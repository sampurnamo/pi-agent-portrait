import { test } from "node:test";
import assert from "node:assert/strict";
import { sixelGeometry, sixelLine, sixelWanted, IMAGE_LINE_MARKER } from "../src/sixel.ts";

test("the image covers whole cells, rounded up, from the terminal's own cell size", () => {
  assert.deepEqual(sixelGeometry(200, 200, { widthPx: 10, heightPx: 20 }), { cols: 20, rows: 10 });
  assert.deepEqual(sixelGeometry(200, 200, { widthPx: 9, heightPx: 18 }), { cols: 23, rows: 12 });   // pi-tui's default before the terminal answers
  assert.deepEqual(sixelGeometry(1, 1, { widthPx: 10, heightPx: 20 }), { cols: 1, rows: 1 });
});

test("the line is marked as an image line, and the cursor moves past the image and its margin", () => {
  const line = sixelLine("\x1bP0;1;0q#0;2;0;0;0~\x1b\\", 20);
  assert.ok(line.startsWith(IMAGE_LINE_MARKER));
  assert.ok(line.endsWith("\x1b[21C"));
  assert.ok(line.includes("\x1bP0;1;0q"));
});

test("the marker is what pi-tui's isImageLine looks for (a Kitty prefix) and carries no image id", () => {
  assert.ok(IMAGE_LINE_MARKER.startsWith("\x1b_G"));
  assert.equal(/(?:^|,)i=(\d+)(?:,|$)/.exec(/\x1b_G([^;]*);/.exec(IMAGE_LINE_MARKER)![1]!), null);
});

test("Sixel is for a plain Windows Terminal tab with a sixel.json, and the variable overrides", () => {
  const wt = { WT_SESSION: "abc" };
  assert.equal(sixelWanted(wt, true), true);
  assert.equal(sixelWanted(wt, false), false);                              // no sixel.json
  assert.equal(sixelWanted({}, true), false);                               // not Windows Terminal
  assert.equal(sixelWanted({ ...wt, TMUX: "/tmp/x,1,0" }, true), false);    // inside psmux or tmux
  assert.equal(sixelWanted({ ...wt, PI_PORTRAIT_SIXEL: "0" }, true), false);
  assert.equal(sixelWanted({ PI_PORTRAIT_SIXEL: "1", TMUX: "x" }, true), true);
  assert.equal(sixelWanted({ PI_PORTRAIT_SIXEL: "1" }, false), false);      // forcing still needs the file
});
