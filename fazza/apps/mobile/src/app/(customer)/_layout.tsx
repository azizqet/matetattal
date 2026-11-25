import { Redirect } from "expo-router";
import { AppTabs } from "@/features/TabBar";
import { useUnreadCount } from "@/features/useUnread";
import { useAuth } from "@/providers/AuthProvider";

export default function CustomerTabs() {
  const { session, ready } = useAuth();
  const unread = useUnreadCount();
  if (ready && !session) return <Redirect href="/welcome" />;
  return (
    <AppTabs tabs={[
      { name: "home", label: "tabs.home", icon: "home-outline", iconActive: "home" },
      { name: "orders", label: "tabs.orders", icon: "receipt-outline", iconActive: "receipt" },
      { name: "notifications", label: "tabs.notifications", icon: "notifications-outline", iconActive: "notifications", badge: unread },
      { name: "account", label: "tabs.account", icon: "person-circle-outline", iconActive: "person-circle" },
    ]} />
  );
}
