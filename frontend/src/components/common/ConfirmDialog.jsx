import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ open, title, text, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', loading = false, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open} onClose={loading ? () => {} : onCancel} title={title} size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>{confirmLabel}</Button>
        </>
      )}
    >
      {text ? <p className="text-sm text-muted">{text}</p> : null}
      {children}
    </Modal>
  );
}
