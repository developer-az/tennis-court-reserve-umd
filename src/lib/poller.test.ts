import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planWatch, type CourtSnapshot } from "./poller";

const openCourts: CourtSnapshot = { available: true, courtsAvailable: 6 };

function watch(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-10-30",
    hour: 16,
    createdAt: "2026-10-27T15:00:00.000Z",
    notifyOnOpen: 1,
    notifyOnAvailable: 1,
    lastCourtsAvailable: null as number | null,
    notifiedOpen: false as boolean | undefined,
    ...overrides,
  };
}

describe("planWatch", () => {
  it("does not alert before the Eastern booking window opens", () => {
    const plan = planWatch(watch(), openCourts, new Date("2026-10-28T19:00:00.000Z"));
    assert.equal(plan.notifyOpen, false);
    assert.equal(plan.notifyAvailable, false);
    assert.equal(plan.updateAvailability, false);
  });

  it("sends the open alert once, without also calling it a cancellation", () => {
    const first = planWatch(watch(), openCourts, new Date("2026-10-28T20:05:00.000Z"));
    assert.equal(first.notifyOpen, true);
    assert.equal(first.notifyAvailable, false);
    assert.equal(first.updateAvailability, true);
    assert.equal(first.nextCourtsAvailable, 6);
    assert.equal(first.notifiedOpen, true);

    const again = planWatch(
      watch({ notifiedOpen: true, lastCourtsAvailable: 6 }),
      openCourts,
      new Date("2026-10-28T20:20:00.000Z")
    );
    assert.equal(again.notifyOpen, false);
    assert.equal(again.notifyAvailable, false);
  });

  it("still alerts if the scheduler is late, as long as the watch was set beforehand", () => {
    const plan = planWatch(watch(), openCourts, new Date("2026-10-28T23:30:00.000Z"));
    assert.equal(plan.notifyOpen, true);
  });

  it("does not send an open alert for a watch created after the window opened", () => {
    const plan = planWatch(
      watch({ createdAt: "2026-10-28T21:00:00.000Z" }),
      openCourts,
      new Date("2026-10-28T21:10:00.000Z")
    );
    assert.equal(plan.notifyOpen, false);
    assert.equal(plan.updateAvailability, true);
  });

  it("does not burst open alerts for legacy watches that are already hours into the window", () => {
    const plan = planWatch(
      watch({ notifiedOpen: undefined }),
      openCourts,
      new Date("2026-10-29T02:00:00.000Z")
    );
    assert.equal(plan.notifyOpen, false);
    assert.equal(plan.notifiedOpen, true);
  });

  it("alerts when a court frees up after a baseline inside the open window", () => {
    const plan = planWatch(
      watch({ notifiedOpen: true, lastCourtsAvailable: 2 }),
      { available: true, courtsAvailable: 4 },
      new Date("2026-10-29T15:00:00.000Z")
    );
    assert.equal(plan.notifyOpen, false);
    assert.equal(plan.notifyAvailable, true);
    assert.equal(plan.nextCourtsAvailable, 4);
  });

  it("marks a started slot so it stops being checked", () => {
    const plan = planWatch(watch(), openCourts, new Date("2026-10-30T20:00:00.000Z"));
    assert.equal(plan.markTriggered, true);
    assert.equal(plan.notifyOpen, false);
  });
});
