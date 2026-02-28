import { ChaosResult } from "@/data/mockChaosData";

const methodColors: Record<string, string> = {
    GET: "text-primary",
    POST: "text-foreground",
    PUT: "text-foreground",
    DELETE: "text-destructive",
    PATCH: "text-muted-foreground",
};

const ChaosStream = ({ data }: { data: ChaosResult[] }) => {
    return (
        <div className="border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 glow-cyan-subtle">
                <div className="w-1.5 h-1.5 bg-primary animate-scan-pulse" />
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-mono">
                    Chaos Stream — Live
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full font-mono text-sm">
                    <thead>
                        <tr className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-[0.15em]">
                            <th className="text-left px-5 py-3 w-20">Method</th>
                            <th className="text-left px-5 py-3">Endpoint</th>
                            <th className="text-left px-5 py-3 w-24">Status</th>
                            <th className="text-left px-5 py-3">
                                Payload Snippet
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => {
                            const isError = row.statusCode >= 500;
                            const isSuccess =
                                row.statusCode >= 200 && row.statusCode < 300;

                            return (
                                <tr
                                    key={row.id}
                                    className={`border-b border-[hsl(0_0%_10%)] transition-colors hover:bg-[hsl(0_0%_6%)] ${
                                        isError ? "row-error" : ""
                                    } ${isSuccess && !isError ? "row-dimmed" : ""}`}
                                >
                                    <td
                                        className={`px-5 py-3 font-semibold ${isSuccess && !isError ? "!text-[hsl(0_0%_35%)]" : methodColors[row.method] || "text-foreground"}`}
                                    >
                                        {row.method}
                                    </td>
                                    <td className="px-5 py-3">
                                        {row.endpoint.length > 50
                                            ? row.endpoint.slice(0, 50) + "…"
                                            : row.endpoint}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={`font-bold ${isError ? "text-destructive" : ""}`}
                                        >
                                            {row.statusCode}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="truncate block max-w-md">
                                            {row.payload.length > 60
                                                ? row.payload.slice(0, 60) + "…"
                                                : row.payload}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ChaosStream;
