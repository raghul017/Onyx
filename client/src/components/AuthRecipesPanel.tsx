// =============================================================================
// AuthRecipesPanel — manage scan credentials (T7b static + T8b dynamic).
//
// Secrets are WRITE-ONLY: the API returns them masked (••••last4 for static,
// ••••••  for dynamic). On edit the secret field(s) stay blank ("leave blank to
// keep current secret") and are only sent if the user types a new value — so the
// plaintext never round-trips back. Static secrets are strings; DYNAMIC secrets
// (loginRequest / oauth2ClientCredentials) are objects. Light-mono styling.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Pencil, Loader2, X } from "lucide-react";
import {
    listAuthRecipes,
    createAuthRecipe,
    updateAuthRecipe,
    deleteAuthRecipe,
    type AuthRecipe,
    type AuthRecipeType,
    type AuthRecipeMeta,
    type AuthRecipeSecretInput,
    type UpdateAuthRecipeInput,
} from "@/services/api";

const TYPE_LABEL: Record<AuthRecipeType, string> = {
    bearer: "Bearer token",
    apiKey: "API key",
    header: "Custom header",
    cookie: "Cookie",
    loginRequest: "Login request",
    oauth2ClientCredentials: "OAuth2 (client credentials)",
};

const DYNAMIC_TYPES: AuthRecipeType[] = ["loginRequest", "oauth2ClientCredentials"];
export const isDynamic = (t: AuthRecipeType) => DYNAMIC_TYPES.includes(t);

// ---------------------------------------------------------------------------
// Pure form helpers (unit-tested) — keep the credential-handling logic honest.
// ---------------------------------------------------------------------------

export interface RecipeFormFields {
    // static
    secret: string;
    headerName: string;
    queryName: string;
    location: "header" | "query";
    cookieName: string;
    // shared dynamic
    injectMode: "bearer" | "header";
    injectHeaderName: string;
    // oauth2ClientCredentials
    tokenUrl: string;
    clientId: string;
    scope: string;
    tokenResponseField: string;
    clientSecret: string;
    // loginRequest
    method: string;
    url: string;
    bodyTemplate: string;
    tokenPath: string;
    headerPairs: Array<{ key: string; value: string }>;
    secretValues: Record<string, string>; // placeholder name → value
}

export const EMPTY_FIELDS: RecipeFormFields = {
    secret: "",
    headerName: "",
    queryName: "",
    location: "header",
    cookieName: "",
    injectMode: "bearer",
    injectHeaderName: "",
    tokenUrl: "",
    clientId: "",
    scope: "",
    tokenResponseField: "",
    clientSecret: "",
    method: "POST",
    url: "",
    bodyTemplate: "",
    tokenPath: "",
    headerPairs: [],
    secretValues: {},
};

/** {{name}} placeholders referenced in a loginRequest body template. */
export function extractPlaceholders(template: string): string[] {
    const out: string[] = [];
    const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template)) !== null) {
        if (!out.includes(m[1])) out.push(m[1]);
    }
    return out;
}

/** True when a valid JSON value can be parsed (used to validate bodyTemplate). */
export function isValidJson(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

function injectAsString(f: Partial<RecipeFormFields>): string {
    return f.injectMode === "header" && (f.injectHeaderName ?? "").trim()
        ? `header:${(f.injectHeaderName ?? "").trim()}`
        : "bearer";
}

function pairsToRecord(pairs?: Array<{ key: string; value: string }>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of pairs ?? []) {
        if (p.key.trim()) out[p.key.trim()] = p.value;
    }
    return out;
}

/** Build the non-secret meta for a given credential type. */
export function buildRecipeMeta(type: AuthRecipeType, f: Partial<RecipeFormFields>): AuthRecipeMeta {
    switch (type) {
        case "header":
            return { headerName: (f.headerName ?? "").trim() };
        case "cookie":
            return { cookieName: (f.cookieName ?? "").trim() };
        case "apiKey":
            return (f.location ?? "header") === "query"
                ? { location: "query", queryName: (f.queryName ?? "").trim() }
                : { location: "header", headerName: (f.headerName ?? "").trim() };
        case "oauth2ClientCredentials": {
            const meta: AuthRecipeMeta = {
                tokenUrl: (f.tokenUrl ?? "").trim(),
                clientId: (f.clientId ?? "").trim(),
                injectAs: injectAsString(f),
            };
            if ((f.scope ?? "").trim()) meta.scope = (f.scope ?? "").trim();
            if ((f.tokenResponseField ?? "").trim())
                meta.tokenResponseField = (f.tokenResponseField ?? "").trim();
            return meta;
        }
        case "loginRequest": {
            const meta: AuthRecipeMeta = {
                method: f.method ?? "POST",
                url: (f.url ?? "").trim(),
                bodyTemplate: f.bodyTemplate ?? "",
                tokenPath: (f.tokenPath ?? "").trim(),
                injectAs: injectAsString(f),
            };
            const headers = pairsToRecord(f.headerPairs);
            if (Object.keys(headers).length > 0) meta.headers = headers;
            return meta;
        }
        case "bearer":
        default:
            return {};
    }
}

