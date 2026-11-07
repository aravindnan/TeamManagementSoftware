import { Close } from '@mui/icons-material'
import React, { useState } from 'react'
import { deleteMemberFromProject } from '../services/projectServices'
import APIResponseStatus from '../common/APIResponseStatus'

function RemoveMemberConfirmationModal(props:any) {

    const {setRemoveMemberModal,activeProject,memberData,triggerRerender}=props
    const [deleteMemberStatus,setDeleteMemberStatus]= useState<string>("not-deleted")

    const handleRemove=async()=>{
      setDeleteMemberStatus("delete-loading")
      const userData = {
        memberId:memberData?._id
      }
      await deleteMemberFromProject(activeProject._id,userData).then((res:any)=>{
        if(res?.deleteStatus){
          setDeleteMemberStatus("delete-success")
          triggerRerender()
        }
      }).catch((err:any)=>{
        setDeleteMemberStatus("delete-failure")
      })
    }

    const handleModalClose =()=>{
        setRemoveMemberModal(false)
    }

  return (
    <div className='top-0 left-0 absolute w-[100vw] h-[100vh] bg-[#00000054] flex justify-center items-center'>
    <div className='bg-C55 rounded-[8px] p-5 w-[500px] shadow-xl' >
      <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11'>
        Remove Member
      </div>
      <button className='cursor-pointer'
      onClick={handleModalClose}
      >
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>
      </div>  
      {deleteMemberStatus==="not-deleted"?
        <div className="mt-4 mb-6 text-[14px]">
          This action is irreversible!<br/>
          Are you sure you want to remove <strong>{`${memberData?.firstName} ${memberData?.lastName}`}</strong> from  <strong>{activeProject?.projectName}</strong> ? 
        </div>
        :deleteMemberStatus==="delete-loading"?
        <div className="flex justify-center text-[16px] font-light mt-5">
          <div>Removing {memberData?.firstName}...</div>
        </div>:
        deleteMemberStatus==="delete-success"?
         <APIResponseStatus message="Member Deleted" status={true}/>:
         deleteMemberStatus==="delete-failure"?
         <APIResponseStatus message="Member Deletion Failed" status={false}/>:null
        }


      <div className='flex justify-end gap-4 mt-2'>
        {deleteMemberStatus==="not-deleted"?
        <>
        <button className={`bg-inactiveC11  rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Not Sure</button>
        <button className={` hover:bg-inactiveRed rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5` }onClick={handleRemove}>Remove</button>
        </>
         :
        deleteMemberStatus==="delete-loading"?
        null:
        deleteMemberStatus==="delete-failure" ||  deleteMemberStatus==="delete-success"?
        <button className={`hover:bg-inactiveC11  rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Back To Project</button>:null

        }
         </div> 
    </div>
  </div>
  )
}

export default RemoveMemberConfirmationModal
