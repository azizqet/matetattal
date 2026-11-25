/**
 * Shares the driver's GPS position ONLY while the driver has an active (accepted / picked-up) order.
 * Foreground only; no background location permission is requested.
 */
import { useQuery } from "@tanstack/react-query";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { useEffect } from "react";
import { Platform } from "react-native";
import { rpc } from "@/lib/api";
import { useRealtimeInvalidate } from "@/lib/hooks";
import { ensureLocationPermission } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export function useActiveDriverOrders() {
  const { session } = useAuth();
  const uid = session?.user.id;
  useRealtimeInvalidate(`drv-orders-${uid}`, "orders", `driver_id=eq.${uid}`, [["driver-active"], ["driver-history"]], !!uid);
  return useQuery({
    queryKey: ["driver-active"],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("driver_id", uid!)
        .in("status", ["accepted", "picked_up", "delivered"]).order("accepted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDriverLocationSharing() {
  const { data } = useActiveDriverOrders();
  const tracking = (data ?? []).some((o) => o.status === "accepted" || o.status === "picked_up");
  useEffect(() => {
    if (!tracking || Platform.OS === "web") return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      if (!(await ensureLocationPermission())) return;
      activateKeepAwakeAsync("fazza-tracking").catch(() => undefined);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 8000 },
        (pos) => {
          if (cancelled) return;
          rpc("update_my_location", {
            p_lat: pos.coords.latitude, p_lng: pos.coords.longitude,
            p_heading: pos.coords.heading ?? null, p_speed: pos.coords.speed ?? null, p_accuracy: pos.coords.accuracy ?? null,
          }).catch(() => undefined);
        },
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      deactivateKeepAwake("fazza-tracking");
    };
  }, [tracking]);
}
