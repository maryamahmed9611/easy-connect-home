import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-secondary text-secondary-foreground hover:bg-secondary/80";

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-bold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${variantClasses} ${className}`}
      {...props}
    />
  );
}