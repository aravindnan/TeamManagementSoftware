import { Logout } from '@mui/icons-material'
import { Tooltip } from '@mui/material'
import React from 'react'
import Logo from '../common/Logo'
import NotificationBell from './NotificationBell'
import { Link } from 'react-router-dom'
import { colors } from '../Constants'
import { useSelector } from 'react-redux'

function Sidebar(props:any) {
    const{setUserProfileModal,setLogoutModal,activePage}=props

    const myProfiledata = useSelector(
      (state: any) => state.authReducer.myUserProfile
    );
    
  return (
    <div className="bg-C44 w-[60px] pt-2 hidden md:flex flex-col">
    <div className="flex-1 ">
    <Tooltip title="Dashboard" placement="right" arrow>
    <Link to="/dashboard">
        <div className="flex justify-center py-2 cursor-pointer">
          <Logo size={"0.5"} color={colors.C11} />
        </div>
      </Link>
    </Tooltip>
    <Tooltip title="Profile" placement="right" arrow className='mx-auto '>
      <button className="flex justify-center py-2 cursor-pointer"
       onClick={()=>setUserProfileModal(true)}
      >
      {
        myProfiledata&&activePage==="dashboard"&&
        <div 
        className={`w-[35px] h-[35px] rounded-full flex justify-center items-center text-center text-[11px] font-semibold text-white p-[2px] bg-inactiveC11 hover:bg-C11 transition-all duration-[0.5s]` }>
          <div className='bg-C11 flex items-center justify-center min-w-full min-h-full text-center  border-C44 rounded-full border-[2px]'>
          {`${myProfiledata?.firstName[0].toUpperCase()}${myProfiledata?.lastName[0].toUpperCase()}`}
          </div>
        </div>
      }
      </button>
    </Tooltip>
    <Tooltip title="Notifications" placement="right" arrow>
      <div className="flex justify-center">
        <NotificationBell />
      </div>
    </Tooltip>
    </div>
    {
      activePage==="dashboard"?
    <Tooltip title="Logout" placement="right" arrow>
      <button className="flex justify-center py-4 cursor-pointer"
      onClick={()=>setLogoutModal(true)}
      >
        <Logout sx={{ fontSize: 20, color: colors.C11 }} />
      </button>
    </Tooltip>:null
    }
  </div>
  )
}

export default Sidebar
