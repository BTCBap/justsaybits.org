/**
 * Small focus helpers shared by the content dialog and the not-found screen.
 * The menu is marked `inert` while a screen is open, so the trap mainly guards
 * the boundaries and keyboard wrap-around.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const getFocusable = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => (
    element.getClientRects().length > 0
    && element.getAttribute('aria-hidden') !== 'true'
    && !element.hasAttribute('disabled')
  ));
};

/** Wrap Tab/Shift+Tab inside `root`. Returns true when the event was handled. */
export const trapTabKey = (event: KeyboardEvent, root: HTMLElement | null): boolean => {
  if (event.key !== 'Tab') return false;
  const focusable = getFocusable(root);
  if (focusable.length === 0) {
    event.preventDefault();
    root?.focus({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const activeIndex = active ? focusable.indexOf(active) : -1;

  // -1 includes the dialog itself and its -1 tabindex heading: the next Tab
  // should enter the list, the previous should wrap to its end.
  if (event.shiftKey && activeIndex <= 0) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
};

/** True when the event came from a control that should own its own keys. */
export const isInteractiveTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  return !!element.closest(
    'button, a, input, textarea, select, summary, [contenteditable="true"], [role="button"], [role="tab"], [role="option"], [role="link"]',
  );
};
