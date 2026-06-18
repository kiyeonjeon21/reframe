/**
 * Layout helpers — pure coordinate math for the common "evenly space N things"
 * jobs (a row of cards, a grid of tiles) so authors don't hand-roll a `cx(i)`
 * every time. They return coordinates you spread into node `x`/`y`; no nodes,
 * no renderer involvement — authoring sugar only. Deterministic.
 *
 *   const xs = row(3, { center: 960, gap: 60, itemWidth: 440 });
 *   xs.map((x, i) => rect({ id: `card-${i}`, x, y: 540, ... }));
 */

export interface RowOpts {
  /** Centre of the row/column (default 0). */
  center?: number;
  /** Gap between adjacent items, paired with `itemWidth` (packed layout). */
  gap?: number;
  /** Item extent along the axis, paired with `gap` (packed layout). */
  itemWidth?: number;
  /** Alternative to gap+itemWidth: spread the item CENTRES evenly across this span. */
  span?: number;
}

/** N evenly-spaced positions along one axis, centred on `center`. Give either
 *  `span` (spread centres across it) or `gap`+`itemWidth` (pack fixed-width items). */
export function row(count: number, opts: RowOpts = {}): number[] {
  if (count <= 0) return [];
  const center = opts.center ?? 0;
  if (count === 1) return [center];
  if (opts.span !== undefined) {
    const start = center - opts.span / 2;
    const pitch = opts.span / (count - 1);
    return Array.from({ length: count }, (_, i) => start + i * pitch);
  }
  const iw = opts.itemWidth ?? 0;
  const gap = opts.gap ?? 0;
  const pitch = iw + gap;
  const total = count * iw + (count - 1) * gap;
  const start = center - total / 2 + iw / 2;
  return Array.from({ length: count }, (_, i) => start + i * pitch);
}

/** N evenly-spaced positions along the vertical axis — `row` for the y axis. */
export const column = row;

export interface GridOpts {
  center?: { x: number; y: number };
  gapX?: number;
  gapY?: number;
  cellW?: number;
  cellH?: number;
  /** Alternatives to gap+cell: spread cell centres across these spans. */
  spanX?: number;
  spanY?: number;
}

/** `rows × cols` cell centres in row-major order, centred on `center`. */
export function grid(rows: number, cols: number, opts: GridOpts = {}): { x: number; y: number }[] {
  const axis = (center: number, gap?: number, item?: number, span?: number): RowOpts => ({
    center,
    ...(gap !== undefined ? { gap } : {}),
    ...(item !== undefined ? { itemWidth: item } : {}),
    ...(span !== undefined ? { span } : {}),
  });
  const xs = row(cols, axis(opts.center?.x ?? 0, opts.gapX, opts.cellW, opts.spanX));
  const ys = row(rows, axis(opts.center?.y ?? 0, opts.gapY, opts.cellH, opts.spanY));
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: xs[c]!, y: ys[r]! });
  return out;
}
