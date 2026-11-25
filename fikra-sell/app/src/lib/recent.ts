import AsyncStorage from '@react-native-async-storage/async-storage';

/** On-device history (never sent to the server): recent searches and viewed categories. */
const SEARCH_KEY = 'fikra.recentSearches';
const CAT_KEY = 'fikra.viewedCategories';

export async function recentSearches(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(SEARCH_KEY)) ?? '[]'); } catch { return []; }
}
export async function addRecentSearch(q: string) {
  const v = q.trim();
  if (v.length < 2) return;
  const list = [v, ...(await recentSearches()).filter((x) => x !== v)].slice(0, 12);
  await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(list));
}
export async function clearRecentSearches() { await AsyncStorage.removeItem(SEARCH_KEY); }

export async function noteCategoryView(mainCategoryId: number) {
  try {
    const m: Record<string, number> = JSON.parse((await AsyncStorage.getItem(CAT_KEY)) ?? '{}');
    m[mainCategoryId] = (m[mainCategoryId] ?? 0) + 1;
    await AsyncStorage.setItem(CAT_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}
export async function topViewedCategory(): Promise<number | null> {
  try {
    const m: Record<string, number> = JSON.parse((await AsyncStorage.getItem(CAT_KEY)) ?? '{}');
    const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    return top ? Number(top[0]) : null;
  } catch { return null; }
}
