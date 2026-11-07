import { Close } from '@mui/icons-material'
import React from 'react'
import ModalOverlay from '../common/ModalOverlay';

function ViewMemberModal(props:any) {
    const {setViewMemberModal,memberData}=props
    // function to close this modal
    const handleModalClose=()=>{
        setViewMemberModal(false)    
    }

  return (
    <ModalOverlay onClose={() => setViewMemberModal(false)}>
    <div className='bg-C55 rounded-[8px] p-5 w-[90%] md:w-[600px] shadow-xl' >
      <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11'>
        Member Profile
      </div>
      <button className='cursor-pointer'
      onClick={handleModalClose}
       aria-label="Close">
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>
      </div> 
      <div className='flex flex-col text-[14px]'>
        <div className='mx-auto w-[150px] h-[150px] rounded-[8px]  flex justify-center my-2 items-center   bg-C11 p-1'>
        {memberData?.profilePictureURL===""?
        <div
            className='flex items-center justify-center w-full h-full font-bold text-center text-white text-[40px] capitalize rounded-[2px] bg-C11 border-[2px] border-white'>
            {`${memberData.firstName[0]} ${memberData.lastName[0]}`}
        </div>:
          <img src="" alt="profileimage " />
          }
        
        </div>

        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>First Name</div>
          <div className='w-1/2 font-bold'>{memberData?.firstName}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Last Name</div>
          <div className='w-1/2 font-bold'>{memberData?.lastName}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Username</div>
          <div className='w-1/2 font-bold'>{memberData?.username}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Role</div>
          <div className='w-1/2 font-bold'>{memberData?.role}</div>
        </div>
        <div className='flex flex-row items-start justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Bio</div>
          {
          memberData?.bio===""?
          <div className='w-1/2 italic text-gray-300'>not specified</div>:
          <div className='w-1/2 font-bold'>{memberData?.bio}</div>
          }
        </div>
        {/* <Loader/> */}
      </div>
    </div>
  </ModalOverlay>
  )
}

export default ViewMemberModal
