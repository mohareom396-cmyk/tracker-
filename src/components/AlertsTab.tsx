import React, { useState, useMemo } from "react";
import { Bell, BellOff, Filter, CheckCircle2, AlertTriangle, ShieldCheck, AlertCircle, BarChart3, Activity } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line, ReferenceLine } from "recharts";
import { AlertItem } from "../types";

interface AlertsTabProps {
  alerts: AlertItem[];
  onClearAlerts: () => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  alerts,
  onClearAlerts,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OVERPRICED' | 'UNDERPRICED' | 'EXPIRED'>('ALL');

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'ALL') return alerts;
    return alerts.filter(a => a.type === activeFilter);
  }, [alerts, activeFilter]);

  // Transform alerts into dynamic chart datasets
  const signalBreakdownData = useMemo(() => {
    const counts = { OVERPRICED: 0, UNDERPRICED: 0, EXPIRED: 0 };
    alerts.forEach(a => {
      if (a.type in counts) {
        counts[a.type as keyof typeof counts]++;
      }
    });
    return [
      { name: "OVERPRICED", count: counts.OVERPRICED, color: "#58a6ff" },
      { name: "UNDERPRICED", count: counts.UNDERPRICED, color: "#bc8cff" },
      { name: "EXPIRED", count: counts.EXPIRED, color: "#39d353" }
    ];
  }, [alerts]);

  const zScoreTrackerData = useMemo(() => {
    // Take the last 15 signals to keep sparkline clean and legible
    return alerts.slice(-15).map((a, i) => ({
      label: `S-${i + 1}`,
      zScore: parseFloat(a.zScore.toFixed(2)),
      type: a.type,
      mispricing: parseFloat(a.mispricing.toFixed(1))
    }));
  }, [alerts]);

  return (
    <div id="content-alerts-panel" className="flex flex-col gap-4 w-full">
      
      {/* 2. LIVE SIGNAL DESK ANALYTICS ROW (CHARTS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Signal breakdown counts */}
        <div className="bg-[#161b22] border border-[#21262d] p-4 rounded-lg font-mono flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-[#8b92a3] uppercase font-sans tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#bc8cff]" />
              <span>Signal Distribution Frequencies</span>
            </span>
            <p className="text-[9px] text-[#6e7681] font-sans">Relative counts of pricing anomalies detected by statistical Z-score</p>
          </div>

          <div className="w-full h-[125px] text-[9.5px] mt-3">
            {alerts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signalBreakdownData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid stroke="#1f242c" horizontal={false} />
                  <XAxis type="number" stroke="#8b949e" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#8b949e" tickLine={false} axisLine={false} width={85} />
                  <Tooltip 
                    contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }}
                    formatter={(value) => [`${value} Alerts`, "Total Fired"]}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={14}>
                    {signalBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6e7681] text-[9.5px]">
                Waiting for Carry signals to calibrate count spectrum...
              </div>
            )}
          </div>
        </div>

        {/* Z-Score tracking curve */}
        <div className="bg-[#161b22] border border-[#21262d] p-4 rounded-lg font-mono flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-[#8b92a3] uppercase font-sans tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#39d353]" />
              <span>Real-Time Model Z-Score Deviations</span>
            </span>
            <p className="text-[9px] text-[#6e7681] font-sans">Standard deviation spark path for the last 15 pricing signals</p>
          </div>

          <div className="w-full h-[125px] text-[9.5px] mt-3">
            {alerts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={zScoreTrackerData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#1f242c" vertical={false} />
                  <XAxis dataKey="label" stroke="#8b949e" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }}
                    formatter={(value) => [`σ ${value}`, "Z-Score Scale"]}
                  />
                  <ReferenceLine y={2.0} stroke="#bc8cff" strokeDasharray="3 3" />
                  <ReferenceLine y={-2.0} stroke="#58a6ff" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="zScore" stroke="#bc8cff" strokeWidth={1.5} dot={{ r: 3, fill: "#bc8cff" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6e7681] text-[9.5px]">
                Waiting for signal streams to compile deviation index...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration filters bar */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center text-[#6e7681] text-xs mr-1 uppercase font-bold tracking-wide font-sans">
            <Filter className="w-4 h-4 mr-1.5 text-[#58a6ff]" />
            <span>Filter Signals:</span>
          </div>

          <div className="flex flex-wrap gap-1 bg-[#0d1117] p-1 border border-[#21262d] rounded">
            {(['ALL', 'OVERPRICED', 'UNDERPRICED', 'EXPIRED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded text-[10px] uppercase font-black cursor-pointer transition-all ${
                  activeFilter === f 
                    ? "bg-[#21262d] text-white border border-[#30363d]" 
                    : "text-[#6e7681] hover:text-[#e6edf3]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClearAlerts}
          className="text-[9px] font-black uppercase text-[#f85149] hover:bg-[#f85149]/10 border border-[#f85149]/20 hover:border-[#f85149]/40 px-3 py-1.5 rounded transition-all font-mono"
        >
          Flush Signal Index
        </button>
      </div>

      {/* SEC: LIST OF CARDS */}
      <div className="flex flex-col gap-3 font-mono">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map(alert => {
            const isOverpriced = alert.type === "OVERPRICED";
            const isExpired = alert.type === "EXPIRED";
            
            let cardBorder = "border-[#21262d]";
            let headerBg = "text-yellow-400";
            let statusIcon = <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />;

            if (isOverpriced) {
              cardBorder = "border-[#58a6ff]/30 hover:border-[#58a6ff]/50";
              headerBg = "text-[#58a6ff]";
              statusIcon = <AlertTriangle className="w-4 h-4 text-[#58a6ff] shrink-0" />;
            } else if (isExpired) {
              cardBorder = "border-[#6e7681]/30 hover:border-[#6e7681]/40";
              headerBg = "text-[#6e7681]";
              statusIcon = <CheckCircle2 className="w-4 h-4 text-[#39d353] shrink-0" />;
            } else if (alert.type === "UNDERPRICED") {
              cardBorder = "border-[#bc8cff]/30 hover:border-[#bc8cff]/50";
              headerBg = "text-[#bc8cff]";
              statusIcon = <AlertTriangle className="w-4 h-4 text-[#bc8cff] shrink-0" />;
            }

            return (
              <div 
                key={alert.id}
                className={`bg-[#161b22] border rounded-lg p-3.5 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${cardBorder}`}
              >
                {/* Left meta information */}
                <div className="flex gap-3">
                  <div className="mt-1 shrink-0">{statusIcon}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase ${headerBg}`}>
                        {alert.type} DETECTED (Z: {alert.zScore.toFixed(2)})
                      </span>
                      <span className="text-[9px] text-[#6e7681] bg-[#0d1117] border border-[#21262d] px-1.5 rounded">
                        {alert.timestamp}
                      </span>
                    </div>
                    <span className="text-[10px] text-white font-extrabold tracking-wide uppercase mt-1 inline-block font-sans">
                      Strategy Route: {alert.recommendedAction}
                    </span>
                    <span className="text-[9px] text-[#6e7681] block mt-0.5">
                      Spot Price: ₹{alert.spot.toLocaleString()} &bull; Futures Price: ₹{alert.futures.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Right metrics layout */}
                <div className="flex flex-wrap items-center gap-4 md:text-right border-t border-[#21262d] md:border-t-0 pt-2.5 md:pt-0 w-full md:w-auto">
                  <div className="flex-1 md:flex-initial">
                    <span className="text-[9px] text-[#6e7681] block uppercase font-sans">MISPRICING GAP</span>
                    <span className={`text-xs font-bold ${isExpired ? "text-[#6e7681]" : "text-white"}`}>
                      ₹{alert.mispricing.toFixed(2)} / unit
                    </span>
                  </div>

                  <div className="flex-1 md:flex-initial">
                    <span className="text-[9px] text-[#6e7681] block uppercase font-sans">OPERATING COST/LT</span>
                    <span className="text-xs text-[#f85149] font-bold">
                      ₹{alert.transactionCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex-1 md:flex-initial">
                    <span className="text-[9px] text-[#6e7681] block uppercase font-sans">NET DESK MARGIN</span>
                    <span className={`text-sm font-black ${alert.netOpportunity > 0 ? "text-[#39d353]" : "text-[#6e7681]"}`}>
                      {alert.netOpportunity > 0 ? `+₹${alert.netOpportunity.toFixed(2)}` : "₹0.00"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 text-center text-[#6e7681] text-xs">
            <BellOff className="w-8 h-8 text-[#6e7681] mx-auto mb-2 opacity-50" />
            <span>No alerts indexed under the {activeFilter} category. The Carry Desk is listening for dynamic cross-boundary opportunities.</span>
          </div>
        )}
      </div>
    </div>
  );
};
