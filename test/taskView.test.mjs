import assert from "node:assert/strict";
import { test } from "node:test";

import {
  splitDayTasks,
  formatTimeRange,
  plannedMinutes
} from "../public/taskView.mjs";

test("splitDayTasks separates timed blocks from loose tasks and sorts them", () => {
  const tasks = [
    { id: "later", title: "Later", startTime: "15:00", endTime: "16:00", priority: "low", done: false },
    { id: "loose", title: "Loose", priority: "high", done: false },
    { id: "done", title: "Done", startTime: "09:00", endTime: "09:30", priority: "medium", done: true },
    { id: "early", title: "Early", startTime: "10:00", endTime: "10:45", priority: "high", done: false }
  ];

  const result = splitDayTasks(tasks);

  assert.deepEqual(result.timed.map(task => task.id), ["early", "later", "done"]);
  assert.deepEqual(result.loose.map(task => task.id), ["loose"]);
});

test("formatTimeRange supports optional start and end times", () => {
  assert.equal(formatTimeRange({ startTime: "09:00", endTime: "10:15" }), "09:00 - 10:15");
  assert.equal(formatTimeRange({ startTime: "09:00" }), "09:00 开始");
  assert.equal(formatTimeRange({ endTime: "18:00" }), "18:00 前");
  assert.equal(formatTimeRange({}), "");
});

test("plannedMinutes only counts complete positive time ranges", () => {
  assert.equal(plannedMinutes({ startTime: "13:00", endTime: "14:30" }), 90);
  assert.equal(plannedMinutes({ startTime: "13:00" }), 0);
  assert.equal(plannedMinutes({ startTime: "15:00", endTime: "14:30" }), 0);
});
