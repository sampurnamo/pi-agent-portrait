import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCellDimensions } from "@earendil-works/pi-tui";
import type { EmoteState } from "./types.js";
import type { RenderedFrame } from "./renderer.js";
import { ALL_STATES } from "./emotes.js";
import { AsciiRenderer } from "./render_ascii.js";
import { log } from "./log.js";
import { sixelGeometry, sixelLine, type SixelFile } from "./sixel.js";

/**
 * Sixel renderer for Windows Terminal. Frames come from <set>/sixel.json, pre-encoded by `draw-portrait --sixel PX`, so
 * there is no image decoding here. Choosing which frame to show (random, talk, cycling) is the ASCII renderer's job and
 * is reused as it is: each Sixel string is stored as the one "line" of a frame, and getRenderedFrame turns that line into
 * an image frame for the widget.
 */
export class SixelRenderer extends AsciiRenderer {
  private size: { width: number; height: number } | null = null;
  private lastLines: string[] | null = null;
  private generation = 0;

  loadFrames(emoteSetDir: string, _extDir: string) {
    const path = join(emoteSetDir, "sixel.json");
    if (!emoteSetDir || !existsSync(path)) {
      log(`SixelRenderer: no sixel.json in ${emoteSetDir}`);
      return;
    }
    const data = JSON.parse(readFileSync(path, "utf-8")) as SixelFile;
    this.size = { width: data.width, height: data.height };
    this.frames.clear();
    for (const state of ALL_STATES) {
      const byName = data.frames[state];
      if (!byName) continue;
      const named = new Map<string, string[]>(Object.entries(byName).map(([name, seq]) => [name, [seq]]));
      this.frames.set(state as EmoteState, { named, names: [...named.keys()] });
    }
    log(`SixelRenderer: loaded ${this.frames.size} states from ${path}`);
  }

  getRenderedFrame(): RenderedFrame | null {
    const frame = super.getRenderedFrame();
    if (!frame || frame.kind !== "text" || !this.size) return frame;
    // A new frame bumps the generation. The widget uses it to repaint the rows beside the image too: a Sixel with
    // transparent pixels leaves the old picture showing through unless every row it covers is cleared first.
    if (frame.lines !== this.lastLines) { this.lastLines = frame.lines; this.generation++; }
    const { cols, rows } = sixelGeometry(this.size.width, this.size.height, getCellDimensions());
    return { kind: "image", sequence: sixelLine(frame.lines[0]!, cols), rows, cols, cursorAdvances: true, repaint: this.generation };
  }
}
