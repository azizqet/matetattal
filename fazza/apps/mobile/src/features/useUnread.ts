import { useQuery } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export function useUnreadCount(): number {
  const { session } = useAuth();
  const uid = session?.user.id;
  useRealtimeInvalidate(`notif-${uid}`, "notifications", `user_id=eq.${uid}`, [["unread"], ["notifications"]], !!uid);
  const { data } = useQuery({
    queryKey: ["unread"],
    enabled: !!uid,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      return count ?? 0;
    },
  });
  return data ?? 0;
}