/** Build the secret payload: a string for static types, an object for dynamic. */
export function buildRecipeSecret(
    type: AuthRecipeType,
    f: Partial<RecipeFormFields>,
): AuthRecipeSecretInput {
    if (type === "oauth2ClientCredentials") {
        return { clientSecret: f.clientSecret ?? "" };
    }
    if (type === "loginRequest") {
        const out: Record<string, string> = {};
        for (const name of extractPlaceholders(f.bodyTemplate ?? "")) {
            out[name] = f.secretValues?.[name] ?? "";
        }
        return out;
    }
    return f.secret ?? "";
}

/** True when a secret carries no non-empty value (→ "keep current" on edit). */
export function isSecretBlank(secret: AuthRecipeSecretInput): boolean {
    if (typeof secret === "string") return secret.trim().length === 0;
    const values = Object.values(secret);
    return values.length === 0 || values.every((v) => v.trim().length === 0);
}

/**
 * Build the PATCH payload for editing a recipe. The secret (string OR object) is
 * included ONLY when a new value was entered — a blank secret keeps the current.
 */
export function buildRecipeUpdatePayload(args: {
    name: string;
    meta: AuthRecipeMeta;
    secret: AuthRecipeSecretInput;
}): UpdateAuthRecipeInput {
    const payload: UpdateAuthRecipeInput = { name: args.name.trim(), meta: args.meta };
    if (!isSecretBlank(args.secret)) payload.secret = args.secret;
    return payload;
}

