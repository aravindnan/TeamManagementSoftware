import { Close, DoneAll } from "@mui/icons-material";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import ModalOverlay from "../common/ModalOverlay";
import NoDataMessage from "../common/NoDataMessage";
import { describeNotification, NotificationItem } from "../helper/notifications";
import { setUnreadAction } from "../redux/actions/notificationActions";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationServices";
import { errorMessage, isApiError } from "../services/apiClient";

const PAGE = 20;
const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase();

function NotificationsModal({ setOpen }: { setOpen: (v: boolean) => void }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const unread: number = useSelector((state: any) => state.notificationReducer.unread);

  const [onlyUnread, setOnlyUnread] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (before?: string) => {
      const id = ++requestId.current;
      const res: any = await getNotifications({ limit: PAGE, unread: onlyUnread, ...(before ? { before } : {}) });
      if (id !== requestId.current) return null; // superseded by a newer request
      if (isApiError(res) || !Array.isArray(res?.items)) throw new Error(errorMessage(res, "Could not load notifications."));
      return res as { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };
    },
    [onlyUnread]
  );

  const loadFirst = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPage();
      if (!page) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      dispatch(setUnreadAction(page.unreadCount));
      setStatus("ready");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, [fetchPage, dispatch]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (!page) return;
      setItems((cur) => [...cur, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    } finally {
      setLoadingMore(false);
    }
  };

  const open = async (n: NotificationItem) => {
    const wasUnread = !n.readAt;
    if (wasUnread) {
      // Optimistic: the row and badge update immediately; the server call follows.
      setItems((cur) => cur.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      dispatch(setUnreadAction(unread - 1));
      markNotificationRead(n._id);
    }
    const { to } = describeNotification(n);
    if (to) {
      setOpen(false);
      navigate(to);
    }
  };

  const markAll = async () => {
    const res: any = await markAllNotificationsRead();
    if (res?.ok) {
      setItems((cur) => cur.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
      dispatch(setUnreadAction(0));
    } else {
      setError(errorMessage(res, "Could not mark notifications as read."));
      setStatus("error");
    }
  };

  const visible = onlyUnread ? items.filter((n) => !n.readAt) : items;

  return (
    <ModalOverlay onClose={() => setOpen(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[560px] h-[80vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="font-bold text-[20px] text-C11">Notifications</div>
          <button className="cursor-pointer" onClick={() => setOpen(false)} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>

        <div className="flex flex-row items-center justify-between pb-2">
          <div role="group" aria-label="Filter notifications" className="flex flex-row gap-1">
            {([[false, "All"], [true, "Unread"]] as [boolean, string][]).map(([val, label]) => (
              <button
                key={label}
                onClick={() => setOnlyUnread(val)}
                aria-pressed={onlyUnread === val}
                className={`rounded-[6px] font-bold text-[10px] py-1 px-2 ${onlyUnread === val ? "bg-[#012b3927] text-C11" : "text-gray-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={markAll}
            disabled={unread === 0}
            className="flex flex-row items-center gap-1 text-[11px] font-bold text-C22 hover:text-C11 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            <DoneAll sx={{ fontSize: 14 }} />
            Mark all as read
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {status === "loading" && <div className="py-10 text-center text-[12px] text-gray-500">Loading notifications...</div>}

          {status === "error" && (
            <div role="alert" className="flex flex-col items-center gap-2 py-10 text-[12px] text-highPriority font-semibold">
              <div>{error}</div>
              <button onClick={loadFirst} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-1 px-4">
                Retry
              </button>
            </div>
          )}

          {status === "ready" && visible.length === 0 && (
            <div className="mt-[20%]">
              <NoDataMessage size="small" message={onlyUnread ? "You're all caught up" : "No notifications yet"} />
            </div>
          )}

          {status === "ready" && (
            <ul className="flex flex-col">
              {visible.map((n) => {
                const t = describeNotification(n);
                const isUnread = !n.readAt;
                return (
                  <li key={n._id}>
                    <button
                      onClick={() => open(n)}
                      className={`w-full text-left flex flex-row gap-3 p-2 rounded-[6px] hover:bg-C44 ${isUnread ? "bg-white" : ""}`}
                    >
                      <span className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-C11 text-white text-[10px] font-semibold shrink-0">
                        {initials(n.actorName)}
                      </span>
                      <span className="flex flex-col min-w-0 flex-1 text-[12px]">
                        <span className="break-words">
                          <span className="font-bold">{n.actorName}</span> {t.lead}
                          {t.subject && <span className="font-semibold"> {t.subject}</span>}
                          {t.trail && <> {t.trail}</>}
                        </span>
                        {t.detail && <span className="text-gray-500 break-words mt-[2px]">{t.detail}</span>}
                        <span className="text-[10px] text-gray-400 mt-[2px]">
                          {n.projectName ? `${n.projectName} · ` : ""}
                          <time dateTime={n.createdAt} title={moment(n.createdAt).format("LLLL")}>
                            {moment(n.createdAt).fromNow()}
                          </time>
                        </span>
                      </span>
                      {isUnread && <span aria-label="Unread" className="mt-[6px] w-[8px] h-[8px] rounded-full bg-C22 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {status === "ready" && cursor && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-C44 hover:bg-[#012b3927] disabled:opacity-50 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-6"
              >
                {loadingMore ? "Loading..." : "Load older notifications"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default NotificationsModal;
