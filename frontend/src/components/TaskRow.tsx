import React from "react";
import { Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import moment from "moment";

const priorityBg = (priority?: string) =>
  priority === "High" ? "bg-highPriority" : priority === "Medium" ? "bg-mediumPriority" : "bg-lowPriority";

/** One task line: priority colour bar that expands on hover to show due date and status. */
function TaskRow({ task }: { task: any }) {
  return (
    <Tooltip title="View Task" arrow placement="right">
      <Link to={`/task-page?id=${task._id}`}>
        <div className="flex flex-row group rounded-[4px]  text-[12px] max-w-full break-words hover:bg-C44 cursor-pointer transition-all w-full items-center">
          <div className="flex flex-row flex-1">
            <div
              className={`group-hover:px-2 min-w-[10px] group-hover:min-w-[80px] duration-200 flex justify-center items-center ${priorityBg(
                task?.taskPriority
              )} p-1 rounded-[4px] group-hover:rounded-l-[4px] group-hover:rounded-r-[0px] `}
            >
              <div className="hidden text-C55 font-semibold group-hover:flex duration-[1s]">
                {task?.dueDate ? moment(task.dueDate).format("LL") : "No due date"}
              </div>
            </div>
            <div className="hidden group-hover:flex  min-w-[10px] group-hover:min-w-[80px] duration-200 justify-center items-center p-1   group-hover:rounded-r-[0px] bg-[#dedede] ">
              <div className="hidden text-C11 font-semibold group-hover:flex duration-[1s]">{task?.taskStatus}</div>
            </div>
            <div className="p-2 max-w-[80%] break-words">{task?.taskTitle}</div>
          </div>
        </div>
      </Link>
    </Tooltip>
  );
}

export default TaskRow;
