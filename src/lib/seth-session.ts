const KEY = "yg.seth.unlocked";

export function isSethUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSethUnlocked(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (open) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
