import test from "node:test";
import assert from "node:assert/strict";
import { cleanFrame, applyFrame, summarizeFailure, type LogLine } from "./logClean.ts";

const line = (text: string, level: LogLine["level"] = "plain"): LogLine => ({ level, text, raw: text });

test("logrus text with colour codes", () => {
  const l = cleanFrame("\x1b[32mINFO\x1b[0m[0000] starting colima");
  assert.equal(l.level, "info");
  assert.equal(l.text, "starting colima");
});

test("logrus text drops trailing key=value context", () => {
  const l = cleanFrame("INFO[0001] creating and starting ...                     context=vm");
  assert.equal(l.text, "creating and starting ...");
});

test("logrus WARN and ERRO map to warn and error", () => {
  assert.equal(cleanFrame("WARN[0002] disk is slow").level, "warn");
  assert.equal(cleanFrame("ERRO[0003] boom").level, "error");
  assert.equal(cleanFrame("FATA[0003] boom").level, "error");
});

test("logfmt error line", () => {
  const l = cleanFrame('time="2026-10-04T10:00:00Z" level=error msg="exit status 1"');
  assert.equal(l.level, "error");
  assert.equal(l.text, "exit status 1");
});

test("logfmt warning, extra fields and escaped quotes", () => {
  assert.equal(cleanFrame('level=warning msg="slow disk"').level, "warn");
  assert.equal(cleanFrame('time="t" level=info msg="done" context=docker').text, "done");
  assert.equal(cleanFrame('level=info msg="say \\"hi\\""').text, 'say "hi"');
});

test("Lima prefix is removed and the line is plain", () => {
  const l = cleanFrame("> [hostagent] ready");
  assert.equal(l.level, "plain");
  assert.equal(l.text, "[hostagent] ready");
});

test("raw is kept exactly and unknown lines are plain", () => {
  const raw = "\x1b[1mDownloading 45%\x1b[0m";
  const l = cleanFrame(raw);
  assert.equal(l.raw, raw);
  assert.equal(l.level, "plain");
  assert.equal(l.text, "Downloading 45%");
});

test("a frame that is only colour codes cleans to empty text", () => {
  assert.equal(cleanFrame("\x1b[0m").text, "");
});

test("a \\r frame replaces the previous line", () => {
  const out = applyFrame([line("Downloading 10%")], "\rDownloading 45%");
  assert.deepEqual(out.map((l) => l.text), ["Downloading 45%"]);
});

test("a \\r frame with nothing before it is appended (last progress frame, no newline)", () => {
  const out = applyFrame([], "\r50%");
  assert.deepEqual(out.map((l) => l.text), ["50%"]);
});

test("a normal frame appends and does not mutate the input", () => {
  const before = [line("one")];
  const out = applyFrame(before, "two");
  assert.deepEqual(out.map((l) => l.text), ["one", "two"]);
  assert.equal(before.length, 1);
});

test("consecutive identical lines collapse; blank frames are ignored", () => {
  let lines = applyFrame([], "waiting");
  lines = applyFrame(lines, "waiting");
  lines = applyFrame(lines, "\x1b[0m");
  assert.equal(lines.length, 1);
});

test("summarizeFailure prefers the last error line, then the last non-empty line, then empty", () => {
  assert.equal(summarizeFailure([line("a", "error"), line("b"), line("c", "error"), line("d")]), "c");
  assert.equal(summarizeFailure([line("a"), line("b"), line("")]), "b");
  assert.equal(summarizeFailure([]), "");
});
