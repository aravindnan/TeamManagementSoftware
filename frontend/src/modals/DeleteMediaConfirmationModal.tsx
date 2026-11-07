import { Close } from '@mui/icons-material'
import React, { useState } from 'react'
import ModalOverlay from '../common/ModalOverlay';
import APIResponseStatus from '../common/APIResponseStatus'
import { deleteMediaFromProject } from '../services/projectServices'

function DeleteMediaConfirmationModal(props:any) {

    const {setDeleteProjectMediaModal,activeMedia,activeProject,triggerRerender,setViewMediaModal}=props
    const[deleteMediaStatus,setDeleteMediaStatus]=useState<string>("not-deleted")


    const handleDelete =async()=>{
      setDeleteMediaStatus("delete-loading")

      await deleteMediaFromProject(activeProject?._id,activeMedia?.mediaURL).then((res:any)=>{
        if(res?.deleteStatus){
          setDeleteMediaStatus("delete-success")
          triggerRerender()
        }
        else{
            setDeleteMediaStatus("delete-failure")
        }
      }).catch((err:any)=>{
        setDeleteMediaStatus("delete-failure")
      })
    }

    const handleModalClose =()=>{
        
        setDeleteProjectMediaModal({[`isOpen`]:false,[`mediaData`]:null})
    }

    const handleDeleteSuccessClose = ()=>{
      setDeleteProjectMediaModal({[`isOpen`]:false,[`mediaData`]:null})
      setViewMediaModal({[`isOpen`]:false,[`mediaData`]:null})
    }

    
    
  return (
    <ModalOverlay onClose={() => setDeleteProjectMediaModal({[`isOpen`]:false,[`mediaData`]:null})}>
    <div className='bg-C55 rounded-[8px] p-5 w-[90%] md:w-[500px] shadow-xl' >
      <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11'>
        Delete Media
      </div>
      {deleteMediaStatus!=="delete-success"?
      <button className='cursor-pointer'
      onClick={handleModalClose}
       aria-label="Close">
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>:null
       }
      </div> 
      {deleteMediaStatus==="not-deleted"?
      <div className="mt-4 mb-6 text-[14px]">
        This process is irreversible !!<br/>
        Are you sure you want to remove " <strong>{activeMedia?.mediaName}</strong> " from <strong>{activeProject?.projectName}</strong> ? 
      </div>:
      deleteMediaStatus==="delete-loading"?
      null:
      deleteMediaStatus==="delete-success"?
      <APIResponseStatus status={true} message="Media Deleted"/>
      :deleteMediaStatus==="delete-failure"?
      <APIResponseStatus status={false} message="Deletion Failed"/>
      :null
      } 
      <div className='flex justify-end gap-4 mt-2'>
        {
          deleteMediaStatus==="not-deleted"?
          <>
        <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Not Sure</button>
        <button
         className={`hover:bg-inactiveRed rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5`} 
         onClick={handleDelete}>Delete</button>
          </>:
           deleteMediaStatus==="delete-loading"?
           <div className="flex justify-center text-[16px] font-light mx-auto ">
           <div>Deleting Media...</div>
           </div>:
           deleteMediaStatus==="delete-success"?
           <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleDeleteSuccessClose}>Close</button>:
           deleteMediaStatus==="delete-failure"?
           <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Close</button>:
           null

        }
      </div> 
    </div>
  </ModalOverlay>
  )
}

export default DeleteMediaConfirmationModal
