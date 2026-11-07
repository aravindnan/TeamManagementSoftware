

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { getMe } from "../services/authServices";
import { useDispatch, useSelector } from "react-redux";
import * as authActions from "../redux/actions/authActions"
import { getTaskById } from "../services/taskServices";
import TopBar from "../components/TopBar";
import ChangeStatusModal from "../modals/ChangeStatusModal";
import APIResponseStatus from "../common/APIResponseStatus";


function TaskPage() {
  const [userProfileModal,setUserProfileModal]=useState<Boolean>(false)
  const [editTaskModal,setEditTaskModal]=useState<Boolean>(false)
  const [viewMediaModal,setViewMediaModal]=useState<any>({isOpen: false, mediaData: null})
  const [deleteTaskModal,setDeleteTaskModal]=useState<Boolean>(false)
  const [viewMemberModal,setViewMemberModal] = useState<any>({isOpen: false, memberData: null})
  const [addMediaModal,setAddMediaModal] = useState<Boolean>(false)
  const [taskStatusModal,setTaskStatusModal] = useState<Boolean>(false)
  const [activeTask,setActiveTask]= useState<any>({})
  const [rerender, setRerender] = useState<Boolean>(false)
  const [networkError,setNetworkError] = useState<Boolean>(false)
  const [pageLoading, setPageLoading] = useState<any>("not-loaded")
  
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useEffect(()=>{
    Object.keys(activeTask).length!==0?
    window.document.title = activeTask?.taskTitle:window.document.title ="TMS"
  },[activeTask])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res: any = await getMe()
      if (cancelled) return
      if (res === null) {
        navigate("/login")
      } else if (res?._id) {
        dispatch(authActions.loginAction(res))
      } else {
        setNetworkError(res?.code === "ERR_NETWORK")
      }
    })()
    return () => { cancelled = true }
  }, [navigate, dispatch]);
    
  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get("id");
    if (!taskId) {
      navigate("/not-found", { replace: true })
      return
    }
    let cancelled = false
    ;(async () => {
      const res: any = await getTaskById(taskId)
      if (cancelled) return
      if (res?._id) {
        setPageLoading("loaded")
        setActiveTask(res)
      } else {
        setNetworkError(res?.code === "ERR_NETWORK")
        setPageLoading("error")
      }
    })()
    return () => { cancelled = true }
  }, [rerender, navigate]);

  const triggerRerender = () => {
    setRerender((prev) => !prev);
  };


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
            triggerRerender={triggerRerender}
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
            triggerRerender={triggerRerender}
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
          triggerRerender={triggerRerender}
          setUserProfileModal={setUserProfileModal}
          />:null
        }
        {
          editTaskModal?
          <EditTaskModal
          triggerRerender={triggerRerender}
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
          triggerRerender={triggerRerender}
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
          triggerRerender={triggerRerender}
          activeTask={activeTask}
          setAddMediaModal={setAddMediaModal} 
          />:null
      }
      {
        taskStatusModal?
        <ChangeStatusModal
        triggerRerender={triggerRerender}
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
