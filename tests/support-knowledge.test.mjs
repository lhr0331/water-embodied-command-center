import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupportQuestion } from "../src/supportKnowledge.js";

test("extracts device, fence and alert intents from one professional query", () => {
  const result = resolveSupportQuestion("无人机如何接入，电子围栏怎么设置，告警出现后怎样处理？");

  assert.equal(result.fallback, false);
  assert.deepEqual(result.topics.map((topic) => topic.id), ["device-access", "fence", "alerts"]);
  assert.ok(result.keywords.includes("无人机"));
  assert.ok(result.keywords.includes("设备接入"));
  assert.ok(result.keywords.includes("电子围栏"));
  assert.ok(result.keywords.includes("告警处置"));
});

test("routes a live-data failure to troubleshooting and monitoring guidance", () => {
  const result = resolveSupportQuestion("传感器数据不刷新，设备也不显示怎么办？");

  assert.equal(result.fallback, false);
  assert.ok(result.topics.some((topic) => topic.id === "troubleshooting"));
  assert.ok(result.topics.some((topic) => topic.id === "monitoring"));
  assert.ok(result.intentLabel.includes("故障排查"));
});

test("gives a bounded clarification when no platform function is mentioned", () => {
  const result = resolveSupportQuestion("你们的价格是多少？");

  assert.equal(result.fallback, true);
  assert.equal(result.topics.length, 0);
  assert.ok(result.lines[0].includes("具体功能对象"));
});
