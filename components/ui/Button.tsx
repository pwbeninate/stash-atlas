import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-bg text-accent-fg hover:brightness-110",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-bg text-white hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md") {
  return `inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
