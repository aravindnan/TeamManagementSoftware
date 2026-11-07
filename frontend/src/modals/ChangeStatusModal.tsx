import React, { useEffect, useState } from 'react'
import ModalOverlay from '../common/ModalOverlay';
import APIResponseStatus from '../common/APIResponseStatus'
import { Close } from '@mui/icons-material'
import { changeTaskStatus } from '../services/taskServices'

function ChangeStatusModal(props:any) {
    const {setTaskStatusModal,activeTask,triggerRerender}=props
    const[updateTaskStatus,setUpdateTaskStatus]=useState<string>("not-updated")
    const[currentStatus,setCurrentStatus] = useState<string>(activeTask?.taskStatus)

    useEffect(()=>{
        if(currentStatus==="Completed"){
            setCurrentStatus("In Progress")
        }
        else{
            setCurrentStatus("Completed")
        }

    },[activeTask])


    const handleUpdate =async()=>{
      setUpdateTaskStatus("update-loading")
      await changeTaskStatus(activeTask?._id,currentStatus).then((res:any)=>{
        if(res?.updateStatus){
          setUpdateTaskStatus("update-success")
          triggerRerender()
        }
      }).catch((err:any)=>{
        setUpdateTaskStatus("update-failure")
      })
      
    }

    const handleModalClose =()=>{
        setTaskStatusModal(false)
    }
  return (
    <ModalOverlay onClose={() => setTaskStatusModal(false)}>
    <div className='bg-C55 rounded-[8px] p-5 w-[90%] md:w-[500px] shadow-xl' >
      <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11'>
        Update Task Status
      </div>
      {updateTaskStatus!=="update-success"?
      <button className='cursor-pointer'
      onClick={handleModalClose}
       aria-label="Close">
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>:null
       }
      </div> 
      {updateTaskStatus==="not-updated"?
      <div className="mt-4 mb-6 text-[14px]">
        {activeTask?.taskStatus!=="Completed"?
        <span>Do you confirm to mark this  task as <strong>Completed</strong>?</span>:
        <span>Do you confirm change task as <strong>In Progress</strong>?</span>
        }
        
      </div>:
      updateTaskStatus==="update-loading"?
      null:
      updateTaskStatus==="update-success"?
      <APIResponseStatus status={true} message="Task Status Updated"/>
      :updateTaskStatus==="update-failure"?
      <APIResponseStatus status={false} message="Updation Failed"/>
      :null


      } 
      <div className='flex justify-end gap-4 mt-2'>
        {
          updateTaskStatus==="not-updated"?
          <>
        <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Not Sure</button>
        <button className={` bg-C11 rounded-[8px] text-C55 font-bold text-[12px] py-2 px-5`} onClick={handleUpdate}>Update</button>
          </>:
           updateTaskStatus==="update-loading"?
           <div className="flex justify-center text-[16px] font-light mx-auto ">
           <div>Updating Task Status...</div>
           </div>:
           updateTaskStatus==="update-success"?
           <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Back To Task</button>:
           updateTaskStatus==="update-failure"?
           <button className={` bg-inactiveC11 rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}  onClick={handleModalClose}>Close</button>:
           null
        }
      </div> 
    </div>
  </ModalOverlay>
  )
}

export default ChangeStatusModal
