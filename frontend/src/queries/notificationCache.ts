import type { QueryClient } from "@tanstack/react-query";
import { qk } from "./keys";

const LIST_PREFIX = [...qk.notifications, "list"] as const;

const mapItems = (old: any, fn: (n: any) => any) =>
  old && Array.isArray(old.pages) ? { ...old, pages: old.pages.map((p: any) => ({ ...p, items: p.items.map(fn) })) } : old;

/** Marks one notification read in every cached inbox list, so the UI updates before the server answers. */
export function markReadInCache(client: QueryClient, id: string, now: string = new Date().toISOString()) {
  client.setQueriesData({ queryKey: LIST_PREFIX }, (old: any) => mapItems(old, (n) => (n._id === id && !n.readAt ? { ...n, readAt: now } : n)));
}

export function markAllReadInCache(client: QueryClient, now: string = new Date().toISOString()) {
  client.setQueriesData({ queryKey: LIST_PREFIX }, (old: any) => mapItems(old, (n) => (n.readAt ? n : { ...n, readAt: now })));
}

/** Adjusts the badge by `delta` without ever going below zero. */
export function adjustUnreadCount(client: QueryClient, delta: number) {
  client.setQueryData(qk.unreadCount, (old: number | undefined) => Math.max(0, (old ?? 0) + delta));
}
