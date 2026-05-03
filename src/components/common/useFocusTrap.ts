/**
 * useFocusTrap — shared focus-trap utility for modal dialogs.
 *
 * Addresses M1a deferred FE-C4 (Codex finding): all M1a dialogs
 * (ContractDeleteDialog, ContractStatusDialog, ContractVersionCreateDialog)
 * shipped without programmatic focus trapping. Tab / Shift+Tab inside an
 * open dialog could escape the modal and reach the page underneath, which
 * fails WCAG 2.1 AA keyboard-trap requirements (SC 2.1.2 / 2.4.3).
 *
 * Behaviour:
 *   1. On `isOpen=true` transition: capture the currently-focused element so
 *      it can be restored later. Move focus to the first focusable element
 *      inside the container (or the container itself with tabIndex=-1).
 *   2. While `isOpen=true`: intercept Tab / Shift+Tab keydown events. When
 *      focus is on the LAST focusable element and the user presses Tab,
 *      cycle to the FIRST. When focus is on the FIRST and the user presses
 *      Shift+Tab, cycle to the LAST.
 *   3. On `isOpen=false` transition (or component unmount): restore focus
 *      to the element that originally held it.
 *
 * Why a hook (not a component): existing M1a dialogs render their own
 * `<div role="dialog">` root with state-coupled close handlers. Wrapping
 * each dialog in a new component would force a refactor; a hook lets us
 * paint the trap on top of the existing DOM tree without touching markup.
 *
 * Production hardening notes:
 *   - The focusable selector intentionally excludes [tabindex="-1"] AND
 *     [disabled] AND [aria-hidden="true"] — disabled buttons (e.g. Submit
 *     during mutation.isPending) must NOT be focus targets because that
 *     creates a dead-end keyboard loop.
 *   - Selector handles SVG <a xlink:href> too — ContractStatusBadge etc.
 *   - Container ref may be `null` on first render in strict-mode double
 *     invocations; guard accordingly.
 *   - We listen on the container element (not document) so that nested
 *     dialogs (e.g. a confirm-inside-confirm scenario) cannot cross-trap.
 */
import { useEffect, useRef } from "react";

/**
 * CSS selector for elements that are focusable by Tab key in normal flow.
 * - Excludes elements with tabindex="-1" (programmatic-only focus).
 * - Excludes [disabled] (HTMLButtonElement, HTMLInputElement, etc.).
 * - Excludes [aria-hidden="true"] (visually hidden).
 * - Includes contenteditable elements.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1']):not([aria-hidden='true'])",
  "area[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1']):not([aria-hidden='true'])",
  "input:not([disabled]):not([type='hidden']):not([tabindex='-1']):not([aria-hidden='true'])",
  "select:not([disabled]):not([tabindex='-1']):not([aria-hidden='true'])",
  "textarea:not([disabled]):not([tabindex='-1']):not([aria-hidden='true'])",
  "[tabindex]:not([tabindex='-1']):not([aria-hidden='true'])",
  "[contenteditable='true']:not([tabindex='-1']):not([aria-hidden='true'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  // Filter out elements that are visually hidden (display:none / visibility:hidden).
  // offsetParent === null is a cheap proxy for "not in render tree".
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    // offsetParent is null for `display:none`; for `visibility:hidden` we
    // also need the computed style check.
    if (el.offsetParent === null && el !== document.activeElement) return false;
    return true;
  });
}

/**
 * Trap keyboard focus inside the container element while `isOpen` is true.
 *
 * @param containerRef - Ref to the dialog's outer element (role="dialog").
 * @param isOpen       - When false, the trap is inert (no listeners attached).
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Snapshot the element that had focus before the dialog opened so we
    // can restore it on close. Falls back to document.body when nothing
    // was focused (rare; happens on first navigation).
    previouslyFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null;

    // Defer initial focus by one microtask — gives the dialog tree a chance
    // to mount, which matters when the consumer does its own setTimeout-based
    // autofocus on a specific input. We only seed focus if no inner element
    // has grabbed it yet.
    const seedHandle = window.setTimeout(() => {
      if (!container.contains(document.activeElement)) {
        const focusables = getFocusableElements(container);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          // No focusable children — focus the container itself so the
          // keydown listener has a target. role="dialog" containers should
          // carry tabIndex={-1} for this case (we set it defensively).
          if (!container.hasAttribute("tabindex")) {
            container.setAttribute("tabindex", "-1");
          }
          container.focus();
        }
      }
    }, 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (!container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        // No tabbable children — keep focus pinned to the container so the
        // browser does not escape into the page underneath.
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Forward Tab from the last element → cycle to first.
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
        return;
      }

      // Backward Tab (Shift+Tab) from the first element → cycle to last.
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }

      // If focus has somehow escaped the container entirely (e.g. dev tools
      // moved it), pull it back to the first focusable child.
      if (active && !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(seedHandle);
      container.removeEventListener("keydown", onKeyDown);

      // Restore focus on close. Wrap in try/catch because the previously
      // focused element may have been removed from the DOM while the dialog
      // was open (e.g., a parent component unmounted under us).
      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        try {
          previous.focus();
        } catch {
          // Previously-focused element rejected focus (rare — happens with
          // disabled inputs that became disabled while the dialog was open).
          // Fall back to body to ensure focus does not stay trapped on the
          // unmounted dialog node.
          document.body.focus();
        }
      }
      previouslyFocusedRef.current = null;
    };
  }, [containerRef, isOpen]);
}

export default useFocusTrap;
