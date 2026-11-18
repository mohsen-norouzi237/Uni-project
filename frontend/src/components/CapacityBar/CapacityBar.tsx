import React from "react";
import { isAtCapacity } from "@/utils/capacity";
import "./CapacityBar.css";

export interface CapacityBarProps {
  current: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  showNumbers?: boolean;
  height?: number;
  rtl?: boolean;
  className?: string;
  /** Compact single-line layout used inside table cells. */
  compact?: boolean;
  /** Badge text shown when capacity is exhausted. */
  fullLabel?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

function getCapacityColor(fill: number): string {
  let hue: number;
  if (fill <= 0.5) {
    hue = 120 - 60 * (fill / 0.5);
  } else if (fill <= 0.75) {
    hue = 60 - 30 * ((fill - 0.5) / 0.25);
  } else {
    hue = 30 - 30 * ((fill - 0.75) / 0.25);
  }
  return `hsl(${Math.round(hue)}, 85%, 45%)`;
}

/**
 * The single capacity/progress bar in the app.
 *
 * The inline `LoadBar` that used to live in WorkloadMonitoringPage has been
 * deleted in favour of this component. Two behaviours it did not have and that
 * matter once real data arrives:
 *
 *  - **Division is always guarded.** `max` of 0 (a TA with no allowance, which
 *    Django can legitimately send) produced `0/0 = NaN` and
 *    `style={{ width: "NaN%" }}`. Here the denominator is floored at 1 and the
 *    ratio is clamped to [0, 1], so a zero limit renders as a full bar rather
 *    than a broken one. Non-finite input (NaN/Infinity) is coerced to 0.
 *  - **`role="progressbar"`, not `role="meter"`.** `meter` has patchy screen
 *    reader support; `progressbar` is universally announced.
 */
export const CapacityBar: React.FC<CapacityBarProps> = ({
  current,
  max,
  label,
  showPercent = true,
  showNumbers = true,
  height = 12,
  rtl = true,
  className = "",
  compact = false,
  fullLabel,
}) => {
  // Coerce non-finite values before any arithmetic touches them.
  const safeCurrentRaw = Number.isFinite(current) ? Math.max(0, current) : 0;
  const declaredMax = Number.isFinite(max) ? Math.max(0, max) : 0;

  // Floor the DENOMINATOR at 1 so the division can never be 0/0 or x/0.
  // `declaredMax` (which may be 0) is still what we display and announce.
  const divisor = Math.max(1, declaredMax);
  const fillRatio = clamp(safeCurrentRaw / divisor, 0, 1);
  const percentage = Math.round(fillRatio * 100);

  // A limit of 0 means "no allowance": treat any assignment as full.
  // Shared with the workload filter (`isOverloaded`) so both agree.
  const isFull = isAtCapacity(safeCurrentRaw, declaredMax);
  const barColor = getCapacityColor(fillRatio);
  const valueText = `${round(safeCurrentRaw, 2)} از ${declaredMax} (${percentage}٪)`;

  const track = (
    <div
      className="capacity-bar__track"
      style={{ height: `${height}px` }}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div
        className="capacity-bar__fill"
        style={{ width: `${percentage}%`, backgroundColor: barColor }}
      />
    </div>
  );

  if (compact) {
    return (
      <div
        className={`capacity-bar-container capacity-bar--compact ${rtl ? "capacity-bar--rtl" : ""} ${className}`.trim()}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={declaredMax}
        aria-valuenow={safeCurrentRaw}
        aria-valuetext={valueText}
      >
        <div className="capacity-bar__compact-row">
          <div className="capacity-bar__compact-track">{track}</div>
          <span className="capacity-bar__numbers" dir="ltr">
            {round(safeCurrentRaw, 2)}/{declaredMax}
          </span>
          {isFull && fullLabel && (
            <span className="capacity-bar__full-badge">{fullLabel}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`capacity-bar-container ${rtl ? "capacity-bar--rtl" : ""} ${className}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={declaredMax}
      aria-valuenow={safeCurrentRaw}
      aria-valuetext={valueText}
    >
      {(label || showNumbers || showPercent) && (
        <div className="capacity-bar__header">
          {label && <span className="capacity-bar__label">{label}</span>}
          <div className="capacity-bar__meta">
            {showNumbers && (
              <span className="capacity-bar__numbers">
                {round(safeCurrentRaw, 2)} / {declaredMax}
              </span>
            )}
            {showNumbers && showPercent && (
              <span className="capacity-bar__separator">·</span>
            )}
            {showPercent && (
              <span className="capacity-bar__percent">{percentage}٪</span>
            )}
          </div>
        </div>
      )}

      {track}
    </div>
  );
};

export default CapacityBar;
