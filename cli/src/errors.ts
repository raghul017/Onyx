// =============================================================================
// Operational errors — all map to CLI exit code 2. Messages are safe to print
// (never contain the API token).
// =============================================================================

export class OnyxError extends Error {
    /** Optional actionable hint printed under the error. */
    hint?: string;
    constructor(message: string, hint?: string) {
        super(message);
        this.name = "OnyxError";
        this.hint = hint;
    }
}

/** 401 — bad/expired/revoked API token. */
export class AuthError extends OnyxError {
    constructor() {
        super(
            "Authentication failed (401) — the API token is invalid, expired, or revoked.",
            "Create a fresh token in Settings → API tokens and pass it via --api-token or ONYX_TOKEN.",
        );
        this.name = "AuthError";
    }
}

/** 403 DOMAIN_NOT_VERIFIED — the target domain must be verified first. */
export class VerificationError extends OnyxError {
    constructor(domain: string) {
        super(
            `The target domain "${domain}" is not verified for your account.`,
            "Verify ownership in the Onyx dashboard (Dashboard → Verify Domain) before scanning it.",
        );
        this.name = "VerificationError";
    }
}

/** Poll cap exceeded. */
export class TimeoutError extends OnyxError {
    constructor(seconds: number) {
        super(
            `Timed out after ${seconds}s waiting for the run to finish.`,
            "Increase --timeout, or check the run in the Onyx dashboard.",
        );
        this.name = "TimeoutError";
    }
}
