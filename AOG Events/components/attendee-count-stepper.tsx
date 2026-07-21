"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Minus, Plus } from "lucide-react";

// Tap +/- for small adjustments, or type a value directly (needed for large
// headcounts). Keeps its own draft text so the field can be backspaced/cleared
// while typing instead of snapping back to 0 on every keystroke.
export function AttendeeCountStepper({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const next = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    onChange(next);
    setText(String(next));
  };

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => commit(String(Math.max(0, value - 1)))}
          disabled={disabled || value <= 0} className="h-9 w-9 shrink-0 rounded-full">
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          className="text-center"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || /^\d+$/.test(raw)) setText(raw);
          }}
          onBlur={() => commit(text)}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => commit(String(value + 1))}
          disabled={disabled} className="h-9 w-9 shrink-0 rounded-full">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Field>
  );
}
