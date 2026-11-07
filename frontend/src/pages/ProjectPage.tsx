import React, { useEffect, useState } from "react";
import ProjectPageProjectInfo from "../components/ProjectPageProjectInfo";
import ProjectPageMyTasks from "../components/ProjectPageMyTasks";
import ProjectPageProjectMembers from "../components/ProjectPageProjectMembers";
import ProjectPageAttachedMedia from "../components/ProjectPageAttachedMedia";
import AddNewTaskModal from "../modals/AddNewTaskModal";
import ViewAllTaskModal from "../modals/ViewAllTaskModal";
import BoardModal from "../modals/BoardModal";
import ActivityModal from "../modals/ActivityModal";
import Sidebar from "../components/Sidebar";
import UserProfileModal from "../modals/UserProfileModal";
import RemoveMemberConfirmationModal from "../modals/RemoveMemberConfirmationModal";
import ViewMemberModal from "../modals/ViewMemberModal";
import EditProjectInfoModal from "../modals/EditProjectInfoModal";
import AddNewMemberModal from "../modals/AddNewMemberModal";
import DeleteProjectConfirmationModal from "../modals/DeleteProjectConfirmationModal";
import ProjectPageAddMediaModal from "../modals/ProjectPageAddMediaModal";
import ViewMediaModal from "../modals/ViewMediaModal";
import { getProjectById } from "../services/projectServices";
import { useDispatch, useSelector } from "react-redux";
import { getMe } from "../services/authServices";
import * as authActions from "../redux/actions/authActions"
import { useNavigate } from "react-router";
import TopBar from "../components/TopBar";


import ProjectPageDiscussion from "../components/ProjectPageDiscussion";
import APIResponseStatus from "../common/APIResponseStatus";


