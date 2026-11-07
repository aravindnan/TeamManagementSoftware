import React, { useEffect, useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import { Close } from "@mui/icons-material";
import ErrorBox from "../common/ErrorBox";
import { addTaskToProject } from "../services/projectServices";
import APIResponseStatus from "../common/APIResponseStatus";
import { Link } from "react-router-dom";

function AddNewTaskModal(props: any) {
  const { setAddTaskModal,activeProject,triggerRerender} = props;

  const [error, setError] = useState<string | null>(null);
  const [createTaskStatus,setCreateTaskStatus]=useState<any>("not-created");
  const [createdTaskId,setCreatedTaskId]=useState<string>("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);
    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = {
    taskTitle: "",
    taskDescription: "",
    taskPriority: "",
    assignedBy:activeProject?.projectManager?._id,
    assignedTo: "",
    dueDate: "",
  };

  const [addNewTaskFormData, setAddNewTaskFormData]: any = useState<any>({
    taskTitle: "",
    taskDescription: "",
    taskPriority: "",
    assignedBy: activeProject?.projectManager?._id ,
    assignedTo: "",
    dueDate: "",
  });

  const handleInputChange = (e: any) => {

    setAddNewTaskFormData({
      ...addNewTaskFormData,
      [e.target.name]: e.target.value,
    });
  };

  const validateBeforeSubmit = () => {
    if(!addNewTaskFormData.taskTitle.trim()){
      setError("Task Title cannot be empty")
    }
    else if(!addNewTaskFormData.taskDescription.trim()){
      setError("Task Description cannot be empty")
    }
    else if(!addNewTaskFormData.taskPriority.trim()){
      setError("Please choose a Task Priority")
    }
    else if(!addNewTaskFormData.assignedTo.trim()){
      setError("Choose a User To Assign the Task To")
    }
    else if(!addNewTaskFormData.dueDate.trim()){
      setError("Please Specify a Deadline")
    }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDateObj = new Date(addNewTaskFormData.dueDate);

  if (dueDateObj < tomorrow) {
    setError("Due date must be tomorrow or later");
    return false;
  }

  
    return true;
  };

  const handleSubmit = async() => {
    // Add your validation logic here

    if (validateBeforeSubmit()) {
      // Perform registration logic here call API
      setCreateTaskStatus("create-loading")
      const res: any = await addTaskToProject(activeProject._id,addNewTaskFormData)
      if (res?.status) {
        setCreateTaskStatus("create-success")
        setCreatedTaskId(res.taskId)
        triggerRerender()
      } else {
        setCreateTaskStatus("create-failure")
      }

      // setAddNewTaskFormData(emptyState);
    } else {
      // Display error message
    
    }
  };

  // function to close the modal
  const handleModalClose = () => {
    setAddNewTaskFormData(emptyState)
    setAddTaskModal(false);
  };

  return (
    <ModalOverlay onClose={() => setAddTaskModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[700px] shadow-xl">
        <div className="flex flex-row items-center justify-between">
          <div className="font-bold text-[20px] text-C11">Add New Task</div>
          <button className="cursor-pointer" onClick={handleModalClose} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>
        {createTaskStatus==="not-created"?
                <div className="my-1 mt-2 text-[14px] flex flex-col md:flex-row gap-2">
                <div className="flex flex-col flex-1 gap-2">
                  <div className="flex flex-col gap-1">
                    <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                      Task Name
                    </div>
                    <input
                      type="text"
                      className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                      name="taskTitle"
                      id="taskTitle"
                      value={addNewTaskFormData.taskTitle}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                      Task Description
                    </div>
                    <textarea
                      rows={5}
                      className="bg-C44 rounded-[8px]  p-2 text-[14px] resize-none"
                      name="taskDescription"
                      id="taskDescription"
                      value={addNewTaskFormData.taskDescription}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap flex-row md:flex-col md:w-[40%] gap-2">
                  <div className="flex flex-col gap-1">
                    <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                      Assigned To
                    </div>
                    <select
                      name="assignedTo"
                      id="assignedTo"
                      className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                      value={addNewTaskFormData.assignedTo}
                      onChange={handleInputChange}
                      defaultValue=" "
                    >
                      <option value=" "selected>
                        None Selected
                      </option>
                      {activeProject?.projectMembers?.map((node: any) => (
                        <option value={node?._id} className="text-C11" key={node._id}>
                          {`${node.firstName} ${node.lastName}`}
                        </option>
                      ))}
                    </select>
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
                      value={addNewTaskFormData.dueDate}
                      onChange={handleInputChange}
                    />
                  </div>
      
                  <div className="flex flex-col gap-1">
                    <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                      Task Priority
                    </div>
                    <select
                      name="taskPriority"
                      id="taskPriority"
                      className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                      value={addNewTaskFormData.taskPriority}
                      onChange={handleInputChange}
                      defaultValue=" "
                    >
                        <option value="" className="text-C11" selected>None Selected</option>
                        <option value="High" className="text-C11">High</option>
                        <option value="Medium" className="text-C11">Medium</option>
                        <option value="Low" className="text-C11">Low</option>
                    </select>
                  </div>
                </div>
              </div>

        :createTaskStatus==="create-loading"?
          <div className="flex justify-center text-[16px] font-light ">
            <div>Creating New Task...</div>
          </div>:
          createTaskStatus==="create-success"?
           <APIResponseStatus message="Task Created" status={true}/>:
           createTaskStatus==="create-failure"?
           <APIResponseStatus message="Failed To Create" status={false}/>:null
          }

        {error?
          // Section to implement the logic for validation
          <ErrorBox message={error} />:null
        }
        <div className="flex justify-end gap-4 mt-2">
          {/* <button
            className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
            onClick={handleModalClose}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
          >
            Save
          </button> */}
{
        createTaskStatus==="not-created"?
        <div className="flex justify-end gap-4 mt-4">
          
          <button
            className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
            onClick={handleModalClose}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
          >
            Save
          </button>
        </div>:
        createTaskStatus==="create-loading"?
        null:
        createTaskStatus==="create-success"?
        <div className="flex justify-end gap-4 mt-4">
            
            <button
              className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
              onClick={handleModalClose}
            >
              Back To Project
            </button>
            <Link to={`/task-page?id=${createdTaskId}`}>
            <div
              className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
            >
              Go To Task
            </div>
            </Link>
        </div>:
        createTaskStatus==="create-failure"?
        <div className="flex justify-end gap-4 mt-4">
            <button
              className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
              onClick={handleModalClose}
            >
              Back To Project
            </button>
        </div>:
        null
        }

        </div>
      </div>
    </ModalOverlay>
  );
}

export default AddNewTaskModal;
