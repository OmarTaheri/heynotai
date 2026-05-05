import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "outline" | "ghost" | "green" | "green-outline";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap select-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-[7px]",
  md: "h-9 px-4 text-[14px] rounded-[9px]",
  lg: "h-10 px-5 text-[14px] rounded-[10px]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-fg)] text-[var(--color-bg)] font-semibold hover:brightness-95",
  outline:
    "border border-[var(--color-line-strong)] bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]",
  green:
    "bg-[var(--color-cta)] text-white font-semibold shadow-[0_6px_18px_var(--color-cta-ring)] hover:brightness-105",
  "green-outline":
    "border border-[var(--color-cta-line)] bg-[var(--color-cta-soft)] text-[var(--color-cta-ink)] hover:brightness-95",
};

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    children,
    className = "",
    fullWidth = false,
  } = props;

  const classes = [
    base,
    sizes[size],
    variants[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, variant: _v, size: _s, leftIcon: _l, rightIcon: _r, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
    void _v; void _s; void _l; void _r; void _f; void _c; void _ch;
    return (
      <Link href={href} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  const { variant: _v, size: _s, leftIcon: _l, rightIcon: _r, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
  void _v; void _s; void _l; void _r; void _f; void _c; void _ch;
  return (
    <button className={classes} {...rest}>
      {content}
    </button>
  );
}
