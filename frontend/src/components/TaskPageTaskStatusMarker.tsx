import { Comment, Done, DonutLarge, Edit, Replay } from "@mui/icons-material";
import React, { useEffect, useRef, useState } from "react";
import { colors } from "../Constants";
import ErrorBox from "../common/ErrorBox";
import NoDataMessage from "../common/NoDataMessage";
import {addCommentToTaskById } from "../services/taskServices";
import { errorMessage } from "../services/apiClient";
import moment from "moment";

function TaskPageTaskStatusMarker(props: any) {
  const { activeTask, myProfiledata, setTaskStatusModal, triggerRerender } =
    props;
    const commentsContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [postCommentStatus, setPostCommentStatus] =
    useState<string>("not-posted");

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = { messageContent: "" };

  const [taskCommentFormData, setTaskCommentFormData] = useState(emptyState);

  const validateBeforeSubmit = () => {
    if (!taskCommentFormData.messageContent.trim()) {
      setError("Cannot post an empty comment");
      return false;
    }
    return true;
  };

  const handleInputChange = (e: any) => {
    setTaskCommentFormData({
      ...taskCommentFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!validateBeforeSubmit()) return;
    setPostCommentStatus("post-loading");
    const res: any = await addCommentToTaskById(activeTask?._id, taskCommentFormData);
    if (res?.addStatus) {
      setPostCommentStatus("not-posted");
      setTaskCommentFormData(emptyState);
      triggerRerender();
    } else {
      setError(errorMessage(res, "Comment Could Not be Posted"));
      setPostCommentStatus("post-failure");
    }
  };

  useEffect(() => {
    // Scroll to the bottom of the comments container after rendering
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
    }
  }, [activeTask?.taskComments]);

  return (
    <>
      <div className=" w-full h-[300px] md:mt-5 ">
        <div>
          <div className="text-C11 text-[12px] font-semibold p-1 flex flex-row gap-2 items-center">
            <Comment sx={{ fontSize: 20, color: colors.C11 }} />
            <span>Comments</span>
          </div>

          <div className="flex flex-col gap-3 my-1 bg-gray-50 min-h-[200px] items-center md:min-h-[300px] overflow-y-auto p-2 max-h-[300px]" ref={commentsContainerRef}>
            {activeTask?.taskComments.map((node: any) => (
              <React.Fragment key={node._id}>
                {node?.senderId === myProfiledata?._id ? (
                  <div className="flex flex-col group text-[12px] max-w-full break-words hover:bg-C44 cursor-pointer transition-all p-2 w-full border-r-4 hover:border-C11 ">
                    <div
                      className={`min-w-[10px] group-hover:min-w-[80px]  duration-200 flex  text-right flex-row-reverse justify-between w-full items-center  rounded-[4px] group-hover:rounded-l-[4px] group-hover:rounded-r-[0px] `}
                    >
                      <div className=" text-C11 font-bold group-hover:flex duration-[1s] text-[10px] ">
                        {node?.senderName}
                      </div>
                      <div className="text-[8px] font-medium">
                        {moment(node?.timeStamp).format("lll")}
                      </div>
                    </div>
                    <div className="flex items-center justify-end ">
                      {/* <Person sx={{ fontSize: 10, color: colors.C22 }} /> */}
                      <div className="break-words text-C11 bg-gray-200 px-[4px] rounded-[2px]">
                        {node?.messageContent}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col group text-[12px] max-w-full break-words hover:bg-C44 cursor-pointer transition-all p-2 w-full border-l-4 hover:border-C11 ">
                    <div
                      className={`min-w-[10px] group-hover:min-w-[80px]  duration-200 flex  text-left flex-row justify-between w-full items-center  rounded-[4px] group-hover:rounded-l-[4px] group-hover:rounded-r-[0px] `}
                    >
                      <div className=" text-C11 font-bold group-hover:flex duration-[1s] text-[10px] ">
                        {node?.senderName}
                      </div>
                      <div className="text-[8px] font-medium">
                        {moment(node?.timeStamp).format("lll")}
                      </div>
                    </div>
                    <div className="flex items-center ">
                      {/* <Person sx={{ fontSize: 10, color: colors.C22 }} /> */}
                      <div className="break-words text-C11 bg-gray-200 px-[4px] rounded-[2px]">
                        {node?.messageContent}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {activeTask?.taskComments.length === 0 && (
              <div className="w-full  mt-[18%]">
                <NoDataMessage message={"No Comments"} size="small" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col ">
          <div className=" text-C11 text-[12px] font-bold  w-fit py-1 flex flex-row gap-1 items-center ">
            <Edit sx={{ fontSize: 15, color: colors.C11 }} />
            <div>Leave a comment</div>
          </div>
          <textarea
            rows={4}
            className="bg-C44 resize-none   rounded-[4px] p-2 text-[14px]"
            placeholder="Type a message"
            name="messageContent"
            id="messageContent"
            value={taskCommentFormData.messageContent}
            onChange={handleInputChange}
          />
          <div className="flex justify-end py-2">
            <button
              disabled={postCommentStatus === "post-loading"?true:false}
              onClick={handleSubmit}
              className={`hover:bg-[#09171c]  rounded-[4px] disabled:cursor-not-allowed bg-[#012B39]  text-white font-semibold text-[12px] py-1 px-5 `}
            >
              {postCommentStatus === "post-loading" ? "Posting ..." : "Post"}
            </button>
          </div>
          {error ? <ErrorBox message={error} /> : null}
        </div>

        
        {activeTask?.assignedTo._id === myProfiledata?._id ? (
          <div className="flex flex-col pb-5 mt-2 md:mt-4 md:pb-0">
            <div className=" text-C11 text-[12px] font-bold  w-fit py-1 flex flex-row gap-1 items-center ">
              <DonutLarge sx={{ fontSize: 15, color: colors.C11 }} />
              <div>Update Status</div>
            </div>
            <button
              onClick={() => setTaskStatusModal(true)}
              className="text-C11 border-2 border-C11 transition duration-300  hover:text-C55  justify-between text-[14px] font-bold hover:bg-C11  rounded-[4px] py-2 px-4 w-full flex flex-row gap-1 items-center "
            >
              <span>{`${
                activeTask?.taskStatus === "In Progress"
                  ? "Mark as Complete"
                  : "Mark as In Progress"
              }`}</span>
              {activeTask?.taskStatus === "In Progress" ? <Done /> : <Replay />}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default TaskPageTaskStatusMarker;
