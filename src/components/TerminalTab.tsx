import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceLine } from "recharts";
import { CircleDot, Calculator, Flame, AlertCircle, ShieldCheck, ArrowRightLeft, ShieldAlert, Copy, CornerDownRight, Landmark, Info } from "lucide-react";
import { TickData, OrderBook, ArbPosition } from "../types";

export const calculateRoundTripCosts = (spotPrice: number, futuresPrice: number, qty: number) => {
  const spotTurnover = spotPrice * qty;
  const futuresTurnover = futuresPrice * qty;
  const totalTurnover = spotTurnover + futuresTurnover;

  const brokerage = 40.00; // Flat 40 INR for two sides
  const stt = 0.0001 * futuresTurnover; // 0.01% of futures Sell value
  const exchangeCharges = 0.0000343 * totalTurnover; // ~0.00343% of total turnover
  const sebiCharges = 0.000001 * totalTurnover; // ₹10 per crore
  const stampDuty = 0.000021 * spotTurnover; // 0.002% spot buying leg
  const gst = 0.18 * (brokerage + exchangeCharges + sebiCharges);

  const total = brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst;

  return {
    brokerage,
    stt,
    exchangeCharges,
    gst,
    stampDuty,
    sebiCharges,
    total
  };
};

/**
 * Dedicated memoized calculation function for Net Arbitrage Opportunity.
 * Applies a noise reduction deadband and linear weight decay smoothing
 * based on history to eliminate tick-level jitter during high-volatility spikes.
 */
export const calculateNetArbOpportunity = (
  latestMispricing: number,
  breakEvenMispricing: number,
  history: TickData[],
  useSmoothing: boolean = true,
  smoothingWindow: number = 6,
  deadbandThreshold: number = 0.08
): number => {
  const rawOpp = Math.abs(latestMispricing) - breakEvenMispricing;
  const currentRaw = rawOpp > 0 ? rawOpp : 0;

  if (!useSmoothing || history.length < 2) {
    return parseFloat(currentRaw.toFixed(2));
  }

  // Extract trailing interval history for smoothing
  const windowTicks = history.slice(-smoothingWindow);
  let totalWeightedOpp = 0;
  let weightSum = 0;

  windowTicks.forEach((tick, idx) => {
    const historicalRaw = Math.max(0, Math.abs(tick.mispricing) - breakEvenMispricing);
    // Linearly increase weight for newer ticks
    const weight = idx + 1;
    totalWeightedOpp += historicalRaw * weight;
    weightSum += weight;
  });

  // Incorporate current active tick with the highest weight
  const activeWeight = windowTicks.length + 1;
  totalWeightedOpp += currentRaw * activeWeight;
  weightSum += activeWeight;

  const smoothed = totalWeightedOpp / weightSum;

  // Hysteresis threshold check
  if (smoothed < deadbandThreshold) {
    return 0;
  }

  return parseFloat(smoothed.toFixed(2));
};

