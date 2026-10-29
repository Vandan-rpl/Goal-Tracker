import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Single-select dropdown with a type-to-filter box, styled like the
 * Goal Tracker's form inputs.
 *
 * Usage:
 *   <SearchableSelect
 *     options={[{ value: 9, label: "Dharmesh Thanki – IT" }]}
 *     value={leadId}
 *     onChange={setLeadId}            // receives the option value, or null on clear
 *     placeholder="Search by name or department"
 *   />
 */
export default function SearchableSelect({
  id,
  options = [],
  value = null,
  onChange,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  hasError = false,
  noOptionsText = "No matches found",
  ...ariaProps
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  const containerRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((option) => option.value === value) || null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? options.filter((option) => option.label.toLowerCase().includes(term))
      : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openList = () => {
    if (disabled) return;
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const select = (option) => {
    onChange(option.value);
    close();
  };

  // Close when clicking anywhere outside the control.
  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (event) => {
      if (!containerRef.current?.contains(event.target)) close();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Keep the highlighted option visible while using the arrow keys.
  useEffect(() => {
    if (open) listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) =>
        filtered.length ? (current + step + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      // Never let Enter submit the surrounding form from this field.
      event.preventDefault();
      if (open && filtered[highlight]) select(filtered[highlight]);
      else openList();
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlight] ? `${listboxId}-${highlight}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={loading ? "Loading..." : selected ? selected.label : placeholder}
        value={open ? query : selected?.label || ""}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full pl-3 pr-14 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
          hasError ? "border-red-500" : "border-slate-300"
        }`}
        {...ariaProps}
      />

      <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
        {selected && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              onChange(null);
              close();
            }}
            className="px-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
          >
            ✕
          </button>
        )}
        <span className="pointer-events-none text-slate-400 text-xs">▾</span>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm"
        >
          {loading ? (
            <li className="px-3 py-2 text-slate-500">Loading...</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">{noOptionsText}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                // mousedown + preventDefault keeps focus in the input.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`px-3 py-2 cursor-pointer ${
                  index === highlight ? "bg-indigo-50 text-indigo-900" : "text-slate-700"
                } ${option.value === value ? "font-semibold" : ""}`}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
