/**
 * Pure helpers for the Sixel renderer (render_sixel.ts), kept free of pi imports so they can be tested alone.
 *
 * What the Windows Terminal probe showed (1.24, 2026-11-15): Sixel is advertised, a cell is 10 by 20 pixels, and after an
 * image the cursor stays on the image's last row at the column where it started. So a frame is drawn like the iTerm2
 * one (cursor up, image on the last row) and then the cursor is moved right past the image for the text that follows.
 */

export interface Cell { widthPx: number; heightPx: number }

/** The shape of <set>/sixel.json, written by `draw-portrait --sixel PX`. */
export interface SixelFile {
  width: number;
  height: number;
  frames: Record<string, Record<string, string>>;
}

/**
 * pi-tui decides a line is wider than the terminal unless it is an image line, and it only knows Kitty and iTerm2 by
 * their prefixes: a Sixel string would count as tens of thousands of visible characters and stop pi with "Rendered line
 * exceeds terminal width". An empty Kitty APC string ahead of the Sixel marks the line as an image line. Terminals
 * ignore APC strings, and the empty control part (";") matches no registered Kitty image.
 */
export const IMAGE_LINE_MARKER = "\x1b_G;\x1b\\";

/**
 * Windows Terminal keeps a Sixel in the cells it covers, and clearing a line (which pi-tui does before it rewrites it)
 * erases that line's slice of the picture. pi-tui rewrites only the lines that changed, so when one row beside the picture
 * changes alone (a token count, the mood) it would cut a black band across the image. A mark that changes whenever the
 * frame or any row's text changes, put on every row, makes the changed range cover the whole block, so all rows are cleared
 * and the picture, drawn on the last row, goes on top of them. An APC string is ignored by terminals and by pi-tui's width
 * measure, and with no "G" it is not a Kitty command.
 */
export function repaintMark(frameGeneration: number, rows: string[]): string {
  let h = 5381;
  for (const ch of rows.join("\n")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `\x1b_p${frameGeneration}.${h.toString(36)}\x1b\\`;
}

/** Whole cells the image covers. */
export function sixelGeometry(widthPx: number, heightPx: number, cell: Cell): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(widthPx / cell.widthPx)),
    rows: Math.max(1, Math.ceil(heightPx / cell.heightPx)),
  };
}

/** The info rows keep at least this many cells; a narrower terminal gets no mood board. */
export const BOARD_MIN_INFO = 36;

/**
 * The mood board tile (a fixed-size thumbnail, see mood.ts) at the right edge of the widget: how many cells it covers, how
 * much width the info rows give up for it, and the column it starts at. null when the terminal is too narrow to leave the
 * info rows BOARD_MIN_INFO cells after the portrait and the tile.
 */
export function boardLayout(width: number, avatarCols: number, board: { width: number; height: number }, cell: Cell) {
  const { cols, rows } = sixelGeometry(board.width, board.height, cell);
  const reserve = cols + 2;                                  // the tile and a gap of two cells before it
  if (width - avatarCols - 5 - reserve < BOARD_MIN_INFO) return null;
  return { cols, rows, reserve, startCol: width - cols - 1 };  // right-aligned, one cell from the edge
}

/**
 * Appended to the widget's last row, where the cursor is after the portrait and the info text: back up to the first row,
 * out to the tile's column, and draw it. Like the portrait it is drawn last, so the clears of the rows above never touch it.
 */
export function boardPart(widgetRows: number, startCol: number, sixel: string): string {
  return `\x1b[${Math.max(0, widgetRows - 1)}A\r\x1b[${startCol}C${sixel}`;
}

/** The text of one image line: marker, the Sixel, then the cursor moved right past the image and its 1-cell margin. */
export function sixelLine(sequence: string, cols: number): string {
  return `${IMAGE_LINE_MARKER}${sequence}\x1b[${cols + 1}C`;
}

/**
 * Whether to use Sixel. PI_PORTRAIT_SIXEL=0 turns it off and =1 forces it (for a multiplexer known to pass Sixel
 * through). Otherwise: a plain Windows Terminal tab (WT_SESSION set, no tmux or screen in between) with a sixel.json.
 */
export function sixelWanted(env: Record<string, string | undefined>, hasSixelFile: boolean): boolean {
  if (!hasSixelFile || env.PI_PORTRAIT_SIXEL === "0") return false;
  if (env.PI_PORTRAIT_SIXEL === "1") return true;
  return Boolean(env.WT_SESSION) && !env.TMUX && !env.STY;
}
