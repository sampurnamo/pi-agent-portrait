import { test } from "node:test";
import assert from "node:assert/strict";
import { textCanvas, MIN_TEXT_COLS, MIN_TEXT_ROWS } from "../src/canvas.ts";

// Visible width: the length once colour codes are gone (the widget passes pi-tui's visibleWidth).
const width = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;

test("the shipped 8x4 ASCII frames keep the 8x4 canvas", () => {
  const bot = [".------.", "|  ^o^ |", "'--++--'", "===++==="];
  assert.deepEqual(textCanvas(bot, width), { cols: MIN_TEXT_COLS, rows: MIN_TEXT_ROWS });
});

test("block art sets its own canvas, counting visible cells and not colour codes", () => {
  const row = "\x1b[38;2;10;20;30m\x1b[48;2;40;50;60m▀".repeat(24) + "\x1b[0m";
  assert.deepEqual(textCanvas(Array(12).fill(row), width), { cols: 24, rows: 12 });
});

test("a small frame never shrinks the canvas", () => {
  assert.deepEqual(textCanvas(["ab"], width), { cols: MIN_TEXT_COLS, rows: MIN_TEXT_ROWS });
  assert.deepEqual(textCanvas([], width), { cols: MIN_TEXT_COLS, rows: MIN_TEXT_ROWS });
});
