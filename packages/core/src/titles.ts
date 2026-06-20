/**
 * Title + lower-third generators — the motion-graphic overlay vocabulary for a
 * media piece (titles, name straps), the high-level analog of `photoMontage`.
 *
 * `title()` composes the kinetic-text engine (`splitText` + `textIn`/`textOut`);
 * `lowerThird()` is a name/role strap with an accent bar. Both return
 * `{ nodes, timeline }` (house style) so a caller spreads the nodes into the
 * scene and composes the timeline with `seq`/`par`. Pure + deterministic; stable
 * ids so overlay edits address them.
 */

import { beat, group, par, rect, seq, text, tween, wait } from "./dsl.js";
import type { NodeIR, TimelineIR } from "./ir.js";
import { splitText, textIn, textOut, type FontWeight, type TextBlock, type TextInName, type TextOutName } from "./textFx.js";

export interface TitleOpts {
  /** The headline text. */
  text: string;
  /** Id PREFIX → glyph ids `${id}-${i}` (default "title"). Make it unique. */
  id?: string;
  /** Anchor (default centre of a 1920×1080 frame). */
  x?: number;
  y?: number;
  fontSize?: number; // default 96
  fontWeight?: FontWeight;
  fill?: string;
  letterSpacing?: number;
  /** Entrance preset (default "cascade"). */
  entrance?: TextInName;
  /** Optional exit preset — when set, the title plays in, holds, then exits. */
  exit?: TextOutName;
  /** Duration multiplier (>1 faster). */
  speed?: number;
  /** Deterministic per-glyph variation. */
  seed?: number;
  /** Seconds held before the exit (only used with `exit`). Default 2. */
  hold?: number;
}

export interface TitleResult {
  nodes: NodeIR[];
  timeline: TimelineIR;
  /** The laid-out text block — add `textLoop` behaviors or extra tweens off this. */
  block: TextBlock;
}

/** A kinetic headline. Labels: `${id}-in` (entrance) and `${id}-out` (exit). */
export function title(opts: TitleOpts): TitleResult {
  const id = opts.id ?? "title";
  const block = splitText(opts.text, {
    id,
    x: opts.x ?? 960,
    y: opts.y ?? 540,
    fontSize: opts.fontSize ?? 96,
    ...(opts.fontWeight !== undefined && { fontWeight: opts.fontWeight }),
    ...(opts.fill !== undefined && { fill: opts.fill }),
    ...(opts.letterSpacing !== undefined && { letterSpacing: opts.letterSpacing }),
  });
  const fx = {
    ...(opts.speed !== undefined && { speed: opts.speed }),
    ...(opts.seed !== undefined && { seed: opts.seed }),
  };
  const entrance = textIn(opts.entrance ?? "cascade", block, { ...fx, label: `${id}-in` });
  if (!opts.exit) return { nodes: block.nodes, timeline: entrance, block };
  const timeline = seq(
    entrance,
    wait(Math.max(0, opts.hold ?? 2)),
    textOut(opts.exit, block, { ...fx, label: `${id}-out` }),
  );
  return { nodes: block.nodes, timeline, block };
}

export interface LowerThirdOpts {
  /** Main line (e.g. a name). */
  name: string;
  /** Sub line (e.g. a role). Omit for a single-line strap. */
  role?: string;
  /** Id PREFIX → `${id}` group + `${id}-bar`/`${id}-name`/`${id}-role` (default "lt"). */
  id?: string;
  /** Group anchor (default a bottom-left title-safe position). */
  x?: number;
  y?: number;
  /** Accent bar colour (default "#FF4D00"). */
  accent?: string;
  /** Name colour (default "#FFFFFF"). */
  fill?: string;
  /** Role colour (default "#C9C9C9"). */
  subFill?: string;
  /** Name font size (default 48); the role is ~0.58× of it. */
  fontSize?: number;
  /** Seconds the strap holds before it exits. Default 3. */
  hold?: number;
}

export interface LowerThirdResult {
  nodes: NodeIR[];
  timeline: TimelineIR;
}

/** A name/role strap with an accent bar that grows in, text sliding + fading.
 *  Labels: `${id}-in` (entrance) and `${id}-out` (exit). */
export function lowerThird(opts: LowerThirdOpts): LowerThirdResult {
  const id = opts.id ?? "lt";
  const x = opts.x ?? 120;
  const y = opts.y ?? 860;
  const fs = opts.fontSize ?? 48;
  const roleFs = Math.round(fs * 0.58);
  const barH = opts.role ? fs + roleFs + 24 : fs + 16;
  const restX = 28; // text rests 28px right of the bar; slides in from restX-8
  const startX = restX - 8;

  const children: NodeIR[] = [
    rect({ id: `${id}-bar`, x: 0, y: 0, width: 6, height: barH, anchor: "top-left", fill: opts.accent ?? "#FF4D00", scaleY: 0 }),
    text({ id: `${id}-name`, x: startX, y: 6, anchor: "top-left", content: opts.name, fontFamily: "Inter", fontSize: fs, fontWeight: 700, fill: opts.fill ?? "#FFFFFF", opacity: 0 }),
  ];
  if (opts.role !== undefined) {
    children.push(
      text({ id: `${id}-role`, x: startX, y: 6 + fs + 8, anchor: "top-left", content: opts.role, fontFamily: "Inter", fontSize: roleFs, fill: opts.subFill ?? "#C9C9C9", opacity: 0 }),
    );
  }
  const nodes: NodeIR[] = [group({ id, x, y }, children)];

  const entrance = beat(`${id}-in`, {}, [
    par(
      tween(`${id}-bar`, { scaleY: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      seq(wait(0.08), tween(`${id}-name`, { opacity: 1, x: restX }, { duration: 0.45, ease: "easeOutCubic" })),
      ...(opts.role !== undefined ? [seq(wait(0.16), tween(`${id}-role`, { opacity: 1, x: restX }, { duration: 0.45, ease: "easeOutCubic" }))] : []),
    ),
  ]);
  const exit = beat(`${id}-out`, {}, [
    par(
      tween(`${id}-bar`, { scaleY: 0 }, { duration: 0.35, ease: "easeInCubic" }),
      tween(`${id}-name`, { opacity: 0 }, { duration: 0.3, ease: "easeInCubic" }),
      ...(opts.role !== undefined ? [tween(`${id}-role`, { opacity: 0 }, { duration: 0.3, ease: "easeInCubic" })] : []),
    ),
  ]);

  return { nodes, timeline: seq(entrance, wait(Math.max(0, opts.hold ?? 3)), exit) };
}
