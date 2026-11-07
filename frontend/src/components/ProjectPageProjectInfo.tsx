import {
  Add,
  CalendarMonth,
  CheckBox,
  Delete,
  DonutLarge,
  Edit,
  Person,
  } from "@mui/icons-material";
import React, {} from "react";
import { colors } from "../Constants";
import "react-circular-progressbar/dist/styles.css";
import CircularGraph from "../common/CircularGraph";
import { Tooltip } from "@mui/material";

import { useSelector } from "react-redux";
import moment from "moment";

function ProjectPageProjectInfo(props: any) {
  const { 
    setAddTaskModal,
    activeProject, 
    setViewAllTaskModal, 
    setOverallPerformanceModal ,
    setEditProjectInfoModal,
    setViewMemberModal,
    setDeleteProjetModal,
    completedTasks,
} =
    props;



  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  return (
    <>
      <div className="flex flex-row items-center ">
        <div className="flex flex-col w-full md:w-[75%] ">
          <div className="text-[40px] font-extrabold">{activeProject?.projectName}</div>
          <div className="text-[14px] w-[90%]">
            {activeProject?.projectDescription}
          </div>
          <div className="relative flex flex-row flex-wrap gap-5 py-5">
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Project Manager
              </div>
              <Tooltip title="View Profile" arrow placement="bottom">
              <button
              onClick={()=>setViewMemberModal({[`isOpen`]:true,[`memberData`]:activeProject?.projectManager})}
               className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer hover:underline underline-offset-2 bg-C44 ">
                <Person sx={{ fontSize: 12, color: colors.C11 }} />
                <div className="p-2 font-semibold ">{`${activeProject?.projectManager?.firstName} ${activeProject?.projectManager?.lastName}`}</div>
              </button>
              </Tooltip>
             
            </div>

            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Start Date
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <CalendarMonth sx={{ fontSize: 12, color: colors.C11 }} />
                <div className="p-2 font-semibold">{moment(activeProject?.startDate).format("LL")}</div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1">
                Project Status
              </div>
              <div className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 ">
                <DonutLarge sx={{ fontSize: 12, color: colors.C11 }} />
                <div className="p-2 font-semibold">{activeProject?.projectStatus}</div>
              </div>
            </div>

            {/* Project Manager Privileges */}
            {
              activeProject.projectManager?._id === myProfiledata?._id?
              <>
               <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1 select-none">
                View
              </div>
              <Tooltip title={"View All Tasks"} arrow placement="bottom">
                <button
                  onClick={() => setViewAllTaskModal(true)}
                  className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 "
                >
                  <CheckBox sx={{ fontSize: 12, color: colors.C11 }} />
                  <div className="p-2 font-semibold">All Tasks</div>
                </button>
              </Tooltip>
            </div>
            <div className="flex flex-col ">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1 select-none">
                Add
              </div>
              <div className="flex flex-row gap-2">
              <Tooltip title={"Add New Task"} arrow placement="bottom">
                <button
                  onClick={() => setAddTaskModal(true)}
                  className="bg-C11 text-C55 flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer "
                >
                  <Add sx={{ fontSize: 12, color: colors.C55 }} />
                  <div className="p-2 font-semibold">Task</div>
                </button>
              </Tooltip>

              </div>

            </div>
            <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1 select-none">
                Edit
              </div>
              <Tooltip title={"Edit Project Info"} arrow placement="bottom">
                <button
                  onClick={() => setEditProjectInfoModal(true)}
                  className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 "
                >
                  <Edit sx={{ fontSize: 12, color: colors.C11 }} />
                  <div className="p-2 font-semibold">Info</div>
                </button>
              </Tooltip>
            </div>
             <div className="flex flex-col">
              <div className=" text-C11 text-[8px] font-bold  w-fit py-1 ">
              Delete
              </div>
              <Tooltip title="Delete Project" arrow placement="bottom">
              <button
               onClick={()=>setDeleteProjetModal(true)}
               className="flex flex-row items-center px-2 rounded-[4px] text-[12px] cursor-pointer bg-C44 text-highPriority bg-inactiveRed">
                <Delete sx={{ fontSize: 15 }} />
                <div className="p-2 font-semibold ">Delete Project</div>
              </button>
              </Tooltip>
            </div>
              </>:null
            }
            {/* AddTaskModal Active */}
          </div>
        </div>
        {
          activeProject.allTasks.length!==0?
        <div className="hidden md:flex">

        <CircularGraph
          
          setOverallPerformanceModal={setOverallPerformanceModal}
          color={colors.C11}
          trackColor={colors.C44}
          percentage={Math.floor((completedTasks.length/activeProject?.allTasks.length)*100)}
        />
        </div>:null
        }
      </div>
    </>
  );
}

export default ProjectPageProjectInfo;
