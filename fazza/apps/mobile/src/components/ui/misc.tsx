import { Image } from "expo-image";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { T } from "./T";
import { TextField } from "./TextField";

export function Row({ icon, title, subtitle, right, onPress, danger, testID }: {
  icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }}>
          <Icon name={icon} size={20} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T w="semibold" color={danger ? "danger" : "text"}>{title}</T>
        {subtitle ? <T v="small" color="muted">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export function EmptyState({ title, body, art, action }: { title: string; body?: string; art?: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 28, gap: 10 }}>
      {art}
      <T v="h3" center>{title}</T>
      {body ? <T color="muted" center>{body}</T> : null}
      {action}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <T color="muted">{label}</T> : null}
    </View>
  );
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i} stars`}>
          <Icon name={i <= Math.round(value) ? "star" : "star-outline"} size={size} color={i <= Math.round(value) ? "#F5B400" : colors.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

export function Avatar({ uri, name, size = 48 }: { uri?: string | null; name?: string; size?: number }) {
  const { colors } = useTheme();
  const initials = (name ?? "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" /> : <T w="bold" color="primary" style={{ fontSize: size * 0.36 }}>{initials}</T>}
    </View>
  );
}

export function Chips<V extends string>({ options, value, onChange, testIDPrefix }: {
  options: { value: V; label: string; icon?: IconName }[]; value: V | null; onChange: (v: V) => void; testIDPrefix?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
              backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}>
            {o.icon ? <Icon name={o.icon} size={16} color={on ? "#fff" : colors.textMuted} /> : null}
            <T v="small" w="semibold" color={on ? "white" : "text"}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.border }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: on ? colors.primary : "transparent" }}>
            <T v="small" w="bold" color={on ? "white" : "muted"}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({ tone = "primary", icon = "information-circle", title, body, action }: {
  tone?: "primary" | "warning" | "danger" | "success"; icon?: IconName; title: string; body?: string; action?: ReactNode;
}) {
  const { colors, radius } = useTheme();
  const bg = { primary: colors.primarySoft, warning: colors.warningSoft, danger: colors.dangerSoft, success: colors.successSoft }[tone];
  const fg = { primary: colors.primary, warning: colors.warning, danger: colors.danger, success: colors.success }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Icon name={icon} size={22} color={fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <T w="bold" color={fg}>{title}</T>
          {body ? <T v="small" color="muted">{body}</T> : null}
        </View>
      </View>
      {action}
    </View>
  );
}

/** Modal asking for a text value (e.g. cancellation reason, password). */
export function PromptModal({ visible, title, body, placeholder, confirmLabel, danger, password, required = true, onCancel, onConfirm }: {
  visible: boolean; title: string; body?: string; placeholder?: string; confirmLabel?: string; danger?: boolean; password?: boolean;
  required?: boolean; onCancel: () => void; onConfirm: (value: string) => Promise<void> | void;
}) {
  const { colors, radius } = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 14 }}>
          <T v="h3">{title}</T>
          {body ? <T color="muted">{body}</T> : null}
          <TextField value={value} onChangeText={setValue} placeholder={placeholder} password={password} multiline={!password} autoFocus />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button style={{ flex: 1 }} kind="ghost" title={t("common.cancel")} onPress={() => { setValue(""); onCancel(); }} />
            <Button style={{ flex: 1 }} kind={danger ? "danger" : "primary"} title={confirmLabel ?? t("common.confirm")} loading={busy}
              disabled={required && !value.trim()}
              onPress={async () => { setBusy(true); try { await onConfirm(value.trim()); setValue(""); } finally { setBusy(false); } }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ImageTile({ uri, label, onPress, onRemove, size = 96, testID }: { uri?: string | null; label?: string; onPress?: () => void; onRemove?: () => void; size?: number; testID?: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: radius.md, overflow: "hidden", borderWidth: 1.5, borderStyle: uri ? "solid" : "dashed",
        borderColor: uri ? colors.border : colors.primary, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", padding: 4 }}>
      {uri ? <Image source={{ uri }} style={{ position: "absolute", width: size, height: size }} contentFit="cover" /> : (
        <>
          <Icon name="camera-outline" size={24} color={colors.primary} />
          {label ? <T v="caption" color="primary" center numberOfLines={2}>{label}</T> : null}
        </>
      )}
      {uri && onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="remove" style={{ position: "absolute", top: 4, end: 4, backgroundColor: "#0008", borderRadius: 12, padding: 2 }}>
          <Icon name="close" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function Stat({ label, value, icon, tone = "primary" }: { label: string; value: string; icon?: IconName; tone?: "primary" | "success" | "warning" | "danger" }) {
  const { colors, radius } = useTheme();
  const fg = { primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border }}>
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <T v="h3" w="bold" style={{ writingDirection: "ltr" }}>{value}</T>
      <T v="caption" color="muted">{label}</T>
    </View>
  );
}
