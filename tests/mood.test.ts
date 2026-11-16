import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSpace, spaceKey, wrapWords, MOOD_FRESH_MS, REFLECT_FRESH_MS } from "../src/mood.ts";

const folder = () => mkdtempSync(join(tmpdir(), "space-"));

test("no folder, or an empty one, shows nothing", () => {
  assert.deepEqual(readSpace(undefined), { mood: null, wall: null, reflecting: null, note: null, board: null });
  assert.deepEqual(readSpace(folder()), { mood: null, wall: null, reflecting: null, note: null, board: null });
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

test("the mood board tile is read once per pin, reused while the pin is the same, and kept out of the change key", () => {
  const d = folder();
  const ESC = String.fromCharCode(27);
  writeFileSync(join(d, "board.sixel"), `${ESC}P0;0;0q"1;1;400;200#0;2;0;0;0~${ESC}\\`);
  assert.equal(readSpace(d).board, null);                                      // no board.json yet: the tile is not ready
  writeFileSync(join(d, "board.json"), JSON.stringify({ width: 400, height: 200, pin: "a.jpg" }));
  const first = readSpace(d);
  assert.equal(first.board?.key, "a.jpg:400x200");
  assert.equal(readSpace(d, Date.now(), first).board, first.board);            // same pin: the very same object, no re-read
  assert.ok(!spaceKey(first).includes("P0;0;0q"));                             // the picture itself is not in the key
  writeFileSync(join(d, "board.json"), JSON.stringify({ width: 400, height: 200, pin: "b.jpg" }));
  assert.notEqual(spaceKey(readSpace(d, Date.now(), first)), spaceKey(first)); // a new pin changes the key
  writeFileSync(join(d, "board.sixel"), "not a sixel");
  writeFileSync(join(d, "board.json"), JSON.stringify({ width: 400, height: 200, pin: "c.jpg" }));
  assert.equal(readSpace(d).board, null);                                      // a file that is not a Sixel is ignored
});

test("her answer to a pause shows with her own label, fresh for 12 hours and then dim; a missing or odd file shows nothing", () => {
  const d = folder();
  const hourAgo = Date.now() - 3600 * 1000;
  const at = new Date(hourAgo - new Date(hourAgo).getTimezoneOffset() * 60000).toISOString().slice(0, 19);   // an hour ago, as local time without a zone, the way space.py writes it
  writeFileSync(join(d, "reflection.json"), JSON.stringify({ at, label: "stuck", text: "I keep   restamping the map." }));
  assert.deepEqual(readSpace(d).reflecting, { label: "stuck", text: "I keep restamping the map.", fresh: true });
  assert.equal(readSpace(d, Date.now() + REFLECT_FRESH_MS).reflecting?.fresh, false);
  writeFileSync(join(d, "reflection.json"), JSON.stringify({ at: "not a date", label: "change", text: "x" }));
  assert.equal(readSpace(d).reflecting?.fresh, false);                          // an unreadable date is never fresh
  writeFileSync(join(d, "reflection.json"), JSON.stringify({ at, label: "", text: "x" }));
  assert.equal(readSpace(d).reflecting, null);
  writeFileSync(join(d, "reflection.json"), "not json");
  assert.equal(readSpace(d).reflecting, null);
});

test("her note to him is one short line", () => {
  const d = folder();
  assert.equal(readSpace(d).note, null);
  writeFileSync(join(d, "note.txt"), "the   breath works\n");
  assert.equal(readSpace(d).note, "the breath works");
  writeFileSync(join(d, "note.txt"), "y".repeat(200));
  assert.equal(readSpace(d).note?.length, 56);
});

test("words wrap at word breaks, and what does not fit ends in ..", () => {
  assert.deepEqual(wrapWords("one two three four five six seven", 14, 3), ["one two three", "four five six", "seven"]);
  assert.deepEqual(wrapWords("one two three four five six seven", 14, 2), ["one two three", "four five si.."]);
  assert.deepEqual(wrapWords("", 14, 2), []);
  assert.deepEqual(wrapWords("short", 14, 2), ["short"]);
});
