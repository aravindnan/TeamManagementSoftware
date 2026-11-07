import React from "react";
import { Link, useSearchParams } from "react-router-dom";

type Props = Omit<React.ComponentProps<typeof Link>, "to"> & { taskId: string };

/**
 * Opens a task in the project page's drawer by adding `?task=<id>` to the current URL (keeping the project
 * id and anything else). Because the drawer lives in the URL it is shareable, survives a reload, and the
 * browser's back button closes it.
 */
function TaskLink({ taskId, children, ...rest }: Props) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("task", taskId);
  return (
    <Link to={{ search: `?${next.toString()}` }} {...rest}>
      {children}
    </Link>
  );
}

export default TaskLink;
