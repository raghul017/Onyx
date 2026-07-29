# Onyx API Security Scan — GitHub Action

A **composite** GitHub Action that runs an [Onyx](../README.md) API security scan
in CI. It:

1. Builds the Onyx CLI from this repo (`cli/`),
2. Runs **one** scan, emitting both JSON and SARIF,
3. Uploads the SARIF to the **Security → Code scanning** tab,
4. Posts (and on later runs, **updates**) a summary **comment** on the pull request,
5. Fails the check when a finding meets your severity threshold — *after* reporting.

The action lives at the repo root as [`action.yml`](../action.yml), so within this
repo you reference it as `uses: ./`.

> **Why composite / build-from-source?** The CLI is not published to npm yet, so
> the action compiles it from `cli/` on each run. See
> [External distribution](#external-distribution-follow-up) below.

## Usage

```yaml
permissions:
  contents: read
  security-events: write   # upload SARIF to the Security tab
  pull-requests: write     # post/update the PR comment

jobs:
  onyx-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          spec: https://api.example.com/openapi.json
          api-token: ${{ secrets.ONYX_TOKEN }}
          fail-on: high
```

A ready-to-copy workflow is in
[.github/workflows/onyx-scan.yml](../.github/workflows/onyx-scan.yml).

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `spec` | **yes** | — | Public OpenAPI/Swagger URL to scan. |
| `api-token` | **yes** | — | Onyx API token (`onyx_…`). Pass via `secrets.*` — read as an env var, never on the command line. |
| `api-url` | no | *(CLI default)* | Onyx API base URL (e.g. `https://onyx.your-host.com`). Omit / empty to use the default. |
| `auth-recipe` | no | — | Auth-recipe id to attach to the run (authenticated scanning). |
| `org` | no | — | Organization id (`x-org-id`). |
| `fail-on` | no | `high` | Threshold that fails the check: `critical` \| `high` \| `medium` \| `low`. |
| `working-directory` | no | `.` | Directory to run the scan from; reports (`onyx.json`, `onyx.sarif`) are written here. |
| `github-token` | no | `${{ github.token }}` | Token used to post the PR comment (needs `pull-requests: write`). |

## Required permissions

Set these on the job (or workflow) that uses the action:

```yaml
permissions:
  contents: read
  security-events: write   # github/codeql-action/upload-sarif → Security tab
  pull-requests: write     # actions/github-script → PR comment
```

`security-events: write` is also required for the SARIF upload to work on PRs from
the same repository. (SARIF upload and the PR comment are best-effort:
`continue-on-error` is set on both, so a permissions gap degrades gracefully — the
check still passes/fails correctly on the scan result.)

## Secrets setup

1. **Settings → Secrets and variables → Actions → New repository secret**
2. Name `ONYX_TOKEN`, value = an API token from the Onyx dashboard
   (Settings → API tokens). The token acts as you and is scoped exactly like your session.
3. *(Self-hosting Onyx)* add a repository **variable** `ONYX_API_URL` with your API base, and pass it as `api-url:`.

The token is read from the `ONYX_TOKEN` **environment variable** and masked with
`::add-mask::` — it is never placed on the command line, printed, or logged.

## Exit-code behavior

The scan runs once and its exit code is **captured** (the job is not aborted), so the
action can still upload SARIF and comment on the PR **before** failing the check.
The final step then re-exits with that code:

| CLI exit | Meaning | Check result |
| --- | --- | --- |
| `0` | No finding at or above `fail-on`. | ✅ passes |
| `1` | At least one finding at or above `fail-on`. | ❌ fails |
| `2` | Operational failure (bad token, unverified domain, run `FAILED`, timeout, network). | ❌ fails |

The PR comment reflects the same gate (✅ passed / ❌ failed / ⚠️ errored) and, on
exit `2` with no report, explains the operational failure.

## Single scan, both reports

To avoid double-charging the API, the action runs **one** scan and asks the CLI to
write both outputs at once:

```
onyx scan … --format json --out onyx.json --sarif-out onyx.sarif
```

`onyx.json` drives the PR comment (score, label, severity counts, top findings);
`onyx.sarif` is uploaded to the Security tab. See the CLI's `--sarif-out` flag.

## External distribution (follow-up)

This action builds the CLI from source, which works for **this** repo's own PRs
(`uses: ./`) and for consumers who pin a full-repo tag (`uses: your-org/onyx@v1`)
— the checkout includes `cli/` and the action builds it.

A cleaner distribution is a **dedicated action repo** (or an npm-published CLI) so
consumers don't pull the whole product repo:

- Publish `@onyx/cli` to npm; have the action `npm i -g @onyx/cli` instead of building; **or**
- Split `action.yml` + a prebuilt CLI bundle into `onyx-security/onyx-action` with versioned tags (`v1`, `v1.2.3`).

Tracked as a follow-up; not part of this action's initial scope.
