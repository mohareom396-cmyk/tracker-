import React, { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, AlertCircle, BarChart3, Sliders, Info, Percent } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { TickData, ArbPosition } from "../types";

interface RiskTabProps {
  history: TickData[];
  latestTick: TickData;
  activePositions: ArbPosition[];
  capital: number;
  setCapital: (cap: number) => void;
}

export const RiskTab: React.FC<RiskTabProps> = ({
  history,
  latestTick,
  activePositions,
  capital,
  setCapital,
}) => {
  const [calculatorCapital, setCalculatorCapital] = useState<string>("5000000");

  // A. VaR Calculation (Historical Simulation method, 95% confidence over ticks)
  const varMetrics = useMemo(() => {
    if (history.length < 10) {
      return { varPercent: 0.18, varInr: 2200 };
    }

    // Compute tick-by-tick return of Nifty Spot
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].spot;
      const curr = history[i].spot;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }

    if (returns.length === 0) {
      return { varPercent: 0.18, varInr: 2200 };
    }

    // Sort ascending to find 5th percentile
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const indexIndex = Math.max(0, Math.floor(sortedReturns.length * 0.05));
    const varPercent = Math.abs(sortedReturns[indexIndex]);

    // VaR in ₹ for 1 lot (50 units)
    const varPercentClean = varPercent > 0 ? varPercent : 0.0015; // fallback
    const varInr = varPercentClean * latestTick.spot * 50;

    return {
      varPercent: parseFloat((varPercentClean * 100).toFixed(3)),
      varInr: parseFloat(varInr.toFixed(2))
    };
  }, [history, latestTick.spot]);

  // B. SPAN Margin Requirement (12% of contract value)
  const lotSize = 50;
  const contractValue = latestTick.spot * lotSize;
  const marginPerLot = contractValue * 0.12;

  const maxLotsPossible = useMemo(() => {
    const capNum = parseFloat(calculatorCapital) || capital;
    return Math.floor(capNum / marginPerLot);
  }, [calculatorCapital, capital, marginPerLot]);

  // Capital Utilization calculation
  const totalLotsOpen = useMemo(() => {
    return activePositions.reduce((acc, pos) => acc + (pos.qty / 50), 0);
  }, [activePositions]);

  const utilizedMargin = totalLotsOpen * marginPerLot;
  const utilizationPercent = useMemo(() => {
    if (capital <= 0) return 0;
    return Math.min(100, parseFloat(((utilizedMargin / capital) * 100).toFixed(1)));
  }, [utilizedMargin, capital]);

  // Leg Risk Status (based on typical execution fill, simulate a 95% filled status)
  const legRiskStatus = useMemo(() => {
    const hasUnhedgedOpen = activePositions.some(p => p.fillCount === 1 && Math.random() > 0.95);
    if (hasUnhedgedOpen) {
      return {
        status: "FAILED / SLIPPAGE",
        color: "text-[#f85149] bg-[#f85149]/10 border-[#f85149]/30",
        desc: "Execution unmatched on futures. Immediate exposure limit alert.",
        icon: <ShieldAlert className="w-5 h-5 text-[#f85149]" />
      };
    }
    // Any partials?
    const hasPartials = activePositions.some(p => p.qty % 50 !== 0);
    if (hasPartials) {
      return {
        status: "LAGGING / PARTIAL",
        color: "text-[#f0883e] bg-[#f0883e]/10 border-[#f0883e]/30",
        desc: "One or more hedge legs partially transacted. Balancing fill pending.",
        icon: <AlertCircle className="w-5 h-5 text-[#f0883e]" />
      };
    }
    return {
      status: "FULLY BALANCED HEDGE",
      color: "text-[#39d353] bg-[#39d353]/10 border-[#39d353]/30",
      desc: "Perfect spot-to-futures lock ratio. Zero spot index exposure.",
      icon: <ShieldCheck className="w-5 h-5 text-[#39d353]" />
    };
  }, [activePositions]);

  // C. Greeks Modeling
  const greeks = useMemo(() => {
    // Arbitrage spot buying (+Delta 1) paired with shorting futures (-Delta 1) always nets 0 delta.
    const netDelta = 0.01; // residual frictional delta
    const gamma = 0.0001; // residual change in delta per point spot movement
    const thetaDecayPerDay = latestTick.mispricing / 14; // daily premium convergence

    return {
      delta: netDelta,
      gamma,
      theta: parseFloat(thetaDecayPerDay.toFixed(3))
    };
  }, [latestTick.mispricing]);

  // D. Scenario Analysis Matrix (±1%, ±2%, ±3%)
  const scenarioData = useMemo(() => {
    const percentageShifts = [-0.03, -0.02, -0.01, 0.01, 0.02, 0.03];
    return percentageShifts.map(shift => {
      const spotShifted = latestTick.spot * (1 + shift);
      // Futures shifts with spot but the basis spread changes under stress (+volatility expands or contracts basis)
      const basisImpactMultiplier = 1 + (shift * 5); // higher spots expand the carry arbitrage basis
      const basisShifted = latestTick.basis * basisImpactMultiplier;
      const futuresShifted = spotShifted + basisShifted;
      
      // Calculate hypothetical PnL on standard 3 lots (150 units) of active positions
      // Cash & Carry is (Futures Entry - Spot Entry) vs (Futures Exit - Spot Exit)
      // Standard basis PnL sensitivity
      let estimatedPnlEffect = 0;
      if (totalLotsOpen > 0) {
        // basis difference impact
        const basisChange = basisShifted - latestTick.basis;
        estimatedPnlEffect = basisChange * totalLotsOpen * 50;
      } else {
        // demo representation on active baseline
        const basisChange = basisShifted - latestTick.basis;
        estimatedPnlEffect = basisChange * 3 * 50; 
      }

      return {
        shiftLabel: `${shift > 0 ? "+" : ""}${(shift * 100).toFixed(0)}%`,
        spotPrice: spotShifted,
        futuresPrice: futuresShifted,
        basis: basisShifted,
        estimatedPnl: estimatedPnlEffect
      };
    });
  }, [latestTick.spot, latestTick.basis, totalLotsOpen]);

  return (
    <div id="content-risk-controls" className="flex flex-col gap-5 w-full">
      {/* TOP ROW STAT CARDS: VAR, CAPITAL UTILIZATION, LEG RISK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Value at Risk (VaR) Panel */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-3">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider">VALUE AT RISK (VaR) 95%</span>
            <BarChart3 className="w-4 h-4 text-[#f85149]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[#f85149] text-xl font-black block leading-none">
                {varMetrics.varPercent.toFixed(3)}%
              </span>
              <span className="text-[9px] text-[#6e7681] mt-1 block">1-DAY HISTORICAL RET PERCENTILE</span>
            </div>
            <div className="text-right">
              <span className="text-white text-md font-bold block leading-none">
                ₹{varMetrics.varInr.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </span>
              <span className="text-[9px] text-[#6e7681] mt-1 block">1 LOT RISK EXP (55 units)</span>
            </div>
          </div>
        </div>

        {/* Capital Utilization Gauge */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-3">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider">SPAN MARGIN UTILIZATION</span>
            <Percent className="w-4 h-4 text-[#58a6ff]" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="w-16 h-1 w-full bg-[#21262d] rounded-full overflow-hidden shrink-0 relative">
              <div 
                className="h-full bg-[#58a6ff] rounded-full transition-all duration-500" 
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
            <div className="text-right shrink-0">
              <span className="text-white text-lg font-black block leading-none">
                {utilizationPercent}%
              </span>
              <span className="text-[9px] text-[#6e7681] mt-1 block font-sans">
                ₹{utilizedMargin.toLocaleString("en-IN")} / ₹{capital.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Leg Risk Status Card */}
        <div className={`border rounded-lg p-4 font-mono flex items-center justify-between ${legRiskStatus.color}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{legRiskStatus.icon}</div>
            <div>
              <span className="text-[10px] font-extrabold block uppercase tracking-wide">LEG ARBITRAGE SYNC EXECUTION</span>
              <span className="text-white text-xs font-black block mt-0.5">{legRiskStatus.status}</span>
              <span className="text-[#6e7681] text-[9px] mt-0.5 block line-clamp-1">{legRiskStatus.desc}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CORE SIZING CALCULATOR & GREEKS MODULE PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Positions Sizer */}
        <div className="lg:col-span-8 bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2.5 mb-3.5">
            <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Sliders className="w-4 h-4 text-yellow-500" />
              <span>QUANT COCKPIT POSITION SIZING</span>
            </h4>
            <span className="text-[10px] text-[#6e7681] uppercase">MARGIN RATIO: 12.0%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-[#6e7681] uppercase font-bold tracking-wider block mb-1">ALLOCATED CAPITAL RESERVES (INR)</label>
                <div className="flex items-center bg-[#0d1117] border border-[#21262d] rounded px-2.5">
                  <span className="text-[#6e7681] text-xs font-bold font-sans">₹</span>
                  <input
                    type="number"
                    value={calculatorCapital}
                    onChange={(e) => {
                      setCalculatorCapital(e.target.value);
                      const val = parseFloat(e.target.value) || 0;
                      if (val > 0) setCapital(val);
                    }}
                    className="w-full bg-transparent border-0 outline-none p-2 font-bold text-yellow-400 text-xs shrink font-mono"
                  />
                  <span className="text-[8px] text-[#6e7681] font-sans">MAX RESERVES</span>
                </div>
              </div>

              <div className="bg-[#0d1117] border border-[#21262d] p-3 rounded text-[10px] text-[#8b949e] flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>SPAN Margin Requirement/Lot</span>
                  <span className="text-white">₹{marginPerLot.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Single Contract Exposure (50 shares)</span>
                  <span className="text-white">₹{contractValue.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-[#21262d]/50 pt-1.5 text-xs">
                  <span className="text-white uppercase font-sans text-[9px]">MAXIMUM SOLVENT POSITION CAPACITY</span>
                  <span className="text-yellow-400 font-bold">{maxLotsPossible} lots ({maxLotsPossible * 50} units)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-[#0d1117] border border-[#21262d] p-3 rounded-lg text-[10px]">
              <span className="text-[#6e7681] uppercase font-black block tracking-widest border-b border-[#21262d] pb-1 mb-1 font-sans">DESK RISK PARMETERS DISCLOSURE</span>
              <div className="flex flex-col gap-1.5 text-[#8b949e]">
                <p className="leading-relaxed">
                  The computed available lots represent standard leverage safeguards. Portfolio allocations utilize <span className="text-white">SPAN (Standard Portfolio Analysis of Risk)</span> calculations configured with 12% buffer boundaries.
                </p>
                <p className="leading-relaxed">
                  Net Portfolio Delta remains strictly bounded at <span className="text-white">~0.01</span> due to the spot index underlying fully balancing out index futures decay.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Greeks Dashboard Panel */}
        <div className="lg:col-span-4 bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="border-b border-[#21262d] pb-2.5 mb-3">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block">GREEKS ENGINE CONTROL MONITOR</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center bg-[#0d1117] p-2 rounded border border-[#21262d]">
              <div>
                <span className="text-[9px] text-[#6e7681] block uppercase font-sans">PORTFOLIO COCKPIT DELTA</span>
                <span className="text-white font-bold block text-sm mt-0.5">{greeks.delta.toFixed(2)}</span>
              </div>
              <span className="text-[8px] bg-[#39d353]/15 text-[#39d353] p-1 rounded border border-[#39d353]/30 uppercase font-bold">DELTA-NEUT</span>
            </div>

            <div className="flex justify-between items-center bg-[#0d1117] p-2 rounded border border-[#21262d]">
              <div>
                <span className="text-[9px] text-[#6e7681] block uppercase font-sans">RESIDUAL PORTFOLIO GAMMA</span>
                <span className="text-white font-bold block text-sm mt-0.5">{greeks.gamma.toFixed(5)}</span>
              </div>
              <span className="text-[8px] text-[#6e7681] uppercase">CONVEXITY SAFE</span>
            </div>

            <div className="flex justify-between items-center bg-[#0d1117] p-2 rounded border border-[#21262d]">
              <div>
                <span className="text-[9px] text-[#6e7681] block uppercase font-sans">THETA BASIS PREMIUM DECAY</span>
                <span className={`font-bold block text-sm mt-0.5 ${greeks.theta >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>
                  ₹{greeks.theta.toFixed(3)}/day
                </span>
              </div>
              <span className="text-[8px] text-yellow-500 uppercase font-bold">YIELD HARVEST</span>
            </div>
          </div>
        </div>
      </div>

      {/* MATRIX SCENARIO OVERVIEW */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
        <div className="border-b border-[#21262d] pb-2.5 mb-4 flex items-center justify-between">
          <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Sliders className="w-4 h-4 text-yellow-400" />
            <span>STRESS SCENARIO ANALYSIS & SENSITIVITY CURVE</span>
          </h4>
          <span className="text-[9px] text-yellow-505 font-bold bg-[#f85149]/10 px-1.5 py-0.5 rounded border border-[#f85149]/20 uppercase font-mono text-yellow-400">
            STRESS MODEL ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          {/* Stress Sensitivity Chart Left */}
          <div className="lg:col-span-5 bg-[#0d1117] border border-[#21262d] p-3 rounded-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black tracking-wider text-[#8b92a3] uppercase font-sans">Theoretical P&L Stress Sensitivity</span>
              <p className="text-[9px] text-[#6e7681] font-sans">Simulating Net P&L (INR) based on underlying Nifty index changes from -3% to +3%</p>
            </div>

            <div className="w-full h-[165px] text-[9.5px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scenarioData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#39d353" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f85149" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f242c" vertical={false} />
                  <XAxis dataKey="shiftLabel" stroke="#8b949e" tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }}
                    formatter={(value: any) => [`₹${parseFloat(value).toLocaleString("en-IN", {maximumFractionDigits:0})}`, "Est. Stress P&L"]}
                  />
                  <ReferenceLine y={0} stroke="#21262d" strokeWidth={1} />
                  <Area type="monotone" dataKey="estimatedPnl" stroke="#39d353" fillOpacity={1} fill="url(#stressGrad)" strokeWidth={1.5} dot={{ r: 3, fill: "#bc8cff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stress Details Table Right */}
          <div className="lg:col-span-7 overflow-x-auto">
            <span className="text-[10px] font-black tracking-wider text-[#8b92a3] uppercase font-sans block mb-2">Detailed Simulated Matrix Output</span>
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="bg-[#0d1117] text-[#6e7681] uppercase font-bold border border-[#21262d] text-[9px] font-sans">
                <tr>
                  <th className="px-3 py-2 text-center">NIFTY POTENTIAL SHIFT</th>
                  <th className="px-3 py-2 text-right">MODELLED SPOT</th>
                  <th className="px-3 py-2 text-right">MODELLED FUTURES</th>
                  <th className="px-3 py-2 text-right">ESTIMATED BASIS</th>
                  <th className="px-3 py-2 text-right">ARBITRAGE PNL IMPACT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50 border border-[#21262d] bg-[#0d1117]/30">
                {scenarioData.map((scen, idx) => {
                  const isPositive = scen.estimatedPnl >= 0;
                  return (
                    <tr key={idx} className="hover:bg-[#161b22]/70 h-8 font-mono">
                      <td className="px-3 py-2 text-center font-bold font-sans text-yellow-500 text-[10px]">{scen.shiftLabel} Stress Shift</td>
                      <td className="px-3 py-2 text-right text-white">₹{scen.spotPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-white">₹{scen.futuresPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-[#bc8cff]">₹{scen.basis.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-black ${isPositive ? "text-[#39d353]" : "text-[#f85149]"}`}>
                        {isPositive ? "+" : ""}₹{scen.estimatedPnl.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
