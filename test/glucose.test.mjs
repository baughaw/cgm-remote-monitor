import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReading, parseDexcomTimestamp } from "../netlify/functions/glucose.mjs";

test("parses Dexcom Share timestamps", () => {
  assert.equal(parseDexcomTimestamp("/Date(1789442179089-0400)/"), 1789442179089);
});

test("normalizes a falling glucose reading", () => {
  assert.deepEqual(
    normalizeReading({ Value: 193, Trend: "FortyFiveDown", WT: "/Date(1789442179089)/" }),
    {
      value: 193,
      arrow: "↘",
      trend: "falling",
      direction: "FortyFiveDown",
      timestamp: 1789442179089
    }
  );
});

