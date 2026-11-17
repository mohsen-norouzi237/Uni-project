import Modal from '@/components/Modal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  itemName?: string;
  isLoading?: boolean;
  /** Label for the destructive button, e.g. 'حذف تخصیص'. */
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Destructive-action confirmation.
 *
 * This used to be a second, hand-rolled dialog: no `role="dialog"`, no
 * `aria-modal`, no focus trap, no Escape handling and no focus restore. It is
 * now a thin composition over `<Modal>`, so every accessibility behaviour is
 * implemented exactly once and cannot drift between the two.
 */
export const ConfirmDeleteModal = ({
  isOpen,
  title = 'تأیید حذف',
  message,
  itemName,
  isLoading = false,
  confirmLabel = 'حذف',
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    footer={
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 disabled:opacity-50"
        >
          انصراف
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onConfirm}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>در حال حذف...</span>
            </>
          ) : (
            <span>{confirmLabel}</span>
          )}
        </button>
      </div>
    }
  >
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-600">{message}</p>
      </div>

      {itemName && (
        <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-sm font-medium text-slate-800">
          {itemName}
        </div>
      )}

      <p className="text-sm font-semibold text-rose-500">این عملیات قابل بازگشت نخواهد بود.</p>
    </div>
  </Modal>
);

export default ConfirmDeleteModal;
