import { PendingActions } from "@mui/icons-material";
import React, { useEffect } from "react";
import { Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import moment from "moment";
import NoDataMessage from "../common/NoDataMessage";

function ProjectPageMyTasks(props:any) {

  const {myProfiledata,activeProject,myTasks,setMytasks} = props
  useEffect(() => {
    setMytasks(activeProject?.allTasks?.filter((task: any) => task.assignedTo === myProfiledata?._id));
  }, [activeProject, myProfiledata, setMytasks]);
  



  return (
    <>
      <div className="w-full lg:w-1/2 ">
        <div className="flex flex-row items-center justify-between gap-2 py-1">
          <div className="flex flex-row ">
          <PendingActions sx={{ fontSize: 25 }} />
          <div className="font-bold text-[18px] ml-2">My Tasks</div> 
          </div>
          <div className="flex flex-row gap-1 px-1">
            <Tooltip title="High Priority" arrow placement="left">
              <div className="w-[15px] h-[15px] rounded-full bg-highPriority"></div>
            </Tooltip>
            <Tooltip title="Medium Priority" arrow placement="top">
              <div className="w-[15px] h-[15px] rounded-full bg-mediumPriority"></div>
            </Tooltip>
            <Tooltip title="Low Priority" arrow placement="right">
              <div className="w-[15px] h-[15px] rounded-full bg-lowPriority"></div>
            </Tooltip>
          </div>
        </div>
        {myTasks?.length!==0?
        <div className="p-1 flex flex-col gap-2 py-4 overflow-y-auto max-h-[400px]">
          {myTasks?.map((node: any) => (
            <Tooltip
             title="View Task" arrow placement="right" key={node._id}>
            <Link to={`/task-page?id=${node._id}`}>
              <div className="flex flex-row group rounded-[4px]  text-[12px] max-w-full break-words hover:bg-C44 cursor-pointer transition-all ">
                <div
                  className={` group-hover:px-2 min-w-[10px] group-hover:min-w-[80px] duration-200 flex justify-center items-center  ${
                    node?.taskPriority === "High"
                      ? "bg-highPriority"
                      : node.taskPriority === "Medium"
                      ? "bg-mediumPriority"
                      : "bg-lowPriority"
                  } p-1 rounded-[4px] group-hover:rounded-l-[4px] group-hover:rounded-r-[0px] `}
                >
                  <div className="hidden text-C55 font-semibold group-hover:flex duration-[1s]">
                    {moment(node.dueDate).format("LL")}
                  </div>
                </div>

                <div
                  className={`hidden group-hover:flex  min-w-[10px] group-hover:min-w-[80px] duration-200 justify-center items-center p-1   group-hover:rounded-r-[0px] bg-[#dedede] `}
                >
                  <div className="hidden text-C11 font-semibold group-hover:flex duration-[1s]">
                    {node?.taskStatus}
                  </div>
                </div>
                <div className="p-2 max-w-[80%] break-words">{node.taskTitle}</div>
              </div>
            </Link> 
            </Tooltip>
          ))}
        </div>:
         <NoDataMessage size="small" message="Currently No Tasks For You Here"/>
        }
      </div>
    </>
  );
}

export default ProjectPageMyTasks;
