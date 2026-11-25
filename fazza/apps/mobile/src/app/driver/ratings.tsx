import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, EmptyState, Header, Screen, Stars, T } from "@/components/ui";
import { rpc } from "@/lib/api";
import { useLang } from "@/lib/hooks";

export default function Ratings() {
  const { t } = useTranslation();
  const lang = useLang();
  const { data } = useQuery({ queryKey: ["my-ratings"], queryFn: () => rpc<{ stars: number; comment: string | null; created_at: string; order_code: string }[]>("my_ratings") });
  return (
    <Screen>
      <Header title={t("driver.ratings")} />
      {(data ?? []).length === 0 ? <EmptyState title={t("driver.noRatings")} /> : (data ?? []).map((r, i) => (
        <Card key={i}>
          <Stars value={r.stars} />
          {r.comment ? <T>{r.comment}</T> : null}
          <T v="caption" color="faint">{r.order_code} · {new Date(r.created_at).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-GB")}</T>
        </Card>
      ))}
    </Screen>
  );
}
