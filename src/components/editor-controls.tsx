import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  RadioGroupPrimitive,
  RadioPrimitive,
} from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@/components/ui/tooltip";
import { Field, FieldLabel } from "@/components/ui/field";
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, ReactNode][];
  onChange: (value: string) => void;
}) {
  return (
    <SegmentedControl
      size="sm"
      aria-label={label}
      render={
        <RadioGroupPrimitive
          value={value}
          onValueChange={(v) => onChange(String(v))}
        />
      }
    >
      {options.map(([v, text]) => (
        <SegmentedControlItem
          key={v}
          render={<RadioPrimitive.Root value={v} />}
        >
          {text}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
export function Section({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className="inspector-section">
      <h3>{title}</h3>
      {description && <p className="section-note">{description}</p>}
      {children}
    </section>
  );
}
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field className="parameter-field">
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        getAriaLabel={() => label}
      >
        <div className="field-heading">
          <FieldLabel>{label}</FieldLabel>
          <output>
            {value}
            {unit}
          </output>
        </div>
      </Slider>
    </Field>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = `toggle-${label}`;
  return (
    <div className="toggle-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {hint && <p className="section-note">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function commit() {
    let hex = draft.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (/^#[\da-f]{3}$/i.test(hex))
      hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
    if (/^#[\da-f]{6}$/i.test(hex)) onChange(hex.toLowerCase());
    else setDraft(value);
  }
  return (
    <div className="color-row">
      <label htmlFor={`hex-${label}`}>{label}</label>
      <div className="color-input">
        <input
          type="color"
          aria-label={`${label}颜色选择器`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          unstyled
          id={`hex-${label}`}
          value={draft}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label}十六进制`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}
