import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Stack of currently open dialogs, outermost first.
 *
 * Escape must close exactly one dialog: the topmost. The previous
 * implementation called `event.stopPropagation()` inside a capture-phase
 * listener, which silently cancelled the parent's listener chain and made
 * nested dialogs behave unpredictably. Consulting a shared stack is explicit:
 * a dialog simply ignores Escape unless it is on top.
 */
const dialogStack: symbol[] = [];

/**
 * The scroll lock is a single shared resource on <body>, so its previous value
 * belongs to the stack, not to any individual dialog instance.
 *
 * Previously every dialog captured `document.body.style.overflow` at its own
 * open time. A nested dialog therefore captured 'hidden' (set by its parent),
 * and if the dialogs unmounted in a different order than they mounted, the
 * last one out restored 'hidden' - locking the page forever with no dialog on
 * screen. Now only the first dialog in reads the value and only the last one
 * out writes it back.
 */
let lockedOverflow: string | null = null;

/**
 * Accessible dialog: labelled, modal, focus-trapped, focus-restoring, and
 * scroll-lock safe when several modals are mounted (the previous overflow
 * value is restored instead of a hardcoded 'unset').
 *
 * If this grows any further, swap it for Radix `Dialog` or Headless UI rather
 * than maintaining the trap by hand.
 */
export const Modal = ({ isOpen, onClose, title, children, footer }: ModalProps) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const instanceId = useRef<symbol>(Symbol('dialog'));

  /*
   * `onClose` is read through a ref instead of a dependency.
   *
   * Every caller passes an inline arrow (`onClose={() => setOpen(false)}`), so
   * its identity changes on each parent render. When the keydown handler
   * depended on it, typing inside the dialog re-created the handler, which
   * re-ran the open/close effect: its cleanup restored focus to the trigger
   * button and the dialog was popped and re-pushed onto `dialogStack` between
   * keystrokes. The ref keeps the handler stable while still calling the
   * latest `onClose`.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Only the topmost dialog reacts; no event suppression required.
        if (dialogStack[dialogStack.length - 1] !== instanceId.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    // Stable for the lifetime of the component: the latest `onClose` is read
    // from `onCloseRef`, and `dialogRef`/`instanceId` are refs.
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    const id = instanceId.current;
    dialogStack.push(id);

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    if (dialogStack.length === 1) {
      lockedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    document.addEventListener('keydown', handleKeyDown, true);

    // Move focus into the dialog on open.
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? dialogRef.current)?.focus();

    return () => {
      const index = dialogStack.indexOf(id);
      if (index !== -1) dialogStack.splice(index, 1);

      document.removeEventListener('keydown', handleKeyDown, true);
      // Only the last dialog on screen may release the scroll lock, and it
      // restores the value captured before the *first* dialog opened.
      if (dialogStack.length === 0 && lockedOverflow !== null) {
        document.body.style.overflow = lockedOverflow;
        lockedOverflow = null;
      }
      previouslyFocused.current?.focus();
    };
    // `handleKeyDown` is stable, so this effect runs only when the dialog
    // actually opens or closes - never on a parent re-render.
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  /*
   * Rendered through a portal into <body>.
   *
   * Inline rendering placed the dialog inside AppLayout, inheriting its
   * `overflow-hidden` and stacking context, so a tall dialog was clipped and
   * z-index fought with the sidebar. The portal escapes both.
   */
  return createPortal(
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      {/* کلیک روی فضای خالی برای بستن */}
      <div className="fixed inset-0" aria-hidden="true" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-800">
            {title ?? 'پیام سیستم'}
          </h2>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 text-sm text-gray-600">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
