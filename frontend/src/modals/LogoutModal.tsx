import { Close } from '@mui/icons-material'
import React, { useState } from 'react'
import { logoutUser } from '../services/authServices'
import { useNavigate } from 'react-router'
import APIResponseStatus from '../common/APIResponseStatus'
import * as authActions from "../redux/actions/authActions"
import { useDispatch } from 'react-redux'


function LogoutModal(props:any) {

   const dispatch =  useDispatch()
    const {setLogoutModal}= props

    const [error, setError] = useState<string | null>(null);
    const [logoutStatus,setLogoutStatus] = useState<any>("not-loggedout")

    const navigate=useNavigate()
    const handleModalClose =()=>{
      setError(null)
      setLogoutModal(false)
    }


    const handleLogout = async () => {
      setLogoutStatus("logout-loading")
      const res: any = await logoutUser()
      if (res?.logoutStatus) {
        setLogoutStatus("logout-success")
        dispatch(authActions.logoutAction())
        navigate("/")
      } else {
        setError("Logout Failed")
        setLogoutStatus("not-loggedout")
      }
    }


  return (
 <div className='top-0 left-0 absolute w-[100vw] h-[100vh] bg-[#00000054] flex justify-center items-center'>
    <div className='bg-C55 rounded-[8px] p-5 w-[90%] md:max-w-[500px] max-h-[300px] shadow-xl' >
    <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11 '>
      {`${logoutStatus==="logout-loading"?"Loggin Out ":"Log Out"}`}
      </div>
      {logoutStatus!=="logout-loading"?
      <button className='cursor-pointer'
      onClick={handleModalClose}
      >
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>:
      logoutStatus==="logout-failure"?
      <button className='cursor-pointer'
      onClick={handleModalClose}
      >
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>:
      logoutStatus==="not-loggedout"?
      <button className='cursor-pointer'
      onClick={handleModalClose}
      >
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>:null



      }
      </div>
      {!error && logoutStatus==="not-loggedout"?
      <>
  
      <div className="mt-4 mb-6 text-[14px]">
        Are you sure you want to <strong>Log out</strong> from TMS  
      </div>
      <div className='flex justify-end gap-4 mt-2'>
        <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Cancel</button>
        <button className={`hover:bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`} onClick={handleLogout}>Log Out</button>
      </div> 
      </>: error?
      <div>
        <APIResponseStatus message={error} status={false}/>
        <div className='flex justify-end gap-4 mt-2'>
          <button className={`hover:bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`} onClick={handleModalClose}>Okay</button>
        </div> 
      </div>
      :null
      }

    </div>
  </div>
  )
}

export default LogoutModal
