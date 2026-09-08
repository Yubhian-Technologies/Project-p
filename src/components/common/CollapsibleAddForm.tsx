import { useState } from "react";
import type { ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";
import "./CollapsibleAddForm.css";

interface CollapsibleAddFormProps {
  label: string;
  title: string;
  children: ReactNode;
}

export function CollapsibleAddForm({ label, title, children }: CollapsibleAddFormProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <Card className="collapsible-add-form">
      <div className="collapsible-add-form__header">
        <p className="collapsible-add-form__title">{title}</p>
        <button
          type="button"
          className="collapsible-add-form__close"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      {children}
    </Card>
  );
}
