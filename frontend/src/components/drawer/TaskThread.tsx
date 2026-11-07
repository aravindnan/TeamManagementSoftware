import React, { useEffect, useRef, useState } from "react";
import moment from "moment";
import { addCommentToTaskById } from "../../services/taskServices";
import { errorMessage } from "../../services/apiClient";

const initials = (name: string = "") =>
  name.split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase();

function TaskThread({ taskId, comments }: { taskId: string; comments: any[] }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [comments.length]);

  const post = async () => {
    if (!text.trim()) {
      setError("Cannot post an empty comment");
      return;
    }
    const message = text;
    setText(""); // anything typed while this posts must not be wiped when it finishes
    setPosting(true);
    setError(null);
    const res: any = await addCommentToTaskById(taskId, { messageContent: message }); // the cache layer appends it
    setPosting(false);
    if (!res?.addStatus) {
      setText((current) => current || message); // give the text back, unless they have started another comment
      setError(errorMessage(res, "Comment could not be posted"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && <p className="text-[12px] text-gray-500">No comments yet. Start the conversation.</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c._id} className="flex flex-row gap-2">
            <span className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-C11 text-white text-[9px] font-semibold shrink-0">
              {initials(c.senderName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px]">
                <span className="font-bold">{c.senderName}</span>{" "}
                <time className="text-gray-500" dateTime={c.timeStamp} title={moment(c.timeStamp).format("LLLL")}>
                  {moment(c.timeStamp).fromNow()}
                </time>
              </div>
              <p className="text-[13px] whitespace-pre-wrap break-words">{c.messageContent}</p>
            </div>
          </li>
        ))}
      </ul>
      <div ref={endRef} />

      <div className="flex flex-col gap-2">
        <textarea
          aria-label="Write a comment"
          value={text}
          rows={3}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              post();
            }
          }}
          placeholder="Write a comment..."
          className="bg-C44 rounded-[6px] p-2 text-[13px] resize-none"
        />
        {error && (
          <div role="alert" className="text-[11px] text-highPriority font-semibold">
            {error}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={post}
            disabled={posting}
            className="bg-[#012b39f2] hover:bg-[#012B39] disabled:opacity-60 rounded-[8px] text-white font-bold text-[12px] py-1 px-4"
          >
            {posting ? "Posting..." : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskThread;
