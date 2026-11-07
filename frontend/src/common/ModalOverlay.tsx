import React, { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  onClose: () => void;
  /** Slightly darker backdrop variant used by the media viewer. */
  tint?: "default" | "dark";
  children: React.ReactNode;
}

/**
 * Accessible modal shell. Visually identical to the old hand-rolled overlays, but:
 * - fixed to the viewport (the old `absolute` overlay drifted off-screen when the page was scrolled)
 * - announces itself as a dialog, closes on Escape, keeps Tab focus inside, and restores focus on close.
 */
function ModalOverlay({ onClose, tint = "default", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Label the dialog from its first bold heading so screen readers announce it.
    const heading = root.querySelector<HTMLElement>("h1, h2, h3, .font-bold");
    if (heading?.textContent?.trim()) root.setAttribute("aria-label", heading.textContent.trim().slice(0, 80));

    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    // Prefer a form field; otherwise the dialog itself.
    const first = root.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") || focusables()[0];
    (first || root).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Inner (later-mounted) dialogs register first, so only the topmost one closes.
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
      previouslyFocused?.focus?.();
    };
  }, []);

  const backdrop = tint === "dark" ? "bg-[#0000005b]" : "bg-[#00000054]";
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={`top-0 left-0 fixed z-50 w-[100vw] h-[100vh] ${backdrop} flex justify-center items-center outline-none`}
    >
      {children}
    </div>
  );
}

export default ModalOverlay;
