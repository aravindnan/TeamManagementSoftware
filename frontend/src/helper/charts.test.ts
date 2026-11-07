import { barGeometry, linePoints, niceMax } from "./charts";

describe("niceMax", () => {
  test.each([
    [0, 1], [1, 1], [-3, 1], [NaN, 1], [2, 2], [3, 5], [5, 5], [6, 10], [11, 20], [37, 50], [51, 100], [230, 500],
  ])("niceMax(%p) = %p", (input, expected) => expect(niceMax(input)).toBe(expected));
});

describe("barGeometry", () => {
  test("scales bars to the ceiling and stands them on the baseline", () => {
    const bars = barGeometry([0, 5, 10], 300, 100, 10);
    expect(bars.map((b) => b.height)).toEqual([0, 50, 100]);
    expect(bars.map((b) => b.y)).toEqual([100, 50, 0]);
    expect(bars.every((b) => b.y + b.height === 100)).toBe(true);
  });
  test("bars stay inside their slots and never overlap", () => {
    const bars = barGeometry([1, 1, 1, 1], 400, 80, 2);
    for (let i = 0; i < bars.length; i++) {
      expect(bars[i].x).toBeGreaterThanOrEqual(i * 100);
      expect(bars[i].x + bars[i].width).toBeLessThanOrEqual((i + 1) * 100);
    }
  });
  test("values above the ceiling are clipped, empty input is safe", () => {
    expect(barGeometry([50], 100, 100, 10)[0].height).toBe(100);
    expect(barGeometry([], 100, 100, 10)).toEqual([]);
    expect(barGeometry([3], 100, 100, 0)[0].height).toBe(0);
  });
});

describe("linePoints", () => {
  test("spans the full width, with the highest value at the top", () => {
    expect(linePoints([0, 5, 10], 200, 100, 10)).toBe("0,100 100,50 200,0");
  });
  test("a single point becomes a flat segment; empty input gives nothing", () => {
    expect(linePoints([4], 100, 100, 10)).toBe("0,60 100,60");
    expect(linePoints([], 100, 100, 10)).toBe("");
  });
});
