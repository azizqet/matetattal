import React, { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { fonts } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { T } from "./T";

export interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  prefix?: string;
  password?: boolean;
}

export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, FieldProps>(function TextField(
  { label, error, hint, icon, prefix, password, style, multiline, ...rest }, ref,
) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" w="semibold" color="muted">{label}</T> : null}
      <View style={[styles.box, {
        borderRadius: radius.md, backgroundColor: colors.surface,
        borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
        minHeight: multiline ? 110 : 54, alignItems: multiline ? "flex-start" : "center",
      }]}>
        {icon ? <View style={{ paddingTop: multiline ? 14 : 0 }}><Icon name={icon} size={20} color={colors.textFaint} /></View> : null}
        {prefix ? <T w="semibold" color="muted" style={{ writingDirection: "ltr" }}>{prefix}</T> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={password ? hidden : undefined}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, { color: colors.text, fontFamily: fonts.regular, textAlignVertical: multiline ? "top" : "center", paddingTop: multiline ? 12 : 0 }, style]}
          {...rest}
        />
        {password ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel="toggle password">
            <Icon name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <T v="caption" color="danger">{error}</T> : hint ? <T v="caption" color="faint">{hint}</T> : null}
    </View>
  );
});

export function PhoneField(props: Omit<FieldProps, "prefix" | "keyboardType">) {
  return <TextField {...props} prefix="+965" keyboardType="phone-pad" maxLength={11} textContentType="telephoneNumber" autoComplete="tel" style={{ writingDirection: "ltr", textAlign: "left" }} />;
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", borderWidth: 1.5, paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, minWidth: 0, fontSize: 15.5, minHeight: 50, textAlign: "auto" },
});
