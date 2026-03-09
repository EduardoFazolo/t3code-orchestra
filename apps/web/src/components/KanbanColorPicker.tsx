import { CheckIcon, PipetteIcon } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { Popover, PopoverPopup, PopoverTrigger } from "./ui/popover";
import { cn } from "~/lib/utils";

// ─── Palette definition ────────────────────────────────────────────────────────

// 5 columns × 3 rows of base colors
export const COLOR_PALETTE = [
  // Row 1: reds → yellows
  { hex: "#ef4444", family: "red" },
  { hex: "#f97316", family: "orange" },
  { hex: "#f59e0b", family: "amber" },
  { hex: "#eab308", family: "yellow" },
  { hex: "#84cc16", family: "lime" },
  // Row 2: greens → blues
  { hex: "#22c55e", family: "green" },
  { hex: "#10b981", family: "emerald" },
  { hex: "#06b6d4", family: "cyan" },
  { hex: "#3b82f6", family: "blue" },
  { hex: "#6366f1", family: "indigo" },
  // Row 3: purples → neutrals
  { hex: "#8b5cf6", family: "violet" },
  { hex: "#a855f7", family: "purple" },
  { hex: "#ec4899", family: "pink" },
  { hex: "#f43f5e", family: "rose" },
  { hex: "#64748b", family: "slate" },
] as const;

type ColorFamily = (typeof COLOR_PALETTE)[number]["family"];

const COLOR_SHADES: Record<ColorFamily, string[]> = {
  red: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#991b1b"],
  orange: ["#fdba74", "#fb923c", "#f97316", "#ea580c", "#9a3412"],
  amber: ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#92400e"],
  yellow: ["#fde68a", "#fcd34d", "#eab308", "#ca8a04", "#854d0e"],
  lime: ["#bef264", "#a3e635", "#84cc16", "#65a30d", "#3f6212"],
  green: ["#86efac", "#4ade80", "#22c55e", "#16a34a", "#14532d"],
  emerald: ["#6ee7b7", "#34d399", "#10b981", "#059669", "#064e3b"],
  cyan: ["#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#164e63"],
  blue: ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e3a8a"],
  indigo: ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#312e81"],
  violet: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#4c1d95"],
  purple: ["#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#581c87"],
  pink: ["#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#831843"],
  rose: ["#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#881337"],
  slate: ["#94a3b8", "#64748b", "#475569", "#334155", "#0f172a"],
};

// 5 colors shown as quick picks before the "more" button
export const QUICK_PICKS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"] as const;

function familyForHex(hex: string): ColorFamily | null {
  const entry = COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return entry?.family ?? null;
}

function shadesForHex(hex: string): string[] {
  const family = familyForHex(hex);
  if (!family) return [];
  return COLOR_SHADES[family];
}

function normalizeHex(raw: string): string {
  const h = raw.trim().replace(/^#/, "");
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 6) return `#${h}`;
  return `#${h}`;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ─── Swatch ────────────────────────────────────────────────────────────────────

const Swatch = memo(function Swatch({
  color,
  selected,
  size = "md",
  onClick,
  title,
}: {
  color: string;
  selected?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? color}
      onClick={onClick}
      className={cn(
        "relative rounded-md border-2 transition-transform hover:scale-110 active:scale-95 shrink-0",
        size === "sm" ? "size-6" : "size-7",
        selected ? "border-white/80 shadow-md" : "border-transparent",
      )}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <CheckIcon
          className="absolute inset-0 m-auto size-3 drop-shadow-sm"
          style={{ color: isLight(color) ? "#000" : "#fff" }}
        />
      )}
    </button>
  );
});

function isLight(hex: string): boolean {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// ─── Expanded picker panel ─────────────────────────────────────────────────────

const ExpandedPicker = memo(function ExpandedPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string) => void;
}) {
  const [hexInput, setHexInput] = useState(value ?? "");
  const [hexError, setHexError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shades = value ? shadesForHex(value) : [];

  const applyHex = useCallback(() => {
    const normalized = normalizeHex(hexInput);
    if (isValidHex(normalized)) {
      setHexError(false);
      onChange(normalized);
    } else {
      setHexError(true);
    }
  }, [hexInput, onChange]);

  return (
    <div className="w-56 space-y-3">
      {/* Color grid */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Colors</p>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <Swatch
              key={c.hex}
              color={c.hex}
              size="sm"
              selected={value?.toLowerCase() === c.hex.toLowerCase()}
              onClick={() => {
                onChange(c.hex);
                setHexInput(c.hex);
              }}
            />
          ))}
        </div>
      </div>

      {/* Shades */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Shades</p>
        {shades.length > 0 ? (
          <div className="flex gap-1.5">
            {shades.map((s) => (
              <Swatch
                key={s}
                color={s}
                size="sm"
                selected={value?.toLowerCase() === s.toLowerCase()}
                onClick={() => {
                  onChange(s);
                  setHexInput(s);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            Select a color to see shades
          </p>
        )}
      </div>

      {/* Hex input */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Hex code</p>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5",
            hexError ? "border-destructive" : "border-border",
          )}
        >
          <span className="text-xs text-muted-foreground">#</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-xs text-foreground outline-none font-mono"
            value={hexInput.replace(/^#/, "")}
            onChange={(e) => {
              setHexInput(`#${e.target.value}`);
              setHexError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyHex();
            }}
            onBlur={applyHex}
            maxLength={6}
            placeholder="3b82f6"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={applyHex}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Apply hex color"
          >
            <PipetteIcon className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── KanbanColorPicker ─────────────────────────────────────────────────────────

interface KanbanColorPickerProps {
  value: string | undefined;
  onChange: (color: string) => void;
}

export const KanbanColorPicker = memo(function KanbanColorPicker({
  value,
  onChange,
}: KanbanColorPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      {/* 5 quick-pick swatches */}
      {QUICK_PICKS.map((color) => (
        <Swatch
          key={color}
          color={color}
          selected={value?.toLowerCase() === color.toLowerCase()}
          onClick={() => onChange(color)}
        />
      ))}

      {/* 6th button: opens full palette popover */}
      <Popover>
        <PopoverTrigger
          className={cn(
            "relative size-7 shrink-0 rounded-md border-2 transition-transform hover:scale-110 active:scale-95",
            // Show current color if it's not a quick pick, else show a gradient indicator
            value && !QUICK_PICKS.includes(value as (typeof QUICK_PICKS)[number])
              ? "border-white/80 shadow-md"
              : "border-transparent",
          )}
          style={
            value && !QUICK_PICKS.includes(value as (typeof QUICK_PICKS)[number])
              ? { backgroundColor: value }
              : {}
          }
          aria-label="More colors"
        >
          {!(value && !QUICK_PICKS.includes(value as (typeof QUICK_PICKS)[number])) && (
            <div
              className="size-full rounded-[4px]"
              style={{
                background:
                  "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
              }}
            />
          )}
        </PopoverTrigger>
        <PopoverPopup side="bottom" align="start" className="p-0">
          <div className="p-3">
            <ExpandedPicker value={value} onChange={onChange} />
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  );
});
