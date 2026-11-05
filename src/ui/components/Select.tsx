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
    <div className={`select-wrapper ${className}`}>
      {label && <label className="select-label" htmlFor={id}>{label}</label>}
      <div className="select-trigger-wrapper" role="combobox" aria-expanded={isOpen} aria-controls={listboxId} aria-label={ariaLabel} aria-describedby={ariaDescribedBy || (error ? `${id}-error` : undefined)} aria-disabled={disabled}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={`select-trigger ${isOpen ? "open" : ""} ${error ? "error" : ""} ${disabled ? "disabled" : ""}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-owns={listboxId}
        >
          <span className="select-value">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption && selectedOption.description && !isOpen && (
            <span className="select-description">{selectedOption.description}</span>
          )}
          <Icon name="chevron" size={16} className={`select-chevron ${isOpen ? "open" : ""}`} aria-hidden="true" />
        </button>

        {isOpen && (
          <Portal>
            <div className="select-dropdown" role="listbox" id={listboxId} aria-label={ariaLabel} style={{ maxHeight }}>
              {searchable && (
                <div className="select-search">
                  <input
                    type="text"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    placeholder="Filtrar..."
                    className="select-search-input"
                    autoFocus
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <ul ref={listRef} className="select-list" role="listbox" style={{ maxHeight }}>
                {enabledOptions.length === 0 ? (
                  <li className="select-empty" role="option" aria-disabled="true">Nenhuma opção encontrada</li>
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
                        className={`select-option ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""}`}
                        onClick={() => { onChange(option.value); setIsOpen(false); }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {option.icon && <Icon name={option.icon} size={14} className="select-option-icon" aria-hidden="true" />}
                        <div className="select-option-content">
                          <span className="select-option-label">{option.label}</span>
                          {option.description && <span className="select-option-description">{option.description}</span>}
                        </div>
                        {isSelected && <Icon name="tick" size={14} className="select-option-check" aria-hidden="true" />}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </Portal>
        )}
      </div>
      {error && <p id={`${id}-error`} className="select-error" role="alert">{error}</p>}
    </div>
  );
}

export type { SelectProps, SelectOption };