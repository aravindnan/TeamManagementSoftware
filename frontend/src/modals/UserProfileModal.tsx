import { Close, Edit } from '@mui/icons-material'
import React, { useState } from 'react'
import ModalOverlay from '../common/ModalOverlay';
import { Tooltip } from '@mui/material'
import { useSelector } from 'react-redux'
import moment from 'moment'
import ErrorBox from '../common/ErrorBox'
import { editUserById } from '../services/userServices'
import APIResponseStatus from '../common/APIResponseStatus'

function UserProfileModal(props:any) {
  const myProfiledata = useSelector(
    (state: any) => state.authReducer.myUserProfile
  );

    const {setUserProfileModal,triggerRerender}=props
    const [editState,setEditState] = useState<Boolean>(false)
    const [error, setError] = useState<string | null>(null);
    const [editProfileStatus,setEditProfileStatus] = useState<string>("not-edited")
    const emptyState = {
      firstName:myProfiledata?.firstName,
      lastName:myProfiledata?.lastName,
      username:myProfiledata?.username,
      email:myProfiledata?.email,
      bio:myProfiledata?.bio,
      dateOfBirth:myProfiledata?.dateOfBirth,
      role:myProfiledata?.role
    }
    const [userProfileFormData,setUserProfileFormData] = useState<any>(emptyState)
    // function to close this modal
    const handleModalClose=()=>{
      setEditState(false)
      setUserProfileModal(false)    
    }

    const validateBeforeSubmit = () => {
  
      if (
        !userProfileFormData.firstName ||
        !userProfileFormData.lastName ||
        !userProfileFormData.username ||
        !userProfileFormData.role ||
        !userProfileFormData.dateOfBirth ||
        !userProfileFormData.email
      ) {
        setError("All fields are required");
        return false;
      }
  
      // Simple email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userProfileFormData.email)) {
        setError("Invalid email format");
        return false;
      }

      const currentDate = new Date();
      const birthDate = new Date(userProfileFormData.dateOfBirth);
      const ageDifference = currentDate.getFullYear() - birthDate.getFullYear();
  
      // Check if the person is above 18
      if (ageDifference < 18) {
        setError("Age must be 18 or above");
        return false;
      }
      // Add more validation logic based on your requirements
  
      setError(null); // Reset error if validation passes
      return true;
    };

    const handleUpdate=async()=>{
      if(validateBeforeSubmit()){
      
        setEditProfileStatus("edit-loading");
        // Perform registration logic here call API
        await editUserById(myProfiledata?._id,userProfileFormData)
          .then((res: any) => {
            if(res.updateStatus){
              setEditProfileStatus("edit-success");
              triggerRerender()
            }
            else{
              setEditProfileStatus("edit-failure");
            }
            
          })
          .catch((err: any) => {
            setEditProfileStatus("edit-failure");
          });
          setUserProfileFormData(emptyState);
      } else {
        // Display error message
      }

    }

    const handleInputChange = (e: any) => {
      setUserProfileFormData({
        ...userProfileFormData,
        [e.target.name]: e.target.value,
      });
    };


  return (
    <ModalOverlay onClose={() => setUserProfileModal(false)}>
    <div className='bg-C55 rounded-[8px] p-5 w-[90%] md:w-[600px] shadow-xl' >
      <div className='flex flex-row items-center justify-between'>
      <div className='font-bold text-[20px] text-C11'>
      {`${editState?"Edit ":""} My  Profile`}  
      </div>
      <button className='cursor-pointer'
      onClick={handleModalClose}
       aria-label="Close">
        <Close sx={{fontSize:20,fontWeight:800}}/>
      </button>
      </div> 
      <div className='flex flex-col text-[14px]'>
        {
        editProfileStatus==="not-edited"&&!editState?
        <div className='mx-auto w-[150px] h-[150px] rounded-[4px]  flex justify-center my-2 items-center  bg-C11 p-1'>
          {myProfiledata.profilePictureURL===""?
           <div
            className='flex items-center justify-center w-full h-full font-bold text-center text-white text-[40px] capitalize rounded-[2px] bg-C11 border-[2px] border-white'>
            {`${myProfiledata.firstName[0]} ${myProfiledata.lastName[0]}`}
           </div>:
            <img src="" alt="profileimage " />}
        </div>:null

        }
      {/* {
        editState&&
        <div className='flex justify-center mb-4'>
          <Tooltip title="Remove and Add New Profile Picture" placement='bottom' arrow>
          <button  className='text-C11 gap-[2px] flex flex-row items-center bg-inactiveC11 font-bold text-[10px] px-2 py-1 rounded-full'>
          <CameraAlt sx={{fontSize:13}}/>
          <span>Choose File</span>
          </button>
          </Tooltip>
        </div>
      }   */}
      {
        !editState&&
      <div className='flex justify-end gap-4 my-2'>
        <Tooltip title="Edit Profile" placement='left' arrow>
        <button
         onClick={()=>{setEditState(true);setEditProfileStatus("not-edited")}}
         className='flex flex-row items-center gap-1 hover:bg-[#012b3927] p-1 rounded-[4px]'>
          <Edit sx={{fontSize:18}}/>
        </button>
        </Tooltip>
        {/* <button className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[4px] font-semibold text-white  text-[10px] py-1 px-3`} >Edit Profile</button> */}
      </div>
      }  
      {
        !editState?
      <div className='flex flex-col'>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>First Name</div>
          <div className='w-1/2 font-bold'>{myProfiledata?.firstName}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Last Name</div>
          <div className='w-1/2 font-bold'>{myProfiledata?.lastName}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Username</div>
          <div className='w-1/2 font-bold'>{myProfiledata?.username}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Role</div>
          <div className='w-1/2 font-bold'>{myProfiledata?.role}</div>
        </div>
        <div className='flex flex-row items-center justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Date of birth</div>
          <div className='w-1/2 font-bold'>{moment(myProfiledata.dateOfBirth).format("LL")}</div>
        </div>
        <div className='flex flex-row items-start justify-between p-1 px-5 my-1 gap-x-2 bg-C44 rounded-[4px]'>
          <div className='w-1/2 text-C11'>Bio</div>
          {
          myProfiledata?.bio===""?
          <div className='w-1/2 italic text-gray-300'>not specified</div>:
          <div className='w-1/2 font-bold'>{myProfiledata?.bio}</div>
          }
        </div>
      </div>:
      editProfileStatus==="not-edited"?
      <div className='flex flex-col gap-2 max-h-[400px] overflow-y-auto'>
        <div className='flex flex-col gap-2 md:flex-row'>
          <div className='flex flex-col flex-1'>
            <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">First Name</div>
            <input 
            value={userProfileFormData?.firstName}
            name='firstName'
            onChange={handleInputChange}
            type="text" 
            className='bg-C44 rounded-[4px]  p-2 text-[14px]' />
          </div>
          <div className='flex flex-col flex-1 '>
            <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Last Name</div>
            <input 
            value={userProfileFormData?.lastName}
            name='lastName'
            onChange={handleInputChange}
            type="text" 
            className='bg-C44 rounded-[4px]  p-2 text-[14px]' />
          </div>
        </div> 

        <div className='flex flex-col gap-2 md:flex-row'>
        <div className='flex flex-col flex-1'>
          <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Email</div>
          <input
          value={userProfileFormData?.email}
          name='email'
          onChange={handleInputChange}
          type="email" 
          className='bg-C44 rounded-[4px]  p-2 text-[14px]' />
        </div>
        <div className='flex flex-col flex-1'>
          <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Username</div>
          <input 
          value={userProfileFormData?.username}
          name='username'
          onChange={handleInputChange}
          type="text" 
          className='bg-C44 rounded-[4px]  p-2 text-[14px]' />
        </div>
        </div> 


        <div className='flex flex-col gap-2 md:flex-row'>
        <div className='flex flex-col flex-1 '>
          <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Date Of Birth</div>
          <input 
            value={userProfileFormData?.dateOfBirth}
            name='dateOfBirth'
            onChange={handleInputChange}
          type="Date" 
          className='bg-C44 rounded-[4px]  p-2 text-[14px] cursor-pointer' />
        </div>
        <div className='flex flex-col flex-1 '>
          <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Role</div>
          <input 
            value={userProfileFormData?.role}
            name='role'
            onChange={handleInputChange}
          type="text" 
          className='bg-C44 rounded-[4px]  p-2 text-[14px]' />
        </div>
        </div>
        <div className='flex flex-col '>
          <div  className=" text-C11 text-[10px] font-bold  w-fit  select-none">Bio</div>
          <textarea 
            value={userProfileFormData?.bio}

            name='bio'
            onChange={handleInputChange} 
          rows={5} 
          className= 'flex-1 bg-C44 rounded-[8px]  p-2 text-[14px] resize-none'>
            userProfileFormData?.bio
          </textarea>
        </div>
      </div>:
      editProfileStatus==="edit-loading"?
      <div className="flex justify-center w-full text-[16px] font-light ">
        <div className="mx-auto">Editing Profile Info...</div>
        </div>:
        editProfileStatus === "edit-success"?
        <APIResponseStatus status={true} message="Profile Updated"/>:
          editProfileStatus === "edit-failure"?
        <APIResponseStatus status={false} message="Updation Failed"/>:
       null
      }
      </div>
      {error&&
        <ErrorBox message={error} />
      }
      {
      editState&&
      <div className='flex justify-end gap-4 mt-4'>
        {
          editProfileStatus==="not-edited"?
          <>
          <button className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`} onClick={()=>{setEditState(false);setEditProfileStatus("not-edited")}}>Cancel</button>
          <button className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`} onClick={handleUpdate} >Save</button>
          </>:
          editProfileStatus==="edit-loading"?
          null:
          <button className={` hover:bg-[#012b3927] rounded-[8px] text-C11 font-bold text-[12px] py-2 px-5`} onClick={()=>{setEditState(false);setEditProfileStatus("not-edited")}}>Close</button> 
        }

      </div>
      }
    </div>
  </ModalOverlay>
  )
}

export default UserProfileModal
