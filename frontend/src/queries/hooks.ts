import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getMe } from "../services/authServices";
import { getProjectActivity, getProjectAnalytics, getProjectById, getProjectRisk } from "../services/projectServices";
import type { ActivityCategory } from "../services/projectServices";
import { getTaskById } from "../services/taskServices";
import { getNotifications, getUnreadCount } from "../services/notificationServices";
import { getAllUsers } from "../services/userServices";
import { loginAction, logoutAction } from "../redux/actions/authActions";
import { qk } from "./keys";
import { NotSignedInError, unwrap } from "./unwrap";

export const UNREAD_POLL_MS = 30_000;

/** The signed-in user. Rejects with NotSignedInError when there is no valid session. */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const res = await getMe(); // null = 401
      if (res === null) throw new NotSignedInError();
      return unwrap(res);
    },
    staleTime: 60_000,
  });
}

/**
 * For pages that need a login: keeps the Redux copy of the profile (still read by many components)
 * in step with the cache, and sends signed-out visitors to the login page.
 */
export function useRequireMe() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const query = useMe();

  useEffect(() => {
    if (query.data) dispatch(loginAction(query.data));
  }, [query.data, dispatch]);

  useEffect(() => {
    if (query.error instanceof NotSignedInError) {
      dispatch(logoutAction());
      navigate("/login");
    }
  }, [query.error, dispatch, navigate]);

  return query;
}

export function useProject(projectId: string | null | undefined) {
  return useQuery({
    queryKey: qk.project(projectId ?? ""),
    queryFn: async () => unwrap(await getProjectById(projectId as string)),
    enabled: !!projectId,
  });
}

export function useTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: qk.task(taskId ?? ""),
    queryFn: async () => unwrap(await getTaskById(taskId as string)),
    enabled: !!taskId,
  });
}

export function useProjectRisk(projectId: string) {
  return useQuery({
    queryKey: qk.risk(projectId),
    queryFn: async () => unwrap(await getProjectRisk(projectId)),
  });
}

/** `enabled` lets the Insights tab load only when someone actually opens it. */
export function useProjectAnalytics(projectId: string, enabled = true) {
  return useQuery({
    queryKey: qk.analytics(projectId),
    queryFn: async () => unwrap(await getProjectAnalytics(projectId)),
    enabled,
  });
}

export interface ActivityPage {
  items: any[];
  nextCursor: string | null;
}

export function useProjectActivity(projectId: string, category: ActivityCategory | "all", pageSize = 20) {
  return useInfiniteQuery({
    queryKey: qk.activity(projectId, category),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ActivityPage> =>
      unwrap(
        await getProjectActivity(projectId, {
          limit: pageSize,
          ...(pageParam ? { before: pageParam } : {}),
          ...(category !== "all" ? { category } : {}),
        })
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export interface NotificationPage extends ActivityPage {
  unreadCount: number;
}

export function useNotificationList(unreadOnly: boolean, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: qk.notificationList(unreadOnly),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<NotificationPage> =>
      unwrap(await getNotifications({ limit: pageSize, unread: unreadOnly, ...(pageParam ? { before: pageParam } : {}) })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * The bell's badge. One shared query: both nav bars use it, so there is a single request every 30 s,
 * automatically paused while the tab is hidden and refreshed as soon as it is visible again.
 */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: qk.unreadCount,
    queryFn: async () => (unwrap(await getUnreadCount()) as { count: number }).count,
    enabled,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: 10_000,
  });
}

/** Everyone who can be added to a project (public fields only). Cached, so reopening the picker is instant. */
export function useUserDirectory(enabled = true) {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => unwrap<any[]>(await getAllUsers()),
    enabled,
  });
}
