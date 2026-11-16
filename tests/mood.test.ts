import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSpace, MOOD_FRESH_MS } from "../src/mood.ts";

const folder = () => mkdtempSync(join(tmpdir(), "space-"));

test("no folder, or an empty one, shows nothing", () => {
  assert.deepEqual(readSpace(undefined), { mood: null, wall: null });
  assert.deepEqual(readSpace(folder()), { mood: null, wall: null });
});

test("a fresh mood carries the face she chose; a stale one shows dim and drops the face", () => {
  const d = folder();
  writeFileSync(join(d, "mood.txt"), "soft   and awake\n");
  writeFileSync(join(d, "face.txt"), "success\n");
  assert.deepEqual(readSpace(d).mood, { text: "soft and awake", fresh: true, face: "success" });
  assert.deepEqual(readSpace(d, Date.now() + MOOD_FRESH_MS + 1000).mood, { text: "soft and awake", fresh: false, face: "" });
});

test("a long mood is cut to one short line", () => {
  const d = folder();
  writeFileSync(join(d, "mood.txt"), "x".repeat(200));
  assert.equal(readSpace(d).mood?.text.length, 56);
});

test("the wall is the last pin's note, else its file, and bad lines are skipped", () => {
  const d = folder();
  writeFileSync(join(d, "pins.jsonl"), '{"file":"a.jpg","note":"first"}\n{"file":"b.jpg","note":""}\n');
  assert.equal(readSpace(d).wall, "b.jpg");
  writeFileSync(join(d, "pins.jsonl"), '{"file":"a.jpg","note":"a moon"}\nnot json\n');
  assert.equal(readSpace(d).wall, null);   // the last line is the one that counts, and it is not a pin
});
