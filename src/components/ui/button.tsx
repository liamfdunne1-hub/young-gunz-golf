import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
  {
    variants: {
      variant: {
        gold: "bg-gold text-navy hover:bg-gold-2",
        navy: "bg-navy-3 text-cream border border-line hover:bg-navy-2",
        ghost: "bg-transparent text-cream hover:bg-cream/5",
        cream: "bg-cream text-navy hover:bg-cream-2",
        danger: "bg-danger text-cream",
      },
      size: {
        sm: "h-9 px-3 text-xs rounded-[8px]",
        md: "h-11 px-4 text-sm rounded-[12px]",
        lg: "h-12 px-5 text-sm rounded-[14px]",
        xl: "h-14 px-6 text-base rounded-[16px]",
        icon: "size-11 rounded-[12px]",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
