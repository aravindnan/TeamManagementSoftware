  import React, { useMemo, useState } from "react";
    import { colors } from "../Constants";
  // import { AccountCircle, Logout } from "@mui/icons-material";
  // import { Tooltip } from "@mui/material";
  import DashboardGreeting from "../components/DashboardGreeting";
  import DashboardPendingTasks from "../components/DashboardPendingTasks";
  import DashboardCompletedTasks from "../components/DashboardCompletedTasks";
  import DashboardMyProjects from "../components/DashboardMyProjects";
  import DashboardProjectsInvolved from "../components/DashboardProjectsInvolved";
  // import { Link } from "react-router-dom";
  import CircularGraph from "../common/CircularGraph";
  import CreateNewProjectModal from "../modals/CreateNewProjectModal";
  import Sidebar from "../components/Sidebar";
  import UserProfileModal from "../modals/UserProfileModal";
  // import Loader from "../common/Loader";
  import LogoutModal from "../modals/LogoutModal";
  // import { url } from "inspector";
import TopBar from "../components/TopBar";
import { useRequireMe, useWorkspaces } from "../queries/hooks";
import InvitationsBanner from "../components/InvitationsBanner";
import WorkspacesModal from "../modals/WorkspacesModal";
import { usePersistentState } from "../helper/usePersistentState";
import { NotSignedInError } from "../queries/unwrap";
import APIResponseStatus from "../common/APIResponseStatus";

  function Dashboard() {
    document.title = "TMS • Dashboard";
    const [createNewProjectModal, setCreateNewProjectModal] =useState<Boolean>(false);
    const [userProfileModal, setUserProfileModal] = useState<Boolean>(false);
    const [logoutModal, setLogoutModal] = useState<Boolean>(false);
    // Owned by the page, not by the first-run card: that card disappears as soon as a workspace exists.
    const [workspacesModal, setWorkspacesModal] = useState<boolean>(false);

    // The profile comes from the shared query cache: instant when you navigate back here, and refreshed
    // automatically whenever something you did makes it stale (see queries/invalidation.ts).
    const meQuery = useRequireMe()
    const myProfiledata: any = meQuery.data
    const networkError = (meQuery.error as any)?.code === "ERR_NETWORK"
    const pageLoading =
      myProfiledata ? "loaded" : meQuery.isError && !(meQuery.error instanceof NotSignedInError) ? "error" : "not-loaded"

    // Workspaces: filter the project lists, and prompt first-time users to create or join one.
    const workspacesQuery = useWorkspaces()
    const workspaces: any[] = workspacesQuery.data ?? []
    const [savedFilter, setSavedFilter] = usePersistentState("tms.workspaceFilter", "all")
    const workspaceFilter = workspaces.some((w) => w._id === savedFilter) ? savedFilter : "all" // a deleted workspace falls back to "all"
    const inFilter = (projects: any[] | undefined) =>
      (projects ?? []).filter((p) => workspaceFilter === "all" || String(p.workspace) === workspaceFilter)
    const myProjects = inFilter(myProfiledata?.myProjects)
    const involvedProjects = inFilter(myProfiledata?.involvedProjects)

    const { pendingTasks, completedTasks } = useMemo(() => {
      const tasks: any[] = myProfiledata?.allTasks || []
      return {
        pendingTasks: tasks.filter((task) => task.taskStatus !== "Completed"),
        completedTasks: tasks.filter((task) => task.taskStatus === "Completed"),
      }
    }, [myProfiledata])

    return (
      <>
        {pageLoading==="loaded" ? 
          <>
            <div className="flex flex-col md:flex-row h-[100vh] text-C11 relative">
              <TopBar
                activePage="dashboard"
               setUserProfileModal={setUserProfileModal}
               setLogoutModal={setLogoutModal}
              />
              <Sidebar
                activePage="dashboard"
                setUserProfileModal={setUserProfileModal}
                setLogoutModal={setLogoutModal}
              />
              <div className="bg-C55 py-10 px-5 sm:px-10 flex-1 pt-20 max-h-[100vh] overflow-y-auto">
                <div className="flex flex-row items-center sm:pr-10 ">
                  <DashboardGreeting />
                  {
                  !( myProfiledata?.allTasks?.length===0)?
                  <CircularGraph
                    color={colors.C11}
                    trackColor={colors.C44}
                    percentage={Math.floor((completedTasks?.length/myProfiledata?.allTasks?.length)*100)}
                  />:null
                  }

                </div>
                <div className=" flex flex-col lg:flex-row justify-between pt-10 gap-[30px] lg:gap-[150px] ">

                  {
                  myProfiledata?.allTasks?.length!==0?
                  <DashboardPendingTasks 
                  allTasks={pendingTasks}
                  />:null
                  }

                  {myProfiledata?.allTasks?.length!==0?
                    <DashboardCompletedTasks 
                    allTasks={completedTasks}
                    />:null
                  } 

                </div>
                
                <InvitationsBanner />

                {workspacesQuery.data && workspaces.length === 0 && (
                  <section aria-label="Get started" className="mt-8 rounded-[8px] bg-C44 p-5 max-w-[620px] flex flex-col gap-2 items-start">
                    <div className="text-[16px] font-bold">Start with a workspace</div>
                    <p className="text-[13px] text-gray-700">
                      A workspace is where your team and projects live. Create one to start a project, or open the invitation link a teammate sent you.
                    </p>
                    <button onClick={() => setWorkspacesModal(true)} className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[13px] py-2 px-5">
                      Open workspaces
                    </button>
                  </section>
                )}

                {workspaces.length > 0 && (
                  <div className="flex flex-row items-center gap-2 mt-8">
                    <label htmlFor="workspace-filter" className="text-[11px] font-bold text-gray-500">Workspace</label>
                    <select
                      id="workspace-filter"
                      value={workspaceFilter}
                      onChange={(e) => setSavedFilter(e.target.value)}
                      className="bg-C44 rounded-[6px] text-[12px] font-semibold px-2 py-1"
                    >
                      <option value="all">All workspaces</option>
                      {workspaces.map((w) => (
                        <option key={w._id} value={w._id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <DashboardMyProjects
                  myProjects={myProjects}
                  setCreateNewProjectModal={setCreateNewProjectModal}
                />
                {
                  involvedProjects.length > 0 &&
                <DashboardProjectsInvolved 
                involvedProjects={involvedProjects}

                />
                }
              </div>

              {/* ---- Active Modals----  */}

              {
                //Create project modal
                createNewProjectModal ? (
                  <CreateNewProjectModal
                    defaultWorkspaceId={workspaceFilter === "all" ? undefined : workspaceFilter}
                    setCreateNewProjectModal={setCreateNewProjectModal}
                  />
                ) : null
              }


              {
                // User Profile Modal
                userProfileModal ? (
                  <UserProfileModal 
                  setUserProfileModal={setUserProfileModal} />
                ) : null
              }
              {workspacesModal ? <WorkspacesModal setOpen={setWorkspacesModal} /> : null}
              {logoutModal ? (
                <LogoutModal setLogoutModal={setLogoutModal} />
              ) : null}
            </div>
          </>
         :pageLoading==="not-loaded"?
        <div className="w-[100vw] h-[100vh] flex justify-center items-center">
        <div className="flex justify-center text-[16px] font-light ">
              <div>Setting Up Dashboard...</div>
            </div>
        </div>:
          <div className="flex items-center justify-center flex-1 w-full h-[100vh]">
          <APIResponseStatus status={false} message={`${networkError?"Network Error":"An Error Occured"}`}/>
          </div> 
         }
      </>
    );
  }

  export default Dashboard;
