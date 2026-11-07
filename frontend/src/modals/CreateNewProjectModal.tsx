import React, { useEffect, useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import ErrorBox from "../common/ErrorBox";
import { errorMessage } from "../services/apiClient";
import { createNewProject } from "../services/projectServices";
import { useSelector } from "react-redux";
import APIResponseStatus from "../common/APIResponseStatus";
import { Link } from "react-router-dom";

function CreateNewProjectModal(props: any) {
  const { setCreateNewProjectModal,triggerRerender} = props;
  const [error, setError] = useState<string | null>(null);
  const [createProjectStatus,setCreateProjectStatus] = useState<any>("not-created")
  const [createdProjectId,setCreatedProjectId] = useState<any>(null)
  const [apiResponseMessage,setApiResponseMessage] = useState<string>("")


  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  const emptyState = {
    projectName: "",
    projectDescription: "",
  };

  const [createProjectFormData, setCreateProjectFormData]: any = useState<any>({
    projectName: "",
    projectDescription: "",
  });

  const handleInputChange = (e: any) => {
    setCreateProjectFormData({
      ...createProjectFormData,
      [e.target.name]: e.target.value,
    });
  };

  const validateBeforeSubmit = () => {
    // Check if username and password are not empty
    if (!createProjectFormData.projectName.trim()) {
      setError('Project Name cannot be empty');
      return false;
    }
    else if(!createProjectFormData.projectDescription.trim()){
      setError('Project Description cannot be empty')
      return false
    }
    // Add any other specific validation rules here
    // If all validations pass, return true
    return true;
    };
    const myProfiledata = useSelector(
      (state: any) => state.authReducer.myUserProfile
    );

  const handleSubmit = async() => {

    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setCreateProjectStatus("create-loading")
      // Perform registration logic here call API
      const res: any = await createNewProject(createProjectFormData,myProfiledata._id)
      if (res?.project?._id) {
        setCreateProjectFormData(emptyState)
        setCreateProjectStatus("create-success")
        setCreatedProjectId(res.project._id);
        triggerRerender()
      } else {
        setCreateProjectStatus("create-failure")
        setApiResponseMessage(errorMessage(res, "Could not create the project"))
      }
    } else {
      // Display error message
    }
  };

  // function to close this modal
  const handleModalClose = () => {
    setCreateProjectFormData(emptyState)
    setCreateNewProjectModal(false);
  };

  return (
    <ModalOverlay onClose={() => setCreateNewProjectModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[700px] shadow-xl">
        <div className="font-bold text-[20px] text-C11">New Project</div>
        <div className="my-1 mt-2 text-[14px] flex flex-col gap-2 ">
          {
            createProjectStatus==="not-created"?
          <div className="flex flex-col flex-1 gap-2">
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Project Name
              </div>
              <input
                type="text"
                className="bg-C44 rounded-[8px]  p-2 text-[14px]"
                name="projectName"
                id="projectName"
                value={createProjectFormData.projectName}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
                Project Description
              </div>
              <textarea
                rows={7}
                className="bg-C44 rounded-[8px]  p-2 text-[14px] resize-none"
                name="projectDescription"
                id="projectDescription"
                value={createProjectFormData.projectDescription}
                onChange={handleInputChange}
              />
            </div>
          </div>:
          createProjectStatus==="create-loading"?
          <div className="flex justify-center text-[16px] font-light ">
            <div>Creating New Project...</div>
          </div>:
          createProjectStatus==="create-success"?
           <APIResponseStatus message="Project Created" status={true}/>:
           createProjectStatus==="create-failure"?
           <APIResponseStatus message={apiResponseMessage} status={false}/>:null
          }

          {error?
            // Section to implement the logic for validation
            <ErrorBox message={error} />:null
          }
        </div>
        {
        createProjectStatus==="not-created"?
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
        createProjectStatus==="create-loading"?
        null:
        createProjectStatus==="create-success"?
        <div className="flex justify-end gap-4 mt-4">
            
            <button
              className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
              onClick={handleModalClose}
            >
              Back To Dashboard
            </button>
            <Link to={`/project-page?id=${createdProjectId}`}>
            <div
              className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
            >
              Go To project
            </div>
            </Link>
        </div>:
        createProjectStatus==="create-failure"?
        <div className="flex justify-end gap-4 mt-4">
            <button
              className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
              onClick={handleModalClose}
            >
              Back To Dashboard
            </button>
        </div>:
        null


        }


      </div>
    </ModalOverlay>
  );
}

export default CreateNewProjectModal;
