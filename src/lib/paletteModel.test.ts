import { test } from "node:test";
import assert from "node:assert";
import { score, rank, flat, pushRecent, type PaletteItem } from "./paletteModel.ts";

const items: PaletteItem[] = [
  { id: "kafka", group: "Containers", label: "kafka", hint: "confluentinc/cp-kafka", dot: "ok", run: () => {} },
  { id: "kafka-ui", group: "Containers", label: "kafka-ui", hint: "provectuslabs/kafka-ui", dot: "ok", run: () => {} },
  { id: "restart-kafka", group: "Actions", label: "Restart kafka", run: () => {} },
  { id: "logs-kafka", group: "Actions", label: "Logs of kafka", run: () => {} },
  { id: "go-containers", group: "Go to", label: "Containers", run: () => {} },
];

test("paletteModel: Given kaf and items kafka and kafka-ui, When ranked, Then both are in Containers and kafka is first", () => {
  const sections = rank("kaf", items, []);
  const containers = sections.find((s) => s.group === "Containers");
  assert.ok(containers);
  assert.deepStrictEqual(containers!.items.map((i) => i.id), ["kafka", "kafka-ui"]);
});

test("paletteModel: Given a label Restart kafka, When scored with kaf, Then the score is 1", () => {
  assert.strictEqual(score("Restart kafka", "kaf"), 1);
});

test("paletteModel: Given an empty query, When ranked, Then Go to is first and no Containers section is returned", () => {
  const sections = rank("", items, []);
  assert.deepStrictEqual(sections.map((s) => s.group), ["Go to"]);
});

test("paletteModel: Given 12 matching containers, When ranked, Then 8 are returned", () => {
  const many: PaletteItem[] = [];
  for (let i = 0; i < 12; i++) {
    many.push({ id: `c${i}`, group: "Containers", label: `container-${i}`, run: () => {} });
  }
  const sections = rank("container", many, []);
  const total = flat(sections).length;
  assert.strictEqual(total, 8);
});

test("paletteModel: Given recent ids [a, b] and an empty query, When ranked, Then the Actions section lists a then b", () => {
  const withActions: PaletteItem[] = [
    { id: "a", group: "Actions", label: "a", run: () => {} },
    { id: "b", group: "Actions", label: "b", run: () => {} },
    { id: "c", group: "Go to", label: "c", run: () => {} },
  ];
  const sections = rank("", withActions, ["a", "b"]);
  const actions = sections.find((s) => s.group === "Actions");
  assert.ok(actions);
  assert.deepStrictEqual(actions!.items.map((i) => i.id), ["a", "b"]);
});

test("paletteModel: Given pushRecent on six different ids, When called, Then five are kept, newest first", () => {
  let recent: string[] = [];
  for (const id of ["a", "b", "c", "d", "e", "f"]) {
    recent = pushRecent(recent, id);
  }
  assert.deepStrictEqual(recent, ["f", "e", "d", "c", "b"]);
});

test("paletteModel: Given the same id pushed twice, When pushRecent runs, Then it appears once, first", () => {
  let recent: string[] = ["b", "a"];
  recent = pushRecent(recent, "a");
  assert.deepStrictEqual(recent, ["a", "b"]);
});

test("paletteModel: Given no match, When ranked, Then the result is []", () => {
  assert.deepStrictEqual(rank("zzzz", items, []), []);
});
