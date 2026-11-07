import { act, renderHook } from "@testing-library/react";
import { usePersistentState } from "./usePersistentState";

afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

test("starts from the initial value and remembers changes across mounts", () => {
  const first = renderHook(() => usePersistentState("k", "all"));
  expect(first.result.current[0]).toBe("all");
  act(() => first.result.current[1]("w1"));
  expect(first.result.current[0]).toBe("w1");
  first.unmount();
  const second = renderHook(() => usePersistentState("k", "all"));
  expect(second.result.current[0]).toBe("w1");
});

test("separate keys do not interfere", () => {
  const a = renderHook(() => usePersistentState("a", "x"));
  act(() => a.result.current[1]("1"));
  expect(renderHook(() => usePersistentState("b", "x")).result.current[0]).toBe("x");
});

test("still works as plain state when storage is blocked", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  const { result } = renderHook(() => usePersistentState("k", "fallback"));
  expect(result.current[0]).toBe("fallback");
  act(() => result.current[1]("changed"));
  expect(result.current[0]).toBe("changed");
});
