import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An optional "space" folder the widget shows beside the portrait. Set PI_PORTRAIT_SPACE to a folder that may hold:
 *   mood.txt    one line, how she feels (counts as fresh for 3 hours, then shows dim)
 *   face.txt    the emote state she wants to wear while resting (success, hi, think, ...); ignored once the mood is stale
 *   pins.jsonl  one JSON object per line; the last one's "note" is what is "on her wall"
 * The portrait never invents a mood: with no folder, or no mood.txt, nothing is shown and nothing changes.
 */
export const MOOD_FRESH_MS = 3 * 3600 * 1000;

export interface Space {
  mood: { text: string; fresh: boolean; face: string } | null;
  wall: string | null;
}

const oneLine = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 2)}..` : t;
};

const read = (file: string) => {
  try { return readFileSync(file, "utf8"); } catch { return ""; }
};

export function readSpace(dir: string | undefined, now = Date.now()): Space {
  if (!dir) return { mood: null, wall: null };
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
  return { mood, wall };
}

/** Compares two readings, so a redraw happens only when something she can see changed. */
export const spaceKey = (s: Space) => JSON.stringify(s);
