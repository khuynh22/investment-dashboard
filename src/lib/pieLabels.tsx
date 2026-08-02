import type { ReactElement } from "react";
import type { Slice } from "./portfolio";

export type Pt = { x: number; y: number };
export type Placement = { x: number; y: number; anchor: "start" | "end"; tip: Pt; elbow: Pt };

export const LABEL_GAP = 15; // minimum vertical distance between two callout labels
export const ELBOW = 14; // radial length of the leader stub leaving the rim
export const GUTTER = 22; // horizontal run from the elbow out to the text
const NIB = 6; // breathing room between the end of the leader and the text

/**
 * One rim-to-text callout: an elbowed leader in the slice's own colour, and the
 * label in plain ink. Text carries no series colour of its own — the leader it
 * sits on is what ties it to the slice.
 */
export function PieCallout({ at, label, color }: { at: Placement; label: string; color: string }): ReactElement {
  const nib = at.anchor === "start" ? at.x - NIB : at.x + NIB;
  return (
    <g className="recharts-pie-callout">
      <polyline
        points={`${at.tip.x},${at.tip.y} ${at.elbow.x},${at.elbow.y} ${nib},${at.y}`}
        fill="none"
        stroke={color}
        strokeWidth={1}
      />
      <text x={at.x} y={at.y} textAnchor={at.anchor} dominantBaseline="middle" fontSize={12} fill="#e6e6e6">
        {label}
      </text>
    </g>
  );
}

/** Matches recharts' own polar math: 90deg is 12 o'clock, angles decrease clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const rad = (-deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

/**
 * Places one callout label per slice in a left and a right gutter, pushed apart so
 * they never overlap. Assumes the pie runs clockwise from 12 o'clock
 * (startAngle 90 / endAngle -270) and that `view` is in slice order.
 *
 * Returns a map keyed by slice index; a slice missing from the map gets neither
 * text nor leader line — that pairing is the point, since a line pointing at
 * nothing is worse than no callout at all.
 */
export function layoutLabels(view: Slice[], cx: number, cy: number, r: number, height: number): Map<number, Placement> {
  const total = view.reduce((s, d) => s + d.value, 0);
  const placed = new Map<number, Placement>();
  if (total <= 0) return placed;

  let acc = 0;
  const items = view.map((s, i) => {
    const sweep = (s.value / total) * 360;
    const mid = 90 - (acc + sweep / 2);
    acc += sweep;
    const elbow = polar(cx, cy, r + ELBOW, mid);
    return { i, value: s.value, tip: polar(cx, cy, r, mid), elbow, right: elbow.x >= cx };
  });

  const top = LABEL_GAP / 2;
  const bottom = height - LABEL_GAP / 2;
  const capacity = Math.max(0, Math.floor((bottom - top) / LABEL_GAP) + 1);

  for (const right of [true, false]) {
    let side = items.filter((it) => it.right === right);
    // More labels than the column can hold: keep the biggest slices and let the rest
    // fall through to the tooltip and the holdings table rather than stacking illegibly.
    if (side.length > capacity) {
      const keep = new Set([...side].sort((a, b) => b.value - a.value).slice(0, capacity).map((it) => it.i));
      side = side.filter((it) => keep.has(it.i));
    }
    side.sort((a, b) => a.elbow.y - b.elbow.y);

    // Sweep down enforcing the gap, then slide the column back inside the plot.
    const ys: number[] = [];
    let y = -Infinity;
    for (const it of side) ys.push((y = Math.max(it.elbow.y, y + LABEL_GAP)));
    const overflow = ys.length ? Math.max(0, ys[ys.length - 1] - bottom) : 0;
    if (overflow) for (let k = 0; k < ys.length; k++) ys[k] = Math.max(top + k * LABEL_GAP, ys[k] - overflow);

    side.forEach((it, k) => {
      placed.set(it.i, {
        x: right ? cx + r + ELBOW + GUTTER : cx - r - ELBOW - GUTTER,
        y: ys[k],
        anchor: right ? "start" : "end",
        tip: it.tip,
        elbow: it.elbow,
      });
    });
  }
  return placed;
}
