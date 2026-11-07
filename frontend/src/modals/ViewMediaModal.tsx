import { Close } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import React, { useState } from "react";
import ModalOverlay from '../common/ModalOverlay';
import DeleteMediaConfirmationModal from "./DeleteMediaConfirmationModal";
import DeleteTaskMediaConfirmationModal from "./DeleteTaskMediaConfirmationModal";
function ViewMediaModal(props: any) {
  const { setViewMediaModal, mediaData,activeProject,activeTask,type } = props;
  const [deleteProjectMediaModal,setDeleteProjectMediaModal]=useState<any>({isOpen: false, mediaData: null})
  const [deleteTaskMediaModal,setDeleteTaskMediaModal]=useState<any>({isOpen: false, mediaData: null})

  // function to close this modal
  const handleModalClose = () => {
    setViewMediaModal({[`isOpen`]:false,[`mediaData`]:null});
  };
  return (
    <ModalOverlay onClose={() => setViewMediaModal({[`isOpen`]:false,[`mediaData`]:null})}>
      <div className="bg-C55 rounded-[8px] p-5 shadow-xl  max-w-[90%] max-h-[520px]">
        <div className="flex flex-row items-center justify-between">
          <div className="font-bold text-[20px] text-C11">
            {mediaData.mediaName}
          </div>
          <button className="cursor-pointer" onClick={handleModalClose} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>

        <div className="flex items-center justify-center mt-3 ">
          {mediaData.mediaType === "image/png" ||
          mediaData.mediaType === "image/jpeg" ||
          mediaData.type === "image/jpg" ? (
            <div className="flex flex-col gap-2">
            <img
              src={mediaData?.mediaURL}
              className="border max-h-[400px]  border-black aspect-auto rounded-[8px] "
              alt=""
            />

          <div className="flex flex-row gap-2">
            {
              type==="task"?
              <Tooltip  title='Delete file' arrow placement="bottom">
                <button
                    onClick={()=>setDeleteTaskMediaModal({[`isOpen`]:true,[`mediaData`]:mediaData})}
                    className={`w-fit hover:bg-inactiveRed  rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5`} 
                  >
                    Delete
                  </button>
              </Tooltip>:
              type==="project"?
              <Tooltip  title='Delete file' arrow placement="bottom">
              <button
                  onClick={()=>setDeleteProjectMediaModal({[`isOpen`]:true,[`mediaData`]:mediaData})}
                  className={`w-fit hover:bg-inactiveRed  rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5`} 
                >
                  Delete
                </button>
              </Tooltip>:null
            } 

           
          </div>
            </div>
            
          ) : (
            <div className="bg-C44 flex flex-col gap-2  items-center text-inactiveC11 transition-colors duration-[0.5s] justify-center border-inactiveC11 border-2 hover:bg-C44 rounded-[8px]  hover:text-gray-400 font-bold text-[12px] py-2 px-5 cursor-pointer w-full min-h-[100px]">
              <div className="mx-auto">
                {"Only Images can be Viewed Here :("}<br/>
                {"open it in a new window or download it"}
              </div>
              <div className="flex flex-row-reverse gap-2">

              <a href={mediaData?.mediaURL}
              download={true}
              target="_blank" rel="noreferrer"
              className={`bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[12px] py-2 px-5`}
              >
                View File
              </a>

              {
              type==="task"?
              <Tooltip  title='Delete file' arrow placement="bottom">
                <button
                    onClick={()=>setDeleteTaskMediaModal({[`isOpen`]:true,[`mediaData`]:mediaData})}
                    className={`w-fit hover:bg-inactiveRed  rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5`} 
                  >
                    Delete
                  </button>
              </Tooltip>:
              type==="project"?
              <Tooltip  title='Delete file' arrow placement="bottom">
              <button
                  onClick={()=>setDeleteProjectMediaModal({[`isOpen`]:true,[`mediaData`]:mediaData})}
                  className={`w-fit hover:bg-inactiveRed  rounded-[8px] text-highPriority font-bold text-[12px] py-2 px-5`} 
                >
                  Delete
                </button>
              </Tooltip>:null
            } 


              </div>
            </div>
          )}
        </div>
      {
      deleteProjectMediaModal.isOpen&&
      <DeleteMediaConfirmationModal
      setViewMediaModal={setViewMediaModal}
      activeMedia= {deleteProjectMediaModal?.mediaData}
      setDeleteProjectMediaModal={setDeleteProjectMediaModal}
      activeProject={activeProject}
      />
      }
      {
      deleteTaskMediaModal.isOpen&&
      <DeleteTaskMediaConfirmationModal
      activeTask={activeTask}
      setViewMediaModal={setViewMediaModal}
      activeMedia= {deleteTaskMediaModal?.mediaData}
      setDeleteTaskMediaModal={setDeleteTaskMediaModal}
      />
      }
      </div>
    </ModalOverlay>
  );
}

export default ViewMediaModal;
