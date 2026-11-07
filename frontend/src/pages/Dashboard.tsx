  import React, { useEffect, useState } from "react";
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
    import { useDispatch, useSelector } from "react-redux";
  import * as authActions from "../redux/actions/authActions"
    import { getMe } from "../services/authServices";
  import { useNavigate } from "react-router";
import TopBar from "../components/TopBar";
import APIResponseStatus from "../common/APIResponseStatus";

  function Dashboard() {
    document.title = "TMS • Dashboard";
    const [createNewProjectModal, setCreateNewProjectModal] =useState<Boolean>(false);
    const [overallPerformaceModal, setOverallPerformanceModal] =useState<Boolean>(false);
    const [userProfileModal, setUserProfileModal] = useState<Boolean>(false);
    const [logoutModal, setLogoutModal] = useState<Boolean>(false);
    const [rerender, setRerender] = useState(false);
    const [pendingTasks,setPendingTasks]= useState<any>([])
    const [completedTasks,setCompletedTasks]= useState<any>([])
    const [networkError,setNetworkError] = useState<Boolean>(false)
    const [pageLoading, setPageLoading] = useState<any>("not-loaded")

    const myProfiledata = useSelector(
      (state: any) => state.authReducer.myUserProfile
    );

    const dispatch = useDispatch()
    const navigate = useNavigate()
    useEffect(() => {
      getMyProfileData()
    }, [rerender]);
    
    const getMyProfileData = async () => {
      const res: any = await getMe()
      if (res === null) {
        navigate("/login")
      } else if (res?._id) {
        setPageLoading("loaded")
        dispatch(authActions.loginAction(res))
      } else {
        setNetworkError(res?.code === "ERR_NETWORK")
        setPageLoading("error")
      }
    }

  useEffect(()=>{
    if (myProfiledata?.allTasks) {
      const tasks = myProfiledata.allTasks;

      const pending = tasks.filter((task: any) => task.taskStatus === 'In Progress');
      const completed = tasks.filter((task: any) => task.taskStatus === 'Completed');

      setPendingTasks(pending);
      setCompletedTasks(completed);
    }

  },[myProfiledata])

  const triggerRerender = () => {
    setRerender((prev) => !prev);
  };
      



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
                    setOverallPerformanceModal={setOverallPerformanceModal}
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
                    triggerRerender={triggerRerender}
                    setCreateNewProjectModal={setCreateNewProjectModal}
                  />
                ) : null
              }


              {
                // User Profile Modal
                userProfileModal ? (
                  <UserProfileModal 
                  triggerRerender={triggerRerender}
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
