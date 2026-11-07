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
import { useRequireMe } from "../queries/hooks";
import { NotSignedInError } from "../queries/unwrap";
import APIResponseStatus from "../common/APIResponseStatus";

  function Dashboard() {
    document.title = "TMS • Dashboard";
    const [createNewProjectModal, setCreateNewProjectModal] =useState<Boolean>(false);
    const [userProfileModal, setUserProfileModal] = useState<Boolean>(false);
    const [logoutModal, setLogoutModal] = useState<Boolean>(false);

    // The profile comes from the shared query cache: instant when you navigate back here, and refreshed
    // automatically whenever something you did makes it stale (see queries/invalidation.ts).
    const meQuery = useRequireMe()
    const myProfiledata: any = meQuery.data
    const networkError = (meQuery.error as any)?.code === "ERR_NETWORK"
    const pageLoading =
      myProfiledata ? "loaded" : meQuery.isError && !(meQuery.error instanceof NotSignedInError) ? "error" : "not-loaded"

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
                
                <DashboardMyProjects
                  myProjects={myProfiledata?.myProjects}
                  setCreateNewProjectModal={setCreateNewProjectModal}
                />
                {
                  !(myProfiledata?.involvedProjects?.length===0)&&
                <DashboardProjectsInvolved 
                involvedProjects={myProfiledata?.involvedProjects}

                />
                }
              </div>

              {/* ---- Active Modals----  */}

              {
                //Create project modal
                createNewProjectModal ? (
                  <CreateNewProjectModal
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
