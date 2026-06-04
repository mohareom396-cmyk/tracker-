import React, { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { BookOpen, TrendingUp, HelpCircle, Sparkles } from "lucide-react";
import { ArbPosition } from "../types";

interface JournalTabProps {
  positions: ArbPosition[];
}

export const JournalTab: React.FC<JournalTabProps> = ({
  positions,
}) => {
  // Compute analytics from closed positions
  const closedPositions = useMemo(() => {
    return positions.filter(p => p.status === 'CLOSED');
  }, [positions]);

  const metrics = useMemo(() => {
    if (closedPositions.length === 0) {
      return {
        totalNetPnl: 0,
        winRate: 0,
        avgHoldTime: 0,
        bestTrade: 0,
        worstTrade: 0,
        profitFactor: 1.0,
        grossPnl: 0,
        totalCosts: 0
      };
    }

    let grossPnl = 0;
    let totalCosts = 0;
    let netWins = 0;
    let sumHoldTime = 0;
    let bestTrade = -Infinity;
    let worstTrade = Infinity;
    let grossProfits = 0;
    let grossLosses = 0;

    closedPositions.forEach(pos => {
      grossPnl += pos.grossPnl;
      totalCosts += pos.transactionCosts;
      const net = pos.netPnl;
      if (net > 0) {
        netWins++;
        grossProfits += net;
      } else {
        grossLosses += Math.abs(net);
      }

      sumHoldTime += pos.holdingTimeTicks;
      if (net > bestTrade) bestTrade = net;
      if (net < worstTrade) worstTrade = net;
    });

    const totalNetPnl = grossPnl - totalCosts;
    const winRate = (netWins / closedPositions.length) * 100;
    const avgHoldTime = sumHoldTime / closedPositions.length;
    const profitFactor = grossLosses === 0 ? grossProfits : (grossProfits / grossLosses);

    return {
      totalNetPnl,
      winRate,
      avgHoldTime: Math.round(avgHoldTime),
      bestTrade,
      worstTrade: worstTrade === Infinity ? 0 : worstTrade,
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      grossPnl,
      totalCosts
    };
  }, [closedPositions]);

  // Equity Curve data series (cumulative sum over time)
  const equityCurveData = useMemo(() => {
    let cumulative = 0;
    return closedPositions.map((pos, idx) => {
      cumulative += pos.netPnl;
      return {
        tradeIndex: `TS-${idx + 1}`,
        netPnl: pos.netPnl,
        cumulativeNetPnl: cumulative,
        timestamp: pos.exitTime || "N/A"
      };
    });
  }, [closedPositions]);

  // Duration Histogram (putting durations in bins)
  const durationHistogramData = useMemo(() => {
    const bins = {
      "0-10 ticks": 0,
      "11-20 ticks": 0,
      "21-30 ticks": 0,
      "31-40 ticks": 0,
      "41+ ticks": 0
    };

    closedPositions.forEach(pos => {
      const t = pos.holdingTimeTicks;
      if (t <= 10) bins["0-10 ticks"]++;
      else if (t <= 20) bins["11-20 ticks"]++;
      else if (t <= 30) bins["21-30 ticks"]++;
      else if (t <= 40) bins["31-40 ticks"]++;
      else bins["41+ ticks"]++;
    });

    return Object.keys(bins).map(binLabel => ({
      bin: binLabel,
      trades: bins[binLabel as keyof typeof bins]
    }));
  }, [closedPositions]);

  return (
    <div id="content-journal" className="flex flex-col gap-5 w-full">
      {/* PERFORMANCE METRICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {/* Metric 1: Net PnL */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Net Realised Gain</span>
          <span className={`text-base sm:text-lg font-black mt-1 ${metrics.totalNetPnl >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>
            {metrics.totalNetPnl >= 0 ? "+" : ""}₹{metrics.totalNetPnl.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className="text-[8px] text-[#6e7681] mt-0.5 font-sans uppercase">POST-ROUNDS TRADING OVERHEAD</span>
        </div>

        {/* Metric 2: Win Rate */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Win Probability</span>
          <span className="text-base sm:text-lg text-white font-black mt-1">
            {metrics.winRate.toFixed(1)}%
          </span>
          <span className="text-[8px] text-[#6e7681] mt-0.5 font-sans uppercase">{closedPositions.length} CLOSED TRADES</span>
        </div>

        {/* Metric 3: Profit Factor */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Profit Factor Score</span>
          <span className="text-base sm:text-lg text-[#bc8cff] font-black mt-1">
            {metrics.profitFactor}x
          </span>
          <span className="text-[8px] text-[#6e7681] mt-0.5 font-sans uppercase">GROSS PROFIT / LOSS</span>
        </div>

        {/* Metric 4: Avg Hold Time */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Avg Hold Duration</span>
          <span className="text-base sm:text-lg text-yellow-500 font-black mt-1">
            {metrics.avgHoldTime} ticks
          </span>
          <span className="text-[8px] text-[#6e7681] mt-0.5 font-sans uppercase">CONVERGENCE HOLD STEPS</span>
        </div>

        {/* Metric 5: Best Trade */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Extreme Gain Node</span>
          <span className="text-base sm:text-lg text-[#39d353] font-black mt-1">
            +₹{metrics.bestTrade.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[8px] text-[#39d353] mt-0.5 font-sans uppercase">PEAK NET LOT HARVEST</span>
        </div>

        {/* Metric 6: Worst Trade */}
        <div className="bg-[#161b22] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between hover:border-[#30363d] transition-all">
          <span className="text-[9px] text-[#6e7681] uppercase font-sans tracking-wide">Extreme Retrenchment</span>
          <span className={`text-base sm:text-lg font-black mt-1 ${metrics.worstTrade >= 0 ? "text-gray-400" : "text-[#f85149]"}`}>
            {metrics.worstTrade >= 0 ? "+" : ""}₹{metrics.worstTrade.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[8px] text-[#f85149] mt-0.5 font-sans uppercase font-bold">MAX DRAW SLIPPAGE</span>
        </div>
      </div>

      {/* CHARTS ROW (EQ CURVE & HISTOGRAM) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area Chart: Eq Curve */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
            Hedge Account Equity Growth Curve (INR Net PnL)
          </span>
          <div className="w-full h-[160px] text-[9px]">
            {equityCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurveData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#39d353" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#39d353" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="tradeIndex" stroke="#6e7681" tickLine={false} axisLine={false} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Area type="monotone" dataKey="cumulativeNetPnl" stroke="#39d353" fillOpacity={1} fill="url(#colorCumulative)" strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6e7681] text-[10px]">
                No trades documented in journal index. Execute and close an arbitrage opportunity to populate curve.
              </div>
            )}
          </div>
        </div>

        {/* Bar Chart: Hold Time Histogram */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
            Hedge Convergence Hold Time Distribution Index
          </span>
          <div className="w-full h-[160px] text-[9px]">
            {closedPositions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationHistogramData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="bin" stroke="#6e7681" tickLine={false} axisLine={false} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Bar dataKey="trades" fill="#bc8cff" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#6e7681] text-[10px]">
                No closed trades recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED JOURNAL LEDGER TABLE */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
        <div className="border-b border-[#21262d] pb-2.5 mb-3 flex items-center justify-between">
          <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <BookOpen className="w-4 h-4 text-[#58a6ff]" />
            <span>Prop Hedge Ledger Index</span>
          </h4>
          <span className="text-[9px] text-[#6e7681] uppercase">{positions.length} TOTAL POSITIONS RECORDED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0d1117] text-[#6e7681] text-[9px] uppercase border-[#21262d] border font-sans font-extrabold">
              <tr>
                <th className="px-3 py-2.5">CONTRACT DEPLOYMENT ID</th>
                <th className="px-3 py-2.5">STRATEGY TYPE</th>
                <th className="px-3 py-2.5 text-right font-sans">QUANTITY Lots</th>
                <th className="px-3 py-2.5 text-right font-sans">FILL COUNTS</th>
                <th className="px-3 py-2.5 text-right font-sans">ENTRY MISPRICE</th>
                <th className="px-3 py-2.5 text-right font-sans">EXIT MISPRICE</th>
                <th className="px-3 py-2.5 text-right font-sans">OPERATING EXPENSE</th>
                <th className="px-3 py-2.5 text-right">NET REALIZED INR</th>
                <th className="px-3 py-2.5 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]/50 border border-[#21262d] bg-[#0d1117]/10">
              {positions.length > 0 ? (
                positions.map((pos, idx) => {
                  const isCashCarry = pos.side === "Long Futures" || pos.side as string === "Cash & Carry";
                  const netGain = pos.netPnl;
                  const isPositive = netGain >= 0;
                  
                  return (
                    <tr key={pos.id} className="hover:bg-[#161b22]/70 font-mono text-[11px] h-11 transition-colors">
                      <td className="px-3 py-2">
                        <span className="font-extrabold text-[#58a6ff] block uppercase">TS-{pos.id.substring(0,6)}</span>
                        <span className="text-[9px] text-[#6e7681] font-sans block">{pos.entryTime}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                          isCashCarry 
                            ? "bg-[#39d353]/15 text-[#39d353] border border-[#39d353]/25" 
                            : "bg-[#bc8cff]/15 text-[#bc8cff] border border-[#bc8cff]/25"
                        }`}>
                          {isCashCarry ? "Cash & Carry" : "Reverse Carry"}
                        </span>
                        <span className="text-[8px] text-[#6e7681] block mt-0.5 uppercase tracking-wide">{pos.side} leg</span>
                      </td>
                      <td className="px-3 py-2 text-right text-white font-sans">{(pos.qty / 50)} lots</td>
                      <td className="px-3 py-2 text-right text-gray-400 font-sans">{pos.fillCount || 1} &bull; VWAP</td>
                      <td className="px-3 py-2 text-right text-gray-300">₹{pos.entryMispricing.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {pos.status === 'CLOSED' ? `₹${(pos.exitMispricing || 0).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[#f85149]">₹{pos.transactionCosts.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-black ${isPositive ? "text-[#39d353]" : "text-[#f85149]"}`}>
                        {pos.status === 'CLOSED' ? (
                          `${isPositive ? "+" : ""}₹${netGain.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                        ) : (
                          <span className="text-yellow-400 text-[10px] uppercase font-bold tracking-wide animate-pulse inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> UNREALIZED LIQ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block text-[8px] px-1.5 py-0.5 rounded uppercase font-black font-sans leading-none tracking-widest ${
                          pos.status === "OPEN" 
                            ? "bg-[#39d353]/20 text-[#39d353] border border-[#39d353]/40" 
                            : "bg-[#21262d] text-[#6e7681] border border-[#30363d]"
                        }`}>
                          {pos.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-[#6e7681] text-[11px]">
                    No simulated transactions registered in memory. Deploy automated or manual hedges from the Terminal sheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
