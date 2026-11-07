import { Close } from "@mui/icons-material";
import React, { useEffect, useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import ErrorBox from "../common/ErrorBox";
import { editProjectById } from "../services/projectServices";
import APIResponseStatus from "../common/APIResponseStatus";

function EditProjectInfoModal(props: any) {
  const { setEditProjectInfoModal,activeProject ,triggerRerender} = props;
  const [error, setError] = useState<string | null>(null);
  const [editProjectStatus,setEditProjectStatus] = useState<string>("not-edited")

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = {
    projectName:activeProject?.projectName,
    projectDescription: activeProject?.projectDescription,
    projectStatus: activeProject.status,
  };

  const [editProjectFormData, setEditProjectFormData]: any = useState<any>({
    projectName:activeProject?.projectName,
    projectDescription: activeProject?.projectDescription,
    projectStatus: activeProject.projectStatus,
  });

  const validateBeforeSubmit = () => {

    if(!editProjectFormData.projectName.trim()){
      setError( "Project Name cannot be empty");
      return false;
    }
    else if(!editProjectFormData.projectDescription.trim()) {
      setError("Project Description cannot be Empty")
      return false;
    }
    else if(!editProjectFormData.projectStatus.trim()){
      setError("Please select Project Status");
      return false;
    }
    return true
  }
  const handleInputChange = (e: any) => {
    setEditProjectFormData({
      ...editProjectFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async() => {
    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setEditProjectStatus("edit-loading")
      // Perform registration logic here call API
      await editProjectById(activeProject?._id,editProjectFormData).then((res:any)=>{
        if(res.status){
          setEditProjectStatus("edit-success")
          triggerRerender()
          setEditProjectFormData(emptyState)
        }
      }).catch((err:any)=>{
        setEditProjectStatus("edit-failure")
        setEditProjectFormData(emptyState)
      })
      // setAddNewTaskFormData(emptyState);
    } else {
      // Display error message
    }
  };

  const handleModalClose = () => {
    setEditProjectFormData(emptyState)
    setEditProjectInfoModal(false);
  };

  return (
    <ModalOverlay onClose={() => setEditProjectInfoModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[700px] shadow-xl">
        <div className="flex flex-row items-center justify-between">
          <div className="font-bold text-[20px] text-C11">
            Edit Project Info
          </div>
          <button className="cursor-pointer" onClick={handleModalClose} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>
        {
        editProjectStatus==="not-edited"?
        <div className="my-1 mt-2 text-[14px] flex flex-col gap-2 ">
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Project Name
              </div>
              <input
                name="projectName"
                id="projectName"
                type="text"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                value={editProjectFormData.projectName}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Project Description
              </div>
              <textarea
                rows={5}
                name="projectDescription"
                id="projectDescription"
                className="bg-C44 rounded-[8px]  p-2 text-[14px] resize-none"
                value={editProjectFormData.projectDescription}
                onChange={handleInputChange}
              />
            </div>
          <div className="flex flex-col gap-1">
            <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
              Project Status
            </div>
            <select
              name="projectStatus"
              id="projectStatus"
              className="bg-C44 rounded-[8px]  p-2 text-[14px]"
              value={editProjectFormData.projectStatus}
              onChange={handleInputChange}
            >
              <option value="" className="text-C11" >
                None Selected
              </option>
              <option value="In Progress" className="text-C11" >
                In Progress
              </option>
              <option value="Completed" className="text-C11">
                Completed
              </option>
            </select>
          </div>
          
        </div>:
        editProjectStatus ==="edit-loading"?
        <div className="flex justify-center text-[16px] font-light ">
        <div>Editing Project Info...</div>
        </div>:
        editProjectStatus === "edit-success"?
          <APIResponseStatus status={true} message="Project Info Edited"/>:
        editProjectStatus === "edit-failure"?
           <APIResponseStatus status={false} message="Project Edit Failed"/>:
       null
        }
        <div className="mt-2">

        {error?
          <ErrorBox message={error  } />:null
        }
        </div>

        <div className="flex justify-end gap-4 mt-4">
        
          <button
            className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
            onClick={handleModalClose}
          >
            {((editProjectStatus==="edit-success"||editProjectStatus==="edit-failure"))? "Back To Project":editProjectStatus==="edit-loading"?null:"Close"}
          </button>

          {
          editProjectStatus==="not-edited"?
          
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

export default EditProjectInfoModal;
