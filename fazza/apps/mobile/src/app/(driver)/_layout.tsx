import { Redirect } from "expo-router";
import { AppTabs } from "@/features/TabBar";
import { useDriverLocationSharing } from "@/features/driver/useLocationSharing";
import { useUnreadCount } from "@/features/useUnread";
import { useAuth } from "@/providers/AuthProvider";

export default function DriverTabs() {
  const { session, ready, driver } = useAuth();
  const unread = useUnreadCount();
  useDriverLocationSharing();
  if (ready && !session) return <Redirect href="/welcome" />;
  if (ready && session && !driver) return <Redirect href="/driver/apply" />;
  return (
    <AppTabs tabs={[
      { name: "dashboard", label: "tabs.dashboard", icon: "speedometer-outline", iconActive: "speedometer" },
      { name: "requests", label: "tabs.requests", icon: "map-outline", iconActive: "map" },
      { name: "wallet", label: "tabs.wallet", icon: "wallet-outline", iconActive: "wallet" },
      { name: "driver-alerts", label: "tabs.notifications", icon: "notifications-outline", iconActive: "notifications", badge: unread },
      { name: "driver-account", label: "tabs.account", icon: "person-circle-outline", iconActive: "person-circle" },
    ]} />
  );
}
