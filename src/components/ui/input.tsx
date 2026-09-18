import type { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 rounded-[12px] border border-line bg-navy px-3 text-sm text-cream placeholder:text-muted",
        "focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-[16px] border border-line bg-navy px-3 py-2 text-sm text-cream placeholder:text-muted",
        "focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/30",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs uppercase tracking-[0.16em] text-gold", className)} {...props} />;
}
