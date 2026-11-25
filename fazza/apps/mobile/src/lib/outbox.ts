/**
 * Offline outbox: orders created without connectivity are stored locally and sent
 * automatically when the connection returns. The client-generated order id makes
 * retries idempotent on the server (create_order returns the existing order).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { FzError, rpc } from "./api";
import { uploadImage } from "./upload";

const KEY = "fazza.outbox.v1";

export interface PendingOrder {
  id: string;
  userId: string;
  payload: Record<string, unknown>;
  localImages: string[];
  createdAt: string;
  attempts: number;
  lastError?: string;
}

type Listener = (items: PendingOrder[]) => void;
const listeners = new Set<Listener>();
let cache: PendingOrder[] | null = null;
let flushing = false;

async function load(): Promise<PendingOrder[]> {
  if (cache) return cache;
  try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]"); } catch { cache = []; }
  return cache!;
}
async function save(items: PendingOrder[]) {
  cache = items;
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l(items));
}

export function subscribeOutbox(l: Listener): () => void {
  listeners.add(l);
  load().then(l);
  return () => listeners.delete(l);
}

export async function enqueueOrder(item: Omit<PendingOrder, "attempts" | "createdAt">) {
  const items = await load();
  if (!items.some((i) => i.id === item.id)) {
    await save([...items, { ...item, attempts: 0, createdAt: new Date().toISOString() }]);
  }
}

export async function removeFromOutbox(id: string) {
  await save((await load()).filter((i) => i.id !== id));
}

/** Uploads images, then creates the order. Throws FzError on failure. */
export async function sendOrder(item: Pick<PendingOrder, "id" | "userId" | "payload" | "localImages">): Promise<string> {
  const paths: string[] = [];
  for (let i = 0; i < item.localImages.length; i++) {
    const path = `orders/${item.userId}/${item.id}/${i + 1}.jpg`;
    await uploadImage("order-files", path, item.localImages[i]);
    paths.push(path);
  }
  return rpc<string>("create_order", { p: { ...item.payload, id: item.id, image_paths: paths } });
}

export async function flushOutbox(userId: string | undefined): Promise<void> {
  if (flushing || !userId) return;
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return;
  flushing = true;
  try {
    for (const item of await load()) {
      if (item.userId !== userId) continue;
      try {
        await sendOrder(item);
        await removeFromOutbox(item.id);
      } catch (e) {
        const code = e instanceof FzError ? e.code : "FZ_SERVER_ERROR";
        const items = await load();
        // Permanent validation errors are dropped from the queue and surfaced to the user.
        const permanent = !["FZ_NETWORK", "FZ_SERVER_ERROR", "FZ_RATE_LIMITED", "FZ_MAINTENANCE"].includes(code);
        await save(items.map((x) => (x.id === item.id ? { ...x, attempts: x.attempts + 1, lastError: code } : x))
          .filter((x) => !(permanent && x.id === item.id && x.attempts >= 1)));
        if (code === "FZ_NETWORK") break;
      }
    }
  } finally {
    flushing = false;
  }
}
