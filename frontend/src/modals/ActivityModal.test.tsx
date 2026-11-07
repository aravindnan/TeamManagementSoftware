import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import ActivityModal from "./ActivityModal";
import { getProjectActivity } from "../services/projectServices";
import { renderWithProviders } from "../testUtils";

jest.mock("../services/projectServices", () => ({ getProjectActivity: jest.fn() }));
jest.mock("../services/apiClient", () => ({
  errorMessage: (res: any, fallback: string) => res?.response?.data?.error || fallback,
  isApiError: (res: any) => !!res && res.isAxiosError === true,
}));

const mocked = getProjectActivity as jest.Mock;
const now = new Date().toISOString();
const entry = (id: string, verb: string, data: any, extra: any = {}) => ({
  _id: id, verb, category: "task", actorName: "Ana Lee", data, createdAt: now, ...extra,
});
const project = { _id: "p1", projectName: "Relaunch" };
const renderModal = () => renderWithProviders(<ActivityModal activeProject={project} setActivityModal={() => {}} />);

beforeEach(() => mocked.mockReset());

test("renders readable entries, grouped under Today, with task links", async () => {
  mocked.mockResolvedValue({
    items: [
      entry("2", "task.status_changed", { title: "Ship it", from: "To Do", to: "Completed" }, { task: "t9" }),
      entry("1", "comment.project", { excerpt: "Nice work" }, { category: "comment" }),
    ],
    nextCursor: null,
  });
  renderModal();
  expect(await screen.findByText("Today")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ship it" })).toHaveAttribute("href", "/task-page?id=t9");
  expect(screen.getByText(/from To Do to Completed/)).toBeInTheDocument();
  expect(screen.getByText("“Nice work”")).toBeInTheDocument();
  expect(screen.getAllByText("Ana Lee")).toHaveLength(2);
});

test("a deleted task is shown by name without a link", async () => {
  mocked.mockResolvedValue({ items: [entry("1", "task.deleted", { title: "Old task" }, { task: "t1" })], nextCursor: null });
  renderModal();
  expect(await screen.findByText("Old task")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Old task" })).not.toBeInTheDocument();
});

test("choosing a filter requests that category", async () => {
  mocked.mockResolvedValue({ items: [], nextCursor: null });
  renderModal();
  await screen.findByText("No activity yet");
  fireEvent.click(screen.getByRole("button", { name: "Comments" }));
  await waitFor(() => expect(mocked).toHaveBeenLastCalledWith("p1", expect.objectContaining({ category: "comment" })));
  expect(await screen.findByText("No activity of this type yet")).toBeInTheDocument();
});

test("'Load older activity' appends the next page using the cursor", async () => {
  mocked
    .mockResolvedValueOnce({ items: [entry("2", "task.created", { title: "Newer" }, { task: "a" })], nextCursor: "2" })
    .mockResolvedValueOnce({ items: [entry("1", "task.created", { title: "Older" }, { task: "b" })], nextCursor: null });
  renderModal();
  await screen.findByText("Newer");
  fireEvent.click(screen.getByRole("button", { name: /load older activity/i }));
  expect(await screen.findByText("Older")).toBeInTheDocument();
  expect(screen.getByText("Newer")).toBeInTheDocument(); // still there
  expect(mocked).toHaveBeenLastCalledWith("p1", expect.objectContaining({ before: "2" }));
  expect(screen.queryByRole("button", { name: /load older activity/i })).not.toBeInTheDocument();
});

test("shows an error with a retry that recovers", async () => {
  mocked.mockResolvedValueOnce({ isAxiosError: true, response: { data: { error: "Boom" } } });
  renderModal();
  expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
  mocked.mockResolvedValueOnce({ items: [entry("1", "project.created", { name: "Relaunch" })], nextCursor: null });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText(/created the project/)).toBeInTheDocument();
});