interface TerminalTabProps {
  history: TickData[];
  orderBook: OrderBook;
  latestTick: TickData;
  onExecuteManualTrade: (symbol: string, type: "BUY" | "SELL", qty: number, price: number) => void;
  onOpenAutoArbitrage: (side: 'Long Futures' | 'Short Futures', qty: number) => void;
  activePositions: ArbPosition[];
  breachedPositions: ArbPosition[];
  executeLiquidation: (pos: ArbPosition) => void;
  drawdownThreshold: number;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  history,
  orderBook,
  latestTick,
  onExecuteManualTrade,
  onOpenAutoArbitrage,
  activePositions,
  breachedPositions,
  executeLiquidation,
  drawdownThreshold,
}) => {
  const [lots, setLots] = useState<number>(3); // default 3 lots
  const qty = lots * 50;

  // Jitter Filtering states for reducing volatility spikes
  const [useSmoothing, setUseSmoothing] = useState<boolean>(true);
  const [smoothingWindow, setSmoothingWindow] = useState<number>(6);

  // Manual Order Placement state fields
  const [manualInstrument, setManualInstrument] = useState<string>("NIFTY_FUTURES_NEAR");
  const [manualSide, setManualSide] = useState<"BUY" | "SELL">("BUY");
  const [manualQty, setManualQty] = useState<number>(150); // 150 shares default
  const [manualPrice, setManualPrice] = useState<number>(Math.round(latestTick.futures));
  const [activeTooltipPosId, setActiveTooltipPosId] = useState<string | null>(null);

  // Dynamic round-trip cost calculations
  const costs = useMemo(() => {
    return calculateRoundTripCosts(latestTick.spot, latestTick.futures, qty);
  }, [latestTick.spot, latestTick.futures, qty]);

  const breakEvenMispricing = useMemo(() => {
    return parseFloat((costs.total / qty).toFixed(2));
  }, [costs.total, qty]);

  const netOpportunity = useMemo(() => {
    return calculateNetArbOpportunity(
      latestTick.mispricing,
      breakEvenMispricing,
      history,
      useSmoothing,
      smoothingWindow
    );
  }, [latestTick.mispricing, breakEvenMispricing, history, useSmoothing, smoothingWindow]);

  const signalValid = netOpportunity > 0;
  const signalSide = latestTick.mispricing > 0 ? "Short Futures" : "Long Futures";

  // Handle manual order placement dispatch
  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecuteManualTrade(manualInstrument, manualSide, manualQty, manualPrice);
  };

  // Populate manual form with coping leg parameters
  const handleCopyLegParams = (pos: ArbPosition) => {
    setManualInstrument(pos.side === "Long Futures" ? "NIFTY_FUTURES_NEAR" : "NIFTY_SPOT_INDEX");
    setManualQty(pos.qty);
    setManualPrice(Math.round(pos.side === "Long Futures" ? latestTick.futures : latestTick.spot));
    setManualSide(pos.side === "Long Futures" ? "SELL" : "BUY"); // invert side for hedging scale
    setActiveTooltipPosId(null);
  };

  return (
    <div id="content-terminal-view" className="flex flex-col gap-5 w-full">
      {/* Dynamic Critical Drawdown warning */}
      {breachedPositions.length > 0 && (
        <div className="bg-[#2a1415] border-l-4 border-[#f85149] border border-[#f85149]/35 p-3.5 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[#f85149] shrink-0" />
            <div>
              <span className="font-extrabold text-[#f85149] uppercase block tracking-wider font-mono">
                RISK ALARM &mdash; DRAWDOWN DEVIATION LIMIT EXCEEDED
              </span>
              <span className="text-[#6e7681] text-[10px] sm:text-[11px] block mt-0.5 font-mono">
                The active leg model for hedge positions crossed the threshold of -₹{Math.abs(drawdownThreshold).toLocaleString()}. Auto liquidation recommended.
              </span>
            </div>
          </div>
          <div className="flex gap-2 font-mono">
            <button
              onClick={() => executeLiquidation(breachedPositions[0])}
              className="bg-[#f85149] hover:bg-[#b62421] text-[#060a0f] px-3.5 py-1.5 rounded font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer shrink-0"
            >
              AUTO-LIQUIDATE BREACHED LEG
            </button>
          </div>
        </div>
      )}

      {/* TOP ROW SPLIT LAYOUT (60-40) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* LEFT 60%: SYSTEM CHARTS STACK */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          {/* Chart 1: Spot vs Futures vs FairValue */}
          <div className="premium-card rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between border-b border-[#281e4b]/60 pb-2.5 mb-3 gap-2">
              <div>
                <h4 className="font-bold text-xs text-[#f3f4f6] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <CircleDot className="w-3.5 h-3.5 text-[#a78bfa] animate-pulse" />
                  <span>Arbitrage Pricing Index Matrix (90 Ticks)</span>
                </h4>
                <span className="text-[10px] text-[#8b84a3] font-sans">Real-time carry index, monthly futures overlay trackers</span>
              </div>
              
              <div className="flex items-center gap-3 font-mono text-[9px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#38bdf8]" /> SPOT</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#c084fc]" /> FUTURES</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#10b981] stroke-dasharray border border-dashed border-[#10b981]" /> THEO FV</span>
              </div>
            </div>

            <div className="w-full h-[220px] select-none font-mono text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.slice(-90)} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#1f183a" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#847ea1" 
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(t) => t.substring(3)} // MM:SS
                  />
                  <YAxis 
                    stroke="#847ea1" 
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(val) => `₹${Math.round(val)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0c091a", border: "1px solid #281e4b", borderRadius: "6px" }}
                    labelStyle={{ color: "#8b84a3", fontSize: "10px", fontWeight: "bold" }}
                    itemStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <Line type="monotone" dataKey="spot" stroke="#38bdf8" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="futures" stroke="#c084fc" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="fairValue" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Basis + ZScore Area Chart */}
          <div className="premium-card rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between border-b border-[#281e4b]/60 pb-2.5 mb-3 gap-2">
              <div>
                <h4 className="font-bold text-xs text-[#f3f4f6] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#c084fc]" />
                  <span>Basis Spread Premium & Z-Score Tracker</span>
                </h4>
                <span className="text-[10px] text-[#8b84a3] font-sans">Statistical distance from mean carrying equilibrium limits</span>
              </div>
              
              <div className="flex items-center gap-3 font-mono text-[9px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-[#38bdf8]/25 border border-[#38bdf8]/55 rounded-sm" /> BASIS</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-[#f59e0b]/25 border border-[#f59e0b]/55 rounded-sm" /> Z-SCORE</span>
              </div>
            </div>

            <div className="w-full h-[155px] select-none font-mono text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history.slice(-90)} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="basisGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="zscoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f183a" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#847ea1" 
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(t) => t.substring(3)}
                  />
                  <YAxis 
                    stroke="#847ea1" 
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    domain={[-42, 42]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0c091a", border: "1px solid #281e4b", borderRadius: "6px" }}
                  />
                  <ReferenceLine y={20} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3 3" />
                  <ReferenceLine y={-20} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="#281e4b" strokeWidth={1} />
                  <Area type="monotone" dataKey="basis" stroke="#38bdf8" strokeWidth={1.2} fillOpacity={1} fill="url(#basisGrad)" />
                  <Area type="monotone" dataKey="zScore" stroke="#f59e0b" strokeWidth={1} fillOpacity={1} fill="url(#zscoreGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT 40%: ORDER BOOK, ALGO SIGNALS & EXPLORE LIMITS */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          {/* Active Arb Opportunity box */}
          <div className={`border rounded-lg p-3.5 flex flex-col gap-3 font-mono transition-all ${
            signalValid 
              ? "bg-[#10b981]/10 border-[#10b981]/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse-subtle" 
              : "premium-card"
          }`}>
            <div className="flex items-center justify-between border-b border-[#281e4b]/60 pb-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-wider text-[#8b84a3] uppercase font-sans">ACTIVE ARB TRIGGER</span>
                <span className="text-[8px] text-[#847ea1] font-sans font-medium flex items-center gap-1 mt-0.5">
                  Filter: {useSmoothing ? `Smoothed (${smoothingWindow}t)` : "Raw"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Jitter Filter Selector */}
                <button
                  type="button"
                  onClick={() => setUseSmoothing(!useSmoothing)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold border font-mono transition-colors ${
                    useSmoothing 
                      ? "bg-[#a78bfa]/15 text-[#c084fc] border-[#a78bfa]/30 hover:bg-[#a78bfa]/25 cursor-pointer" 
                      : "bg-[#1c1435] text-[#847ea1] border-[#2c1d53] hover:bg-[#251b47] hover:text-[#cfbcff] cursor-pointer"
                  }`}
                  title="Toggle memoized exponential/decay smoothing filter to prevent high-volatility jitter."
                >
                  {useSmoothing ? "⚡ FILTER ON" : "FILTER OFF"}
                </button>
                {signalValid ? (
                  <span className="text-[9px] bg-[#10b981] text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1 animate-pulse font-sans shadow-md">
                    <Flame className="w-3.5 h-3.5 fill-current" /> SPREAD MISMATCH
                  </span>
                ) : (
                  <span className="text-[9px] bg-[#1a1230] text-[#847ea1] border border-[#2c1d53] px-1.5 py-0.5 rounded font-bold font-sans">EFFICIENT DRIFT</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[#8b84a3] block uppercase font-sans">THEO MISPRICING</span>
                <span className={`text-xl font-bold font-mono tracking-tight block ${
                  latestTick.mispricing >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                }`}>
                  {latestTick.mispricing >= 0 ? "+" : ""}₹{latestTick.mispricing.toFixed(2)}
                </span>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] text-[#8b84a3] block uppercase font-sans">NET OPPORTUNITY YIELD</span>
                <span className={`text-xl font-black font-mono tracking-tight block ${
                  signalValid ? "text-[#10b981] animate-pulse" : "text-[#8b84a3]"
                }`}>
                  {signalValid ? `+₹${netOpportunity.toFixed(2)}/u` : "₹0.00"}
                </span>
              </div>
            </div>

            {useSmoothing && (
              <div className="flex items-center justify-between bg-[#150f2e]/60 border border-[#2c1e55] rounded-md px-2 py-1 text-[9px] text-[#847ea1]">
                <span className="font-sans">Compute Jitter Depth</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => setSmoothingWindow(prev => Math.max(2, prev - 1))}
                    disabled={smoothingWindow <= 2}
                    className="w-4 h-4 rounded bg-[#2c1d53] text-white flex items-center justify-center font-bold text-[10px] hover:bg-[#3d2975] disabled:opacity-30 disabled:hover:bg-[#2c1d53] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-[#f59e0b] font-bold">{smoothingWindow} Ticks</span>
                  <button
                    type="button"
                    onClick={() => setSmoothingWindow(prev => Math.min(15, prev + 1))}
                    disabled={smoothingWindow >= 15}
                    className="w-4 h-4 rounded bg-[#2c1d53] text-white flex items-center justify-center font-bold text-[10px] hover:bg-[#3d2975] disabled:opacity-30 disabled:hover:bg-[#2c1d53] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {signalValid ? (
              <div className="bg-[#0b1b1a]/95 border border-[#10b981]/30 rounded p-2.5 text-xs text-[#e6edf3] flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-black text-[#847ea1] font-sans">TACTICAL DEPLOYMENT:</span>
                  <span className="text-[#10b981] font-black text-[10px] uppercase underline tracking-wide">
                    {signalSide === "Short Futures" ? "SHORT FUT + BUY SPOT" : "BUY FUT + SHORT SPOT"}
                  </span>
                </div>
                <p className="text-[9px] text-[#847ea1] leading-relaxed font-sans">
                  The computed basis gap clears the required round-trip carrying friction limit of <span className="text-white font-bold">₹{breakEvenMispricing} per contract leg</span>.
                </p>
                <button
                  onClick={() => onOpenAutoArbitrage(signalSide, lots)}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-black text-[10px] uppercase tracking-wider py-1.5 rounded text-center transition-all cursor-pointer shadow mt-1"
                >
                  EXECUTE SIMULATED CONTRACT
                </button>
              </div>
            ) : (
              <div className="bg-[#120a21]/90 border border-[#2b1b52] rounded p-2 text-[10px] text-[#847ea1] flex items-start gap-1.5 leading-snug font-sans">
                <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0 mt-0.5" />
                <span>
                  Pricing spread is within stable limits. Arbitrage loop is inactive under frictional envelope of ₹{breakEvenMispricing}.
                </span>
              </div>
            )}
          </div>

          {/* Live Order Book Panel */}
          <div className="premium-card rounded-lg p-3.5 flex flex-col gap-2 font-mono">
            <div className="flex items-center justify-between border-b border-[#21262d] pb-2">
              <span className="text-[10px] font-black tracking-wider text-[#6e7681] uppercase font-sans">NIFTY HIGH FREQ ORDERBOOK</span>
              <div className="flex items-center gap-1 text-[9px]">
                <span className={`font-bold bg-[#060a0f] border border-[#21262d] px-1 rounded text-[10px] tracking-tight ${
                  orderBook.spread <= 2 ? "text-[#39d353]" : "text-[#f85149]"
                }`}>
                  Spread: {orderBook.spread.toFixed(1)} pts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[10px]">
              {/* Bid Depth */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-[#6e7681] border-b border-[#21262d] pb-0.5 mb-1 text-center font-sans">BID INDEP (BUYERS)</span>
                {orderBook.bids.map((bid, index) => (
                  <div key={`bid-${index}`} className={`relative flex items-center justify-between px-1.5 py-0.5 rounded ${
                    index === 0 ? "bg-[#39d353]/10 text-[#39d353] font-bold" : "text-[#c9d1d9]"
                  }`}>
                    <span className="z-10 text-[10px]">₹{bid.price.toFixed(1)}</span>
                    <span className="z-10 text-[9px] font-sans text-right">{bid.qty} lts</span>
                  </div>
                ))}
              </div>

              {/* Ask Depth */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-[#6e7681] border-b border-[#21262d] pb-0.5 mb-1 text-center font-sans font-sans">ASK OUTLET (SELLERS)</span>
                {orderBook.asks.map((ask, index) => (
                  <div key={`ask-${index}`} className={`relative flex items-center justify-between px-1.5 py-0.5 rounded ${
                    index === 0 ? "bg-[#f85149]/10 text-[#f85149] font-bold" : "text-[#c9d1d9]"
                  }`}>
                    <span className="z-10 text-[9px] font-sans text-left">{ask.qty} lts</span>
                    <span className="z-10 text-[10px]">₹{ask.price.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calculator inside terminal widgets bar */}
          <div className="premium-card rounded-lg p-3.5 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#21262d] pb-2">
              <span className="text-[10px] font-black tracking-wider text-[#6e7681] uppercase flex items-center gap-1.5 font-sans">
                <Calculator className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>EXPENSE SLIPPAGE ASSESSOR</span>
              </span>
              <div className="flex items-center bg-[#0d1117] border border-[#21262d] rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min="1"
                  max="252"
                  value={lots}
                  onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-8 bg-transparent text-center font-bold text-[#39d353] border-0 outline-none text-[10px]"
                />
                <span className="text-[8px] text-[#6e7681] font-sans font-bold">LOTS</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-[10px] text-[#8b949e]">
              <div className="flex justify-between">
                <span>Total Units Traded</span>
                <span className="text-white font-bold">{qty} shares</span>
              </div>
              <div className="flex justify-between border-t border-[#21262d]/50 pt-1">
                <span>Brokerage Overheads (RT)</span>
                <span className="text-white">₹{costs.brokerage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Federal STT charges</span>
                <span className="text-white">₹{costs.stt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#e6edf3] border-t border-[#21262d]/60 mt-1 pt-1">
                <span>Total Expense Slippage</span>
                <span className="text-[#f85149]">₹{costs.total.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Break-Even Friction Threshold</span>
                <span className="text-[#39d353]">₹{breakEvenMispricing} per contract</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: ACTIVE POSITIONS GRID (60-40 SPLIT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Bottom Left 60%: Open positions registry */}
        <div id="content-dhan" className="lg:col-span-7 xl:col-span-8 premium-card rounded-lg p-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-[#21262d] pb-2.5 mb-3 gap-2">
            <div>
              <h4 className="font-extrabold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <CornerDownRight className="w-4 h-4 text-[#39d353]" />
                <span>Quant Execution Desk &mdash; Active Portfolio Hedges</span>
              </h4>
              <p className="text-[10px] text-[#6e7681] font-sans">L1 carry hedges and pricing legs logged in dynamic memory.</p>
            </div>
            <span className="text-[9px] bg-[#0d1117] border border-[#21262d] text-[#6e7681] font-mono px-2 py-0.5 rounded">
              DRAWDOWN SAFETIES LIMIT: -₹{Math.abs(drawdownThreshold).toLocaleString()}
            </span>
          </div>

          {/* Active Positions Table */}
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#000000]/25 text-[#6e7681] uppercase font-bold border border-[#21262d] font-sans text-[9px]">
                <tr>
                  <th className="px-3 py-2.5">STRATEGY LEG</th>
                  <th className="px-3 py-2.5 text-right">QUANTITY (LOTS)</th>
                  <th className="px-3 py-2.5 text-right uppercase">Avg Entry Price (VWAP)</th>
                  <th className="px-3 py-2.5 text-right font-bold">FLOATING REALTIME PNL</th>
                  <th className="px-3 py-2.5 text-center">ACTION DISPATCH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50 bg-[#0d1117]/10">
                {activePositions.length > 0 ? (
                  activePositions.map((pos) => {
                    const isLongBasis = pos.side === "Long Futures";
                    const isBreached = pos.netPnl <= drawdownThreshold;
                    const isMultiFill = pos.qty > 50 && (pos.fillCount && pos.fillCount > 1);
                    return (
                      <React.Fragment key={pos.id}>
                        <tr className={`h-11 hover:bg-[#161b22]/80 transition-colors ${isBreached ? "bg-[#f85149]/5" : ""}`}>
                          {/* Leg Strategy Tag Column */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white uppercase text-[11px] font-mono">
                                NIFTY_HEDGE_{pos.id.substring(0, 5).toUpperCase()}
                              </span>
                              <span className={`inline-block text-[8px] px-1.5 py-0.5 rounded uppercase font-black font-sans leading-none tracking-wide ${
                                isLongBasis 
                                  ? "bg-[#39d353]/15 text-[#39d353] border border-[#39d353]/25" 
                                  : "bg-[#bc8cff]/15 text-[#bc8cff] border border-[#bc8cff]/25"
                              }`}>
                                {isLongBasis ? "Cash & Carry" : "Reverse Carry"}
                              </span>
                            </div>
                            <span className="text-[8px] text-[#6e7681] mt-0.5 block">Hedge entry time: {pos.entryTime}</span>
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-2.5 text-right text-gray-300">
                            <span className="font-bold">{pos.qty}</span>
                            <span className="text-[9px] text-[#6e7681] block">({pos.qty / 50} contracts)</span>
                          </td>

                          {/* Avg price with volume weighted fills (VWAP column) */}
                          <td className="px-3 py-2.5 text-right text-white">
                            <span className="font-bold">₹{Math.round(pos.entryPriceFutures).toLocaleString()}</span>
                            {isMultiFill ? (
                              <span className="text-[#39d353] text-[9px] font-bold block">
                                (VWAP &bull; {pos.fillCount} fills)
                              </span>
                            ) : (
                              <span className="text-[#6e7681] text-[9px] font-sans block">
                                (Initial standard fill)
                              </span>
                            )}
                          </td>

                          {/* PnL tracker */}
                          <td className={`px-3 py-2.5 text-right font-black ${pos.netPnl >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>
                            <span className="block text-sm">
                              {pos.netPnl >= 0 ? "+" : ""}₹{pos.netPnl.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                            {isBreached && (
                              <span className="text-[#f85149] text-[8px] uppercase font-black tracking-widest animate-pulse inline-flex items-center gap-1">
                                <ShieldAlert className="w-2.5 h-2.5 animate-bounce" /> SENSITIVE DRAWDOWN
                              </span>
                            )}
                          </td>

                          {/* Copy parameters tooltip triggers */}
                          <td className="px-3 py-2.5 text-center relative">
                            <div className="flex items-center justify-center gap-2">
                              {/* Leg Analysis Trigger Button */}
                              <button
                                onClick={() => setActiveTooltipPosId(activeTooltipPosId === pos.id ? null : pos.id)}
                                className="bg-[#21262d] hover:bg-[#30363d] text-gray-300 font-bold font-mono px-2 py-1 rounded text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border border-[#30363d]"
                                title="Leg Analysis options"
                              >
                                <Info className="w-3 h-3 text-[#58a6ff] shrink-0" />
                                <span>LEG INTEL</span>
                              </button>

                              <button
                                onClick={() => executeLiquidation(pos)}
                                className="bg-[#f85149]/15 text-[#f85149] hover:bg-[#f85149] hover:text-[#060a0f] border border-[#f85149]/25 font-bold font-mono px-2 py-1 rounded text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                              >
                                LIQ
                              </button>
                            </div>

                            {/* LEG ANALYSIS POP-UP TOOLTIP (Requirement 3: Copy Leg Params) */}
                            {activeTooltipPosId === pos.id && (
                              <div className="absolute right-3 top-10 z-50 bg-[#0d1117] border border-[#58a6ff]/45 rounded shadow-2xl p-3 w-64 text-left font-mono text-[10px] text-gray-300">
                                <span className="font-extrabold text-[#58a6ff] text-[11px] block uppercase border-b border-[#21262d] pb-1 mb-1.5">
                                  HEDGE COCKPIT SYSTEM ANALYSIS
                                </span>
                                <div className="flex flex-col gap-1 text-[#8b949e] mb-2 font-sans md:leading-relaxed">
                                  <p>
                                    This carry block operates under optimal <span className="text-white font-semibold">T+14 day settle boundaries</span>. The current delta tracking residual margin is <span className="text-[#39d353] font-bold">95%+ efficient</span>.
                                  </p>
                                  <p className="text-[9px] text-[#e3b341]">
                                    Current Net Risk: ₹{Math.abs(pos.netPnl).toLocaleString()} drawdown limit.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLegParams(pos)}
                                  className="w-full bg-[#58a6ff] hover:bg-[#1f6feb] text-black font-black uppercase text-[9px] tracking-wider py-1 rounded text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Leg Params to Manual Form</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[#6e7681]">
                      Desk operational space is clean. Deploy custom lots or tap Active exploit signals to log positions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Right 40%: Order Placement Panel */}
        <div className="lg:col-span-5 xl:col-span-4 premium-card rounded-lg p-4 font-mono flex flex-col justify-between">
          <div className="border-b border-[#21262d] pb-2.5 mb-3.5 flex items-center justify-between">
            <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Landmark className="w-4 h-4 text-yellow-500" />
              <span>Manual Proprietary Order Router</span>
            </h4>
            <span className="text-[8px] text-yellow-500 font-bold border border-yellow-500/20 bg-yellow-500/10 px-1 py-0.5 rounded uppercase font-sans">DESK CONSOLE</span>
          </div>

          <form onSubmit={handleManualOrderSubmit} className="flex flex-col gap-3 font-mono text-[11px]">
            {/* Instrument */}
            <div>
              <label className="text-[9px] text-[#6e7681] uppercase font-bold block mb-1">CONTRACT INSTRUMENT SYMBOL</label>
              <select
                value={manualInstrument}
                onChange={(e) => setManualInstrument(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#21262d] text-white rounded px-2.5 py-2 font-bold focus:border-[#58a6ff] outline-none cursor-pointer"
              >
                <option value="NIFTY_FUTURES_NEAR">NIFTY 50 Near Month Futures (RT-HEDGE)</option>
                <option value="NIFTY_SPOT_INDEX">NIFTY 50 Spot Basket (Direct Equity Index)</option>
              </select>
            </div>

            {/* Price && Shares Quantity row */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-[9px] text-[#6e7681] uppercase font-bold block mb-1">DISPATCH LIMIT PRICE</label>
                <div className="flex bg-[#0d1117] border border-[#21262d] rounded px-1 px-1.5">
                  <span className="text-[#6e7681] py-1.5 px-0.5">₹</span>
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent text-white border-0 outline-none py-1.5 focus:border-0 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-[#6e7681] uppercase font-bold block mb-1">QUANTITY MULTIPLIER (SHARES)</label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={manualQty}
                  onChange={(e) => setManualQty(Math.max(50, parseInt(e.target.value) || 50))}
                  className="w-full bg-[#0d1117] border border-[#21262d] text-white rounded px-2.5 py-2 font-bold focus:border-[#58a6ff] outline-none"
                />
              </div>
            </div>

            {/* Trade Side dispatch Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <button
                type="submit"
                onClick={() => setManualSide("BUY")}
                className={`w-full font-black text-[10px] uppercase tracking-wider py-2 rounded text-center transition-all cursor-pointer block border uppercase ${
                  manualSide === "BUY" 
                    ? "bg-[#39d353] text-[#060a0f] border-[#39d353]/35 font-extrabold" 
                    : "bg-[#0d1117] text-gray-400 border-[#21262d] hover:bg-[#21262d]"
                }`}
              >
                BUY TRANS (LONG SPREAD)
              </button>

              <button
                type="submit"
                onClick={() => setManualSide("SELL")}
                className={`w-full font-black text-[10px] uppercase tracking-wider py-2 rounded text-center transition-all cursor-pointer block border uppercase ${
                  manualSide === "SELL" 
                    ? "bg-[#f85149] text-[#060a0f] border-[#f85149]/35 font-extrabold" 
                    : "bg-[#0d1117] text-gray-400 border-[#21262d] hover:bg-[#21262d]"
                }`}
              >
                SELL TRANS (SHORT SPREAD)
              </button>
            </div>
          </form>

          <p className="text-[9px] text-[#6e7681] leading-relaxed mt-3 pt-2.5 border-t border-[#21262d] font-sans">
            Manual order routing operates under un-hedged parameters. For full system security locks, favor the automated Arbitrage Exploit console.
          </p>
        </div>
      </div>
    </div>
  );
};
