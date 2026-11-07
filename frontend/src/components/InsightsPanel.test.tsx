import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InsightsPanel from "./InsightsPanel";

const project = { projectManager: { _id: "m", firstName: "Mia", lastName: "Mgr" }, projectMembers: [{ _id: "u1", firstName: "Uma", lastName: "Dev" }] };
const base = () => ({
  scope: "all",
  summary: { total: 10, open: 6, completed: 4, overdue: 2, completionRate: 40 },
  cycleTime: { sampleSize: 4, median: 3.5, p85: 6, fastest: 1, slowest: 9 },
  throughput: [
    { weekStart: "2026-10-26", completed: 0 },
    { weekStart: "2026-11-02", completed: 3 },
    { weekStart: "2026-11-09", completed: 1 },
  ],
  burnup: [
    { date: "2026-11-09", created: 8, completed: 3 },
    { date: "2026-11-10", created: 10, completed: 4 },
  ],
  aging: [
    { taskId: "a", taskTitle: "Stuck task", taskStatus: "In Progress", assignedTo: "u1", ageDays: 12, daysInColumn: 9 },
    { taskId: "b", taskTitle: "Fresh task", taskStatus: "In Review", assignedTo: "m", ageDays: 2, daysInColumn: 1 },
  ],
  byAssignee: [
    { assignedTo: "u1", open: 4, completed: 1, overdue: 2 },
    { assignedTo: "m", open: 2, completed: 3, overdue: 0 },
  ],
});
const renderPanel = (props: any = {}) =>
  render(
    <MemoryRouter>
      <InsightsPanel data={base()} error={null} project={project} onRetry={() => {}} {...props} />
    </MemoryRouter>
  );

test("shows the headline numbers", () => {
  renderPanel();
  expect(screen.getByText("3.5d")).toBeInTheDocument();
  expect(screen.getByText(/85% finish within 6d · 4 tasks/)).toBeInTheDocument();
  expect(screen.getByText("Done this week")).toBeInTheDocument();
  expect(screen.getByText(/4 of 10 overall \(40%\)/)).toBeInTheDocument();
  expect(screen.getByText("past their due date")).toBeInTheDocument();
});

test("charts have text alternatives, including a data table for screen readers", () => {
  renderPanel();
  expect(screen.getByRole("img", { name: /tasks completed per week.*1 this week/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /burn-up chart.*10 tasks created and 4 completed/i })).toBeInTheDocument();
  const table = screen.getByRole("table", { name: "Tasks completed per week" });
  expect(within(table).getByText("Week of 2026-11-02").closest("tr")).toHaveTextContent("3");
});

test("flags work that has sat in a column longer than 85% of finished tasks took", () => {
  renderPanel();
  const stuck = screen.getByText("Stuck task").closest("li")!;
  expect(within(stuck).getByText("9d in column · 12d old")).toBeInTheDocument();
  expect(within(stuck).getByText(/slower than 85%/i)).toBeInTheDocument();
  expect(within(screen.getByText("Fresh task").closest("li")!).queryByText(/slower than 85%/i)).not.toBeInTheDocument();
});

test("without finished tasks it says n/a instead of inventing a number", () => {
  renderPanel({ data: { ...base(), cycleTime: { sampleSize: 0, median: null, p85: null, fastest: null, slowest: null } } });
  expect(screen.getByText("n/a")).toBeInTheDocument();
  expect(screen.getByText("No finished tasks yet")).toBeInTheDocument();
  expect(screen.queryByText(/slower than 85%/i)).not.toBeInTheDocument();
});

test("the manager sees every person; a member sees only their own figures and why", () => {
  const { unmount } = renderPanel();
  expect(screen.getByText("By person")).toBeInTheDocument();
  expect(screen.getByText("Uma Dev")).toBeInTheDocument();
  expect(screen.getByText("Mia Mgr")).toBeInTheDocument();
  unmount();
  renderPanel({ data: { ...base(), scope: "self", byAssignee: [{ assignedTo: "u1", open: 4, completed: 1, overdue: 2 }] } });
  expect(screen.getByText("Your figures")).toBeInTheDocument();
  expect(screen.queryByText("Mia Mgr")).not.toBeInTheDocument();
  expect(screen.getByText(/visible to the project manager only/i)).toBeInTheDocument();
});

test("handles an empty project without crashing", () => {
  renderPanel({
    data: {
      ...base(),
      summary: { total: 0, open: 0, completed: 0, overdue: 0, completionRate: 0 },
      cycleTime: { sampleSize: 0, median: null, p85: null, fastest: null, slowest: null },
      throughput: [{ weekStart: "2026-11-09", completed: 0 }],
      burnup: [{ date: "2026-11-11", created: 0, completed: 0 }],
      aging: [], byAssignee: [],
    },
  });
  expect(screen.getByText(/nothing is currently in progress/i)).toBeInTheDocument();
  expect(screen.getByText(/no tasks assigned to you yet/i)).toBeInTheDocument();
});

test("loading and error states, with a working retry", () => {
  const { unmount } = renderPanel({ data: null });
  expect(screen.getByText(/crunching the numbers/i)).toBeInTheDocument();
  unmount();
  const onRetry = jest.fn();
  renderPanel({ data: null, error: "Could not load insights.", onRetry });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalled();
});
