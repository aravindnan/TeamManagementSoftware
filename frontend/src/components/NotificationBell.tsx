import { NotificationsNone } from "@mui/icons-material";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { colors } from "../Constants";
import { badgeText } from "../helper/notifications";
import NotificationsModal from "../modals/NotificationsModal";

/** Bell with an unread badge. Opens the inbox. Used by both the sidebar and the mobile top bar. */
function NotificationBell() {
  const unread: number = useSelector((state: any) => state.notificationReducer.unread);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex justify-center py-2 cursor-pointer"
      >
        <NotificationsNone sx={{ fontSize: 22, color: colors.C11 }} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-[2px] right-[-6px] min-w-[16px] h-[16px] px-[3px] rounded-full bg-highPriority text-white text-[9px] font-bold flex items-center justify-center"
          >
            {badgeText(unread)}
          </span>
        )}
      </button>
      {open && <NotificationsModal setOpen={setOpen} />}
    </>
  );
}

export default NotificationBell;
