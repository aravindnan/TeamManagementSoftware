/** Rounds a maximum up to a tidy axis ceiling (1, 2, 5, 10, 20, 50 ...). Never returns less than 1. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
}

/** Bar rectangles for `values` inside a plot area, scaled to `ceiling`. A zero value still gets a 0-height bar. */
export function barGeometry(values: number[], plotW: number, plotH: number, ceiling: number, gap = 0.3): Bar[] {
  if (values.length === 0) return [];
  const slot = plotW / values.length;
  const width = slot * (1 - gap);
  return values.map((value, i) => {
    const height = ceiling > 0 ? (Math.min(value, ceiling) / ceiling) * plotH : 0;
    return { x: i * slot + (slot - width) / 2, y: plotH - height, width, height, value };
  });
}

/** SVG `points` string for a line series across the plot area. A single point is drawn as a flat segment. */
export function linePoints(values: number[], plotW: number, plotH: number, ceiling: number): string {
  if (values.length === 0) return "";
  const pts = values.length === 1 ? [values[0], values[0]] : values;
  const stepX = plotW / (pts.length - 1);
  return pts.map((v, i) => `${round(i * stepX)},${round(plotH - (ceiling > 0 ? (Math.min(v, ceiling) / ceiling) * plotH : 0))}`).join(" ");
}

const round = (n: number) => Math.round(n * 100) / 100;
