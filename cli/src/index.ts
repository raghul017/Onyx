#!/usr/bin/env node
// =============================================================================
// onyx — CLI entry point. `onyx scan --spec <url>` runs a scan and exits with a
// code suitable for CI. See `onyx scan --help`.
// =============================================================================

import { parseScanArgs, HELP_TEXT } from "./args.js";
import { HttpApiClient } from "./client.js";
import { runScan } from "./scan.js";
import { defaultIO } from "./io.js";
import { CLI_VERSION } from "./version.js";

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    const sub = argv[0];

    if (sub === "--version" || sub === "-v") {
        process.stdout.write(`onyx ${CLI_VERSION}\n`);
        return 0;
    }
    if (!sub || sub === "help" || sub === "-h" || sub === "--help") {
        process.stdout.write(`onyx ${CLI_VERSION}\n\n${HELP_TEXT}`);
        return 0;
    }
    if (sub !== "scan") {
        process.stderr.write(`Unknown command "${sub}". Try: onyx scan --help\n`);
        return 2;
    }

    const parsed = parseScanArgs(argv.slice(1));
    if (parsed.help) {
        process.stdout.write(HELP_TEXT);
        return 0;
    }
    if (!parsed.options) {
        process.stderr.write(`Error: ${parsed.error}\n\nRun "onyx scan --help" for usage.\n`);
        return 2;
    }

    const opts = parsed.options;
    const api = new HttpApiClient(opts.apiUrl, opts.apiToken, opts.orgId);
    return runScan(opts, api, defaultIO());
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        // Last-resort guard — never leak the token; runScan already handles OnyxError.
        process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(2);
    });
