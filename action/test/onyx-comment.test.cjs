// Unit tests for the PR-comment glue (T11). Dependency-free: node:test + assert,
// with a mocked octokit comment list. Run: node --test action/test/
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MARKER, findMarkerComment, buildCommentBody } = require("../onyx-comment.cjs");

const report = {
    onyxCliVersion: "0.1.0",
    runId: "run-abc",
    specUrl: "https://api.example.com/openapi.json",
    score: 42,
    scoreLabel: "MEDIUM",
    severityCounts: { critical: 1, high: 2, medium: 3, low: 4, info: 5 },
    findingCount: 2,
    findings: [
        { severity: "HIGH", owaspCode: "API1:2023", method: "GET", endpoint: "/users/{id}", title: "BOLA on user lookup" },
        { severity: "CRITICAL", owaspCode: "API8:2023", method: "POST", endpoint: "/login", title: "SQLi | in body" },
    ],
};

test("findMarkerComment matches the hidden marker, ignores others", () => {
    const comments = [
        { id: 1, body: "unrelated chatter" },
        { id: 2, body: `${MARKER}\n## old Onyx report` },
        { id: 3, body: "another" },
    ];
    assert.equal(findMarkerComment(comments)?.id, 2);
    assert.equal(findMarkerComment([{ id: 9, body: "nope" }]), null);
    assert.equal(findMarkerComment(null), null);
    assert.equal(findMarkerComment([{ id: 9 }]), null); // no body → no crash
});

test("buildCommentBody: passed gate (exit 0) starts with marker + shows score/counts", () => {
    const body = buildCommentBody(report, { exitCode: 0, failOn: "high" });
    assert.ok(body.startsWith(MARKER), "must start with the hidden marker for find-and-update");
    assert.match(body, /✅ \*\*Passed\*\*/);
    assert.match(body, /Score \*\*42\/100\*\* \(MEDIUM\)/);
    assert.match(body, /\| 1 \| 2 \| 3 \| 4 \| 5 \|/); // severity counts row
    assert.match(body, /Threshold `high`/);
});

test("buildCommentBody: failed gate (exit 1) + findings table with method/path/OWASP", () => {
    const body = buildCommentBody(report, { exitCode: 1, failOn: "high" });
    assert.match(body, /❌ \*\*Failed\*\*/);
    assert.match(body, /API1:2023/);
    assert.match(body, /`GET \/users\/\{id\}`/);
    assert.ok(body.includes("SQLi \\| in body"), "pipes in titles must be escaped");
    assert.match(body, /run-abc/); // footer run id
    assert.match(body, /onyx-cli 0\.1\.0/);
});

test("buildCommentBody: operational failure (null report, exit 2)", () => {
    const body = buildCommentBody(null, { exitCode: 2, failOn: "high" });
    assert.ok(body.startsWith(MARKER));
    assert.match(body, /did not produce a report/);
    assert.match(body, /exit code `2`/);
});

test("buildCommentBody: no findings → clean message, not a table", () => {
    const clean = { ...report, findings: [], findingCount: 0 };
    const body = buildCommentBody(clean, { exitCode: 0, failOn: "high" });
    assert.match(body, /No findings at or above LOW/);
    assert.ok(!body.includes("Top findings"));
});

test("buildCommentBody: caps the table at 10 and notes the remainder", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({
        severity: "LOW", owaspCode: "API9:2023", method: "GET", endpoint: `/e${i}`, title: `f${i}`,
    }));
    const body = buildCommentBody({ ...report, findings: many, findingCount: 13 }, { exitCode: 1, failOn: "low" });
    assert.match(body, /Top findings \(10 of 13\)/);
    assert.match(body, /…and 3 more\./);
});
