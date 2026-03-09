import React, { createContext, useContext } from "react";

import { useLocalStorageStateFactory } from "shared/hooks/local-storage-state";

export const ModalIds = [
  "changes.push",
  "element.content",
  "element.sheet",
  "element.create.sheet",
  "settings",
  "push-changes-dialog",
  "metadata-edit-sheet"
] as const;

export type ModalId = typeof ModalIds[number];

interface ModalsContextType {
  isOpen: Record<ModalId, boolean>;
  setOpen: (id: ModalId, open: boolean) => void;
  open: (id: ModalId) => boolean;
  close: (id: ModalId) => boolean;
}

const ModalsContext = createContext<ModalsContextType | undefined>(undefined);

export function useModals(id: ModalId): {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
};
export function useModals(): ModalsContextType;
export function useModals(id?: ModalId): {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
} | ModalsContextType {
  const context = useContext(ModalsContext);
  if (!context)
    throw new Error("useModals must be used within ModalsProvider");

  if (id) {
    return {
      isOpen: context.isOpen[id],
      setOpen: (open: boolean) => context.setOpen(id, open),
      open: () => context.open(id),
      close: () => context.close(id),
    };
  }

  return context;
}

export const ModalsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useLocalStorageStateFactory(
    __CONFIGURATION__.repository.owner,
    __CONFIGURATION__.repository.name,
  )<Record<ModalId, boolean>>("modals.isOpen", {
    "changes.push": false,
    "element.content": false,
    "element.sheet": false,
    "element.create.sheet": false,
    "settings": false,
    "push-changes-dialog": false,
    "metadata-edit-sheet": false,
  });

  const open = (id: ModalId) => {
    if (isOpen[id]) return false; // already open
    setIsOpen((prev) => ({ ...prev, [id]: true }));
    return true;
  }

  const close = (id: ModalId) => {
    if (!isOpen[id]) return false; // already closed
    setIsOpen((prev) => ({ ...prev, [id]: false }));
    return true;
  }

  const setOpen = (id: ModalId, open_: boolean) => {
    if (open_) return open(id);
    return close(id);
  }

  return (
    <ModalsContext.Provider value={{ isOpen, open, close, setOpen }}>
      {children}
    </ModalsContext.Provider>
  );
};
