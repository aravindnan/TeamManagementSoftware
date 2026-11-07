import React, { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open overlays, oldest first. Only the last one reacts to the keyboard, so opening the task drawer on top of
// the board and pressing Escape closes the drawer, not both.
const openOverlays: symbol[] = [];

interface Props {
  onClose: () => void;
  /** Slightly darker backdrop variant used by the media viewer. */
  tint?: "default" | "dark";
  /** "right" docks the content to the right edge as a full-height drawer. */
  placement?: "center" | "right";
  /** Accessible name. When omitted it is taken from the first heading present at mount; pass it when the content loads later. */
  label?: string;
  children: React.ReactNode;
}

/**
 * Accessible modal shell. Visually identical to the old hand-rolled overlays, but:
 * - fixed to the viewport (the old `absolute` overlay drifted off-screen when the page was scrolled)
 * - announces itself as a dialog, closes on Escape, keeps Tab focus inside, and restores focus on close.
 */
function ModalOverlay({ onClose, tint = "default", placement = "center", label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const id = Symbol("overlay");
    openOverlays.push(id);
    const isTop = () => openOverlays[openOverlays.length - 1] === id;

    // Label the dialog from its first bold heading so screen readers announce it.
    const heading = root.querySelector<HTMLElement>("h1, h2, h3, .font-bold");
    if (!root.getAttribute("aria-label") && heading?.textContent?.trim()) root.setAttribute("aria-label", heading.textContent.trim().slice(0, 80));

    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    // Prefer a form field; otherwise the dialog itself.
    const first = root.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") || focusables()[0];
    (first || root).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const at = openOverlays.indexOf(id);
      if (at !== -1) openOverlays.splice(at, 1);
      previouslyFocused?.focus?.();
    };
  }, []);

  const backdrop = tint === "dark" ? "bg-[#0000005b]" : "bg-[#00000054]";
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={`top-0 left-0 fixed ${placement === "right" ? "z-[60]" : "z-50"} w-[100vw] h-[100vh] ${backdrop} flex ${
        placement === "right" ? "justify-end items-stretch" : "justify-center items-center"
      } outline-none`}
    >
      {children}
    </div>
  );
}

export default ModalOverlay;
