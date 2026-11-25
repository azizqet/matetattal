import { describe, expect, it } from "@jest/globals";
import ar from "./ar";
import en from "./en";

function keys(o: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });
  it("interpolation placeholders match between languages", () => {
    const flat = (o: Record<string, unknown>) => Object.fromEntries(keys(o).map((k) => [k, k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], o)]));
    const fa = flat(ar), fe = flat(en);
    for (const k of Object.keys(fa)) {
      const ph = (s: unknown) => (String(s).match(/{{\w+}}/g) ?? []).sort();
      expect([k, ph(fe[k])]).toEqual([k, ph(fa[k])]);
    }
  });
  it("no empty strings", () => {
    const vals = (o: Record<string, unknown>): unknown[] => Object.values(o).flatMap((v) => (typeof v === "object" && v ? vals(v as Record<string, unknown>) : [v]));
    expect(vals(ar).filter((v) => !String(v).trim())).toEqual([]);
    expect(vals(en).filter((v) => !String(v).trim())).toEqual([]);
  });
});
