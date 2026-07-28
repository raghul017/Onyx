// =============================================================================
// AuthRecipesPanel — manage static scan credentials (T7b).
//
// Secrets are WRITE-ONLY: the API returns them masked as ••••last4. On edit we
// leave the secret field blank ("leave blank to keep current secret") and only
// send a new secret if the user actually types one — so the plaintext never
// needs to round-trip back to the client. Light-mono styling matches Settings.
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
    type UpdateAuthRecipeInput,
} from "@/services/api";

const TYPE_LABEL: Record<AuthRecipeType, string> = {
    bearer: "Bearer token",
    apiKey: "API key",
    header: "Custom header",
    cookie: "Cookie",
};

// ---------------------------------------------------------------------------
// Pure form helpers (unit-tested) — keep the credential-handling logic honest.
// ---------------------------------------------------------------------------

/** Build the non-secret meta descriptors for a given credential type. */
export function buildRecipeMeta(
    type: AuthRecipeType,
    fields: { headerName: string; queryName: string; location: "header" | "query"; cookieName: string },
): AuthRecipeMeta {
    switch (type) {
        case "header":
            return { headerName: fields.headerName.trim() };
        case "cookie":
            return { cookieName: fields.cookieName.trim() };
        case "apiKey":
            return fields.location === "query"
                ? { location: "query", queryName: fields.queryName.trim() }
                : { location: "header", headerName: fields.headerName.trim() };
        case "bearer":
        default:
            return {};
    }
}

/**
 * Build the PATCH payload for editing a recipe. The secret is included ONLY when
 * the user typed a new one — a blank secret means "keep the existing secret".
 */
export function buildRecipeUpdatePayload(args: {
    name: string;
    meta: AuthRecipeMeta;
    secret: string;
}): UpdateAuthRecipeInput {
    const payload: UpdateAuthRecipeInput = { name: args.name.trim(), meta: args.meta };
    if (args.secret.trim().length > 0) payload.secret = args.secret;
    return payload;
}

/** Client-side check that the type-specific descriptor is filled in. */
function validateForType(
    type: AuthRecipeType,
    fields: { headerName: string; queryName: string; location: "header" | "query"; cookieName: string },
): string | null {
    if (type === "header" && !fields.headerName.trim()) return "Header name is required.";
    if (type === "cookie" && !fields.cookieName.trim()) return "Cookie name is required.";
    if (type === "apiKey") {
        if (fields.location === "header" && !fields.headerName.trim()) return "Header name is required.";
        if (fields.location === "query" && !fields.queryName.trim()) return "Query param name is required.";
    }
    return null;
}

const INPUT_CLASS =
    "w-full bg-white border border-[#e6e6e6] text-black font-mono text-[13px] px-3 py-2 outline-none focus:border-black transition-colors placeholder:text-[#999]";
const SELECT_CLASS =
    "bg-white border border-[#e6e6e6] text-[#333] text-[13px] px-2 py-2 outline-none focus:border-black";

type Mode = "idle" | "create" | "edit";

