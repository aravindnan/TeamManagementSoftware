import { Close } from "@mui/icons-material";
import React, { useMemo, useState } from "react";
import ModalOverlay from "../common/ModalOverlay";
import NoDataMessage from "../common/NoDataMessage";
import TaskRow from "../components/TaskRow";
import { filterAndSortTasks, SortMode, StatusFilter, PriorityFilter } from "../helper/taskFilters";

const chip = (active: boolean) =>
  ` ${active ? "bg-[#012b3927] text-C11" : "text-gray-500"} rounded-[6px] font-bold text-[10px] py-1 px-2`;

function ViewAllTaskModal(props: any) {
  const { setViewAllTaskModal, activeProject } = props;

  const [searchKey, setSearchKey] = useState<string>("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");

  const allTasks: any[] = activeProject?.allTasks || [];
  const visible = useMemo(
    () => filterAndSortTasks(allTasks, { search: searchKey, status, priority, sort }),
    [allTasks, searchKey, status, priority, sort]
  );
  const filtersActive = searchKey !== "" || status !== "all" || priority !== "all";

  return (
    <ModalOverlay onClose={() => setViewAllTaskModal(false)}>
      <div className="bg-C55 rounded-[8px] p-5 w-[90%] md:w-[700px]  md:min-h-[550px] md:max-h-[550px] shadow-xl ">
        <div className="flex flex-row items-center justify-between pb-3 ">
          <div className="font-bold text-[20px] text-C11">All Tasks</div>
          <button className="cursor-pointer" onClick={() => setViewAllTaskModal(false)} aria-label="Close">
            <Close sx={{ fontSize: 20, fontWeight: 800 }} />
          </button>
        </div>

        <input
          type="text"
          value={searchKey}
          placeholder="Filter by task ID or Task Title"
          aria-label="Filter tasks by ID or title"
          onChange={(e) => setSearchKey(e.target.value)}
          className="bg-C44 rounded-[8px]  p-2 text-[14px] w-full"
        />

        <div className="flex flex-row flex-wrap items-center gap-x-5 gap-y-1 w-full justify-end rounded-[6px] text-[12px] p-1 mt-1">
          <div className="flex flex-row items-center gap-1" role="group" aria-label="Filter by status">
            {([["all", "All"], ["completed", "Completed"], ["in-progress", "In Progress"]] as [StatusFilter, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setStatus(key)} aria-pressed={status === key} className={chip(status === key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-row items-center gap-1" role="group" aria-label="Filter by priority">
            {([["all", "Any priority"], ["High", "High"], ["Medium", "Medium"], ["Low", "Low"]] as [PriorityFilter, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setPriority(key)} aria-pressed={priority === key} className={chip(priority === key)}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex flex-row items-center gap-1 font-bold text-[10px] text-C11">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="bg-C44 rounded-[6px] text-[10px] font-bold py-1 px-1"
            >
              <option value="default">Default</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-gray-400">
          <span aria-live="polite">{`${visible.length} of ${allTasks.length} task${allTasks.length === 1 ? "" : "s"}`}</span>
          {filtersActive && (
            <button
              className="font-bold text-C22 hover:text-C11"
              onClick={() => {
                setSearchKey("");
                setStatus("all");
                setPriority("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center justify-center p-1 py-2">
          {allTasks.length === 0 ? (
            <div className="mt-[20%]">
              <NoDataMessage size="small" message="Currently No Tasks in this Project" />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-[20%]">
              <NoDataMessage size="small" message="No tasks match the current filters" />
            </div>
          ) : (
            <div className="flex flex-col overflow-y-auto max-h-[360px] gap-2 w-full">
              {visible.map((task: any) => (
                <TaskRow key={task._id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

export default ViewAllTaskModal;
