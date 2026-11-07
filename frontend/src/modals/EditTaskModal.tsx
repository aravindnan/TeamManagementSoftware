import { Close } from "@mui/icons-material";
import React, { useEffect, useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import ErrorBox from "../common/ErrorBox";
import { editTaskById } from "../services/taskServices";
import APIResponseStatus from "../common/APIResponseStatus";

function EditTaskModal(props: any) {
  const { setEditTaskModal,activeTask,triggerRerender } = props;
  const [error, setError] = useState<string | null>(null);
  const [editTaskStatus,setEditTaskStatus] = useState<string>("not-edited")


  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = {
    taskTitle: activeTask?.taskTitle,
    taskDescription: activeTask?.taskDescription,
    taskStatus: activeTask?.taskStatus,
    taskDueDate:activeTask?.dueDate,
    taskPriority:activeTask?.taskPriority
  };

  const [editTaskFormData, setEditTaskFormData]: any = useState<any>({
    taskTitle: activeTask?.taskTitle,
    taskDescription: activeTask?.taskDescription,
    taskStatus: activeTask?.taskStatus,
    dueDate:activeTask?.dueDate,
    taskPriority:activeTask?.taskPriority

  });

  const validateBeforeSubmit = () => {
    if (!editTaskFormData.taskTitle.trim()) {
      setError("Task Title cannot be empty");
      return false;
    } else if (!editTaskFormData.taskDescription.trim()) {
      setError("Task Description cannot be Empty");
      return false;
    } else if (!editTaskFormData.taskStatus.trim()) {
      setError("Please select Task Status");
      return false;
    }
    else if (!editTaskFormData.dueDate.trim()) {
      setError("Please select Task Due Date");
      return false;
    }

    return true;
  };
  const handleInputChange = (e: any) => {
    setEditTaskFormData({
      ...editTaskFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async() => {
    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setEditTaskStatus("edit-loading")
      // Perform registration logic here call API
      const res: any = await editTaskById(activeTask?._id,editTaskFormData)
      if (res?.editStatus) {
        setEditTaskStatus("edit-success")
        setEditTaskFormData(emptyState)
        triggerRerender()
      } else {
        setEditTaskStatus("edit-failure")
      }
      // setAddNewTaskFormData(emptyState);
    } else {
      // Display error message
    }
  };

  // function to close this modal
  const handleModalClose = () => {
    setEditTaskFormData(emptyState);
    setEditTaskModal(false);
  };
  return (
    <ModalOverlay onClose={() => setEditTaskModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[700px] shadow-xl">
        <div className="flex flex-row items-center justify-between">
          <div className="font-bold text-[20px] text-C11">Edit Task Info</div>
          <button className="cursor-pointer" onClick={handleModalClose} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>
        <div className="my-1 mt-2 text-[14px] flex flex-row gap-2 justify-center">
          {
            editTaskStatus==="not-edited"?
          <div className="flex flex-col flex-1 gap-2">
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Task Name
              </div>
              <input
                type="text"
                name="taskTitle"
                id="taskTitle"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                value={editTaskFormData.taskTitle}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Deadline
              </div>
              <input
                type="date"
                name="dueDate"
                id="dueDate"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                value={editTaskFormData.dueDate}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Task Description
              </div>
              <textarea
                rows={5}
                name="taskDescription"
                id="taskDescription"
                className="bg-C44 rounded-[8px]  p-2 text-[14px] resize-none"
                value={editTaskFormData.taskDescription}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Task Status
              </div>
              <select
                name="taskStatus"
                id="taskStatus"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                value={editTaskFormData.taskStatus}
                onChange={handleInputChange}
              >
                <option value="" selected>
                  None Selected
                </option>
                <option value="To Do" >
                  To Do
                </option>
                <option value="In Progress" >
                  In Progress
                </option>
                <option value="In Review" >
                  In Review
                </option>
                <option value="Completed" >
                  Completed
                </option>
                
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Task Priority
              </div>
              <select
                name="taskPriority"
                id="taskPriority"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                value={editTaskFormData.taskPriority}
                onChange={handleInputChange}
              >
                <option value="" selected>
                  None Selected
                </option>
                <option value="High" >
                  High
                </option>
                <option value="Medium" >
                  Medium
                </option>
                <option value="Low" >
                  Low
                </option>
                
              </select>
            </div>
          </div>:
          editTaskStatus==="edit-loading"?
          <div className="flex justify-center w-full text-[16px] font-light ">
          <div className="mx-auto">Editing Task Info...</div>
          </div>:
          editTaskStatus === "edit-success"?
            <APIResponseStatus status={true} message="Task Info Edited"/>:
            editTaskStatus === "edit-failure"?
             <APIResponseStatus status={false} message="Task Edit Failed"/>:
         null
          }

        </div>
        <div className="mt-2">
        {error&&
          <ErrorBox message={error} />
        }
        </div>
        <div className="flex justify-end gap-4 mt-4">
          <button
            className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
            onClick={handleModalClose}
          >
          {((editTaskStatus==="edit-success"||editTaskStatus==="edit-failure"))? "Back To Task":editTaskStatus==="edit-loading"?null:"Close"}

          </button>
          {
          editTaskStatus==="not-edited"?
          
          <button
            onClick={handleSubmit}
            className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
          >
            Save
          </button>:null
        }
        </div>
      </div>
    </ModalOverlay>
  );
}

export default EditTaskModal;
