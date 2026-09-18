import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function formatHandicap(index: number): string {
  if (index < 0) return `+${Math.abs(index).toFixed(1)}`;
  return index.toFixed(1);
}

export function formatCourseHcp(hcp: number): string {
  if (hcp < 0) return `+${Math.abs(hcp)}`;
  return String(hcp);
}

export function playerName(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

export function initials(p: { first_name: string; last_name: string }): string {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "course";
}

export function isPlaceholderEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.startsWith("pending+") || e.endsWith("@pending.younggunz.golf") || e.endsWith(".invalid");
}

export function isAttachableEmail(email: string | null | undefined): email is string {
  if (!email?.trim()) return false;
  return !isPlaceholderEmail(email);
}
