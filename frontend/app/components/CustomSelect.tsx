"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface CustomSelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: CustomSelectOption[];
  className?: string;
  variant?: "default" | "category";
  onFocus?: () => void;
  onBlur?: () => void;
}

export function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  variant = "default",
  onFocus,
  onBlur,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; minWidth: number; centerX: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentOption = options.find((o) => o.value === value) ?? options[0];
  const isCategory = variant === "category";

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
  }, [open, value, options]);

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      centerX: rect.left + rect.width / 2,
    });
  }, []);

  /* Position du dropdown sous le bouton (pour portail), centré par rapport à la box */
  useEffect(() => {
    if (!open || !containerRef.current) return;
    updateDropdownPosition();
  }, [open, updateDropdownPosition]);

  /* Garder le dropdown sous le bouton au scroll / resize (fenêtre fixe par rapport au select) */
  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) {
      setDropdownRect(null);
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setOpen(false);
        setDropdownRect(null);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onBlur]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        onFocus?.();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setDropdownRect(null);
        onBlur?.();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter":
        e.preventDefault();
        onChange(options[highlightedIndex].value);
        setOpen(false);
        onBlur?.();
        break;
      default:
        break;
    }
  };

  /* Catégorie : pr-9 pour que le texte + ellipsis n’empiètent pas sur la flèche. Autres box : pas de pr-9 = centrage sur toute la largeur, le masque de la flèche cache le débordement. */
  const baseButtonClass =
    "w-full rounded-lg border border-white/10 bg-white/5 py-1 min-h-[2rem] flex items-center relative focus:outline-none focus:ring-1 focus:ring-white/20 overflow-hidden";
  const categoryButtonClass = "h-9 text-tagline";
  const defaultButtonClass = "text-tagline";
  const buttonClass = isCategory
    ? `${baseButtonClass} ${categoryButtonClass}`
    : `${baseButtonClass} ${defaultButtonClass}`;

  /* Dropdown : options centrées */
  const dropdownClass =
    "z-[9999] w-max max-w-[min(100vw,24rem)] rounded-xl border border-white/[0.06] bg-[#0d0d0d] py-1.5 max-h-[min(20rem,70vh)] overflow-auto shadow-xl text-center";

  const dropdownContent = open && dropdownRect && typeof document !== "undefined" && (
    <ul
      ref={listRef}
      role="listbox"
      className={dropdownClass}
      style={{
        position: "fixed",
        top: dropdownRect.top,
        left: dropdownRect.centerX,
        minWidth: dropdownRect.minWidth,
        transform: "translateX(-50%)",
      }}
    >
      {options.map((opt, i) => {
        const isHighlighted = i === highlightedIndex || opt.value === value;
        return (
          <li
            key={String(opt.value)}
            role="option"
            aria-selected={opt.value === value}
            className={`cursor-pointer px-3 py-2 text-tagline text-slate-400 whitespace-nowrap transition-colors text-center ${
              isHighlighted
                ? "text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9)]"
                : ""
            } hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.9)]`}
            onMouseEnter={() => setHighlightedIndex(i)}
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
              setDropdownRect(null);
              onBlur?.();
            }}
          >
            {opt.label}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) onFocus?.();
          else onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        className={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={currentOption?.label}
      >
        <span className={isCategory ? "block w-full text-center truncate px-1 pr-9" : "block w-full text-center truncate px-1"}>
          {currentOption?.label ?? value}
        </span>
        <span className="absolute right-0 top-0 bottom-0 w-9 rounded-r-lg bg-white/5 flex items-center justify-center pointer-events-none" aria-hidden>
          <svg
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
