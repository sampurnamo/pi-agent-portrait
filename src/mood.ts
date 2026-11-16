import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An optional "space" folder the widget shows beside the portrait. Set PI_PORTRAIT_SPACE to a folder that may hold:
 *   mood.txt    one line, how she feels (counts as fresh for 3 hours, then shows dim)
 *   face.txt    the emote state she wants to wear while resting (success, hi, think, ...); ignored once the mood is stale
 *   pins.jsonl  one JSON object per line; the last one's "note" is what is "on her wall"
 *   reflection.json  her answer to a pause: {"at": ISO local time, "label": continue|change|stop|stuck, "text"}; fresh for 12 hours
 *   note.txt    a line she leaves for him
 *   board.sixel + board.json  her mood board: a fixed-size thumbnail tile of her latest pin, already encoded as Sixel (width and
 *               height in pixels, and the pin it was made from); drawn at the right of the widget in a Sixel terminal
 * The portrait never invents a mood: with no folder, or no mood.txt, nothing is shown and nothing changes.
 */
export const MOOD_FRESH_MS = 3 * 3600 * 1000;
export const REFLECT_FRESH_MS = 12 * 3600 * 1000;

/** The mood board tile. `key` names the pin and size it was made from, so a change is seen without comparing the picture. */
export interface Board { sixel: string; width: number; height: number; key: string }

export interface Space {
  mood: { text: string; fresh: boolean; face: string } | null;
  wall: string | null;
  reflecting: { label: string; text: string; fresh: boolean } | null;
  note: string | null;
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
  if (!dir) return { mood: null, wall: null, reflecting: null, note: null, board: null };
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
  let reflecting: Space["reflecting"] = null;
  try {
    const r = JSON.parse(read(join(dir, "reflection.json")));
    const text = oneLine(String(r.text ?? ""), 120), label = String(r.label ?? "");
    if (label && text) reflecting = { label, text, fresh: now - Date.parse(r.at) < REFLECT_FRESH_MS };   // an unreadable date is not fresh
  } catch { /* she has not answered a pause yet */ }
  const note = oneLine(read(join(dir, "note.txt")), 56) || null;
  return { mood, wall, reflecting, note, board: readBoard(dir, prev?.board ?? null) };
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

/** Her words wrapped to at most `maxLines` lines of `width` characters (counted by code point); what does not fit ends in "..". */
export function wrapWords(text: string, width: number, maxLines: number): string[] {
  const len = (s: string) => [...s].length;
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && len(`${line} ${word}`) > width) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  if (out.length <= maxLines) return out;
  const kept = out.slice(0, maxLines);
  const last = kept[maxLines - 1]!;
  kept[maxLines - 1] = len(last) + 2 > width ? `${[...last].slice(0, width - 2).join("")}..` : `${last}..`;
  return kept;
}

/** Compares two readings, so a redraw happens only when something she can see changed. */
export const spaceKey = (s: Space) => JSON.stringify({ ...s, board: s.board?.key ?? null });
