import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An optional "space" folder the widget shows beside the portrait. Set PI_PORTRAIT_SPACE to a folder that may hold:
 *   mood.txt    one line, how she feels (counts as fresh for 3 hours, then shows dim)
 *   face.txt    the emote state she wants to wear while resting (success, hi, think, ...); ignored once the mood is stale
 *   pins.jsonl  one JSON object per line; the last one's "note" is what is "on her wall"
 *   board.sixel + board.json  her mood board: a fixed-size thumbnail tile of her latest pin, already encoded as Sixel (width and
 *               height in pixels, and the pin it was made from); drawn at the right of the widget in a Sixel terminal
 * The portrait never invents a mood: with no folder, or no mood.txt, nothing is shown and nothing changes.
 */
export const MOOD_FRESH_MS = 3 * 3600 * 1000;

/** The mood board tile. `key` names the pin and size it was made from, so a change is seen without comparing the picture. */
export interface Board { sixel: string; width: number; height: number; key: string }

export interface Space {
  mood: { text: string; fresh: boolean; face: string } | null;
  wall: string | null;
  board: Board | null;
}

const oneLine = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 2)}..` : t;
};

const read = (file: string) => {
  try { return readFileSync(file, "utf8"); } catch { return ""; }
};

export function readSpace(dir: string | undefined, now = Date.now(), prev?: Space): Space {
  if (!dir) return { mood: null, wall: null, board: null };
  let mood: Space["mood"] = null;
  const text = oneLine(read(join(dir, "mood.txt")), 56);
  if (text) {
    let fresh = false;
    try { fresh = now - statSync(join(dir, "mood.txt")).mtimeMs < MOOD_FRESH_MS; } catch { /* the file just went away */ }
    mood = { text, fresh, face: fresh ? read(join(dir, "face.txt")).trim() : "" };
  }
  let wall: string | null = null;
  const last = read(join(dir, "pins.jsonl")).trim().split("\n").pop() ?? "";
  try {
    const pin = JSON.parse(last);
    const label = oneLine(String(pin.note || pin.file || ""), 56);
    if (label) wall = label;
  } catch { /* no pins yet */ }
  return { mood, wall, board: readBoard(dir, prev?.board ?? null) };
}

/** The tile is read again only when board.json names a different pin or size than the one already held. */
function readBoard(dir: string, held: Board | null): Board | null {
  try {
    const meta = JSON.parse(read(join(dir, "board.json")));
    const width = Number(meta.width), height = Number(meta.height);
    if (!(width > 0 && height > 0)) return null;
    const key = `${meta.pin}:${width}x${height}`;
    if (held?.key === key) return held;
    const sixel = read(join(dir, "board.sixel"));
    return sixel.startsWith("\x1bP") ? { sixel, width, height, key } : null;
  } catch { return null; }
}

/** Compares two readings, so a redraw happens only when something she can see changed. */
export const spaceKey = (s: Space) => JSON.stringify({ ...s, board: s.board?.key ?? null });
