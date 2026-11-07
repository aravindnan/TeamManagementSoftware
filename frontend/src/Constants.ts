// colors
export const colors={
    C11: '#012B39',
    C22: '#1F7A8C',
    C33:'#BFDBF7' ,
    C44 : "#E1E5F2",
    C55 : "#FAFAFA",
    inactiveC11:"#012b3927",
    inactiveRed:"#ff5a5a3f",
    SucessGreen:"#2abf43",
    highPriority:"#FF5A5A",
    mediumPriority:"#fac439",
    lowPriority:"#5A92FF",
    
}

export const acceptedFileTypes = "image/*,.pps,.txt,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.slideshow,application/vnd.openxmlformats-officedocument.presentationml.presentation"


// Task workflow, in board-column order. Must match backend/utils/constants.js.
export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Completed"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
