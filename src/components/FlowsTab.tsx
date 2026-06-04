import React, { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine, Legend } from "recharts";
import { 
  Activity, 
  Gauge, 
  TrendingUp, 
  HelpCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  Zap, 
  Globe, 
  Filter, 
  Layers, 
  Sliders, 
  Coins, 
  Percent 
} from "lucide-react";
import { FiiDiiFlow, TickData } from "../types";

interface FlowsTabProps {
  flowsHistory: FiiDiiFlow[];
  latestTick: TickData;
  history: TickData[];
}

export const FlowsTab: React.FC<FlowsTabProps> = ({
  flowsHistory,
  latestTick,
  history,
}) => {
  // Tab/Filter States
  const [activeSegmentFile, setActiveSegmentFile] = useState<"ALL" | "BUYERS" | "SELLERS">("ALL");
  const [squeezePercentTrigger, setSqueezePercentTrigger] = useState<number>(68); // Threshold default to 68% shorts
  const [searchQuery, setSearchQuery] = useState<string>("");

  const last12Flows = useMemo(() => flowsHistory.slice(-12), [flowsHistory]);
  
  // Custom PCR Gauge
  const pcrValue = latestTick.pcr;
  const pcrMin = 0.4;
  const pcrMax = 1.8;
  const clampedPcr = Math.max(pcrMin, Math.min(pcrMax, pcrValue));
  const percent = (clampedPcr - pcrMin) / (pcrMax - pcrMin);
  const pcrRotationDegree = percent * 180;

  // Option PCR scale sentiment calculation
  const pcrZone = useMemo(() => {
    if (pcrValue < 0.70) {
      return { 
        label: "EXTREME BEARISH / OVERSOLD", 
        color: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30", 
        bias: "bearish" 
      };
    }
    if (pcrValue > 1.35) {
      return { 
        label: "STRONGLY BULLISH / OVERBOUGHT", 
        color: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30", 
        bias: "bullish" 
      };
    }
    return { 
      label: "NEUTRAL / MARKET EQUILIBRIUM", 
      color: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20", 
      bias: "neutral" 
    };
  }, [pcrValue]);

  // Translate Option Interest trends
  const oiTrendInfo = useMemo(() => {
    switch (latestTick.oiTrend) {
      case "long_buildup":
        return { 
          label: "BULLISH LONG BUILDUP", 
          color: "text-[#10b981]", 
          bgSubtle: "bg-[#10b981]/15 border-[#10b981]/25",
          desc: "Futures spot price rallies alongside rising Open Interest, signaling high aggressive buy conviction." 
        };
      case "short_buildup":
        return { 
          label: "BEARISH SHORT BUILDUP", 
          color: "text-[#ef4444]", 
          bgSubtle: "bg-[#ef4444]/15 border-[#ef4444]/25",
          desc: "Futures spot price is falling on surging Open Interest. Aggressive shorts are piling up rapidly." 
        };
      case "short_covering":
        return { 
          label: "BULLISH SHORT COVERING", 
          color: "text-[#c084fc]", 
          bgSubtle: "bg-[#c084fc]/15 border-[#c084fc]/25",
          desc: "Futures spot price rallies while Open Interest is dropping. Bearish legs are forced to liquidate." 
        };
      case "long_unwinding":
        return { 
          label: "BEARISH LONG UNWINDING", 
          color: "text-[#f97316]", 
          bgSubtle: "bg-[#f97316]/15 border-[#f97316]/25",
          desc: "Futures prices slide on dropping Open Interest, indicating long hand liquidations." 
        };
      default:
        return { 
          label: "STABLE CONSOLIDATION", 
          color: "text-white", 
          bgSubtle: "bg-[#251a44] border-[#3f2e75]",
          desc: "Open contracts remain flat with minor fluctuation drift." 
        };
    }
  }, [latestTick.oiTrend]);

  // Derived FII Indicators (Deterministic, based on tick variations & spot trends)
  const FiiDerivStats = useMemo(() => {
    const seed = parseFloat((latestTick.spot % 100).toFixed(2));
    const fiiFutNet = Math.round((seed - 50) * 85);
    const fiiOptNet = Math.round((seed - 40) * 210);
    const scale = (latestTick.spot / 22000);
    const longContracts = Math.round(92000 + (seed * 1100) * scale);
    const shortContracts = Math.round(84000 + ((100 - seed) * 1250) * scale);
    const totalFutContracts = longContracts + shortContracts;
    const fiiLongRatio = (longContracts / totalFutContracts) * 100;
    
    // Dynamic FII Sentiment Rating
    let sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    let score = fiiFutNet + (fiiOptNet * 0.15) + (totalFutContracts * (fiiLongRatio - 50) * 0.01);
    
    if (score > 1200) sentiment = "BULLISH";
    else if (score < -1200) sentiment = "BEARISH";

    return {
      fiiFutNet,
      fiiOptNet,
      longContracts,
      shortContracts,
      fiiLongRatio,
      sentiment,
      score
    };
  }, [latestTick.spot]);

  // Filter flows logic
  const filteredFlows = useMemo(() => {
    return flowsHistory.filter(item => {
      // Step A: Search Filter
      if (searchQuery.trim() !== "") {
        if (!item.date.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      
      // Step B: Segment Selection Filter
      if (activeSegmentFile === "BUYERS") {
        return item.fii > 0;
      }
      if (activeSegmentFile === "SELLERS") {
        return item.fii < 0;
      }
      return true;
    });
  }, [flowsHistory, activeSegmentFile, searchQuery]);

  // Calculate Average FII and DII actions
  const flowAverages = useMemo(() => {
    if (flowsHistory.length === 0) return { fiiAvg: 0, diiAvg: 0 };
    const sums = flowsHistory.reduce((acc, curr) => ({
      fii: acc.fii + curr.fii,
      dii: acc.dii + curr.dii
    }), { fii: 0, dii: 0 });
    return {
      fiiAvg: Math.round(sums.fii / flowsHistory.length),
      diiAvg: Math.round(sums.dii / flowsHistory.length)
    };
  }, [flowsHistory]);

  // Squeeze Signal Analysis
  const isSqueezeAlert = FiiDerivStats.fiiLongRatio < (100 - squeezePercentTrigger); // e.g. when long ratio is below 32% (so shorts > 68%)
  const squeezeIntensity = Math.min(100, Math.round(((100 - FiiDerivStats.fiiLongRatio) / squeezePercentTrigger) * 100));

  return (
    <div id="content-flows-dashboard" className="flex flex-col gap-4 w-full">
      
      {/* 1. INTUATIVE FII/DII INSTITUTIONAL INTEL HEADBANNER */}
      <div className="premium-card p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#1e133e] border border-[#3f2e75] rounded-xl text-[#c084fc] relative">
            <Globe className="w-5 h-5 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10b981]"></span>
            </span>
          </div>
          <div>
            <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
              FOREIGN INSTITUTIONAL INVESTORS (FII) DESK INDEX
            </h3>
            <p className="text-[10px] text-[#8b84a3] font-sans">
              Dynamic tracking of foreign portfolio inflows, option call layouts, put hedges & futures rollover metrics.
            </p>
          </div>
        </div>

        {/* Global Market Sentiment Level Badge */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[9px] text-[#8b84a3] uppercase font-semibold">FII CONVICTION METER:</span>
          {FiiDerivStats.sentiment === "BULLISH" ? (
            <span className="px-3 py-1 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 rounded-full font-black text-[10px] tracking-widest animate-pulse flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <Zap className="w-3.5 h-3.5 fill-[#10b981]" /> BULLISH SWEETEN
            </span>
          ) : FiiDerivStats.sentiment === "BEARISH" ? (
            <span className="px-3 py-1 bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 rounded-full font-black text-[10px] tracking-widest animate-pulse flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.25)]">
              <ShieldAlert className="w-3.5 h-3.5" /> BEARISH PRESSURE
            </span>
          ) : (
            <span className="px-3 py-1 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 rounded-full font-extrabold text-[10px] tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> NEUTRAL DAMPEN
            </span>
          )}
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS WITH PSYCHOLOGICAL PNLS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card A: FII Cash Action */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">FII Cash Segment</span>
            <Coins className="w-4 h-4 text-[#c084fc]" />
          </div>
          <div className="my-2">
            <span className="text-[9px] text-[#8b84a3] block">Today's Net Buy/Sell</span>
            <div className={`text-lg font-black font-mono flex items-center gap-0.5 ${
              (last12Flows[last12Flows.length - 1]?.fii ?? 0) >= 0 ? "pnl-profit" : "pnl-loss"
            }`}>
              {(last12Flows[last12Flows.length - 1]?.fii ?? 0) >= 0 ? "+" : ""}
              {(last12Flows[last12Flows.length - 1]?.fii ?? 0).toLocaleString("en-IN")} <span className="text-[10px] text-gray-400 font-normal ml-1">Cr</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono border-t border-[#231b44] pt-1.5 mt-1">
            <span>Flow Averaging (12d)</span>
            <span className={flowAverages.fiiAvg >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
              {flowAverages.fiiAvg >= 0 ? "+" : ""}{flowAverages.fiiAvg} Cr
            </span>
          </div>
        </div>

        {/* Card B: DII Cash Action */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">DII Cash Segment</span>
            <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="my-2">
            <span className="text-[9px] text-[#8b84a3] block">Today's Net Sweep</span>
            <div className={`text-lg font-black font-mono flex items-center gap-0.5 ${
              (last12Flows[last12Flows.length - 1]?.dii ?? 0) >= 0 ? "pnl-profit" : "pnl-loss"
            }`}>
              {(last12Flows[last12Flows.length - 1]?.dii ?? 0) >= 0 ? "+" : ""}
              {(last12Flows[last12Flows.length - 1]?.dii ?? 0).toLocaleString("en-IN")} <span className="text-[10px] text-gray-400 font-normal ml-1">Cr</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono border-t border-[#231b44] pt-1.5 mt-1">
            <span>DII Sweep Avg (12d)</span>
            <span className={flowAverages.diiAvg >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
              {flowAverages.diiAvg >= 0 ? "+" : ""}{flowAverages.diiAvg} Cr
            </span>
          </div>
        </div>

        {/* Card C: FII Derivatives Volume */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">FII Index Derivatives</span>
            <Layers className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="my-2">
            <span className="text-[9px] text-[#8b84a3] block">Futures & Options Combined</span>
            <div className={`text-lg font-black font-mono flex items-center gap-0.5 ${
              (FiiDerivStats.fiiFutNet + FiiDerivStats.fiiOptNet) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              {(FiiDerivStats.fiiFutNet + FiiDerivStats.fiiOptNet) >= 0 ? "+" : ""}
              {(FiiDerivStats.fiiFutNet + FiiDerivStats.fiiOptNet).toLocaleString("en-IN")} <span className="text-[10px] text-[#8b84a3] font-normal ml-1">Cr</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono border-t border-[#231b44] pt-1.5 mt-1">
            <span>Fut: {FiiDerivStats.fiiFutNet >= 0 ? "+" : ""}{FiiDerivStats.fiiFutNet} Cr</span>
            <span>Opt: {FiiDerivStats.fiiOptNet >= 0 ? "+" : ""}{FiiDerivStats.fiiOptNet} Cr</span>
          </div>
        </div>

        {/* Card D: FII Index Futures Long vs Short Ratio */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">FII Long-Short Ratio</span>
            <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-[#160f2d] border border-[#2b1f52] px-1.5 py-0.5 rounded">
              <Percent className="w-3 h-3 text-[#c084fc]" />
              <span>{Math.round(FiiDerivStats.fiiLongRatio)}%</span>
            </div>
          </div>
          
          <div className="my-1">
            <span className="text-[9px] text-[#8b84a3] block">Active Futures Long contracts ratio</span>
            <div className="w-full bg-[#1a1235] rounded-full h-2 mt-1 relative overflow-hidden flex border border-[#281e4b]">
              <div 
                className="bg-gradient-to-r from-[#ef4444] to-[#10b981] h-full transition-all duration-300" 
                style={{ width: `${FiiDerivStats.fiiLongRatio}%` }} 
              />
            </div>
            <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-1">
              <span>{FiiDerivStats.shortContracts.toLocaleString()} Shorts</span>
              <span>{FiiDerivStats.longContracts.toLocaleString()} Longs</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono border-t border-[#231b44] pt-1.5 mt-1">
            <span>Ratio Sentiment</span>
            <span className={`font-semibold ${
              FiiDerivStats.fiiLongRatio > 60 ? "text-[#10b981]" : FiiDerivStats.fiiLongRatio < 40 ? "text-[#ef4444]" : "text-[#f59e0b]"
            }`}>
              {FiiDerivStats.fiiLongRatio > 60 ? "BULLISH STACK" : FiiDerivStats.fiiLongRatio < 40 ? "HEAVY SHORTS" : "BALANCED DRIFT"}
            </span>
          </div>
        </div>
      </section>

      {/* 3. MIDDLE GRAPHICS GRID: CHARTS + SPECIAL GAUGES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        
        {/* Daily Net Cash Flow Bars & Flow Sum Trends */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Chart 1: FII & DII Dual Bar chart with gradients */}
          <div className="premium-card p-4 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-[#281e4b]/60 pb-2.5 mb-3 gap-2">
              <div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Activity className="w-4 h-4 text-[#c084fc]" />
                  <span>Institutional Daily Net Cash Flow Overlay (Cr)</span>
                </h4>
                <p className="text-[10px] text-[#8b84a3] font-sans">Comparing foreign FII purchases versus domestic DII rescue sweeps</p>
              </div>
              
              <div className="flex items-center gap-3 font-mono text-[9px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-[#c084fc] rounded" /> FII NET</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-[#38bdf8] rounded" /> DII NET</span>
              </div>
            </div>

            <div className="w-full h-[220px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last12Flows} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid stroke="#1c1437" vertical={false} />
                  <XAxis dataKey="date" stroke="#847ea1" tickLine={false} axisLine={false} />
                  <YAxis stroke="#847ea1" tickLine={false} axisLine={false} tickFormatter={(val) => `${val >= 0 ? "+" : ""}${val}`} />
                  <Tooltip 
                    contentStyle={{ background: "#0c091a", border: "1px solid #281e4b", borderRadius: "6px" }}
                    labelStyle={{ color: "#8b84a3", fontSize: "10px", fontWeight: "bold" }}
                    itemStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <ReferenceLine y={0} stroke="#2c1d53" />
                  <Bar dataKey="fii" fill="#c084fc" radius={[2, 2, 0, 0]} name="FII Flow" />
                  <Bar dataKey="dii" fill="#38bdf8" radius={[2, 2, 0, 0]} name="DII Flow" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Cumulative Sum Trends */}
          <div className="premium-card p-4 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-[#281e4b]/60 pb-2.5 mb-3 gap-2">
              <div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <TrendingUp className="w-4 h-4 text-[#10b981]" />
                  <span>Cumulative 5-Session Investment Momentum (Cr)</span>
                </h4>
                <p className="text-[10px] text-[#8b84a3] font-sans">Aggregated system liquid flow; shows macro direction of dry powder deployment</p>
              </div>

              <div className="flex items-center gap-2 text-[9px] font-mono bg-[#140b2a] border border-[#2b1f52] p-1.5 rounded text-[#10b981] font-bold">
                <span>CUMULATIVE STATUS:</span>
                <span>{(last12Flows[last12Flows.length - 1]?.cumulative5Day ?? 0) >= 0 ? "+" : ""}{(last12Flows[last12Flows.length - 1]?.cumulative5Day ?? 0).toLocaleString()} Cr</span>
              </div>
            </div>

            <div className="w-full h-[150px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last12Flows} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="flowTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c1437" vertical={false} />
                  <XAxis dataKey="date" stroke="#847ea1" tickLine={false} axisLine={false} />
                  <YAxis stroke="#847ea1" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: "#0c091a", border: "1px solid #281e4b", borderRadius: "6px" }}
                    labelStyle={{ color: "#8b84a3", fontSize: "10px", fontWeight: "bold" }}
                    itemStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <ReferenceLine y={0} stroke="#2c1d53" />
                  <Area type="monotone" dataKey="cumulative5Day" stroke="#10b981" fillOpacity={1} fill="url(#flowTrendGrad)" strokeWidth={1.5} name="5-Session Cumulative" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: GAUGE PANEL + OI ANALYSIS MODULE */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Semicircle Options PCR Squeeze Ring Gauge */}
          <div className="premium-card p-4 font-mono flex flex-col items-center justify-between h-[230px]">
            <div className="w-full border-b border-[#281e4b]/60 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-[#8b84a3] uppercase font-sans tracking-wider">DERIVATIVES PCR SQUEEZE RING</span>
              <Gauge className="w-4 h-4 text-[#f59e0b]" />
            </div>

            {/* Semicircle SVG Gauge */}
            <div className="relative w-44 h-[92px] mt-2 overflow-hidden shrink-0">
              <svg width="176" height="88" viewBox="0 0 100 50" className="overflow-visible">
                {/* Bearish zone */}
                <path d="M 5 50 A 45 45 0 0 1 30 11" fill="none" stroke="#ef4444" strokeWidth="8" opacity="0.25" />
                {/* Neutral zone */}
                <path d="M 30 11 A 45 45 0 0 1 70 11" fill="none" stroke="#f59e0b" strokeWidth="8" opacity="0.25" />
                {/* Bullish zone */}
                <path d="M 70 11 A 45 45 0 0 1 95 50" fill="none" stroke="#10b981" strokeWidth="8" opacity="0.25" />

                {/* Rotary Pointer needle */}
                <g transform="translate(50, 50)">
                  <line 
                    x1="0" 
                    y1="0" 
                    x2="-40" 
                    y2="0" 
                    stroke="#c084fc" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    transform={`rotate(${pcrRotationDegree})`} 
                    className="transition-transform duration-500 ease-out"
                  />
                  <circle cx="0" cy="0" r="4.5" fill="#f3f4f6" />
                </g>
              </svg>
            </div>

            <div className="text-center w-full mt-1 shrink-0">
              <div className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-1 font-mono">
                PCR Ratio: <span className="text-[#c084fc]">{pcrValue.toFixed(2)}</span>
              </div>
              <div className={`mt-1.5 px-2 py-0.5 rounded text-[9px] font-black tracking-widest border border-dashed flex items-center justify-center gap-1 ${pcrZone.color}`}>
                <Activity className="w-3.5 h-3.5" />
                {pcrZone.label}
              </div>
            </div>
          </div>

          {/* Interactive FII Squeeze Matrix Calibration */}
          <div className="premium-card p-4 font-mono flex flex-col justify-between h-[230px]">
            <div className="border-b border-[#281e4b]/60 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-[#8b84a3] uppercase font-sans tracking-wider">FII SHORT SQUEEZE DETECTOR</span>
              <Sliders className="w-4 h-4 text-[#c084fc]" />
            </div>

            <div className="my-2.5 flex flex-col gap-2.5">
              {/* Interactive calibration parameters */}
              <div>
                <div className="flex justify-between items-center text-[9px] mb-1">
                  <span className="text-gray-400">Trigger Squeeze (shorts &gt; %):</span>
                  <span className="text-[#f59e0b] font-bold font-mono">{squeezePercentTrigger}%</span>
                </div>
                <input 
                  type="range" 
                  min="55" 
                  max="85" 
                  step="1"
                  value={squeezePercentTrigger}
                  onChange={(e) => setSqueezePercentTrigger(parseInt(e.target.value))}
                  className="w-full accent-[#c084fc] bg-[#1a1235] h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Squeeze Alarm Panel */}
              {isSqueezeAlert ? (
                <div className="bg-[#1b0c1e] border border-[#ef4444]/40 p-2.5 rounded flex items-start gap-2 text-[10px] text-gray-300 animate-pulse">
                  <span className="text-[9px] p-1 bg-[#ef4444]/25 text-[#ef4444] rounded shrink-0 font-extrabold uppercase font-mono tracking-tight leading-none animate-bounce mt-0.5">ALARM</span>
                  <div>
                    <span className="font-bold text-white block">SQUEEZE SCENARIO ENGAGED</span>
                    <span className="text-[9px] text-[#847ea1]">FII short accumulation exceeds safety. Price up-tock triggers cascading covers! ({squeezeIntensity}% intensity)</span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0b171a] border border-[#10b981]/30 p-2.5 rounded flex items-start gap-2 text-[10px] text-gray-300">
                  <span className="text-[9px] p-1 bg-[#10b981]/20 text-[#10b981] rounded shrink-0 font-black uppercase font-mono tracking-tight leading-none mt-0.5">SAFE</span>
                  <div>
                    <span className="font-bold text-white block">DISPERSION PROFILE STABLE</span>
                    <span className="text-[9px] text-[#847ea1]">FII options index & futures positioning is non-combustive under safety limit of {squeezePercentTrigger}%.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[9px] text-gray-500 flex items-center gap-1 border-t border-[#231b44] pt-2">
              <HelpCircle className="w-3.5 h-3.5 text-[#c084fc] shrink-0" />
              <span>Squeezes trigger violent index spikes as shorts cover in market lots.</span>
            </div>
          </div>

          {/* FUTURES OI BUILDUP ANALYSIS */}
          <div className="premium-card p-4 font-mono flex flex-col justify-between">
            <div className="border-b border-[#281e4b]/60 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-[#8b84a3] uppercase font-sans tracking-wider">NSE INTRADAY OI BUILDUP DESK</span>
              <Activity className="w-4 h-4 text-[#10b981]" />
            </div>

            <div className="my-2 flex flex-col gap-2">
              <div className={`flex justify-between items-center px-2.5 py-1.5 rounded border ${oiTrendInfo.bgSubtle}`}>
                <div>
                  <span className="text-[9px] text-gray-400 block uppercase font-sans">Open Interest Scale</span>
                  <span className="text-white font-extrabold font-mono block mt-0.5">
                    {(latestTick.oi / 1000000).toFixed(2)}M contracts
                  </span>
                </div>
                <span className={`text-[9px] font-black uppercase ${oiTrendInfo.color} font-mono animate-pulse`}>
                  {oiTrendInfo.label}
                </span>
              </div>

              <p className="text-[10px] text-[#8ca4b0] leading-snug font-sans bg-[#130d2d]/80 p-2 border border-[#2b1f52] rounded">
                {oiTrendInfo.desc} Net oi shifted <span className="text-white font-bold">{(latestTick.oiChange >= 0 ? "+" : "") + latestTick.oiChange.toLocaleString()} contracts</span> under spot tick ₹{latestTick.futures}.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 4. BOTTOM INTERACTIVE TABULATED REGISTRY */}
      <div className="premium-card p-4 font-mono">
        <div className="flex flex-wrap items-center justify-between border-b border-[#281e4b]/60 pb-3 mb-3 gap-3">
          <div>
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Layers className="w-4 h-4 text-[#c084fc]" />
              <span>FII / DII Historical Daily Sweep Registry</span>
            </h4>
            <p className="text-[10px] text-[#8b84a3] font-sans">Filter, query and download standard capital sweeps for backtesting index dynamics.</p>
          </div>

          {/* Table search + section selection triggers */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Date */}
            <input
              type="text"
              placeholder="Search session..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#120a21] border border-[#2b1e52] text-xs text-white rounded px-2.5 py-1.5 outline-none focus:border-[#c084fc] font-mono w-36"
            />

            {/* Segment filter buttons */}
            <div className="flex bg-[#120a21] border border-[#2b1e52] rounded p-0.5 text-[9px] font-bold">
              {(["ALL", "BUYERS", "SELLERS"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveSegmentFile(f)}
                  className={`px-3 py-1 rounded transition-all cursor-pointer ${
                    activeSegmentFile === f 
                      ? "bg-[#2a1a5b] text-[#c084fc] font-black border border-[#50359f]" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The data table */}
        <div className="overflow-x-auto w-full no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[500px] text-[10px]">
            <thead className="bg-[#100a22] border-b border-[#281e4b] text-[#8b84a3] uppercase font-bold text-[9px]">
              <tr>
                <th className="py-2.5 px-3">Session Date</th>
                <th className="py-2.5 px-3">Primary Segment</th>
                <th className="py-2.5 px-3 text-right">FII Cash Net Flow</th>
                <th className="py-2.5 px-3 text-right">DII Cash Net Flow</th>
                <th className="py-2.5 px-3 text-right">Composite Net Sweep</th>
                <th className="py-2.5 px-3 text-center">Desk Sentiment rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#281e4b]/40">
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-sans">
                    No institutional sweeps match query filters. Modify parameters.
                  </td>
                </tr>
              ) : (
                filteredFlows.slice().reverse().map((fItem, idx) => {
                  const absoluteTotalNet = fItem.fii + fItem.dii;
                  const isPositiveFii = fItem.fii >= 0;
                  const isPositiveTotal = absoluteTotalNet >= 0;
                  
                  return (
                    <tr key={idx} className="h-10 hover:bg-[#1a1338]/45 transition-colors">
                      <td className="py-2 px-3 font-bold text-white uppercase">{fItem.date}</td>
                      <td className="py-2 px-3 text-[9px] text-[#8b84a3]">NSE CASH BASKET</td>
                      
                      {/* FII Column with custom red/green class styles */}
                      <td className={`py-2 px-3 text-right font-bold font-mono ${isPositiveFii ? "pnl-profit" : "pnl-loss"}`}>
                        {isPositiveFii ? "+" : ""}{fItem.fii.toLocaleString()} <span className="text-[8px] font-normal text-gray-500">Cr</span>
                      </td>

                      {/* DII Column with custom red/green class styles */}
                      <td className={`py-2 px-3 text-right font-bold font-mono ${fItem.dii >= 0 ? "pnl-profit" : "pnl-loss"}`}>
                        {fItem.dii >= 0 ? "+" : ""}{fItem.dii.toLocaleString()} <span className="text-[8px] font-normal text-gray-500">Cr</span>
                      </td>

                      {/* Composite Column */}
                      <td className={`py-2 px-3 text-right font-extrabold font-mono ${isPositiveTotal ? "pnl-profit" : "pnl-loss"}`}>
                        {isPositiveTotal ? "+" : ""}{absoluteTotalNet.toLocaleString()} <span className="text-[8px] font-normal text-gray-500">Cr</span>
                      </td>
                      
                      {/* Custom desk recommendation badge */}
                      <td className="py-2 px-3 text-center">
                        {absoluteTotalNet > 1200 ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                            STRONG ACCUMULATION
                          </span>
                        ) : absoluteTotalNet < -1200 ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
                            STRONG LIQUIDATION
                          </span>
                        ) : isPositiveTotal ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#10b981]/10 text-emerald-300 border border-[#10b981]/20">
                            STABLE ACCUMULATION
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-[#ef4444]/10 text-rose-300 border border-[#ef4444]/20">
                            STABLE DISTRIBUTION
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
