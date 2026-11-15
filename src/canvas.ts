/** Text portraits (ASCII sets and block art) are drawn on a canvas at least 8 columns by 4 rows, the size the
 * shipped ASCII sets were made for. A frame that is bigger, such as 24 by 12 block art, sets its own size. */
export const MIN_TEXT_COLS = 8;
export const MIN_TEXT_ROWS = 4;

export function textCanvas(lines: string[], width: (line: string) => number): { cols: number; rows: number } {
  return {
    cols: Math.max(MIN_TEXT_COLS, ...lines.map(width)),
    rows: Math.max(MIN_TEXT_ROWS, lines.length),
  };
}