/** Validate the non-secret meta for a type. Returns an error string or null. */
export function validateMetaForType(type: AuthRecipeType, f: Partial<RecipeFormFields>): string | null {
    if (type === "header" && !(f.headerName ?? "").trim()) return "Header name is required.";
    if (type === "cookie" && !(f.cookieName ?? "").trim()) return "Cookie name is required.";
    if (type === "apiKey") {
        const loc = f.location ?? "header";
        if (loc === "header" && !(f.headerName ?? "").trim()) return "Header name is required.";
        if (loc === "query" && !(f.queryName ?? "").trim()) return "Query param name is required.";
    }
    if (f.injectMode === "header" && !(f.injectHeaderName ?? "").trim())
        return "Header name is required for header injection.";
    if (type === "oauth2ClientCredentials") {
        if (!(f.tokenUrl ?? "").trim()) return "Token URL is required.";
        if (!(f.clientId ?? "").trim()) return "Client ID is required.";
    }
    if (type === "loginRequest") {
        if (!(f.url ?? "").trim()) return "Login URL is required.";
        if (!(f.bodyTemplate ?? "").trim()) return "Body template is required.";
        if (!isValidJson(f.bodyTemplate ?? "")) return "Body template must be valid JSON.";
        if (!(f.tokenPath ?? "").trim()) return "Token path is required.";
        if (extractPlaceholders(f.bodyTemplate ?? "").length === 0)
            return "Body template must reference at least one {{placeholder}}.";
    }
    return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INPUT_CLASS =
    "w-full bg-white border border-[#e6e6e6] text-black font-mono text-[13px] px-3 py-2 outline-none focus:border-black transition-colors placeholder:text-[#999]";
const SELECT_CLASS =
    "bg-white border border-[#e6e6e6] text-[#333] text-[13px] px-2 py-2 outline-none focus:border-black";
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[92px] resize-y leading-relaxed`;
const LABEL_CLASS = "block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1";

type Mode = "idle" | "create" | "edit";

/** Non-secret meta summary shown under a recipe's name in the list. */
function metaSummary(r: AuthRecipe): string | null {
    if (r.type === "oauth2ClientCredentials") return r.meta.tokenUrl ?? r.meta.clientId ?? null;
    if (r.type === "loginRequest")
        return [r.meta.method, r.meta.url].filter(Boolean).join(" ") || null;
    if (r.type === "apiKey") return r.meta.location === "query" ? r.meta.queryName ?? null : r.meta.headerName ?? null;
    if (r.type === "header") return r.meta.headerName ?? null;
    if (r.type === "cookie") return r.meta.cookieName ?? null;
    return null;
}

export default function AuthRecipesPanel() {
    const qc = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ["auth-recipes"],
        queryFn: listAuthRecipes,
    });
    const recipes = data?.recipes ?? [];

    const [mode, setMode] = useState<Mode>("idle");
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [type, setType] = useState<AuthRecipeType>("bearer");
    const [fields, setFields] = useState<RecipeFormFields>(EMPTY_FIELDS);
    const [formError, setFormError] = useState<string | null>(null);

    const patch = (p: Partial<RecipeFormFields>) => setFields((f) => ({ ...f, ...p }));

    const reset = () => {
        setName("");
        setType("bearer");
        setFields(EMPTY_FIELDS);
        setFormError(null);
    };

    const startCreate = () => {
        reset();
        setEditId(null);
        setMode("create");
    };

    const startEdit = (r: AuthRecipe) => {
        setEditId(r.id);
        setName(r.name);
        setType(r.type);
        // Parse injectAs ("bearer" | "header:<Name>") back into mode + name.
        const injectAs = r.meta.injectAs ?? "bearer";
        const injectMode: "bearer" | "header" = injectAs.startsWith("header:") ? "header" : "bearer";
        const injectHeaderName = injectAs.startsWith("header:") ? injectAs.slice("header:".length) : "";
        setFields({
            ...EMPTY_FIELDS,
            headerName: r.meta.headerName ?? "",
            queryName: r.meta.queryName ?? "",
            location: r.meta.location ?? "header",
            cookieName: r.meta.cookieName ?? "",
            injectMode,
            injectHeaderName,
            tokenUrl: r.meta.tokenUrl ?? "",
            clientId: r.meta.clientId ?? "",
            scope: r.meta.scope ?? "",
            tokenResponseField: r.meta.tokenResponseField ?? "",
            method: r.meta.method ?? "POST",
            url: r.meta.url ?? "",
            bodyTemplate: r.meta.bodyTemplate ?? "",
            tokenPath: r.meta.tokenPath ?? "",
            headerPairs: Object.entries(r.meta.headers ?? {}).map(([key, value]) => ({ key, value })),
            // Secrets stay blank → keep current unless the user re-enters them.
            secret: "",
            clientSecret: "",
            secretValues: {},
        });
        setFormError(null);
        setMode("edit");
    };

    const cancel = () => {
        setMode("idle");
        setEditId(null);
        reset();
    };

    const invalidate = () => qc.invalidateQueries({ queryKey: ["auth-recipes"] });
    const errMsg = (e: any) =>
        e?.response?.data?.message ?? e?.response?.data?.error ?? "Something went wrong.";

    const createMut = useMutation({
        mutationFn: createAuthRecipe,
        onSuccess: () => {
            invalidate();
            cancel();
        },
        onError: (e) => setFormError(errMsg(e)),
    });
    const updateMut = useMutation({
        mutationFn: (v: { id: string; input: UpdateAuthRecipeInput }) => updateAuthRecipe(v.id, v.input),
        onSuccess: () => {
            invalidate();
            cancel();
        },
        onError: (e) => setFormError(errMsg(e)),
    });
    const deleteMut = useMutation({ mutationFn: deleteAuthRecipe, onSuccess: invalidate });

    const submitting = createMut.isPending || updateMut.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!name.trim()) return setFormError("Name is required.");

        const metaError = validateMetaForType(type, fields);
        if (metaError) return setFormError(metaError);

        const meta = buildRecipeMeta(type, fields);
        const secret = buildRecipeSecret(type, fields);

        if (mode === "create") {
            if (isSecretBlank(secret)) {
                return setFormError(
                    type === "loginRequest"
                        ? "Enter a value for each {{placeholder}}."
                        : "Secret value is required.",
                );
            }
            createMut.mutate({ name: name.trim(), type, secret, meta });
        } else if (mode === "edit" && editId) {
            // Guard partial dynamic-secret entry: all-or-nothing (blank keeps current).
            if (type === "loginRequest" && !isSecretBlank(secret)) {
                const vals = Object.values(secret as Record<string, string>);
                if (vals.some((v) => v.trim().length === 0)) {
                    return setFormError(
                        "To rotate the secret, fill every {{placeholder}} value; leave all blank to keep the current secret.",
                    );
                }
            }
            updateMut.mutate({ id: editId, input: buildRecipeUpdatePayload({ name, meta, secret }) });
        }
    };

    const handleDelete = (r: AuthRecipe) => {
        if (window.confirm(`Delete credential "${r.name}"? Runs that used it keep their history.`)) {
            deleteMut.mutate(r.id);
        }
    };

    const placeholders = extractPlaceholders(fields.bodyTemplate);

    return (
        <div className="border border-[#e6e6e6] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-[#3b82f6]" />
                    <h2 className="text-sm font-semibold">Credentials</h2>
                </div>
                {mode === "idle" && (
                    <button onClick={startCreate} className="mono-btn !py-1.5 !px-3 !text-[12px]">
                        <Plus size={12} /> New credential
                    </button>
                )}
            </div>
            <p className="text-[#666] text-[13px] mb-5">
                Credentials attached to a scan so every request is authenticated — static values or a
                dynamic login/OAuth2 token obtained at scan time. Secrets are encrypted and never shown.
            </p>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center gap-2 text-[#999] text-[13px] py-4">
                    <Loader2 size={14} className="animate-spin text-[#3b82f6]" /> Loading…
                </div>
            ) : isError ? (
                <p className="text-[#dc2626] text-[13px] py-3">Failed to load credentials.</p>
            ) : recipes.length === 0 && mode === "idle" ? (
                <div className="border border-dashed border-[#e6e6e6] bg-[#fafafa] px-4 py-6 text-center">
                    <p className="text-[#666] text-[13px] mb-3">No credentials yet.</p>
                    <button onClick={startCreate} className="mono-btn !py-1.5 !px-3 !text-[12px]">
                        <Plus size={12} /> Create credential
                    </button>
                </div>
            ) : (
                <div className="border border-[#e6e6e6] overflow-hidden">
                    <div className="grid grid-cols-[1fr_170px_100px_72px] text-[11px] text-[#999] uppercase tracking-wider px-4 py-2 bg-[#fafafa] border-b border-[#e6e6e6] font-mono">
                        <span>Name</span>
                        <span>Type</span>
                        <span>Secret</span>
                        <span />
                    </div>
                    {recipes.map((r) => {
                        const summary = metaSummary(r);
                        return (
                            <div
                                key={r.id}
                                className="grid grid-cols-[1fr_170px_100px_72px] items-center px-4 py-3 border-b border-[#e6e6e6] last:border-0 bg-white hover:bg-[#f9f9f9]"
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px] text-[#333] truncate">{r.name}</span>
                                    {summary && (
                                        <span className="block text-[11px] text-[#999] font-mono truncate">{summary}</span>
                                    )}
                                </span>
                                <span className="text-[11px] text-[#666] font-mono">{TYPE_LABEL[r.type] ?? r.type}</span>
                                <span className="text-[12px] text-[#999] font-mono truncate">{r.secretMasked}</span>
                                <span className="flex justify-end gap-2">
                                    <button onClick={() => startEdit(r)} className="text-[#999] hover:text-black transition-colors" title="Edit">
                                        <Pencil size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(r)} className="text-[#999] hover:text-[#dc2626] transition-colors" title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / edit form */}
            {mode !== "idle" && (
                <form onSubmit={handleSubmit} className="mt-5 border-t border-[#e6e6e6] pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold">
                            {mode === "create" ? "New credential" : "Edit credential"}
                        </h3>
                        <button type="button" onClick={cancel} className="text-[#999] hover:text-black transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLASS}>Name</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prod credential" className={INPUT_CLASS} />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as AuthRecipeType)}
                                disabled={mode === "edit"} // server can't change type; keep it stable
                                className={`${SELECT_CLASS} w-full disabled:opacity-60`}
                            >
                                <option value="bearer">Bearer token</option>
                                <option value="apiKey">API key</option>
                                <option value="header">Custom header</option>
                                <option value="cookie">Cookie</option>
                                <option value="loginRequest">Login request (dynamic)</option>
                                <option value="oauth2ClientCredentials">OAuth2 client credentials (dynamic)</option>
                            </select>
                        </div>
                    </div>

                    {/* ---- Static type descriptors ---- */}
                    {type === "apiKey" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Location</label>
                                <select value={fields.location} onChange={(e) => patch({ location: e.target.value as "header" | "query" })} className={`${SELECT_CLASS} w-full`}>
                                    <option value="header">Header</option>
                                    <option value="query">Query param</option>
                                </select>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>{fields.location === "query" ? "Query param name" : "Header name"}</label>
                                {fields.location === "query" ? (
                                    <input value={fields.queryName} onChange={(e) => patch({ queryName: e.target.value })} placeholder="api_key" className={INPUT_CLASS} />
                                ) : (
                                    <input value={fields.headerName} onChange={(e) => patch({ headerName: e.target.value })} placeholder="X-Api-Key" className={INPUT_CLASS} />
                                )}
                            </div>
                        </div>
                    )}
                    {type === "header" && (
                        <div>
                            <label className={LABEL_CLASS}>Header name</label>
                            <input value={fields.headerName} onChange={(e) => patch({ headerName: e.target.value })} placeholder="X-Api-Key" className={INPUT_CLASS} />
                        </div>
                    )}
                    {type === "cookie" && (
                        <div>
                            <label className={LABEL_CLASS}>Cookie name</label>
                            <input value={fields.cookieName} onChange={(e) => patch({ cookieName: e.target.value })} placeholder="session" className={INPUT_CLASS} />
                        </div>
                    )}

                    {/* ---- Static secret ---- */}
                    {!isDynamic(type) && (
                        <div>
                            <label className={LABEL_CLASS}>{type === "bearer" ? "Token" : type === "apiKey" ? "API key" : "Value"}</label>
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={fields.secret}
                                onChange={(e) => patch({ secret: e.target.value })}
                                placeholder={mode === "edit" ? "leave blank to keep current secret" : "the sensitive value"}
                                className={INPUT_CLASS}
                            />
                        </div>
                    )}

                    {/* ---- OAuth2 client credentials ---- */}
                    {type === "oauth2ClientCredentials" && (
                        <>
                            <div>
                                <label className={LABEL_CLASS}>Token URL</label>
                                <input value={fields.tokenUrl} onChange={(e) => patch({ tokenUrl: e.target.value })} placeholder="https://idp.example.com/oauth/token" className={INPUT_CLASS} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={LABEL_CLASS}>Client ID</label>
                                    <input value={fields.clientId} onChange={(e) => patch({ clientId: e.target.value })} placeholder="my-client-id" className={INPUT_CLASS} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Scope (optional)</label>
                                    <input value={fields.scope} onChange={(e) => patch({ scope: e.target.value })} placeholder="read write" className={INPUT_CLASS} />
                                </div>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Token response field (optional)</label>
                                <input value={fields.tokenResponseField} onChange={(e) => patch({ tokenResponseField: e.target.value })} placeholder="access_token" className={INPUT_CLASS} />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Client secret</label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={fields.clientSecret}
                                    onChange={(e) => patch({ clientSecret: e.target.value })}
                                    placeholder={mode === "edit" ? "leave blank to keep current secret" : "the client secret"}
                                    className={INPUT_CLASS}
                                />
                            </div>
                            <InjectAsField fields={fields} patch={patch} />
                        </>
                    )}

                    {/* ---- Login request ---- */}
                    {type === "loginRequest" && (
                        <>
                            <div className="grid grid-cols-[110px_1fr] gap-3">
                                <div>
                                    <label className={LABEL_CLASS}>Method</label>
                                    <select value={fields.method} onChange={(e) => patch({ method: e.target.value })} className={`${SELECT_CLASS} w-full`}>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={LABEL_CLASS}>Login URL</label>
                                    <input value={fields.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://api.example.com/login" className={INPUT_CLASS} />
                                </div>
                            </div>

                            {/* Optional non-secret headers */}
                            <KeyValueEditor
                                label="Headers (optional, non-secret)"
                                pairs={fields.headerPairs}
                                onChange={(headerPairs) => patch({ headerPairs })}
                                keyPlaceholder="Content-Type"
                                valuePlaceholder="application/json"
                            />

                            <div>
                                <label className={LABEL_CLASS}>Body template (JSON)</label>
                                <textarea
                                    value={fields.bodyTemplate}
                                    onChange={(e) => patch({ bodyTemplate: e.target.value })}
                                    placeholder={'{"username":"admin","password":"{{password}}"}'}
                                    className={TEXTAREA_CLASS}
                                />
                                <p className="mt-1 text-[11px] text-[#999]">
                                    Use <span className="font-mono text-[#666]">{"{{name}}"}</span> placeholders — their values
                                    are entered below as secrets and substituted at scan time.
                                </p>
                            </div>

                            <div>
                                <label className={LABEL_CLASS}>Token path</label>
                                <input value={fields.tokenPath} onChange={(e) => patch({ tokenPath: e.target.value })} placeholder="data.token" className={INPUT_CLASS} />
                                <p className="mt-1 text-[11px] text-[#999]">
                                    Dot-path like <span className="font-mono text-[#666]">data.token</span> OR a regex like{" "}
                                    <span className="font-mono text-[#666]">{'/"token":"([^"]+)"/'}</span>.
                                </p>
                            </div>

                            {/* Secret values, keyed by the template's placeholders */}
                            <div>
                                <label className={LABEL_CLASS}>Secret values</label>
                                {placeholders.length === 0 ? (
                                    <p className="text-[11px] text-[#999] font-mono">
                                        Add a <span className="text-[#666]">{"{{placeholder}}"}</span> to the body template above.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {placeholders.map((ph) => (
                                            <div key={ph} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                                                <span className="text-[12px] font-mono text-[#666] truncate" title={ph}>
                                                    {`{{${ph}}}`}
                                                </span>
                                                <input
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={fields.secretValues[ph] ?? ""}
                                                    onChange={(e) => patch({ secretValues: { ...fields.secretValues, [ph]: e.target.value } })}
                                                    placeholder={mode === "edit" ? "leave blank to keep current" : "secret value"}
                                                    className={INPUT_CLASS}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <InjectAsField fields={fields} patch={patch} />
                        </>
                    )}

                    {formError && <p className="text-[#dc2626] text-[12px]">{formError}</p>}

                    <div className="flex items-center gap-2 pt-1">
                        <button type="submit" disabled={submitting} className="mono-btn !py-2 disabled:opacity-40">
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            {mode === "create" ? "Create" : "Save changes"}
                        </button>
                        <button type="button" onClick={cancel} className="text-[13px] text-[#666] hover:text-black transition-colors px-3 py-2">
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Small sub-fields
// ---------------------------------------------------------------------------

function InjectAsField({
    fields,
    patch,
}: {
    fields: RecipeFormFields;
    patch: (p: Partial<RecipeFormFields>) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label className={LABEL_CLASS}>Attach token as</label>
                <select
                    value={fields.injectMode}
                    onChange={(e) => patch({ injectMode: e.target.value as "bearer" | "header" })}
                    className={`${SELECT_CLASS} w-full`}
                >
                    <option value="bearer">Authorization: Bearer</option>
                    <option value="header">Custom header</option>
                </select>
            </div>
            {fields.injectMode === "header" && (
                <div>
                    <label className={LABEL_CLASS}>Header name</label>
                    <input
                        value={fields.injectHeaderName}
                        onChange={(e) => patch({ injectHeaderName: e.target.value })}
                        placeholder="X-Auth-Token"
                        className={INPUT_CLASS}
                    />
                </div>
            )}
        </div>
    );
}

function KeyValueEditor({
    label,
    pairs,
    onChange,
    keyPlaceholder,
    valuePlaceholder,
}: {
    label: string;
    pairs: Array<{ key: string; value: string }>;
    onChange: (pairs: Array<{ key: string; value: string }>) => void;
    keyPlaceholder: string;
    valuePlaceholder: string;
}) {
    const update = (i: number, p: Partial<{ key: string; value: string }>) =>
        onChange(pairs.map((row, idx) => (idx === i ? { ...row, ...p } : row)));
    const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
    const add = () => onChange([...pairs, { key: "", value: "" }]);

    return (
        <div>
            <label className={LABEL_CLASS}>{label}</label>
            <div className="space-y-2">
                {pairs.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                        <input value={row.key} onChange={(e) => update(i, { key: e.target.value })} placeholder={keyPlaceholder} className={INPUT_CLASS} />
                        <input value={row.value} onChange={(e) => update(i, { value: e.target.value })} placeholder={valuePlaceholder} className={INPUT_CLASS} />
                        <button type="button" onClick={() => remove(i)} className="text-[#999] hover:text-[#dc2626] transition-colors justify-self-center" title="Remove">
                            <X size={14} />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={add} className="text-[12px] text-[#3b82f6] hover:text-[#2563eb] transition-colors font-mono">
                    + Add header
                </button>
            </div>
        </div>
    );
}
