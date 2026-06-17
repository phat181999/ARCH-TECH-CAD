import { create } from "zustand";

// ── Dialog types ────────────────────────────────────────────────────────────
export type DialogVariant = "info" | "warning" | "danger" | "success";

export interface DialogState {
  isOpen: boolean;
  type: "alert" | "confirm";
  title: string;
  message: string;
  variant: DialogVariant;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((value: boolean) => void) | null;
}

interface DialogStore extends DialogState {
  _show: (opts: Omit<DialogState, "isOpen" | "resolve"> & { resolve: (v: boolean) => void }) => void;
  _close: (result: boolean) => void;
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  isOpen: false,
  type: "alert",
  title: "",
  message: "",
  variant: "info",
  confirmLabel: "OK",
  cancelLabel: "Cancel",
  resolve: null,

  _show: (opts) => set({ isOpen: true, ...opts }),
  _close: (result) => {
    const { resolve } = get();
    resolve?.(result);
    set({ isOpen: false, resolve: null });
  },
}));

// ── Imperative API — call from anywhere ─────────────────────────────────────

export interface AlertOptions {
  title?: string;
  variant?: DialogVariant;
  confirmLabel?: string;
}

export interface ConfirmOptions extends AlertOptions {
  cancelLabel?: string;
}

/** Show an alert dialog (single OK button). Returns a promise that resolves when dismissed. */
export function showAlert(message: string, opts?: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState()._show({
      type: "alert",
      title: opts?.title ?? "",
      message,
      variant: opts?.variant ?? "info",
      confirmLabel: opts?.confirmLabel ?? "OK",
      cancelLabel: "Cancel",
      resolve: () => resolve(),
    });
  });
}

/** Show a confirm dialog (OK + Cancel). Returns true if confirmed, false if cancelled. */
export function showConfirm(message: string, opts?: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState()._show({
      type: "confirm",
      title: opts?.title ?? "Confirm",
      message,
      variant: opts?.variant ?? "warning",
      confirmLabel: opts?.confirmLabel ?? "OK",
      cancelLabel: opts?.cancelLabel ?? "Cancel",
      resolve,
    });
  });
}

// Shorthand object for convenient imports
export const appDialog = { alert: showAlert, confirm: showConfirm };
