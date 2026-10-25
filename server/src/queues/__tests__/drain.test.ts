import { describe, it, expect, vi } from "vitest";
import { drainRunJobs, type DrainableQueue } from "../drain.js";

function fakeQueue(ids: string[], locked: string[] = []): DrainableQueue & { removed: string[] } {
    const removed: string[] = [];
    return {
        removed,
        getRanges: vi.fn(async () => ids),
        remove: vi.fn(async (id: string) => {
            if (locked.includes(id)) return 0;
            removed.push(id);
            return 1;
        }),
    };
}

describe("drainRunJobs — removes only this run's queued jobs, by id", () => {
    it("removes every job kind for the run and nothing else", async () => {
        const q = fakeQueue([
            "run-1:ep-1:0",
            "run-1:ep-1:baseline",
            "run-1:ep-2:obj-9:id-b:replay",
            "run-1:ep-3:massassign",
            "run-10:ep-1:0", // a different run whose id shares a prefix
            "run-2:ep-1:0",
        ]);
        const n = await drainRunJobs(q, "run-1");
        expect(n).toBe(4);
        expect(q.removed).toEqual([
            "run-1:ep-1:0",
            "run-1:ep-1:baseline",
            "run-1:ep-2:obj-9:id-b:replay",
            "run-1:ep-3:massassign",
        ]);
    });

    it("lists ids only from the three pending states", async () => {
        const q = fakeQueue([]);
        await drainRunJobs(q, "run-1");
        expect(q.getRanges).toHaveBeenCalledWith(["waiting", "prioritized", "delayed"], 0, -1);
    });

    it("doesn't count a job a worker already locked", async () => {
        const q = fakeQueue(["run-1:a:0", "run-1:a:1"], ["run-1:a:1"]);
        expect(await drainRunJobs(q, "run-1")).toBe(1);
    });
});
