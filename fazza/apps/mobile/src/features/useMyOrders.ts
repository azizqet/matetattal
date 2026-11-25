import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRealtimeInvalidate } from "@/lib/hooks";
import { type PendingOrder, subscribeOutbox } from "@/lib/outbox";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

export function useMyOrders() {
  const { session } = useAuth();
  const uid = session?.user.id;
  useRealtimeInvalidate(`my-orders-${uid}`, "orders", `customer_id=eq.${uid}`, [["my-orders"]], !!uid);
  return useQuery({
    queryKey: ["my-orders"],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("customer_id", uid!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useOutbox(): PendingOrder[] {
  const [items, setItems] = useState<PendingOrder[]>([]);
  useEffect(() => subscribeOutbox(setItems), []);
  return items;
}