export default function AuthRecipesPanel() {
    const qc = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ["auth-recipes"],
        queryFn: listAuthRecipes,
    });
    const recipes = data?.recipes ?? [];

    const [mode, setMode] = useState<Mode>("idle");
    const [editId, setEditId] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState("");
    const [type, setType] = useState<AuthRecipeType>("bearer");
    const [secret, setSecret] = useState("");
    const [headerName, setHeaderName] = useState("");
    const [queryName, setQueryName] = useState("");
    const [location, setLocation] = useState<"header" | "query">("header");
    const [cookieName, setCookieName] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const resetForm = () => {
        setName("");
        setType("bearer");
        setSecret("");
        setHeaderName("");
        setQueryName("");
        setLocation("header");
        setCookieName("");
        setFormError(null);
    };

    const startCreate = () => {
        resetForm();
        setEditId(null);
        setMode("create");
    };

    const startEdit = (r: AuthRecipe) => {
        setEditId(r.id);
        setName(r.name);
        setType(r.type);
        setSecret(""); // blank => keep current secret
        setHeaderName(r.meta.headerName ?? "");
        setQueryName(r.meta.queryName ?? "");
        setLocation(r.meta.location ?? "header");
        setCookieName(r.meta.cookieName ?? "");
        setFormError(null);
        setMode("edit");
    };

    const cancel = () => {
        setMode("idle");
        setEditId(null);
        resetForm();
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
        mutationFn: (v: { id: string; input: UpdateAuthRecipeInput }) =>
            updateAuthRecipe(v.id, v.input),
        onSuccess: () => {
            invalidate();
            cancel();
        },
        onError: (e) => setFormError(errMsg(e)),
    });

    const deleteMut = useMutation({
        mutationFn: deleteAuthRecipe,
        onSuccess: invalidate,
    });

    const submitting = createMut.isPending || updateMut.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!name.trim()) {
            setFormError("Name is required.");
            return;
        }
        const fields = { headerName, queryName, location, cookieName };
        const metaError = validateForType(type, fields);
        if (metaError) {
            setFormError(metaError);
            return;
        }
        const meta = buildRecipeMeta(type, fields);

        if (mode === "create") {
            if (!secret.trim()) {
                setFormError("Secret value is required.");
                return;
            }
            createMut.mutate({ name: name.trim(), type, secret, meta });
        } else if (mode === "edit" && editId) {
            updateMut.mutate({ id: editId, input: buildRecipeUpdatePayload({ name, meta, secret }) });
        }
    };

    const handleDelete = (r: AuthRecipe) => {
        if (window.confirm(`Delete credential "${r.name}"? Runs that used it keep their history.`)) {
            deleteMut.mutate(r.id);
        }
    };

    // The label for the sensitive value input varies by type.
    const secretLabel =
        type === "bearer" ? "Token" : type === "apiKey" ? "API key" : "Value";

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
                Static credentials attached to a scan so every request is authenticated.
                Secrets are encrypted and shown only as{" "}
                <span className="font-mono">••••last4</span>.
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
                    <div className="grid grid-cols-[1fr_110px_120px_72px] text-[11px] text-[#999] uppercase tracking-wider px-4 py-2 bg-[#fafafa] border-b border-[#e6e6e6] font-mono">
                        <span>Name</span>
                        <span>Type</span>
                        <span>Secret</span>
                        <span />
                    </div>
                    {recipes.map((r) => (
                        <div
                            key={r.id}
                            className="grid grid-cols-[1fr_110px_120px_72px] items-center px-4 py-3 border-b border-[#e6e6e6] last:border-0 bg-white hover:bg-[#f9f9f9]"
                        >
                            <span className="text-[13px] text-[#333] truncate">{r.name}</span>
                            <span className="text-[11px] text-[#666] font-mono">{TYPE_LABEL[r.type] ?? r.type}</span>
                            <span className="text-[12px] text-[#999] font-mono truncate">{r.secretMasked}</span>
                            <span className="flex justify-end gap-2">
                                <button
                                    onClick={() => startEdit(r)}
                                    className="text-[#999] hover:text-black transition-colors"
                                    title="Edit"
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    onClick={() => handleDelete(r)}
                                    className="text-[#999] hover:text-[#dc2626] transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </span>
                        </div>
                    ))}
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
                            <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                Name
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Prod bearer token"
                                className={INPUT_CLASS}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                Type
                            </label>
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
                            </select>
                        </div>
                    </div>

                    {/* Type-specific descriptors */}
                    {type === "apiKey" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                    Location
                                </label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value as "header" | "query")}
                                    className={`${SELECT_CLASS} w-full`}
                                >
                                    <option value="header">Header</option>
                                    <option value="query">Query param</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                    {location === "query" ? "Query param name" : "Header name"}
                                </label>
                                {location === "query" ? (
                                    <input value={queryName} onChange={(e) => setQueryName(e.target.value)} placeholder="api_key" className={INPUT_CLASS} />
                                ) : (
                                    <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="X-Api-Key" className={INPUT_CLASS} />
                                )}
                            </div>
                        </div>
                    )}
                    {type === "header" && (
                        <div>
                            <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                Header name
                            </label>
                            <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="X-Api-Key" className={INPUT_CLASS} />
                        </div>
                    )}
                    {type === "cookie" && (
                        <div>
                            <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                                Cookie name
                            </label>
                            <input value={cookieName} onChange={(e) => setCookieName(e.target.value)} placeholder="session" className={INPUT_CLASS} />
                        </div>
                    )}

                    {/* Secret (write-only) */}
                    <div>
                        <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono mb-1">
                            {secretLabel}
                        </label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder={mode === "edit" ? "leave blank to keep current secret" : "the sensitive value"}
                            className={INPUT_CLASS}
                        />
                    </div>

                    {formError && <p className="text-[#dc2626] text-[12px]">{formError}</p>}

                    <div className="flex items-center gap-2 pt-1">
                        <button type="submit" disabled={submitting} className="mono-btn !py-2 disabled:opacity-40">
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            {mode === "create" ? "Create" : "Save changes"}
                        </button>
                        <button
                            type="button"
                            onClick={cancel}
                            className="text-[13px] text-[#666] hover:text-black transition-colors px-3 py-2"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
