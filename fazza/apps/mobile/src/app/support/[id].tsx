import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Header, Screen, T, TextField } from "@/components/ui";
import { rpc } from "@/lib/api";
import { useErrorAlert, useLang } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

export default function Ticket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const ticket = useQuery({ queryKey: ["ticket", id], queryFn: async () => (await supabase.from("tickets").select("*").eq("id", id).single()).data });
  const thread = useQuery({ queryKey: ["ticket-msgs", id], queryFn: async () => (await supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("id")).data ?? [] });
  const tk = ticket.data;
  return (
    <Screen>
      <Header title={tk?.subject ?? t("support.title")} right={tk ? <Badge label={t(`support.status_${tk.status}`)} /> : undefined} />
      {tk ? <Card><T>{tk.body}</T><T v="caption" color="faint">{new Date(tk.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB")}</T></Card> : null}
      {(thread.data ?? []).map((m) => (
        <View key={m.id} style={{ alignSelf: m.from_staff ? "flex-start" : "flex-end", maxWidth: "85%", padding: 12, borderRadius: 16, backgroundColor: m.from_staff ? colors.primarySoft : colors.card, borderWidth: 1, borderColor: colors.border }}>
          {m.from_staff ? <T v="caption" w="bold" color="primary">FAZZA</T> : null}
          <T>{m.body}</T>
        </View>
      ))}
      {tk && (tk.status === "open" || tk.status === "in_progress") ? (
        <>
          <TextField value={reply} onChangeText={setReply} placeholder={t("support.reply")} multiline />
          <Button title={t("common.send")} loading={busy} disabled={!reply.trim()} onPress={async () => {
            setBusy(true);
            try { await rpc("add_ticket_message", { p_ticket: id, p_body: reply.trim() }); setReply(""); qc.invalidateQueries({ queryKey: ["ticket-msgs", id] }); }
            catch (e) { showError(e); } finally { setBusy(false); }
          }} />
        </>
      ) : null}
    </Screen>
  );
}
