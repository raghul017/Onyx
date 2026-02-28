import { Zap, Bug, Timer } from "lucide-react";

interface MetricsRowProps {
  totalPayloads: number;
  crashes: number;
  avgResponseTime: number;
}

const MetricsRow = ({ totalPayloads, crashes, avgResponseTime }: MetricsRowProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="text-primary" size={14} />
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Total Payloads</span>
        </div>
        <p className="font-mono text-4xl font-bold text-foreground">{totalPayloads}</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="text-destructive" size={14} />
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Successful Crashes</span>
        </div>
        <p className="font-mono text-4xl font-bold text-destructive">{crashes}</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="text-primary" size={14} />
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Avg Response Time</span>
        </div>
        <p className="font-mono text-4xl font-bold text-foreground">
          {avgResponseTime}
          <span className="text-base text-muted-foreground ml-1">ms</span>
        </p>
      </div>
    </div>
  );
};

export default MetricsRow;
