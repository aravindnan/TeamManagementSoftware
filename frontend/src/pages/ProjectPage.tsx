import React, { useEffect, useMemo, useState } from "react";
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
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProject, useRequireMe } from "../queries/hooks";
import TopBar from "../components/TopBar";


import ProjectPageDiscussion from "../components/ProjectPageDiscussion";
import APIResponseStatus from "../common/APIResponseStatus";


// Stable empty value while the project loads, so memo/effect dependencies do not churn.
const NO_PROJECT = {};

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
  const [myTasks,setMytasks] = useState<any>([])

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get("id")

  // Both reads come from the shared query cache: opening a project you have just seen is instant,
  // and every write (a comment, a status change, a new member...) refreshes exactly what it affected.
  useRequireMe() // redirects signed-out visitors and keeps the Redux copy of the profile current
  const projectQuery = useProject(projectId)
  const activeProject: any = projectQuery.data ?? NO_PROJECT
  const networkError = (projectQuery.error as any)?.code === "ERR_NETWORK"
  const pageLoading = projectQuery.data ? "loaded" : projectQuery.isError ? "error" : "not-loaded"

  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  const isCurrentUserInProject = activeProject?.projectMembers?.some((member:any) => member._id === myProfiledata?._id);

  useEffect(() => {
    if (!projectId) navigate("/not-found", { replace: true })
  }, [projectId, navigate])

  useEffect(() => {
    document.title = projectQuery.data?.projectName ?? "TMS"
  }, [projectQuery.data?.projectName])

  const completedTasks = useMemo(
    () => (activeProject?.allTasks || []).filter((task: any) => task.taskStatus === "Completed"),
    [activeProject]
  )

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
      />:null
     }
     {
      // View all tasks of the project modal 
      viewAllTaskModal?
      <ViewAllTaskModal

      activeProject={activeProject} 
      setViewAllTaskModal = {setViewAllTaskModal} 
      />:null
     }
     {
      // Show user profile modal
      userProfileModal?
      <UserProfileModal
      setUserProfileModal={setUserProfileModal}
      />:null
     }
      {
        // Remove Memeber Confirmation Modal
        removeMemberModal.isOpen?
        <RemoveMemberConfirmationModal
        memberData={removeMemberModal.memberData}
        activeProject={activeProject}
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
          activeProject={activeProject}
          mediaData={viewMediaModal.mediaData}
          setViewMediaModal={setViewMediaModal}

          />:null
        }

      {
        editProjectInfoModal?
        <EditProjectInfoModal
        activeProject={activeProject}
        setEditProjectInfoModal={setEditProjectInfoModal}
        />:null
      }

      {
        addMemberModal?
        <AddNewMemberModal
        activeProject={activeProject}
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
