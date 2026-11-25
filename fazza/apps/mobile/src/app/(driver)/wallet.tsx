import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { bpsToPercentString, formatKwd } from "@fazza/shared";
import { WalletScene } from "@/components/illustrations/Illustrations";
import { Badge, Button, Card, Divider, Screen, Segmented, Stat, T, TextField, statusTone } from "@/components/ui";
import { rpc } from "@/lib/api";
import { useDriverDashboard, useErrorAlert, useLang, useSettings } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

export default function Wallet() {
  const { t } = useTranslation();
  const lang = useLang();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const dash = useDriverDashboard();
  const s = useSettings().data;
  const [tab, setTab] = useState<"ledger" | "receipts">("ledger");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: async () => (await supabase.from("ledger_entries").select("*").order("id", { ascending: false }).limit(200)).data ?? [] });
  const receipts = useQuery({ queryKey: ["receipts"], queryFn: async () => (await supabase.from("payment_receipts").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const d = dash.data;
  const instructions = s ? (lang === "ar" ? s.payment_instructions_ar : s.payment_instructions_en) : "";

  return (
    <Screen refreshing={ledger.isRefetching} onRefresh={() => { ledger.refetch(); receipts.refetch(); dash.refetch(); }}>
      <T v="h1" style={{ marginTop: 8 }}>{t("driver.wallet")}</T>
      <View style={{ alignItems: "center" }}><WalletScene width={190} /></View>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Stat icon="alert-circle-outline" tone={d && d.balance_fils >= d.debt_limit_fils ? "danger" : "primary"} label={t("driver.balance")} value={formatKwd(Math.max(d?.balance_fils ?? 0, 0), lang)} />
        <Stat icon="checkmark-circle-outline" tone="success" label={t("driver.paid")} value={formatKwd(d?.paid_total_fils ?? 0, lang)} />
        <Stat icon="trending-up-outline" label={t("driver.monthEarnings")} value={formatKwd(d?.month_earned_fils ?? 0, lang)} />
        <Stat icon="cash-outline" label={t("driver.totalEarnings")} value={formatKwd(d?.total_earned_fils ?? 0, lang)} />
      </View>
      <T v="caption" color="muted">{t("driver.commissionInfo", { pct: bpsToPercentString(s?.commission_bps ?? 1500) })}</T>
      <Card>
        <T w="bold">{t("driver.paymentInfo")}</T>
        {instructions ? <T v="small" color="muted">{instructions}</T> : null}
        {s?.payment_link_url ? <Button small kind="secondary" icon="open-outline" title={t("driver.openPaymentLink")} onPress={() => Linking.openURL(s.payment_link_url)} /> : null}
        <Button icon="cloud-upload-outline" title={t("driver.uploadReceipt")}
          onPress={() => router.push({ pathname: "/driver/receipt", params: { purpose: d && !d.activation_paid ? "activation_fee" : "commission" } })} />
        <T v="caption" color="faint">{t("driver.receiptNotAuto")}</T>
      </Card>
      <Card>
        <T w="bold">{t("driver.promo")}</T>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><TextField value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="FAZZA2026" /></View>
          <Button small title={t("driver.redeem")} loading={busy} disabled={!code.trim()} onPress={async () => {
            setBusy(true);
            try { await rpc("redeem_promo", { p_code: code.trim() }); setCode(""); Alert.alert(t("common.success")); qc.invalidateQueries({ queryKey: ["driver-dashboard"] }); ledger.refetch(); }
            catch (e) { showError(e); } finally { setBusy(false); }
          }} />
        </View>
      </Card>
      <Segmented value={tab} onChange={setTab} options={[{ value: "ledger", label: t("driver.ledger") }, { value: "receipts", label: t("driver.receipts") }]} />
      <Card>
        {tab === "ledger" ? (ledger.data ?? []).map((l, i) => (
          <View key={l.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <View>
                <T w="semibold">{t(`driver.ledger_${l.kind}`)}</T>
                <T v="caption" color="muted">{new Date(l.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB")}</T>
              </View>
              <T w="bold" color={l.amount_fils < 0 ? "success" : "text"} style={{ writingDirection: "ltr" }}>{l.amount_fils < 0 ? "−" : "+"}{formatKwd(Math.abs(l.amount_fils), lang)}</T>
            </View>
          </View>
        )) : (receipts.data ?? []).map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <T w="semibold">{t(`driver.purpose_${r.purpose}`)} · {formatKwd(r.approved_amount_fils ?? r.amount_fils, lang)}</T>
                <T v="caption" color="muted">{new Date(r.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB")}{r.review_note ? ` · ${r.review_note}` : ""}</T>
              </View>
              <Badge tone={statusTone(r.status)} label={t(`driver.review_${r.status}`)} />
            </View>
          </View>
        ))}
        {(tab === "ledger" ? ledger.data : receipts.data)?.length === 0 ? <T color="muted" center>—</T> : null}
      </Card>
    </Screen>
  );
}
