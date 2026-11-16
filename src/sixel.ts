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

/** Whole cells the image covers. */
export function sixelGeometry(widthPx: number, heightPx: number, cell: Cell): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(widthPx / cell.widthPx)),
    rows: Math.max(1, Math.ceil(heightPx / cell.heightPx)),
  };
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
