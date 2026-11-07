import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LabelEditor from "./LabelEditor";

const type = (text: string) => {
  const input = screen.getByLabelText("Add a label");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
};
const deferred = () => {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
};

test("REGRESSION: two labels added quickly are both kept, because each save builds on what is shown, not on the stale server copy", async () => {
  const first = deferred();
  const second = deferred();
  const onChange = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<LabelEditor labels={[]} canEdit onChange={onChange} />); // the server still has nothing

  type("design");
  type("launch-blocker");

  expect(onChange.mock.calls).toEqual([[["design"]], [["design", "launch-blocker"]]]);
  expect(screen.getByText("design")).toBeInTheDocument();
  expect(screen.getByText("launch-blocker")).toBeInTheDocument();
  await act(async () => {
    first.resolve(true);
    second.resolve(true);
  });
});

test("an out-of-date copy arriving from the server while a save is in flight does not wipe the newer edit", async () => {
  const pending = deferred();
  const onChange = jest.fn().mockReturnValue(pending.promise);
  const { rerender } = render(<LabelEditor labels={[]} canEdit onChange={onChange} />);
  type("a");
  rerender(<LabelEditor labels={["old"]} canEdit onChange={onChange} />); // a refetch from before our save lands
  expect(screen.getByText("a")).toBeInTheDocument();
  expect(screen.queryByText("old")).not.toBeInTheDocument();
  await act(async () => pending.resolve(true));
});

test("once saves finish, the server's copy is adopted again", async () => {
  const onChange = jest.fn().mockResolvedValue(true);
  const { rerender } = render(<LabelEditor labels={[]} canEdit onChange={onChange} />);
  type("a");
  await act(async () => {});
  rerender(<LabelEditor labels={["a", "added-by-someone-else"]} canEdit onChange={onChange} />);
  expect(screen.getByText("added-by-someone-else")).toBeInTheDocument();
});

test("a refused save puts the list back to what the server has", async () => {
  const onChange = jest.fn().mockResolvedValue(false);
  render(<LabelEditor labels={["keep"]} canEdit onChange={onChange} />);
  type("nope");
  await act(async () => {});
  expect(screen.getByText("keep")).toBeInTheDocument();
  expect(screen.queryByText("nope")).not.toBeInTheDocument();
});

test("removing a label sends the list without it", () => {
  const onChange = jest.fn().mockResolvedValue(true);
  render(<LabelEditor labels={["a", "b"]} canEdit onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove label a" }));
  expect(onChange).toHaveBeenCalledWith(["b"]);
});

test("read-only viewers get no input and no remove buttons", () => {
  render(<LabelEditor labels={["a"]} canEdit={false} onChange={jest.fn()} />);
  expect(screen.queryByLabelText("Add a label")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("no labels and read-only says so", () => {
  render(<LabelEditor labels={[]} canEdit={false} onChange={jest.fn()} />);
  expect(screen.getByText("No labels")).toBeInTheDocument();
});
