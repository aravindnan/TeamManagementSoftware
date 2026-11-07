import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUnreadCount } from "../services/notificationServices";
import { setUnreadAction } from "../redux/actions/notificationActions";

const INTERVAL_MS = 30_000;

/**
 * Keeps the unread badge fresh while a user is signed in: one lightweight request every 30 s,
 * skipped while the tab is hidden, and refreshed immediately when the tab becomes visible again.
 * Renders nothing; mounted once at the app root so the two nav bars never double-poll.
 */
function NotificationPoller() {
  const dispatch = useDispatch();
  const signedIn = useSelector((state: any) => state.authReducer.isAuthenticated);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      const res: any = await getUnreadCount();
      if (!cancelled && typeof res?.count === "number") dispatch(setUnreadAction(res.count));
    };
    tick();
    const id = setInterval(tick, INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, dispatch]);

  return null;
}

export default NotificationPoller;
