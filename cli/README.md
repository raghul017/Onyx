# Onyx CLI (`onyx`)

Run an [Onyx](https://github.com/onyx-security/onyx) API security scan from your
terminal or CI, gate the build on a severity threshold, and export findings as
**table**, **JSON**, or **SARIF 2.1.0**.

Authenticates with an **API token** (created in the Onyx dashboard → Settings →
API tokens). The token acts as you — the scan is scoped exactly like your
session.

## Install / build

The CLI is a standalone package (Node ≥ 20, zero runtime dependencies — it uses
the built-in `fetch`).

```bash
cd cli
npm install      # dev deps only (typescript, vitest)
npm run build    # → dist/index.js (executable, has a shebang)
node dist/index.js scan --help
```

Once published you'd run it via `npx @onyx/cli scan ...` or a global install; for
now use `node dist/index.js` (or `npm link`).

## Usage

```bash
onyx scan --spec <public-openapi-url> [options]
```

> **Spec input:** only a **public** OpenAPI/Swagger **URL** is supported today.
> Local-file / upload specs are not available yet (tracked in T18).
>
> **Domain verification:** the target domain must be verified for your account
> before a scan is allowed. If it isn't, the CLI prints how to verify it.

### Options

| Flag | Env | Default | Description |
| --- | --- | --- | --- |
| `--spec <url>` | — | — | **Required.** Public OpenAPI/Swagger URL. |
| `--api-token <t>` | `ONYX_TOKEN` | — | **Required.** API token (`onyx_…`). Never printed. |
| `--api-url <url>` | `ONYX_API_URL` | `http://localhost:3000` | Onyx API base (`/api` appended if missing). |
| `--auth-recipe <id>` | — | — | Attach an existing auth recipe to the run. |
| `--fail-on <level>` | — | `high` | `critical` \| `high` \| `medium` \| `low`. |
| `--format <fmt>` | — | `table` | `table` \| `json` \| `sarif`. |
| `--out <file>` | — | stdout | Write the `json`/`sarif` report to a file. |
| `--sarif-out <file>` | — | — | **Also** write SARIF here, regardless of `--format`. Lets CI produce JSON + SARIF from **one** scan. |
| `--org <id>` | `ONYX_ORG` | — | Organization context (`x-org-id`). |
| `--timeout <secs>` | — | `300` | Max time to wait for the run to finish. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Scan finished; **no** finding at or above `--fail-on`. |
| `1` | Scan finished; **at least one** finding at or above `--fail-on`. |
| `2` | Operational failure — bad/expired token (401), unverified domain, run `FAILED`, timeout, or a network error. |

## Examples

```bash
# Table summary (default), fail the build on HIGH or CRITICAL:
ONYX_TOKEN=onyx_xxx \
  onyx scan --spec https://api.example.com/openapi.json

# Only fail on CRITICAL; write SARIF for GitHub's Security tab:
onyx scan \
  --spec https://api.example.com/openapi.json \
  --api-url https://onyx.your-host.com \
  --fail-on critical \
  --format sarif --out onyx.sarif

# Authenticated scan (attach an auth recipe):
onyx scan --spec https://api.example.com/openapi.json --auth-recipe <recipe-id>

# Machine-readable JSON:
onyx scan --spec https://api.example.com/openapi.json --format json --out onyx.json
```

## CI/CD integration (GitHub Actions)

The repo ships a **composite GitHub Action** (`action.yml` at the repo root) that
builds this CLI, runs a scan, uploads SARIF to the **Security** tab, posts/updates
a **PR comment** with the finding summary, and fails the check on the threshold —
all from a **single** scan. See [the action README](../action/README.md) and the
example workflow at [.github/workflows/onyx-scan.yml](../.github/workflows/onyx-scan.yml).

Minimal usage:

```yaml
- uses: actions/checkout@v4
- uses: ./                     # the Onyx action (repo root action.yml)
  with:
    spec: https://api.example.com/openapi.json
    api-token: ${{ secrets.ONYX_TOKEN }}
    fail-on: high
```

If you'd rather call the CLI directly, run one scan and emit both reports with
`--format json --out onyx.json --sarif-out onyx.sarif`, then upload `onyx.sarif`
via `github/codeql-action/upload-sarif@v3` (use `if: always()` so results publish
even when the job fails).

## Output formats

- **table** — human summary: score, severity counts, OWASP coverage, and a
  findings list (`SEVERITY  OWASP  METHOD  ENDPOINT  TITLE`).
- **json** — a stable object: run metadata, `severityCounts`, `owaspCoverage`,
  and a `findings[]` array (method, endpoint, severity, category, OWASP).
- **sarif** — SARIF 2.1.0: one `rule` per finding category, one `result` per
  finding with `level` mapped from severity (`critical`/`high` → `error`,
  `medium` → `warning`, `low`/`info` → `note`) and a location set to the
  endpoint path/method.

Findings are the results at or above **LOW** severity; `INFO` (healthy/handled
probes) is counted in the summary but excluded from the findings list, JSON
`findings[]`, and SARIF `results`.

## Security

The API token is read from `--api-token`/`ONYX_TOKEN`, sent only in the
`Authorization: Bearer` header, and **never printed or logged** — including in
error messages.
