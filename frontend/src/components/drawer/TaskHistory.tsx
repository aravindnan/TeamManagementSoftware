import React from "react";
import moment from "moment";
import { describeActivity } from "../../helper/activity";
import { useProjectActivity } from "../../queries/hooks";
import { errorMessage } from "../../services/apiClient";

function TaskHistory({ projectId, taskId }: { projectId: string; taskId: string }) {
  const feed = useProjectActivity(projectId, "all", 20, taskId);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  if (feed.isPending) return <p className="text-[12px] text-gray-500">Loading history...</p>;
  if (feed.isError && !feed.data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-[12px] text-highPriority font-semibold">
        {errorMessage(feed.error, "Could not load history.")}
        <button onClick={() => feed.refetch()} className="bg-[#012b39f2] rounded-[8px] text-white font-bold text-[12px] py-1 px-3">
          Retry
        </button>
      </div>
    );
  }
  if (items.length === 0) return <p className="text-[12px] text-gray-500">No history yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {items.map((item: any) => {
          const t = describeActivity(item);
          return (
            <li key={item._id} className="py-2 border-b border-C44 last:border-0 text-[12px]">
              <div className="break-words">
                <span className="font-bold">{item.actorName}</span> {t.lead}
                {t.trail && <> {t.trail}</>}
              </div>
              {t.detail && <div className="text-gray-500 break-words mt-[2px]">{t.detail}</div>}
              <time className="text-[10px] text-gray-400" dateTime={item.createdAt} title={moment(item.createdAt).format("LLLL")}>
                {moment(item.createdAt).fromNow()}
              </time>
            </li>
          );
        })}
      </ul>
      {feed.hasNextPage && (
        <button
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="self-center bg-C44 hover:bg-[#012b3927] disabled:opacity-50 rounded-[8px] text-C11 font-bold text-[12px] py-1 px-4"
        >
          {feed.isFetchingNextPage ? "Loading..." : "Load older history"}
        </button>
      )}
    </div>
  );
}

export default TaskHistory;
