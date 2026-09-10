import { useMemo } from "react";
import { useGetUsage, getGetUsageQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 176" className={className} fill="currentColor">
      <path d="M147.487 0L256 176h-53.986l-54.513-88L93.488 176H39.502L147.487 0zM108.513 0H54.527L0 88h53.986L108.513 0z" />
    </svg>
  );
}

function XaiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M2.87 3L10.34 12.46L2.83 21H4.52L11.09 13.47L16.37 21H21.17L13.24 10.91L20.24 3H18.56L12.5 9.9L7.67 3H2.87ZM5.26 4.2H7.12L18.78 19.8H16.92L5.26 4.2Z" />
    </svg>
  );
}

function OpenAiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function OmLogo({ className }: { className?: string }) {
  return (
    <img src="/antiq-square.png" alt="antiq" className={className} style={{ objectFit: "cover", transform: "scale(1.6)" }} />
  );
}

const models = [
  { name: "Claude Opus 4.6", provider: "Anthropic", logo: AnthropicLogo, color: "#d97706" },
  { name: "Grok Heavy 4", provider: "xAI", logo: XaiLogo, color: "#3b82f6" },
  { name: "OpenAI 5.4", provider: "OpenAI", logo: OpenAiLogo, color: "#10b981" },
  { name: "API Requests", provider: "antiq", logo: OmLogo, color: "#ffffff", isImage: true },
];

function formatDateLabel(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-border/40 rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function UsagePage() {
  const queryClient = useQueryClient();
  const { data: usage, isFetching } = useGetUsage();

  const chartData = useMemo(() => {
    const daily = usage?.daily ?? [];
    const today = new Date();
    const dayMap: Record<string, { instagram: number; adgen: number; twitter: number; contentgen: number }> = {};
    for (const d of daily) {
      dayMap[d.date] = { instagram: d.instagram, adgen: d.adgen, twitter: d.twitter, contentgen: d.contentgen };
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap[key];
      return {
        date: formatDateLabel(key),
        Instagram: entry?.instagram ?? 0,
        "Ad Gen": entry?.adgen ?? 0,
        "X Posts": entry?.twitter ?? 0,
        "Content Gen": entry?.contentgen ?? 0,
      };
    });
  }, [usage?.daily]);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8 md:mb-10">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: getGetUsageQueryKey() })}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-10">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">System Status</h2>
        <div className="space-y-2">
          {models.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between py-3 px-4 rounded-lg bg-card/30 border border-border/30"
            >
              <div className="flex items-center gap-3">
                {(m as any).isImage ? (
                  <div className="w-5 h-5 rounded overflow-hidden">
                    <m.logo className="w-full h-full" />
                  </div>
                ) : (
                  <m.logo className="w-5 h-5 text-white/80" />
                )}
                <div>
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{m.provider}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[5px] h-[5px] rounded-full bg-white/50" />
                <span className="text-[11px] text-white/40 font-light tracking-wide">Idle</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">Token Usage</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2 rounded-lg bg-card/30 border border-border/30 overflow-hidden">
            <div className="flex items-center justify-between py-5 px-5">
              <span className="text-sm font-medium">Total Tokens</span>
              <span className="text-2xl font-mono font-semibold tabular-nums">
                {(usage?.totalTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="px-2 pb-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="adGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="xGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Instagram"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fill="url(#igGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="Ad Gen"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#adGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="X Posts"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fill="url(#xGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="Content Gen"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#cgGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="py-4 px-4 rounded-lg bg-card/30 border border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-xs text-muted-foreground">Instagram</span>
            </div>
            <span className="text-sm font-mono tabular-nums">{(usage?.instagramTokens ?? 0).toLocaleString()}</span>
          </div>

          <div className="py-4 px-4 rounded-lg bg-card/30 border border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-xs text-muted-foreground">Ad Gen</span>
            </div>
            <span className="text-sm font-mono tabular-nums">{(usage?.adgenTokens ?? 0).toLocaleString()}</span>
          </div>

          <div className="py-4 px-4 rounded-lg bg-card/30 border border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <span className="text-xs text-muted-foreground">X Posts</span>
            </div>
            <span className="text-sm font-mono tabular-nums">{(usage?.twitterTokens ?? 0).toLocaleString()}</span>
          </div>

          <div className="py-4 px-4 rounded-lg bg-card/30 border border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">Content Gen</span>
            </div>
            <span className="text-sm font-mono tabular-nums">{(usage?.contentgenTokens ?? 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-6 text-[10px] text-muted-foreground/50 space-y-0.5">
          <p>Instagram: 10 tokens per carousel &middot; Ad Gen: 5 tokens per ad &middot; X: 1 token per post &middot; Content Gen: 10 tokens per image</p>
          <p className="font-mono pt-1">v0.9.8.1</p>
        </div>
      </div>
    </div>
  );
}
