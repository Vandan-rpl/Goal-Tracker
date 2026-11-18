import { useState } from "react";
import { CalendarDays } from "lucide-react";

// Drop-in replacement for <input type="date"> that always shows DD/MM/YYYY,
// whatever the browser locale. The value in and out stays 'YYYY-MM-DD', and
// onChange receives { target: { name, value } } like a native input, so
// callers reading e.target.value / e.target.name need no other change.
// Typing a full valid DD/MM/YYYY (or clearing the box) emits a change; the
// calendar button opens the browser's native picker.

const isoToDisplay = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const displayToIso = (value) => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || "").trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export default function DateInput({
  value = "",
  onChange,
  name,
  min,
  max,
  disabled,
  readOnly,
  className = "",
  ...rest
}) {
  const isoValue = String(value || "").slice(0, 10);
  const [text, setText] = useState(() => isoToDisplay(isoValue));
  const [syncedValue, setSyncedValue] = useState(isoValue);

  // Follow outside changes (picker, reset filters, loaded data) without
  // overwriting a typed date that already means the same value.
  if (syncedValue !== isoValue) {
    setSyncedValue(isoValue);
    if ((displayToIso(text) ?? "") !== isoValue) setText(isoToDisplay(isoValue));
  }

  const emit = (next) => {
    if (next !== isoValue) onChange?.({ target: { name, value: next } });
  };

  const handleTextChange = (e) => {
    const nextText = e.target.value;
    setText(nextText);
    if (nextText.trim() === "") emit("");
    else {
      const iso = displayToIso(nextText);
      if (iso) emit(iso);
    }
  };

  // On leaving the box, drop an incomplete date back to the current value.
  const handleBlur = (e) => {
    setText(isoToDisplay(isoValue));
    rest.onBlur?.(e);
  };

  const locked = disabled || readOnly;

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        name={name}
        maxLength={10}
        placeholder="DD/MM/YYYY"
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleTextChange}
        onBlur={handleBlur}
        className={`${className} pr-8`}
      />
      <span
        className={`absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-slate-500 ${
          locked ? "opacity-50" : ""
        }`}
      >
        <CalendarDays size={16} aria-hidden="true" />
        {!locked && (
          <input
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            title="Choose from calendar"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            min={min}
            max={max}
            value={isoValue}
            onChange={(e) => emit(e.target.value)}
          />
        )}
      </span>
    </div>
  );
}
