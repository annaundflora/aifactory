import { useEffect, useState, type RefObject } from "react";

/** Container-width breakpoints (px) for column count. */
const BREAKPOINTS = [
  { minWidth: 1400, columns: 7 },
  { minWidth: 1100, columns: 6 },
  { minWidth: 900, columns: 5 },
  { minWidth: 650, columns: 4 },
  { minWidth: 450, columns: 3 },
] as const;

const DEFAULT_COLUMNS = 2;

/**
 * Returns a responsive column count based on the observed container width.
 * Pass a ref to the gallery container element.
 */
export function useColumnCount(containerRef: RefObject<HTMLElement | null>) {
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (width: number) => {
      const match = BREAKPOINTS.find((bp) => width >= bp.minWidth);
      setColumnCount(match ? match.columns : DEFAULT_COLUMNS);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });

    // Initial measurement
    update(el.clientWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef]);

  return columnCount;
}
