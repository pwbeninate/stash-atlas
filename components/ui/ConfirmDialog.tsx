"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button
            variant={tone}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
