import { Redirect } from 'expo-router';

// The centre tab is a button (see TabBar → BulbButton) that opens /post/new.
// This route only exists so the tab has a slot; deep links land on the form.
export default function PostTab() {
  return <Redirect href="/post/new" />;
}
