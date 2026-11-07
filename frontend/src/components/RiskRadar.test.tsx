import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RiskRadar from "./RiskRadar";

const project = { projectManager: { _id: "m", firstName: "Mia", lastName: "Mgr" }, projectMembers: [{ _id: "u1", firstName: "Uma", lastName: "Dev" }] };
const risk = {
  summary: { openTasks: 3, high: 1, medium: 0, onTrack: 1, unscheduled: 1 },
  tasks: [
    { taskId: "a", taskTitle: "Fix checkout bug", taskStatus: "In Progress", assignedTo: "u1", dueDate: "2026-11-05", level: "high", score: 85,
      reasons: ["Overdue by 2 days.", "No activity for 6 days."], metrics: { typicalCycleDays: 3, sampleSize: 4, estimateSource: "same-priority", daysLeft: -2, staleDays: 6 } },
    { taskId: "b", taskTitle: "Calm task", taskStatus: "To Do", assignedTo: "m", dueDate: "2026-12-30", level: "on-track", score: 0,
      reasons: ["On track: due in 40 days."], metrics: { typicalCycleDays: 5, sampleSize: 0, estimateSource: "default", daysLeft: 40, staleDays: 0 } },
    { taskId: "c", taskTitle: "Undated task", taskStatus: "To Do", assignedTo: "m", dueDate: null, level: "unscheduled", score: 0, reasons: ["No due date, so deadline risk cannot be judged."], metrics: null },
  ],
};
const renderRadar = (props: any = {}) =>
  render(
    <MemoryRouter>
      <RiskRadar risk={risk} error={null} project={project} onRetry={() => {}} {...props} />
    </MemoryRouter>
  );

test("shows only at-risk tasks by default, with every reason and the assignee", () => {
  renderRadar();
  expect(screen.getByText("Fix checkout bug")).toBeInTheDocument();
  expect(screen.getByText("Overdue by 2 days.")).toBeInTheDocument();
  expect(screen.getByText("No activity for 6 days.")).toBeInTheDocument();
  expect(screen.getByText(/Uma Dev/)).toBeInTheDocument();
  expect(screen.queryByText("Calm task")).not.toBeInTheDocument();
});

test("the toggle reveals on-track and unscheduled tasks", () => {
  renderRadar();
  fireEvent.click(screen.getByLabelText(/show on-track and unscheduled/i));
  expect(screen.getByText("Calm task")).toBeInTheDocument();
  expect(screen.getByText("Undated task")).toBeInTheDocument();
});

test("celebrates nothing-at-risk without implying there is no data", () => {
  renderRadar({ risk: { ...risk, summary: { ...risk.summary, high: 0 }, tasks: [risk.tasks[1]] } });
  expect(screen.getByText(/nothing is at risk right now/i)).toBeInTheDocument();
});

test("shows a loading state, and an error with a working retry", () => {
  const { unmount } = renderRadar({ risk: null });
  expect(screen.getByText(/analysing deadlines/i)).toBeInTheDocument();
  unmount();
  const onRetry = jest.fn();
  renderRadar({ error: "Could not analyse deadlines.", onRetry });
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(onRetry).toHaveBeenCalled();
});
