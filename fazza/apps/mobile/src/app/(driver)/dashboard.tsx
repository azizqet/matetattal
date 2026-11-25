import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";
import { bpsToPercentString, formatKwd } from "@fazza/shared";
import { Banner, Button, Card, Icon, Loading, Screen, Stat, T } from "@/components/ui";
import { OrderCard } from "@/features/OrderCard";
import { useActiveDriverOrders } from "@/features/driver/useLocationSharing";
import { rpc } from "@/lib/api";
import { useDriverDashboard, useErrorAlert, useLang, useSettings } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";

export default function Dashboard() {
  const { t } = useTranslation();
  const lang = useLang();
  const { profile, driver } = useAuth();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const dash = useDriverDashboard(!!driver);
  const settings = useSettings().data;
  const active = useActiveDriverOrders();
  const [toggling, setToggling] = useState(false);
  const d = dash.data;

  if (!d) return <Screen scroll={false}><Loading /></Screen>;

  const toggle = async (v: boolean) => {
    setToggling(true);
    try { await rpc("set_online", { p_online: v }); await qc.invalidateQueries({ queryKey: ["driver-dashboard"] }); }
    catch (e) { showError(e); } finally { setToggling(false); }
  };

  return (
    <Screen refreshing={dash.isRefetching} onRefresh={() => { dash.refetch(); active.refetch(); }}>
      <View style={{ marginTop: 8 }}>
        <T v="small" color="muted">{t("home.greeting", { name: profile?.full_name?.split(" ")[0] ?? "" })}</T>
        <T v="h1">{t("tabs.dashboard")}</T>
      </View>

      {d.status === "pending" ? <Banner icon="time-outline" title={t("driver.pendingTitle")} body={t("driver.pendingBody")} /> : null}
      {d.status === "rejected" ? <Banner tone="danger" icon="close-circle" title={t("driver.rejectedTitle")} body={d.status_reason ?? undefined}
        action={<Button small title={t("driver.resubmit")} onPress={() => router.push("/driver/apply")} />} /> : null}
      {d.status === "suspended" ? <Banner tone="danger" icon="ban" title={t("driver.suspendedTitle")} body={d.status_reason ?? undefined} /> : null}
      {d.status === "approved" && !d.activation_paid ? (
        <Banner tone="warning" icon="card-outline" title={t("driver.activationTitle")} body={t("driver.activationBody", { fee: formatKwd(d.activation_fee_due_fils, lang) })}
          action={<Button small title={t("driver.payNow")} onPress={() => router.push({ pathname: "/driver/receipt", params: { purpose: "activation_fee" } })} />} />
      ) : null}
      {d.block_reason === "debt_limit" ? (
        <Banner tone="danger" icon="alert-circle" title={t("driver.debtTitle")}
          body={t("driver.debtBody", { amount: formatKwd(d.balance_fils, lang), limit: formatKwd(d.debt_limit_fils, lang) })}
          action={<Button small title={t("driver.payNow")} onPress={() => router.push({ pathname: "/driver/receipt", params: { purpose: "commission" } })} />} />
      ) : null}

      <LinearGradient colors={d.is_online ? ["#12B76A", "#0E9F5C"] : ["#3466FF", "#1636B3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" }}>
          <Icon name={d.is_online ? "radio" : "power"} size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T v="h3" color="white">{d.is_online ? t("driver.online") : t("driver.offline")}</T>
          <T v="small" color="#E7EDFF">{d.is_online ? t("driver.goOffline") : t("driver.goOnline")}</T>
        </View>
        <Switch testID="online-switch" value={d.is_online} disabled={toggling || (!d.can_receive && !d.is_online)} onValueChange={toggle}
          trackColor={{ true: "#ffffff80", false: "#ffffff40" }} thumbColor="#fff" />
      </LinearGradient>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Stat icon="today-outline" label={t("driver.todayEarnings")} value={formatKwd(d.today_earned_fils, lang)} tone="success" />
        <Stat icon="calendar-outline" label={t("driver.monthEarnings")} value={formatKwd(d.month_earned_fils, lang)} />
        <Stat icon="checkmark-done-outline" label={t("driver.completed")} value={String(d.completed_count)} />
        <Stat icon="star-outline" label={t("driver.rating")} value={d.rating_avg ? `${d.rating_avg.toFixed(1)} (${d.rating_count})` : "—"} tone="warning" />
      </View>

      <Card onPress={() => router.push("/wallet")}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T w="bold">{t("driver.unpaid")}</T>
          <T v="caption" color="muted">{t("driver.limit", { limit: formatKwd(d.debt_limit_fils, lang) })}</T>
        </View>
        <T v="h2" color={d.balance_fils >= d.debt_limit_fils ? "danger" : "text"} style={{ writingDirection: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{formatKwd(Math.max(d.balance_fils, 0), lang)}</T>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: "#0001", overflow: "hidden" }}>
          <View style={{ width: `${Math.min(100, Math.max(0, (d.balance_fils / Math.max(1, d.debt_limit_fils)) * 100))}%`, height: 8, backgroundColor: d.balance_fils >= d.debt_limit_fils ? "#F04438" : "#1E46D8" }} />
        </View>
        <T v="caption" color="muted">{t("driver.commissionInfo", { pct: bpsToPercentString(settings?.commission_bps ?? d.commission_bps) })}</T>
      </Card>

      <T v="h3">{t("driver.activeOrders")}</T>
      {(active.data ?? []).length === 0 ? <Card flat><T color="muted" center>{t("home.noActive")}</T></Card> :
        (active.data ?? []).map((o) => <OrderCard key={o.id} o={o} onPress={() => router.push({ pathname: "/driver/order/[id]", params: { id: o.id } })} />)}
      <Pressable onPress={() => router.push("/requests")}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="map" />
          <T w="bold" style={{ flex: 1 }}>{t("driver.nearby")}</T>
          <Icon name="chevron-forward" />
        </Card>
      </Pressable>
    </Screen>
  );
}