function ProjectPage() {
  const [addTaskModal,setAddTaskModal]=useState<Boolean>(false)
  const [viewAllTaskModal,setViewAllTaskModal] = useState<Boolean>(false)
  const [boardModal,setBoardModal] = useState<Boolean>(false)
  const [activityModal,setActivityModal] = useState<Boolean>(false)
  const [userProfileModal,setUserProfileModal]=useState<Boolean>(false)
  const [removeMemberModal,setRemoveMemberModal] = useState<any>({isOpen: false, memberData: null})
  const [viewMemberModal,setViewMemberModal] = useState<any>({isOpen: false, memberData: null})
  const [viewMediaModal,setViewMediaModal]=useState<any>({isOpen: false, mediaData: null})
  const [editProjectInfoModal,setEditProjectInfoModal] = useState<Boolean>(false)
  const [addMemberModal,setAddMemberModal] = useState<Boolean>(false)
  const [deleteProjectModal,setDeleteProjetModal] = useState<Boolean>(false)
  const [addMediaModal,setAddMediaModal] = useState<Boolean>(false)
  const [activeProject,setActiveProject] =  useState<any>({})
  const [rerender, setRerender] = useState(false);
  const [myTasks,setMytasks] = useState<any>([])
  const [completedTasks,setCompletedTasks] = useState<any>([])
  const [networkError,setNetworkError] = useState<Boolean>(false)
  const [pageLoading, setPageLoading] = useState<any>("not-loaded")

  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  
  
  const isCurrentUserInProject = activeProject?.projectMembers?.some((member:any) => member._id === myProfiledata?._id);
  
  const navigate = useNavigate()
  
  
  
  useEffect(()=>{
    Object.keys(activeProject).length!==0?
    window.document.title = activeProject?.projectName:window.document.title ="TMS"
  },[activeProject])
  

  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get("id");
    if (!projectId) {
      navigate("/not-found", { replace: true })
      return
    }
    let cancelled = false
    ;(async () => {
      const res: any = await getProjectById(projectId)
      if (cancelled) return
      if (res?._id) {
        setPageLoading("loaded")
        setActiveProject(res)
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

  useEffect(()=>{
    if (activeProject?.allTasks) {
      const tasks = activeProject.allTasks;

      const completed = tasks.filter((task: any) => task.taskStatus === 'Completed');

      setCompletedTasks(completed);
    }

  },[activeProject])




  // const activeProject = useSelector(
  //   (state: any) => state.projectReducer.activeProject
  // );
const dispatch = useDispatch()
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

  return (
    <>{
      pageLoading==="loaded"?
    <div className="flex flex-col md:flex-row h-[100vh] text-C11 relative">
      <TopBar
        activePage="projectpage"
        setUserProfileModal={setUserProfileModal}
        />
     <Sidebar 
      setUserProfileModal={setUserProfileModal}
      activePage="project-page"
      />
      <div className=" py-10 px-5 sm:px-10 flex-1 pt-20 max-h-[100vh] overflow-y-auto">
        {/* Project Info */}
        <ProjectPageProjectInfo
        completedTasks={completedTasks}
        activeProject={activeProject} 
        setAddTaskModal={setAddTaskModal}
        setViewAllTaskModal = {setViewAllTaskModal} 
        setBoardModal={setBoardModal}
        setActivityModal={setActivityModal}
        setEditProjectInfoModal={setEditProjectInfoModal}
        setViewMemberModal={setViewMemberModal}
        setDeleteProjetModal={setDeleteProjetModal}

        />
        <div className=" flex flex-row justify-between pt-10  2xl:gap-[150px] xl:gap-[120px] gap-[50px] flex-wrap lg:flex-nowrap">
          {/* my Taks tasks */}
          <ProjectPageMyTasks setMytasks={setMytasks} activeProject={activeProject} myProfiledata={myProfiledata} myTasks={myTasks}/>

          {/* Project Members */}
          <ProjectPageProjectMembers
            myProfiledata={myProfiledata}
            activeProject={activeProject} 
            setAddMemberModal={setAddMemberModal}
            setViewMemberModal={setViewMemberModal}
            setRemoveMemberModal={setRemoveMemberModal}
          />

        </div>
        {
        isCurrentUserInProject&&
        <div className=" flex flex-row justify-between pt-10  2xl:gap-[150px] xl:gap-[120px] gap-[50px] flex-wrap lg:flex-nowrap ">
        
     
          {/* Attached Media */}
          <ProjectPageAttachedMedia 
          myProfiledata={myProfiledata}
          activeProject={activeProject} 
          setAddMediaModal={setAddMediaModal}
          setViewMediaModal={setViewMediaModal}
          />

        {/* ------------------ */}
        <ProjectPageDiscussion
        myProfiledata={myProfiledata}
        activeProject={activeProject} 
        triggerRerender={triggerRerender}
        />


        {/* ------------------ */}
        </div>
        }

      </div>

    {/*--- Active Modals ----*/}
     { 
    //  Add New Task to project modal
     addTaskModal?
     <AddNewTaskModal 
     triggerRerender={triggerRerender} // Pass the function here
     activeProject={activeProject} 
     setAddTaskModal={setAddTaskModal}
     />:null
     }
     {
      activityModal?
      <ActivityModal
      activeProject={activeProject}
      setActivityModal={setActivityModal}
      />:null
     }
     {
      boardModal?
      <BoardModal
      activeProject={activeProject}
      myProfiledata={myProfiledata}
      setBoardModal={setBoardModal}
      triggerRerender={triggerRerender}
      />:null
     }
     {
      // View all tasks of the project modal 
      viewAllTaskModal?
      <ViewAllTaskModal

      activeProject={activeProject} 
      setViewAllTaskModal = {setViewAllTaskModal} 
      triggerRerender={triggerRerender}
      />:null
     }
     {
      // Show user profile modal
      userProfileModal?
      <UserProfileModal
      triggerRerender={triggerRerender} // Pass the function here
      setUserProfileModal={setUserProfileModal}
      />:null
     }
      {
        // Remove Memeber Confirmation Modal
        removeMemberModal.isOpen?
        <RemoveMemberConfirmationModal
        memberData={removeMemberModal.memberData}
        activeProject={activeProject}
        triggerRerender={triggerRerender} // Pass the function here
        setRemoveMemberModal={setRemoveMemberModal}
        />
        :null
      }

      {/* View Project Memeber modal */}
      {
        viewMemberModal.isOpen?
        <ViewMemberModal
        memberData={viewMemberModal.memberData}
        setViewMemberModal={setViewMemberModal}
        />:null
      }
     {
      viewMediaModal.isOpen?
          <ViewMediaModal
          type="project"
          triggerRerender={triggerRerender}
          activeProject={activeProject}
          mediaData={viewMediaModal.mediaData}
          setViewMediaModal={setViewMediaModal}

          />:null
        }

      {
        editProjectInfoModal?
        <EditProjectInfoModal
        triggerRerender={triggerRerender} // Pass the function here
        activeProject={activeProject}
        setEditProjectInfoModal={setEditProjectInfoModal}
        />:null
      }

      {
        addMemberModal?
        <AddNewMemberModal
        activeProject={activeProject}
        triggerRerender={triggerRerender} // Pass the function here
        setAddMemberModal={setAddMemberModal}
        />:null
      }
      {
        deleteProjectModal?
        <DeleteProjectConfirmationModal
        activeProject={activeProject}
        setDeleteProjetModal={setDeleteProjetModal}
        />:null
      }
      {
        addMediaModal?
          <ProjectPageAddMediaModal
          activeProject={activeProject}
          triggerRerender={triggerRerender} // Pass the function here
          setAddMediaModal={setAddMediaModal} 
          />:null
      }



 
    </div>
    :pageLoading==="not-loaded"?
      <div className="flex items-center justify-center flex-1 w-full h-[100vh]">
      <div className="flex justify-center  text-[16px] font-light ">
       <div>Accumulating Project Details...</div>
      </div>
  </div>:
  <div className="flex items-center justify-center flex-1 w-full h-[100vh]">
  <APIResponseStatus status={false} message={`${networkError?"Network Error":"An Error Occured"}`}/>
  </div>


    }
    
    </>
  );
}

export default ProjectPage;
