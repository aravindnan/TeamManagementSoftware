

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRequireMe, useTask } from "../queries/hooks";

import TaskPageTaskInfo from "../components/TaskPageTaskInfo";
import TaskPageAttachedMedia from "../components/TaskPageAttachedMedia";
import TaskPageTaskStatusMarker from "../components/TaskPageTaskStatusMarker";
import Sidebar from "../components/Sidebar";
import UserProfileModal from "../modals/UserProfileModal";
import EditTaskModal from "../modals/EditTaskModal";
import ViewMediaModal from "../modals/ViewMediaModal";
import DeleteTaskConfirmationModal from "../modals/DeleteTaskConfirmationModal";
import ViewMemberModal from "../modals/ViewMemberModal";
import TaskPageAddMediaModal from "../modals/TaskPageAddMediaModal";
import { useSelector } from "react-redux";
import TopBar from "../components/TopBar";
import ChangeStatusModal from "../modals/ChangeStatusModal";
import APIResponseStatus from "../common/APIResponseStatus";


// Stable empty value while the task loads, so effect dependencies do not churn.
const NO_TASK = {};

function TaskPage() {
  const [userProfileModal,setUserProfileModal]=useState<Boolean>(false)
  const [editTaskModal,setEditTaskModal]=useState<Boolean>(false)
  const [viewMediaModal,setViewMediaModal]=useState<any>({isOpen: false, mediaData: null})
  const [deleteTaskModal,setDeleteTaskModal]=useState<Boolean>(false)
  const [viewMemberModal,setViewMemberModal] = useState<any>({isOpen: false, memberData: null})
  const [addMediaModal,setAddMediaModal] = useState<Boolean>(false)
  const [taskStatusModal,setTaskStatusModal] = useState<Boolean>(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get("id")

  // Shared query cache: a task you have just opened is shown instantly, and a comment you post is added
  // to it directly instead of refetching the whole task (see queries/invalidation.ts).
  useRequireMe() // redirects signed-out visitors and keeps the Redux copy of the profile current
  const taskQuery = useTask(taskId)
  const activeTask: any = taskQuery.data ?? NO_TASK
  const networkError = (taskQuery.error as any)?.code === "ERR_NETWORK"
  const pageLoading = taskQuery.data ? "loaded" : taskQuery.isError ? "error" : "not-loaded"

  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  useEffect(() => {
    if (!taskId) navigate("/not-found", { replace: true })
  }, [taskId, navigate])

  useEffect(() => {
    document.title = taskQuery.data?.taskTitle ?? "TMS"
  }, [taskQuery.data?.taskTitle])


  return (
    <>
    {
      pageLoading==="loaded"?
      <>
      <div className="flex flex-col md:flex-row h-[100vh] text-C11 relative">
      <TopBar
        activePage="projectpage"
        setUserProfileModal={setUserProfileModal}
        />
      <Sidebar 
      activePage="task-page"
      setUserProfileModal={setUserProfileModal}
      />
    
        <div className="py-10 px-5 sm:px-10 flex-col md:flex-row flex flex-1 pt-20 max-h-[100vh] overflow-y-auto  gap-2 ">
          {/* Task Info */}
          <div className="flex flex-col w-full md:max-w-[50%] lg:max-w-[60%] h-fit">
            <TaskPageTaskInfo 
            myProfiledata={myProfiledata}
            setDeleteTaskModal={setDeleteTaskModal}
            setEditTaskModal={setEditTaskModal}
            setViewMemberModal={setViewMemberModal}
            activeTask={activeTask}

            />
            <TaskPageAttachedMedia 
            myProfiledata={myProfiledata}
            activeTask={activeTask}
            setViewMediaModal={setViewMediaModal}
            setAddMediaModal={setAddMediaModal} 
            />
          </div>
      {
  activeTask?.assignedTo?._id===myProfiledata?._id||activeTask?.assignedBy?._id ===myProfiledata?._id?

          <div className="flex flex-col flex-1 gap-2 mb-10 md:mb-0">
            <TaskPageTaskStatusMarker
            setTaskStatusModal={setTaskStatusModal}  
            myProfiledata={myProfiledata}           
            activeTask={activeTask}
             />
          </div>:null
        }

        </div>
        {/*--- Active modals--- */}
        {
          // User Profile Modal
          userProfileModal?
          <UserProfileModal 
          setUserProfileModal={setUserProfileModal}
          />:null
        }
        {
          editTaskModal?
          <EditTaskModal
          activeTask={activeTask}
          data={"data"}
          setEditTaskModal={setEditTaskModal}
          />:null
        }
        {
          viewMediaModal.isOpen?
          <ViewMediaModal
          type="task"
          activeTask={activeTask}
          mediaData={viewMediaModal.mediaData}
          setViewMediaModal={setViewMediaModal}

          />:null
        }
        {
          deleteTaskModal?
          <DeleteTaskConfirmationModal
          activeTask={activeTask}
          setDeleteTaskModal={setDeleteTaskModal}
          />:null
        }
        {
        viewMemberModal.isOpen?
        <ViewMemberModal
        memberData ={viewMemberModal.memberData}
        setViewMemberModal={setViewMemberModal}
        />:null
      }
       {
        addMediaModal?
          <TaskPageAddMediaModal
          activeTask={activeTask}
          setAddMediaModal={setAddMediaModal} 
          />:null
      }
      {
        taskStatusModal?
        <ChangeStatusModal
        activeTask={activeTask}
        setTaskStatusModal={setTaskStatusModal}
        />:null
      }

      </div>

      </>
      :pageLoading==="not-loaded"?
      <div className="flex items-center justify-center flex-1 w-full h-[100vh]">
      <div className="flex justify-center  text-[16px] font-light ">
       <div>Accumulating Task Details...</div>
      </div>
  </div>:
  <div className="flex items-center justify-center flex-1 w-full h-[100vh]">
  <APIResponseStatus status={false} message={`${networkError?"Network Error":"An Error Occured"}`}/>
  </div>
    }
    </>
  );
}

export default TaskPage;
