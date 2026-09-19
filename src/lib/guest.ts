import { useSyncExternalStore } from "react";

const KEY = "yg-guest";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function readGuestMode(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enterGuestMode() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode */
  }
  emit();
}

export function leaveGuestMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  emit();
}

export function subscribeGuestMode(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useGuestMode() {
  return useSyncExternalStore(subscribeGuestMode, readGuestMode, () => false);
}
