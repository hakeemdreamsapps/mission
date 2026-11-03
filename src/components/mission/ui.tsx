import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "min-h-11 w-full border border-fg/15 bg-bg px-3 text-base text-fg outline-none placeholder:text-muted focus:border-brass";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

export function BrassButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 bg-brass px-4 font-semibold text-bg transition-colors hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-40",
        focus,
        className,
      )}
      {...props}
    />
  );
}

export function GhostButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 border border-fg/15 bg-surface px-4 text-fg transition-colors hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-40",
        focus,
        className,
      )}
      {...props}
    />
  );
}

export function QuietButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 px-3 text-muted transition-colors hover:text-fg",
        focus,
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "grid size-11 shrink-0 place-items-center text-fg transition-colors hover:bg-fg/5",
        focus,
        className,
      )}
      {...props}
    />
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs tracking-widest text-brass uppercase">{children}</p>;
}

export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
