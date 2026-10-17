import { RotateCcw } from 'lucide-react';
import Button from './Button';
import ConfirmDialog from './ConfirmDialog';
import useDisclosure from '../../hooks/useDisclosure';
import { clearAllStorage } from '../../utils/storage';

/** Clears everything TradeSphere saved in this browser and reloads with the original sample catalogue. */
export default function ResetDataButton({ variant = 'outline', size = 'sm', className = '' }) {
  const dialog = useDisclosure();

  const reset = () => {
    clearAllStorage();
    window.location.assign('/');
  };

  return (
    <>
      <Button variant={variant} size={size} icon={RotateCcw} onClick={dialog.onOpen} className={className}>Reset sample data</Button>
      <ConfirmDialog
        open={dialog.open} onCancel={dialog.onClose} onConfirm={reset} title="Reset sample data?" confirmLabel="Reset everything"
        text="This removes everything saved by TradeSphere in this browser: your cart, saved products, quote requests, messages, orders, accounts you registered, profile changes and any products you added or edited. The original sample catalogue is restored and you are signed out."
      />
    </>
  );
}
