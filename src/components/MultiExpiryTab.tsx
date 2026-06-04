import React, { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { RefreshCw, Calendar, Sparkles, HelpCircle } from "lucide-react";
import { TickData } from "../types";

interface MultiExpiryTabProps {
  history: TickData[];
  latestTick: TickData;
  daysToExpiry: number;
}

export const MultiExpiryTab: React.FC<MultiExpiryTabProps> = ({
  history,
  latestTick,
  daysToExpiry,
}) => {
  const last60Ticks = history.slice(-60);
  const nextExpiryDays = daysToExpiry + 30; // standard 30 day offset

  // Theoretical next month fair value (already defined in master loop base)
  const nextMonthFV = useMemo(() => {
    // Spot * (1 + r * (daysToExpiry+30)/365) - Dividends
    const spot = latestTick.spot;
    const r = 0.065;
    const tNext = nextExpiryDays / 365;
    const divPV = 0.008 * spot * tNext;
    return spot * (1 + r * tNext) - divPV;
  }, [latestTick.spot, nextExpiryDays]);

  // Next Month Basis
  const nextMonthBasis = latestTick.nextFutures - latestTick.spot;
  // Next Month Mispricing
  const nextMonthMispricing = latestTick.nextFutures - nextMonthFV;
  // Next Month Implied Carry %
  const nextMonthImpliedCarry = useMemo(() => {
    const ratio = latestTick.nextFutures / latestTick.spot;
    const exponent = 365 / nextExpiryDays;
    return (Math.pow(ratio, exponent) - 1) * 100;
  }, [latestTick.nextFutures, latestTick.spot, nextExpiryDays]);

  // Assess Optimal Roll Recommendation
  const rollRecommendation = useMemo(() => {
    if (daysToExpiry <= 5) {
      if (latestTick.rollCost < 15) {
        return {
          status: "OPTIMAL WINDOW ACTIVE (HIGH EFFICIENCY)",
          color: "bg-[#39d353]/10 text-[#39d353] border-[#39d353]/35 animate-pulse",
          action: "TRIGGER AUTOMATED ROLLOVER",
          desc: "Days to expiry is ultra critical (<= 5). Futures roll cost of ₹" + latestTick.rollCost.toFixed(2) + " is inside the optimal efficiency bracket. Roll buy spot legs & short next month.",
          level: "HIGH"
        };
      } else {
        return {
          status: "TIME COMPULSION ROLL WINDOW ENFORCED",
          color: "bg-red-500/10 text-[#f85149] border-red-500/20",
          action: "TRIGGER FORCED EXPIRY ROLL",
          desc: "Less than 5 days remaining, but roll spreads are wide. Rollover must execute soon despite un-optimal friction to avoid physical/cash settlement delivery locks.",
          level: "MEDIUM"
        };
      }
    }
    return {
      status: "ROLL WINDOW CLOSED (STABLE ACCUMULATION)",
      color: "bg-[#161b22] text-[#6e7681] border-[#21262d]",
      action: "HOLD CURRENT MONTH CONTRACT",
      desc: "There are still " + daysToExpiry + " days until settlement. Roll costs of ₹" + latestTick.rollCost.toFixed(2) + " are secondary to keeping current contracts saturated.",
      level: "LOW"
    };
  }, [daysToExpiry, latestTick.rollCost]);

  return (
    <div id="content-expiry-spreads" className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* 1. SIDE-BY-SIDE COMPARE & ROLL INSIGHTS (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        
        {/* Table Comparison side by side */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="border-b border-[#21262d] pb-2.5 mb-3 flex items-center justify-between">
            <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Calendar className="w-4 h-4 text-[#bc8cff]" />
              <span>Expiry Contracts Comparison</span>
            </h4>
            <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 py-0.5 rounded uppercase font-black font-sans">MUTEXP COMPARE</span>
          </div>

          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left font-mono">
              <thead className="bg-[#0d1117] text-[#6e7681] text-[9px] uppercase border border-[#21262d] font-sans">
                <tr>
                  <th className="px-2 py-2">CONTRACT ATTR</th>
                  <th className="px-2 py-2 text-right">NEAR MONTH</th>
                  <th className="px-2 py-2 text-right">NEXT MONTH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50 border border-[#21262d] bg-[#0d1117]/10">
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Days to Expiry</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${daysToExpiry <= 5 ? "text-[#f85149]" : "text-[#39d353]"}`}>{daysToExpiry} days</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${nextExpiryDays <= 5 ? "text-[#f85149]" : "text-[#39d353]"}`}>{nextExpiryDays} days</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Futures Price</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.futures >= latestTick.spot ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{latestTick.futures.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.nextFutures >= latestTick.spot ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{latestTick.nextFutures.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Theor Fair Value</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.fairValue >= latestTick.spot ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{latestTick.fairValue.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${nextMonthFV >= latestTick.spot ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{nextMonthFV.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Basis Spread (F-S)</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.basis >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>{latestTick.basis >= 0 ? "+" : ""}{latestTick.basis.toFixed(2)}</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${nextMonthBasis >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>{nextMonthBasis >= 0 ? "+" : ""}{nextMonthBasis.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Theoretical Misprice</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.mispricing >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{latestTick.mispricing.toFixed(2)}</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${nextMonthMispricing >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>₹{nextMonthMispricing.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Implied Carry Rate</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${latestTick.impliedCarry >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>{latestTick.impliedCarry.toFixed(2)}%</td>
                  <td className={`px-2 py-2.5 text-right font-bold ${nextMonthImpliedCarry >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>{nextMonthImpliedCarry.toFixed(2)}%</td>
                </tr>
                <tr className="hover:bg-[#161b22]/70">
                  <td className="px-2 py-2.5 font-bold font-sans text-[#8b949e]">Implied Volatility (IV)</td>
                  <td className="px-2 py-2.5 text-right font-bold text-[#39d353]">13.50%</td>
                  <td className="px-2 py-2.5 text-right font-bold text-[#39d353]">14.15%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Optimal Roll Window Indicator Box */}
        <div className={`border rounded-lg p-4 font-mono flex flex-col gap-3 ${rollRecommendation.color}`}>
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">ROLLOVER ADVISORY MATRIX</span>
            <span className="text-[8px] font-bold bg-[#161b22] border px-1.5 py-0.5 rounded">
              SECTOR CARRY DESK
            </span>
          </div>

          <div>
            <span className="text-[9px] text-[#6e7681] block uppercase font-sans">RECOMMENDED ACTION</span>
            <span className="text-sm font-black uppercase tracking-wide block mt-1 underline">
              {rollRecommendation.action}
            </span>
          </div>

          <p className="text-[10px] text-[#8b949e] leading-relaxed font-sans">
            {rollRecommendation.desc}
          </p>

          <div className="bg-[#030712]/50 border border-[#21262d] p-2 rounded flex flex-col gap-1 text-[9px] text-[#6e7681]">
            <div className="flex justify-between">
              <span>Current Roll Cost:</span>
              <span className="text-[#bc8cff] font-bold">₹{latestTick.rollCost.toFixed(2)} / unit</span>
            </div>
            <div className="flex justify-between">
              <span>Calendar Spread:</span>
              <span>₹{latestTick.calendarSpread.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. CHARTS STACK (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        
        {/* Chart A: Current vs Next Contract pricing */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-[#21262d] pb-2 mb-3">
            <div>
              <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block">Contract Pricing Term Curves</span>
              <span className="text-[9px] text-[#6e7681]">Price overlay displaying Near month futures vs Next month futures</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#bc8cff]" /> NEAR MONTH</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#39d353]" /> NEXT MONTH</span>
            </div>
          </div>

          <div className="w-full h-[185px] text-[9px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last60Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid stroke="#21262d" vertical={false} />
                <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} tickFormatter={(t) => t.substring(3)} />
                <YAxis stroke="#6e7681" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(val) => `₹${Math.round(val)}`} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                <Line type="monotone" dataKey="futures" stroke="#bc8cff" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="nextFutures" stroke="#39d353" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Calendar Spread curve && Roll Cost in mini rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
              Calendar Spread Premium Gap (INR)
            </span>
            <div className="w-full h-[120px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last60Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="calSpreadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#bc8cff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#bc8cff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} tickFormatter={(t) => t.substring(3)} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Area type="monotone" dataKey="calendarSpread" stroke="#bc8cff" fillOpacity={1} fill="url(#calSpreadGrad)" strokeWidth={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
              Theoretical Implied Roll Cost Gap
            </span>
            <div className="w-full h-[120px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last60Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} tickFormatter={(t) => t.substring(3)} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Line type="monotone" dataKey="rollCost" stroke="#f0883e" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
