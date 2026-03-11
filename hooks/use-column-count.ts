import { useEffect, useState } from "react";

const BREAKPOINTS = [
  { query: "(min-width: 1024px)", columns: 4 },
  { query: "(min-width: 640px)", columns: 3 },
] as const;

const DEFAULT_COLUMNS = 2;

export function useColumnCount() {
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const mqls = BREAKPOINTS.map((bp) => ({
      mql: window.matchMedia(bp.query),
      columns: bp.columns,
    }));

    const update = () => {
      const match = mqls.find((m) => m.mql.matches);
      setColumnCount(match ? match.columns : DEFAULT_COLUMNS);
    };

    update();

    const handlers = mqls.map(({ mql }) => {
      const handler = () => update();
      mql.addEventListener("change", handler);
      return { mql, handler };
    });

    return () => {
      handlers.forEach(({ mql, handler }) =>
        mql.removeEventListener("change", handler)
      );
    };
  }, []);

  return columnCount;
}
