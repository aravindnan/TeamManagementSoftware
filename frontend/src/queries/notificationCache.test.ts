import { QueryClient } from "@tanstack/react-query";
import { makeTestClient } from "../testUtils";
import { qk } from "./keys";
import { adjustUnreadCount, markAllReadInCache, markReadInCache } from "./notificationCache";

const NOW = "2026-11-10T12:00:00.000Z";
const inbox = (items: any[]) => ({ pages: [{ items, nextCursor: null, unreadCount: 0 }], pageParams: [undefined] });
const itemsOf = (client: QueryClient, key: readonly unknown[]) => (client.getQueryData(key) as any).pages.flatMap((p: any) => p.items);
let client: QueryClient;

beforeEach(() => {
  client = makeTestClient();
  client.setQueryData(qk.notificationList(false), inbox([{ _id: "a" }, { _id: "b" }, { _id: "c", readAt: "2026-01-01T00:00:00.000Z" }]));
  client.setQueryData(qk.notificationList(true), inbox([{ _id: "a" }, { _id: "b" }]));
  client.setQueryData(qk.unreadCount, 2);
});

describe("markReadInCache", () => {
  test("marks the notification read in every cached list, leaving the others alone", () => {
    markReadInCache(client, "a", NOW);
    expect(itemsOf(client, qk.notificationList(false)).map((n: any) => n.readAt)).toEqual([NOW, undefined, "2026-01-01T00:00:00.000Z"]);
    expect(itemsOf(client, qk.notificationList(true))[0].readAt).toBe(NOW);
    expect(itemsOf(client, qk.notificationList(true))[1].readAt).toBeUndefined();
  });
  test("never rewrites the read time of something already read", () => {
    markReadInCache(client, "c", NOW);
    expect(itemsOf(client, qk.notificationList(false))[2].readAt).toBe("2026-01-01T00:00:00.000Z");
  });
  test("an unknown id, or nothing cached, is harmless", () => {
    markReadInCache(client, "zzz", NOW);
    expect(itemsOf(client, qk.notificationList(false)).filter((n: any) => n.readAt)).toHaveLength(1);
    expect(() => markReadInCache(makeTestClient(), "a", NOW)).not.toThrow();
  });
  test("does not touch the unread-count query", () => {
    markReadInCache(client, "a", NOW);
    expect(client.getQueryData(qk.unreadCount)).toBe(2);
  });
});

describe("markAllReadInCache", () => {
  test("marks everything read in every list", () => {
    markAllReadInCache(client, NOW);
    for (const unreadOnly of [false, true]) {
      expect(itemsOf(client, qk.notificationList(unreadOnly)).every((n: any) => !!n.readAt)).toBe(true);
    }
    expect(itemsOf(client, qk.notificationList(false))[2].readAt).toBe("2026-01-01T00:00:00.000Z"); // unchanged
  });
});

describe("adjustUnreadCount", () => {
  test("adds the delta and never goes below zero", () => {
    adjustUnreadCount(client, -1);
    expect(client.getQueryData(qk.unreadCount)).toBe(1);
    adjustUnreadCount(client, -5);
    expect(client.getQueryData(qk.unreadCount)).toBe(0);
    adjustUnreadCount(client, 3);
    expect(client.getQueryData(qk.unreadCount)).toBe(3);
  });
  test("treats a missing count as zero", () => {
    const empty = makeTestClient();
    adjustUnreadCount(empty, -1);
    expect(empty.getQueryData(qk.unreadCount)).toBe(0);
  });
});
