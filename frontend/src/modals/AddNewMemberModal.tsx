import React, { useEffect, useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import { Close } from "@mui/icons-material";
import ErrorBox from "../common/ErrorBox";
import { getAllUsers } from "../services/userServices";
import APIResponseStatus from "../common/APIResponseStatus";
import { addMemberToProject } from "../services/projectServices";
import { useSelector } from "react-redux";

function AddNewMemberModal(props: any) {
  const { setAddMemberModal ,triggerRerender,activeProject} = props;
  const [error, setError] = useState<any>();
  const [allUsers, setAllUsers] = useState<any>([]);
  const [loading,setLoading] = useState<Boolean>(true)
  const [addNewMemberStatus,setAddNewMemberStatus] = useState<string>("not-added")

  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    // Clear the timeout if the component unmounts or if there's a new error
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(()=>{
    if(allUsers.length===0){
      setLoading(true)
      getUsers()
    }
  },[])

  const getUsers =async()=>{
     await getAllUsers().then((res:any)=>{
        const tempARRAY= res.filter((user:any)=>(user._id!==myProfiledata?._id))
        if(tempARRAY.length>0){
          setLoading(false)
        }
        setAllUsers(tempARRAY)
      })
    }
    
  
  
  const emptyState = {
    memberId: "",
  };

  const [addMemberFormData, setAddMemberFormData]: any = useState<any>({
    memberId: "",
  });

  const validateBeforeSubmit = () => {

    if(!addMemberFormData.memberId.trim()){
      setError( "Please Choose a Member");
      return false;
    }
    return true
  }
  const handleInputChange = (e: any) => {
    setAddMemberFormData({
      ...addMemberFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async() => {
    // Add your validation logic here
    if (validateBeforeSubmit()) {
      setAddNewMemberStatus("add-loading")
      await addMemberToProject(activeProject?._id,addMemberFormData).then((res:any)=>{
        const tempOBJ = res.data
        triggerRerender()
        setAddMemberFormData(emptyState)
        setAddNewMemberStatus("add-success")
      }).catch((err:any)=>{
        setAddNewMemberStatus("add-failure")
      })

      setAddMemberFormData(emptyState)
      // setAddNewTaskFormData(emptyState);
    } else {
      // Display error message
    }
  };

  const handleModalClose = () => {
    setAddMemberFormData(emptyState)
    setAddMemberModal(false);
  };

  return (
    <ModalOverlay onClose={() => setAddMemberModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[500px] shadow-xl">
        <div className="flex flex-row items-center justify-between">
          <div className="font-bold text-[20px] text-C11">Add New Member</div>
          <button className="cursor-pointer" onClick={handleModalClose} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>
        {
          addNewMemberStatus==="not-added"?
        <div className="my-4 text-[14px] flex flex-row gap-2 ">
          {
          loading?
          <div className="flex justify-center  mx-auto text-[16px] font-light ">
          <div>Loading All Users...</div>
          </div>:
          <div className="flex flex-col w-full gap-1 mt-2">
            <div className=" text-C11 text-[10px] font-bold  w-fit  select-none">
              Choose a member
            </div>
            <select
              name="memberId"
              id="memberId"
              className="bg-C44 rounded-[8px]  p-2 text-[14px]"
              value={addMemberFormData.userId}
              onChange={handleInputChange}
            >
              <option value=" " selected>
                None Selected
              </option>
              {allUsers?.map((node: any) => (
                <option value={node._id} className="text-C11" key={node._id}>
                  {`${node.firstName} ${node.lastName}`}
                </option>
              ))}
            </select>
          </div>

          }
        </div>:
        addNewMemberStatus==="add-loading"?
        <div className="flex justify-center text-[16px] font-light ">
        <div>Adding Member To Project...</div>
        </div>:
        addNewMemberStatus === "add-success"?
          <APIResponseStatus status={true} message="Memeber Added to Project"/>:
          addNewMemberStatus === "add-failure"?
           <APIResponseStatus status={true} message="Failed To Add Member"/>:
       null
        }

        {error?
          <ErrorBox message={error} />:null
        }
        <div className="flex justify-end gap-4 mt-4">
        
        <button
          className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`}
          onClick={handleModalClose}
        >
          {((addNewMemberStatus==="add-success"||addNewMemberStatus==="add-failure"))? "Back To Project":addNewMemberStatus==="add-loading"?null:"Close"}
        </button>

        {
        addNewMemberStatus==="not-added"?
        
        <button
          onClick={handleSubmit}
          className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
        >
          Add
        </button>:null
      }

      </div>
      </div>
    </ModalOverlay>
  );
}

export default AddNewMemberModal;
