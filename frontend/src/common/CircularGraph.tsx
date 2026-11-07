import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import ProgressProvider from "./ProgressProvider";
import { Tooltip } from "@mui/material";

function CircularGraph(props: any) {
  const { percentage, color, trackColor } = props;
  return (
    <Tooltip title="Overall Performace" arrow placement="bottom">
          <div className="flex flex-col justify-center gap-2 p-2">
      {/* Progress bar */}
      <div className="max-w-[200px] max-h-[200px] border-dashed  rounded-full text-center items-center hidden md:flex justify-center text-[50px] font-extrabold">
        <ProgressProvider valueStart={0} valueEnd={percentage}>
          {(value: any) => (
            <CircularProgressbar
              styles={buildStyles({
                strokeLinecap: "butt",
                pathTransitionDuration: 3,
                pathColor: `${color}`,
                textColor: `${color}`,
                trailColor: `${trackColor}`,
                // backgroundColor: `${colors.C11}`,
              })}
              value={value}
              text={`${percentage}%`}
            />
          )}
        </ProgressProvider>
      </div>
      {/* <div className="font-bold text-center">Overall Performance</div> */}
    </div>

    </Tooltip>

  );
}

export default CircularGraph;
