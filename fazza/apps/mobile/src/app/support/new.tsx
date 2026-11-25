import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { Button, Chips, Header, Screen, T, TextField } from "@/components/ui";
import { rpc } from "@/lib/api";
import { useErrorAlert } from "@/lib/hooks";

type Kind = "support" | "complaint" | "report_user" | "report_message";

export default function NewTicket() {
  const p = useLocalSearchParams<{ kind?: Kind; order?: string; target?: string; message?: string }>();
  const { t } = useTranslation();
  const showError = useErrorAlert();
  const [kind, setKind] = useState<Kind>(p.kind ?? "support");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await rpc("create_ticket", { p_kind: kind, p_subject: subject.trim(), p_body: body.trim(), p_order: p.order || null, p_target_user: p.target || null, p_message: p.message || null });
      Alert.alert(t("support.sent"));
      router.back();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Header title={t("support.newTicket")} />
      <T w="semibold" color="muted">{t("support.kind")}</T>
      <Chips value={kind} onChange={setKind} options={(["support", "complaint", "report_user", "report_message"] as Kind[])
        .filter((k) => (k === "report_message" ? !!p.message : true)).map((k) => ({ value: k, label: t(`support.kind_${k}`) }))} />
      <TextField label={t("support.subject")} value={subject} onChangeText={setSubject} maxLength={120} />
      <TextField label={t("support.body")} value={body} onChangeText={setBody} multiline maxLength={3000} />
      <Button title={t("common.send")} loading={busy} disabled={subject.trim().length < 2 || body.trim().length < 2} onPress={submit} />
    </Screen>
  );
}
