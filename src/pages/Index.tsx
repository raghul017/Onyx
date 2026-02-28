import { useState } from "react";
import { Search, Crosshair, Shield } from "lucide-react";
import MetricsRow from "@/components/MetricsRow";
import ChaosStream from "@/components/ChaosStream";
import { mockChaosData } from "@/data/mockChaosData";

const Index = () => {
  const [targetUrl, setTargetUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(true);

  const data = mockChaosData;
  const crashes = data.filter((d) => d.statusCode >= 500).length;
  const avgTime = Math.round(data.reduce((s, d) => s + d.responseTime, 0) / data.length);

  const handleLaunch = () => {
    if (!targetUrl) return;
    setIsScanning(true);
    setHasLaunched(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-primary" size={20} />
          <h1 className="text-lg font-semibold tracking-tight">ChaosForge</h1>
          <span className="text-xs text-muted-foreground font-mono ml-2">v0.1.0-alpha</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <span>Engine: Havoc-3</span>
          <span className="w-2 h-2 bg-primary inline-block" />
          <span>Ready</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Command Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://api.target.com/openapi.json"
              className="w-full bg-input border border-border px-12 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-glow-cyan focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <button
            onClick={handleLaunch}
            disabled={isScanning}
            className="relative border border-primary bg-background px-6 py-3 font-mono text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all glow-cyan disabled:opacity-50 flex items-center gap-2 overflow-hidden"
          >
            {isScanning && (
              <div className="absolute inset-0 bg-primary/10">
                <div className="h-full w-1/3 bg-primary/20 animate-scan-line" />
              </div>
            )}
            <Crosshair size={16} className={isScanning ? "animate-spin" : ""} />
            <span className="relative z-10">{isScanning ? "Scanning…" : "Launch Attack"}</span>
          </button>
        </div>

        {/* Metrics */}
        {hasLaunched && (
          <>
            <MetricsRow totalPayloads={data.length} crashes={crashes} avgResponseTime={avgTime} />
            <ChaosStream data={data} />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
