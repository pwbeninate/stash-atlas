"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Native <dialog> shown modally. Children mount only while open, so forms
 * inside start fresh each time. Escape calls onClose.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-xl";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${width} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className={`px-5 pt-5 pb-4 ${children ? "border-b border-line" : ""}`}>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-sm text-ink-2">
                {description}
              </div>
            )}
          </header>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <footer className={`flex flex-wrap justify-end gap-2 px-5 py-4 ${children ? "border-t border-line" : "pt-1"}`}>
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
