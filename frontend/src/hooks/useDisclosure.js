import { useCallback, useState } from 'react';

/** Open/close state for modals, drawers and menus. */
export default function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, onOpen: useCallback(() => setOpen(true), []), onClose: useCallback(() => setOpen(false), []), onToggle: useCallback(() => setOpen((value) => !value), []) };
}
