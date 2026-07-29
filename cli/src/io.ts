// =============================================================================
// IO abstraction — injected into the scan flow so tests can capture output and
// control the clock/sleep without real time or real stdout.
// =============================================================================

import { writeFile as fsWriteFile } from "node:fs/promises";

export interface ScanIO {
    /** Report output → stdout. */
    log(msg: string): void;
    /** Errors → stderr. */
    error(msg: string): void;
    /** Progress lines → stderr (keeps stdout clean for the report). */
    progress(msg: string): void;
    /** Write a file (json/sarif --out). */
    writeFile(path: string, content: string): Promise<void>;
    /** Sleep between polls. */
    sleep(ms: number): Promise<void>;
    /** Monotonic-ish clock for timeout math. */
    now(): number;
}

export function defaultIO(): ScanIO {
    return {
        log: (m) => process.stdout.write(m + "\n"),
        error: (m) => process.stderr.write(m + "\n"),
        progress: (m) => process.stderr.write(m + "\n"),
        writeFile: (p, c) => fsWriteFile(p, c, "utf8"),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        now: () => Date.now(),
    };
}
