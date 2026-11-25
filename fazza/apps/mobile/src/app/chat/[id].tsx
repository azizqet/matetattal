import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Header, Icon, T } from "@/components/ui";
import { PhotoStrip } from "@/features/OrderParts";
import { rpc } from "@/lib/api";
import { useErrorAlert, useLang } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { OrderDetail } from "@/lib/types";
import { chooseImageSource, pickImage, randomId, uploadImage } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/colors";

interface Msg { id: string; order_id: string; sender_id: string | null; body: string | null; image_path: string | null; created_at: string; read_at: string | null }

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Msg>>(null);

  const order = useQuery({ queryKey: ["order", id], queryFn: () => rpc<OrderDetail>("get_order", { p_order: id }) });
  const msgs = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => ((await supabase.from("messages").select("*").eq("order_id", id).order("created_at")).data ?? []) as Msg[],
  });

  useEffect(() => {
    rpc("mark_messages_read", { p_order: id }).catch(() => undefined);
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${id}` }, (p) => {
        qc.setQueryData<Msg[]>(["messages", id], (old) => (old?.some((m) => m.id === (p.new as Msg).id) ? old : [...(old ?? []), p.new as Msg]));
        rpc("mark_messages_read", { p_order: id }).catch(() => undefined);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const o = order.data;
  const open = o && ["accepted", "picked_up", "delivered"].includes(o.status);
  const other = o?.role === "customer" ? o.driver : o?.customer;

  const send = async (imagePath?: string) => {
    const body = text.trim();
    if (!body && !imagePath) return;
    setSending(true);
    const mid = randomId();
    try {
      const { error } = await supabase.from("messages").insert({ id: mid, order_id: id, sender_id: me, body: body || null, image_path: imagePath ?? null });
      if (error) throw error;
      setText("");
      qc.setQueryData<Msg[]>(["messages", id], (old) => (old?.some((m) => m.id === mid) ? old : [...(old ?? []),
        { id: mid, order_id: id, sender_id: me ?? null, body: body || null, image_path: imagePath ?? null, created_at: new Date().toISOString(), read_at: null }]));
    } catch (e) { showError(e); } finally { setSending(false); }
  };

  const sendImage = async () => {
    const src = await chooseImageSource();
    if (!src) return;
    const uri = await pickImage(src);
    if (!uri) return;
    try { await send(await uploadImage("order-files", `chat/${id}/${me}/${randomId()}.jpg`, uri)); } catch (e) { showError(e); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title={other?.full_name ?? t("chat.title")} subtitle={o ? `${t("order.code")} ${o.code}` : undefined}
          right={other?.phone ? <Pressable onPress={() => Linking.openURL(`tel:${other.phone}`)} hitSlop={8}><Icon name="call" color={colors.primary} /></Pressable> : undefined} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={list}
          data={msgs.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          renderItem={({ item: m }) => {
            const mine = m.sender_id === me;
            return (
              <Pressable onLongPress={() => !mine && router.push({ pathname: "/support/new", params: { kind: "report_message", order: id, message: m.id, target: m.sender_id ?? "" } })}
                style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", backgroundColor: mine ? colors.primary : colors.card,
                  borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4, padding: 10, gap: 6, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                {m.image_path ? <PhotoStrip paths={[m.image_path]} /> : null}
                {m.body ? <T color={mine ? "white" : "text"}>{m.body}</T> : null}
                <T v="caption" color={mine ? "#DCE5FF" : "faint"}>
                  {new Date(m.created_at).toLocaleTimeString(lang === "ar" ? "ar-KW" : "en-GB", { hour: "2-digit", minute: "2-digit" })}{mine && m.read_at ? " ✓✓" : ""}
                </T>
              </Pressable>
            );
          }}
        />
        {open ? (
          <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, alignItems: "flex-end" }}>
            <Pressable onPress={sendImage} hitSlop={6} style={{ padding: 10 }}><Icon name="camera-outline" color={colors.primary} /></Pressable>
            <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder={t("chat.placeholder")} placeholderTextColor={colors.textFaint} multiline maxLength={2000}
              style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.regular, borderWidth: 1, borderColor: colors.border, textAlign: "auto" }} />
            <Pressable testID="chat-send" onPress={() => send()} disabled={sending || !text.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: text.trim() ? 1 : 0.5 }}>
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : <T color="muted" center style={{ padding: 16 }}>{t("chat.closed")}</T>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
