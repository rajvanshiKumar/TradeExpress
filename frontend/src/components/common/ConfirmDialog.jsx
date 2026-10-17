import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ open, title, text, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open} onClose={onCancel} title={title} size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} data-autofocus>{confirmLabel}</Button>
        </>
      )}
    >
      {text ? <p className="text-sm text-muted">{text}</p> : null}
      {children}
    </Modal>
  );
}
