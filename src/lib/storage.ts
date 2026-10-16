import type { StateStorage } from "zustand/middleware";
const lastSaved = new Map<string, string | null>();
export const appStorage: StateStorage = {
  getItem(name) {
    try {
      const value = window.electron
        ? window.electron.readSettings(name)
        : localStorage.getItem(name);
      if (value) JSON.parse(value);
      lastSaved.set(name, value);
      return value;
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      if (lastSaved.get(name) === value) return;
      if (window.electron) window.electron.writeSettings(name, value);
      else localStorage.setItem(name, value);
      lastSaved.set(name, value);
    } catch {
      /* Practice remains available when storage is unavailable. */
    }
  },
  removeItem(name) {
    try {
      if (window.electron) window.electron.writeSettings(name, null);
      else localStorage.removeItem(name);
      lastSaved.delete(name);
    } catch {
      /* No storage available. */
    }
  },
};
