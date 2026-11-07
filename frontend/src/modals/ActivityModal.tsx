import {
  AttachFile,
  CheckCircleOutline,
  Close,
  Comment,
  Folder,
  Group,
  Refresh,
} from "@mui/icons-material";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import ModalOverlay from "../common/ModalOverlay";
import NoDataMessage from "../common/NoDataMessage";
import { ActivityItem, describeActivity, groupByDay } from "../helper/activity";
import type { ActivityCategory } from "../services/projectServices";
import { useProjectActivity } from "../queries/hooks";
import { errorMessage } from "../services/apiClient";

const FILTERS: { key: ActivityCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "task", label: "Tasks" },
  { key: "comment", label: "Comments" },
  { key: "file", label: "Files" },
  { key: "member", label: "Members" },
  { key: "project", label: "Project" },
];

const ICON: Record<string, React.ReactElement> = {
  task: <CheckCircleOutline sx={{ fontSize: 14 }} />,
  comment: <Comment sx={{ fontSize: 14 }} />,
  file: <AttachFile sx={{ fontSize: 14 }} />,
  member: <Group sx={{ fontSize: 14 }} />,
  project: <Folder sx={{ fontSize: 14 }} />,
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ActivityModal({ activeProject, setActivityModal }: any) {
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");

  // Each filter is its own cached feed, so flipping back to one you have seen is instant.
  const feed = useProjectActivity(activeProject._id, filter);
  const items: ActivityItem[] = feed.data?.pages.flatMap((p) => p.items as ActivityItem[]) ?? [];
  const status: "loading" | "ready" | "error" = feed.data ? "ready" : feed.isError ? "error" : "loading";
  const error = feed.isError ? errorMessage(feed.error, "Could not load activity.") : null;
  const groups = groupByDay(items);

  return (
    <ModalOverlay onClose={() => setActivityModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[95%] max-w-[720px] h-[85vh] flex flex-col shadow-xl text-C11">
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="font-bold text-[20px] text-C11">{`${activeProject?.projectName || "Project"} · Activity`}</div>
          <div className="flex flex-row items-center gap-3">
            <button className="cursor-pointer" onClick={() => feed.refetch()} aria-label="Refresh activity">
              <Refresh sx={{ fontSize: 20 }} />
            </button>
            <button className="cursor-pointer" onClick={() => setActivityModal(false)} aria-label="Close">
              <Close sx={{ fontSize: 20, fontWeight: 800 }} />
            </button>
          </div>
        </div>

        <div role="group" aria-label="Filter activity" className="flex flex-row flex-wrap gap-1 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-[6px] font-bold text-[10px] py-1 px-2 ${filter === f.key ? "bg-[#012b3927] text-C11" : "text-gray-500"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {status === "loading" && <div className="py-10 text-center text-[12px] text-gray-500">Loading activity...</div>}

          {status === "error" && (
            <div role="alert" className="flex flex-col items-center gap-2 py-10 text-[12px] text-highPriority font-semibold">
              <div>{error}</div>
              <button onClick={() => feed.refetch()} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-1 px-4">
                Retry
              </button>
            </div>
          )}

          {status === "ready" && items.length === 0 && (
            <div className="mt-[15%]">
              <NoDataMessage size="small" message={filter === "all" ? "No activity yet" : "No activity of this type yet"} />
            </div>
          )}

          {status === "ready" &&
            groups.map((group) => (
              <section key={group.label} aria-label={group.label} className="mb-3">
                <h3 className="sticky top-0 bg-C55 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">{group.label}</h3>
                <ul className="flex flex-col">
                  {group.items.map((item) => {
                    const t = describeActivity(item);
                    return (
                      <li key={item._id} className="flex flex-row gap-3 py-2 border-b border-C44 last:border-0">
                        <span
                          title={item.actorName}
                          className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-C11 text-white text-[10px] font-semibold shrink-0"
                        >
                          {initials(item.actorName)}
                        </span>
                        <div className="flex flex-col min-w-0 flex-1 text-[12px]">
                          <div className="break-words">
                            <span className="font-bold">{item.actorName}</span> {t.lead}
                            {t.subject && (
                              <>
                                {" "}
                                {t.taskId ? (
                                  <Link to={`/task-page?id=${t.taskId}`} className="font-semibold hover:underline underline-offset-2">
                                    {t.subject}
                                  </Link>
                                ) : (
                                  <span className="font-semibold">{t.subject}</span>
                                )}
                              </>
                            )}
                            {t.trail && <> {t.trail}</>}
                          </div>
                          {t.detail && <div className="text-gray-500 break-words mt-[2px]">{t.detail}</div>}
                        </div>
                        <div className="flex flex-row items-start gap-2 text-gray-500 shrink-0">
                          <span className="mt-[2px]" aria-hidden>
                            {ICON[item.category]}
                          </span>
                          <time dateTime={item.createdAt} title={moment(item.createdAt).format("LLLL")} className="text-[10px] font-semibold whitespace-nowrap">
                            {moment(item.createdAt).fromNow()}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

          {status === "ready" && feed.hasNextPage && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="bg-C44 hover:bg-[#012b3927] disabled:opacity-50 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-6"
              >
                {feed.isFetchingNextPage ? "Loading..." : "Load older activity"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default ActivityModal;
