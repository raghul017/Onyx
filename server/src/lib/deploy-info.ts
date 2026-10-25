// The deployed commit, so GET /api/health shows what's live. Render sets
// RENDER_GIT_COMMIT on every deploy; GIT_COMMIT covers other hosts.
export function deployedCommit(env: NodeJS.ProcessEnv = process.env): string | null {
    const sha = (env.RENDER_GIT_COMMIT || env.GIT_COMMIT || "").trim();
    return sha || null;
}
