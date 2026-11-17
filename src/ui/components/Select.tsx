import { ReactNode, useState, useRef, useEffect, useId, KeyboardEvent, ChangeEvent } from "react";
import { Icon, IconName } from "../icons";
import { Portal } from "./Portal";

interface SelectOption<T> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: IconName;
}

interface SelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  maxHeight?: number;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function Select<T>({
  value,
  onChange,
  options,
  placeholder,
  label,
  error,
  disabled,
  searchable = false,
  maxHeight = 240,
  className = "",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionsRef = useRef<(HTMLLIElement | null)[]>([]);
  const id = useId();
  const listboxId = `${id}-listbox`;

  const filteredOptions = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.description?.toLowerCase().includes(search.toLowerCase()))
    : options;

  const enabledOptions = filteredOptions.filter((o) => !o.disabled);

  useEffect(() => {
    setHighlightedIndex(enabledOptions.findIndex((o) => o.value === value));
  }, [value, enabledOptions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current && optionsRef.current[highlightedIndex]) {
      optionsRef.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, enabledOptions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (enabledOptions[highlightedIndex]) {
          onChange(enabledOptions[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        if (searchable && e.key.length === 1) {
          // Let the input handle it
        }
        break;
    }
  };

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      {label && <label className="text-meta font-medium text-fg-muted" htmlFor={id}>{label}</label>}
      <div className="relative" role="combobox" aria-expanded={isOpen} aria-controls={listboxId} aria-label={ariaLabel} aria-describedby={ariaDescribedBy || (error ? `${id}-error` : undefined)} aria-disabled={disabled}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`flex h-h-md w-full items-center gap-2 rounded-sm border bg-bg-raised px-3 text-left text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${isOpen ? "border-accent" : "border-line"} ${error ? "border-bad-edge" : ""}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-owns={listboxId}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption && selectedOption.description && !isOpen && (
            <span className="text-meta text-fg-muted">{selectedOption.description}</span>
          )}
          <Icon name="chevron" size={16} className={`shrink-0 text-fg-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOpen && (
          <Portal>
            <div className="z-50 overflow-hidden rounded-md border border-edge bg-bg-raised p-1 shadow-floating" role="listbox" id={listboxId} aria-label={ariaLabel} style={{ maxHeight }}>
              {searchable && (
                <div className="p-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    placeholder="Filtrar..."
                    className="w-full rounded-sm border border-line bg-bg-canvas px-2 py-1 text-meta text-fg outline-none focus:border-accent"
                    autoFocus
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <ul ref={listRef} className="m-0 list-none overflow-y-auto" role="listbox" style={{ maxHeight }}>
                {enabledOptions.length === 0 ? (
                  <li className="px-2 py-1.5 text-meta text-fg-muted" role="option" aria-disabled="true">Nenhuma opção encontrada</li>
                ) : (
                  enabledOptions.map((option, index) => {
                    const isSelected = option.value === value;
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <li
                        key={String(option.value)}
                        ref={(el) => { optionsRef.current[index] = el; }}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled}
                        className={`flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-body ${isSelected ? "text-accent" : "text-fg"} ${isHighlighted ? "bg-tile-hover" : ""}`}
                        onClick={() => { onChange(option.value); setIsOpen(false); }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {option.icon && <Icon name={option.icon} size={14} className="shrink-0 text-fg-muted" aria-hidden="true" />}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{option.label}</span>
                          {option.description && <span className="text-meta text-fg-muted">{option.description}</span>}
                        </div>
                        {isSelected && <Icon name="tick" size={14} className="shrink-0 text-accent" aria-hidden="true" />}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </Portal>
        )}
      </div>
      {error && <p id={`${id}-error`} className="text-meta text-bad" role="alert">{error}</p>}
    </div>
  );
}

export type { SelectProps, SelectOption };