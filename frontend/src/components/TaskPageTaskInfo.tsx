import {
  Person,
  CalendarMonth,
  DonutLarge,
  EmojiEvents,
  Info,
  LabelImportant,
  Edit,
  Delete,
} from "@mui/icons-material";
import { Markdown } from "../helper/markdown";
import React from "react";
import { colors } from "../Constants";
import { Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import moment from "moment";

function TaskPageTaskInfo(props:any) {
    const {setEditTaskModal,setDeleteTaskModal,setViewMemberModal,activeTask}=props
  return (
    <>
      <div className="flex flex-row items-center ">
        <div className="flex flex-col ">
          <div className="flex flex-col w-fit">
            <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Project
            </div>
            <Tooltip title="View Project" arrow placement="right">
            <Link to={`/project-page?id=${activeTask?.project?._id}`}>
            <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
              <EmojiEvents sx={{ fontSize: 15, color: colors.C11 }} />
              <div className="p-2 font-semibold">{activeTask?.project?.projectName}</div>
            </div>
            </Link>
            </Tooltip>
          </div>
          <div className="text-[40px] font-extrabold">{activeTask?.taskTitle}</div>
          <div className="w-[90%]">
            <Markdown source={activeTask?.taskDescription} className="text-[14px]" />
          </div>
          <div className="flex flex-row flex-wrap gap-5 py-5 ">

            {/* Task ID  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Task ID
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <Info sx={{ fontSize: 15, color: colors.C11 }} />
                <div className="p-2 font-semibold ">{activeTask?._id}</div>
              </div>
            </div>

            {/* Priority  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Priority
              </div>
              
              <div className={`text-C55 flex flex-row items-center px-2 rounded-[4px] text-[12px] 
              ${ activeTask?.taskPriority === "High"
                ? "bg-highPriority":
                activeTask?.taskPriority === "Medium"? 
                "bg-mediumPriority"
                : "bg-lowPriority"
              }
               cursor-pointer bg-C44 justify-between`}>
                <LabelImportant sx={{ fontSize: 15}} />
                <div className="p-2 font-semibold ">{activeTask?.taskPriority}</div>
              </div>
            </div>

            {/* Assigned To  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Assigned To
              </div>
              <Tooltip title="View Profile" arrow placement="top-end">
              <button
              onClick={()=>setViewMemberModal({[`isOpen`]:true,[`memberData`]:activeTask?.assignedTo})}
              className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C11 hover:underline underline-offset-2 decoration-C44 ">
                <Person sx={{ fontSize: 15, color: colors.C55 }} />
                <div className="p-2 font-semibold text-C55">{`${activeTask?.assignedTo?.firstName} ${activeTask?.assignedTo?.lastName}`}</div>
              </button>
              </Tooltip>
            </div>

             {/* Assigned By  */}
             <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Assigned By
              </div>
              <Tooltip title="View Profile" arrow placement="top-end">
              <button 
              onClick={()=>setViewMemberModal({[`isOpen`]:true,[`memberData`]:activeTask?.assignedBy})}
              className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 hover:underline underline-offset-2 ">
                <Person sx={{ fontSize: 15, color: colors.C11 }} />
                <div className="p-2 font-semibold ">{`${activeTask?.assignedBy?.firstName} ${activeTask?.assignedBy?.lastName}`}</div>
              </button>
              </Tooltip>
            </div>

             

             {/* Assigned On */}
             <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Assigned On
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <CalendarMonth sx={{ fontSize: 15, color: colors.C11 }} />
                <div className="p-2 font-semibold ">{moment(activeTask?.assignedOn).format("LL")}</div>
              </div>
            </div>

            {/* Deadline  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Deadline
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C11 ">
                <CalendarMonth sx={{ fontSize: 15, color: colors.C55 }} />
                <div className="p-2 font-semibold text-C55">{moment(activeTask?.dueDate).format("LL")}</div>
              </div>
            </div>

            {/* Status  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Status
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <DonutLarge sx={{ fontSize: 15, color: colors.C11 }} />
                <div className="p-2 font-semibold ">{activeTask?.taskStatus}</div>
              </div>
            </div>

            {/* Edit Task Assigner Privilege  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Edit
              </div>
              
              <Tooltip title="Edit Task Info" arrow placement="bottom">
              <button
               onClick={()=>setEditTaskModal(true)}
               className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <Edit sx={{ fontSize: 15, color: colors.C11 }} />
                <div className="p-2 font-semibold ">Info</div>
              </button>
              </Tooltip>
            </div>

            {/* Delete Task Assigner Privilege  */}
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
              Delete
              </div>
              <Tooltip title="Delete Task" arrow placement="bottom">
              <button
               onClick={()=>setDeleteTaskModal(true)}
               className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-inactiveRed text-highPriority ">
                <Delete sx={{ fontSize: 15 }} />
                <div className="p-2 font-semibold ">Delete Task</div>
              </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TaskPageTaskInfo;
