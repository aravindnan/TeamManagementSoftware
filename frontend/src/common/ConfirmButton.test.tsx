import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ConfirmButton from "./ConfirmButton";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("the first click only arms it; the second confirms", () => {
  const onConfirm = jest.fn();
  render(<ConfirmButton label="Delete" onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole("button")).toHaveTextContent("Confirm?");
  fireEvent.click(screen.getByRole("button"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button")).toHaveTextContent("Delete"); // disarmed again
});

test("it disarms itself after a few seconds so a later click cannot confirm by accident", () => {
  const onConfirm = jest.fn();
  render(<ConfirmButton label="Delete" onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button"));
  act(() => {
    jest.advanceTimersByTime(4100);
  });
  expect(screen.getByRole("button")).toHaveTextContent("Delete");
  fireEvent.click(screen.getByRole("button")); // arms again instead of confirming
  expect(onConfirm).not.toHaveBeenCalled();
});

test("uses a custom confirm label and keeps an accessible name that says what is being confirmed", () => {
  render(<ConfirmButton label="Remove" aria-label="Remove Ann" confirmLabel="Remove?" onConfirm={() => {}} />);
  expect(screen.getByRole("button", { name: "Remove Ann" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button", { name: "Remove? Remove Ann" })).toHaveTextContent("Remove?");
});

test("a disabled button cannot be armed", () => {
  const onConfirm = jest.fn();
  render(<ConfirmButton label="Go" disabled onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(screen.getByRole("button"));
  expect(onConfirm).not.toHaveBeenCalled();
});
