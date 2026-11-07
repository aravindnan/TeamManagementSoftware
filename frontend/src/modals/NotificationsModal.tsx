import { Close, DoneAll } from "@mui/icons-material";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import ModalOverlay from "../common/ModalOverlay";
import NoDataMessage from "../common/NoDataMessage";
import { describeNotification, NotificationItem } from "../helper/notifications";
import { useNotificationList, useUnreadCount } from "../queries/hooks";
import { qk } from "../queries/keys";
import { adjustUnreadCount, markAllReadInCache, markReadInCache } from "../queries/notificationCache";
import { markAllNotificationsRead, markNotificationRead } from "../services/notificationServices";
import { errorMessage } from "../services/apiClient";

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase();

function NotificationsModal({ setOpen }: { setOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useNotificationList(onlyUnread);
  const { data: unread = 0 } = useUnreadCount(true);

  const items: NotificationItem[] = list.data?.pages.flatMap((p) => p.items as NotificationItem[]) ?? [];
  // Rows read in this session stay hidden once the "Unread" filter is on.
  const visible = onlyUnread ? items.filter((n) => !n.readAt) : items;

  const open = (n: NotificationItem) => {
    if (!n.readAt) {
      // Optimistic: row and badge update now; the server call follows and the cache reconciles afterwards.
      markReadInCache(client, n._id);
      adjustUnreadCount(client, -1);
      // Not awaited: the click-through must not wait for the network. If the server refuses, resync.
      markNotificationRead(n._id).then((res: any) => {
        if (!res?.ok) client.invalidateQueries({ queryKey: qk.notifications });
      });
    }
    const { to } = describeNotification(n);
    if (to) {
      setOpen(false);
      navigate(to);
    }
  };

  const markAll = async () => {
    markAllReadInCache(client);
    client.setQueryData(qk.unreadCount, 0);
    const res: any = await markAllNotificationsRead();
    if (!res?.ok) {
      setActionError(errorMessage(res, "Could not mark notifications as read."));
      client.invalidateQueries({ queryKey: qk.notifications });
    } else {
      setActionError(null);
    }
  };

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

        {actionError && (
          <div role="alert" className="mb-2 rounded-[4px] bg-inactiveRed text-highPriority text-[12px] font-semibold px-2 py-1">
            {actionError}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {list.isPending && <div className="py-10 text-center text-[12px] text-gray-500">Loading notifications...</div>}

          {list.isError && !list.data && (
            <div role="alert" className="flex flex-col items-center gap-2 py-10 text-[12px] text-highPriority font-semibold">
              <div>{errorMessage(list.error, "Could not load notifications.")}</div>
              <button onClick={() => list.refetch()} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-1 px-4">
                Retry
              </button>
            </div>
          )}

          {list.data && visible.length === 0 && (
            <div className="mt-[20%]">
              <NoDataMessage size="small" message={onlyUnread ? "You're all caught up" : "No notifications yet"} />
            </div>
          )}

          {list.data && (
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

          {list.hasNextPage && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                className="bg-C44 hover:bg-[#012b3927] disabled:opacity-50 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-6"
              >
                {list.isFetchingNextPage ? "Loading..." : "Load older notifications"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default NotificationsModal;
