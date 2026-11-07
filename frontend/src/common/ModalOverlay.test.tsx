import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ModalOverlay from "./ModalOverlay";

const esc = () => fireEvent.keyDown(document, { key: "Escape" });

test("exposes itself as a labelled modal dialog and closes on Escape", () => {
  const onClose = jest.fn();
  render(<ModalOverlay onClose={onClose}><div className="font-bold">Settings</div></ModalOverlay>);
  const dialog = screen.getByRole("dialog", { name: "Settings" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  esc();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("with stacked overlays, Escape closes only the topmost, then the next one", () => {
  const closeBottom = jest.fn();
  const closeTop = jest.fn();
  const { rerender } = render(<ModalOverlay onClose={closeBottom}><div className="font-bold">Board</div></ModalOverlay>);
  // a drawer opens later, on top
  rerender(
    <>
      <ModalOverlay onClose={closeBottom}><div className="font-bold">Board</div></ModalOverlay>
      <ModalOverlay onClose={closeTop} placement="right"><div className="font-bold">Task</div></ModalOverlay>
    </>
  );
  esc();
  expect(closeTop).toHaveBeenCalledTimes(1);
  expect(closeBottom).not.toHaveBeenCalled();

  // the drawer goes away; now the board is on top again
  rerender(<ModalOverlay onClose={closeBottom}><div className="font-bold">Board</div></ModalOverlay>);
  esc();
  expect(closeBottom).toHaveBeenCalledTimes(1);
});

test("Tab is trapped inside the top overlay only", () => {
  render(
    <>
      <ModalOverlay onClose={() => {}}><button>lower</button></ModalOverlay>
      <ModalOverlay onClose={() => {}}><button>first</button><button>last</button></ModalOverlay>
    </>
  );
  const last = screen.getByText("last");
  last.focus();
  // jsdom reports no layout, so focusables are all treated as hidden; the trap must still not throw or escape
  expect(() => fireEvent.keyDown(document, { key: "Tab" })).not.toThrow();
});

test("the right placement docks the dialog to the right edge", () => {
  render(<ModalOverlay onClose={() => {}} placement="right"><div className="font-bold">Drawer</div></ModalOverlay>);
  expect(screen.getByRole("dialog").className).toMatch(/justify-end/);
});

test("focus returns to the opener when the overlay closes", () => {
  const opener = document.createElement("button");
  document.body.appendChild(opener);
  opener.focus();
  const { unmount } = render(<ModalOverlay onClose={() => {}}><input aria-label="x" /></ModalOverlay>);
  expect(document.activeElement).not.toBe(opener);
  unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});
