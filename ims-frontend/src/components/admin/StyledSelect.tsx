"use client";

import { Children, isValidElement, type ReactNode, type SelectHTMLAttributes } from "react";
import AdminSelect from "./AdminSelect";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function optionText(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}

function collectOptions(children: ReactNode): { value: string; label: string }[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return [];
    return child.type === "option"
      ? [{ value: String(child.props.value ?? optionText(child.props.children)), label: optionText(child.props.children) }]
      : collectOptions(child.props.children);
  });
}

// Keep existing option lists and form behavior while sharing the application menu UI.
export default function StyledSelect({ value, onValueChange, children, id, disabled, required, name, "aria-label": label }: Props) {
  return <AdminSelect label={label ?? "Select option"} hideLabel value={value} onChange={onValueChange} options={collectOptions(children)} id={id} disabled={disabled} required={required} name={name} />;
}
