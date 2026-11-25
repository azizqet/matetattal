import { Tabs } from 'expo-router';
import React from 'react';
import { TabBar } from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
