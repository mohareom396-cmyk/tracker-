import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ShieldCheck, 
  Scale, 
  Layers, 
  Lock, 
  Unlock, 
  Calculator, 
  Coins, 
  HelpCircle,
  Clock
} from "lucide-react";

interface DhanOrderWindowProps {
  isOpen: boolean;
  onClose: () => void;
  latestTick: {
    spot: number;
    futures: number;
    fairValue: number;
    basis: number;
    mispricing: number;
  };
  simulatedBalance: number;
  tradeMode: "sandbox" | "live";
  isApiConnected: boolean;
  clientId: string;
  onPlaceOrder: (
    type: "BUY" | "SELL",
    symbol: string,
    qty: number,
    price: number,
    orderType: "MARKET" | "LIMIT",
    isAutoTriggered?: boolean,
    bracketConfig?: {
      useBracket: boolean;
      targetPrice: number;
      stopPrice: number;
      isTrailing?: boolean;
      trailingOffset?: number;
    }
  ) => Promise<void>;
}

export function DhanOrderWindow({
  isOpen,
  onClose,
  latestTick,
  simulatedBalance,
  tradeMode,
  isApiConnected,
  clientId,
  onPlaceOrder
}: DhanOrderWindowProps) {
  
  // Form parameters
  const [selectedSymbol, setSelectedSymbol] = useState<string>("NIFTY_JUNE_FUT");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [productType, setProductType] = useState<"MIS" | "NRML" | "MTF">("MIS");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP_LIMIT" | "STOP_MARKET">("MARKET");
  const [quantity, setQuantity] = useState<number>(50); // Nifty default 1 lot = 50
  const [limitPrice, setLimitPrice] = useState<number>(latestTick.futures);
  const [triggerPrice, setTriggerPrice] = useState<number>(latestTick.futures - 10);
  
  // Bracket Order configuration
  const [useBracket, setUseBracket] = useState<boolean>(false);
  const [tpOffsetTicks, setTpOffsetTicks] = useState<number>(20); // 1 tick = 0.05 paisa. 20 ticks = ₹1.00
  const [slOffsetTicks, setSlOffsetTicks] = useState<number>(20);
  const [isTrailingSL, setIsTrailingSL] = useState<boolean>(false);

  // Status simulation
  const [customSlippage, setCustomSlippage] = useState<number>(0.2);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Keep limit price updated to LTP if user is in MARKET or changes symbol
  useEffect(() => {
    if (orderType === "MARKET") {
      const ltp = selectedSymbol === "NIFTY_SPOT_INDEX" ? latestTick.spot : latestTick.futures;
      setLimitPrice(parseFloat(ltp.toFixed(2)));
    }
  }, [selectedSymbol, orderType, latestTick]);

  // Handle auto LTP trigger
  const handleCopyLtp = () => {
    const ltp = selectedSymbol === "NIFTY_SPOT_INDEX" ? latestTick.spot : latestTick.futures;
    setLimitPrice(parseFloat(ltp.toFixed(2)));
    setTriggerPrice(parseFloat((ltp - 5).toFixed(2)));
  };

  // Get current asset LTP
  const currentLtp = useMemo(() => {
    return selectedSymbol === "NIFTY_SPOT_INDEX" ? latestTick.spot : latestTick.futures;
  }, [selectedSymbol, latestTick]);

  // Bracket trigger price values calculations
  const calculatedTpPrice = useMemo(() => {
    const ltp = orderType === "LIMIT" ? limitPrice : currentLtp;
    const tickMultiplier = 0.05;
    const offsetAmt = tpOffsetTicks * tickMultiplier;
    return direction === "BUY" ? ltp + offsetAmt : ltp - offsetAmt;
  }, [direction, limitPrice, currentLtp, orderType, tpOffsetTicks]);

  const calculatedSlPrice = useMemo(() => {
    const ltp = orderType === "LIMIT" ? limitPrice : currentLtp;
    const tickMultiplier = 0.05;
    const offsetAmt = slOffsetTicks * tickMultiplier;
    return direction === "BUY" ? ltp - offsetAmt : ltp + offsetAmt;
  }, [direction, limitPrice, currentLtp, orderType, slOffsetTicks]);

  // Leverage Factor: MIS (Intraday) = 5x leverage, MTF = 4x leverage, NRML = 1x (No Leverage)
  const leverageDivisor = useMemo(() => {
    if (productType === "MIS") return 5;
    if (productType === "MTF") return 4;
    return 1;
  }, [productType]);

  const requiredMargin = useMemo(() => {
    const priceFactor = orderType === "LIMIT" ? limitPrice : currentLtp;
    return (quantity * priceFactor) / leverageDivisor;
  }, [quantity, limitPrice, currentLtp, orderType, leverageDivisor]);

  // Tax and Brokerage fees simulation based on genuine SEBI/GST formulas
  const feesBreakdown = useMemo(() => {
    const priceFactor = orderType === "LIMIT" ? limitPrice : currentLtp;
    const turnover = priceFactor * quantity;

    const brokerage = 20.00; // Dhan broker fee is standard ₹20 per executed trade
    const stt = selectedSymbol === "NIFTY_SPOT_INDEX" ? (direction === "BUY" ? 0.001 * turnover : 0.001 * turnover) : (direction === "SELL" ? 0.000125 * turnover : 0);
    const exchangeCharges = 0.0000343 * turnover; 
    const sebiCharges = 0.000001 * turnover;
    const gst = 0.18 * (brokerage + exchangeCharges + sebiCharges);
    const stampDuty = direction === "BUY" ? 0.00003 * turnover : 0;
    const total = brokerage + stt + exchangeCharges + sebiCharges + gst + stampDuty;

    return {
      brokerage,
      stt,
      exchangeCharges,
      sebiCharges,
      gst,
      stampDuty,
      total
    };
  }, [selectedSymbol, direction, quantity, limitPrice, currentLtp, orderType]);

  const handleTransmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransmitting(true);
    setOrderSuccessMsg(null);

    try {
      // Bracket Config payload mapping
      const bracketConfig = useBracket ? {
        useBracket: true,
        targetPrice: parseFloat(calculatedTpPrice.toFixed(2)),
        stopPrice: parseFloat(calculatedSlPrice.toFixed(2)),
        isTrailing: isTrailingSL,
        trailingOffset: parseFloat((slOffsetTicks * 0.05).toFixed(2))
      } : undefined;

      const orderPriceParam = orderType === "MARKET" ? currentLtp : limitPrice;

      // Submit
      await onPlaceOrder(
        direction,
        selectedSymbol,
        quantity,
        orderPriceParam,
        orderType === "LIMIT" || orderType === "STOP_LIMIT" ? "LIMIT" : "MARKET",
        false, // not auto-triggered
        bracketConfig
      );

      setOrderSuccessMsg(`Successfully executed order loop on the DhanHQ Gateway!`);
      
      // Auto close success notify after 1.5 seconds
      setTimeout(() => {
        setOrderSuccessMsg(null);
      }, 1500);

    } catch (err: any) {
      console.error(err);
    } finally {
      setIsTransmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010409]/80 backdrop-blur-sm select-none">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-[#161b22] border-2 border-[#fada5e]/40 rounded-xl shadow-2xl overflow-hidden font-mono text-xs text-[#c9d1d9]"
      >
        {/* Border Dhan Corporate Style Header */}
        <div className="flex items-center justify-between bg-[#1f242c] p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#fada5e] text-black flex items-center justify-center font-black text-xs shrink-0 select-none">
              D
            </span>
            <div>
              <h3 className="font-extrabold text-[#e6edf3] tracking-wider uppercase text-[12px] flex items-center gap-1.5">
                <span>DhanHQ Professional Order Desk</span>
                <span className="text-[8px] border border-[#3fb950]/40 bg-[#3fb950]/10 text-[#3fb950] px-1.5 py-0.2 rounded font-black tracking-widest uppercase">
                  ACTIVE TERMINAL
                </span>
              </h3>
              <p className="text-[9px] text-[#8b949e]">Authenticated client endpoint tunnel for real-time risk simulation.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#8b949e] hover:text-white hover:bg-[#30363d] p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Ticker Ribbon */}
        <div className="bg-[#0d1117] px-4 py-2 flex items-center justify-between border-b border-[#21262d] text-[10px]">
          <div className="flex items-center gap-4">
            <span className="text-[#8b949e]">
              Future LTP: <span className="font-bold text-white">₹{latestTick.futures.toFixed(2)}</span>
            </span>
            <span className="text-[#8b949e]">
              Spot Index: <span className="font-bold text-white">₹{latestTick.spot.toFixed(2)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse"></span>
            <span className="text-[#3fb950] text-[9px] font-bold">API Latency: 12ms</span>
          </div>
        </div>

        {/* Content Form Body scrollable if tight */}
        <form onSubmit={handleTransmit} className="p-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto no-scrollbar">

          {/* Direction toggle - high contrast buy vs sell */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDirection("BUY");
                setOrderSuccessMsg(null);
              }}
              className={`py-3.5 rounded-lg font-black tracking-widest uppercase text-center border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] ${
                direction === "BUY"
                  ? "bg-[#1f883d]/20 text-[#3fb950] border-[#3fb950]"
                  : "bg-[#0d1117] text-[#8b949e] border-[#30363d] hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-[#3fb950]" />
              <span>BUY (LONG LEG)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDirection("SELL");
                setOrderSuccessMsg(null);
              }}
              className={`py-3.5 rounded-lg font-black tracking-widest uppercase text-center border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] ${
                direction === "SELL"
                  ? "bg-[#da3633]/20 text-[#f85149] border-[#f85149]"
                  : "bg-[#0d1117] text-[#8b949e] border-[#30363d] hover:text-white"
              }`}
            >
              <TrendingDown className="w-4 h-4 text-[#f85149]" />
              <span>SELL (SHORT LEG)</span>
            </button>
          </div>

          {/* Asset Symbol selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#8b949e] font-extrabold pb-1 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#fada5e]" />
                <span>Trading Instrument</span>
              </label>
              <select
                className="w-full bg-[#0d1117] border border-[#30363d] p-2 outline-none focus:border-[#fada5e] rounded text-white font-bold"
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  setOrderSuccessMsg(null);
                }}
              >
                <option value="NIFTY_JUNE_FUT">NSE F&O: NIFTY FUT (LTP: ₹{latestTick.futures.toFixed(1)})</option>
                <option value="NIFTY_SPOT_INDEX">NSE CASH: NIFTY SPOT (LTP: ₹{latestTick.spot.toFixed(1)})</option>
                <option value="HDFCBANK">HDFCBANK Basket (Heavyweight Component)</option>
                <option value="RELIANCE">RELIANCE Corporate Basket (High Vol)</option>
              </select>
            </div>

            {/* Product classification tabs */}
            <div>
              <label className="block text-[10px] text-[#8b949e] font-extrabold pb-1 uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#fada5e]" />
                <span>Dhan Product Class</span>
              </label>
              <div className="grid grid-cols-3 border border-[#30363d] rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProductType("MIS")}
                  className={`py-2 text-[10px] font-extrabold text-center transition-all ${
                    productType === "MIS"
                      ? "bg-[#30363d] text-[#fada5e] font-black border-r border-[#21262d]"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white border-r border-[#21262d]"
                  }`}
                  title="Intraday Square-off (Provides 5x Leverage)"
                >
                  MIS (5x)
                </button>
                <button
                  type="button"
                  onClick={() => setProductType("NRML")}
                  className={`py-2 text-[10px] font-extrabold text-center transition-all ${
                    productType === "NRML"
                      ? "bg-[#30363d] text-[#fada5e] font-black border-r border-[#21262d]"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white border-r border-[#21262d]"
                  }`}
                  title="Carry Forward Delivery (1x Margin requirement)"
                >
                  NRML (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setProductType("MTF")}
                  className={`py-2 text-[10px] font-extrabold text-center transition-all ${
                    productType === "MTF"
                      ? "bg-[#30363d] text-[#fada5e] font-black"
                      : "bg-[#0d1117] text-[#8b949e] hover:text-white"
                  }`}
                  title="Margin Trading Facility (4x Leverage)"
                >
                  MTF (4x)
                </button>
              </div>
            </div>
          </div>

          {/* Quantity Size & Order Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10px] text-[#8b949e] font-extrabold uppercase tracking-wider">
                  Lot Size / Units
                </label>
                <span className="text-[9px] text-gray-500 font-bold">1 Lot = 50</span>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setQuantity(prev => Math.max(50, prev - 50))}
                  className="px-3 py-2 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-xs font-bold text-[#e6edf3] rounded-l"
                >
                  -50
                </button>
                <input 
                  type="number" 
                  value={quantity}
                  step={50}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 50))}
                  className="w-full bg-[#0d1117] border-y border-[#30363d] py-1.5 text-center font-bold font-mono text-[#e6edf3]"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(prev => prev + 50)}
                  className="px-3 py-2 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-xs font-bold text-[#e6edf3] rounded-r"
                >
                  +50
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-[#8b949e] font-extrabold pb-1 uppercase tracking-wider">
                Exchange Order Type
              </label>
              <select
                className="w-full bg-[#0d1117] border border-[#30363d] p-2 outline-none focus:border-[#fada5e] rounded text-white font-bold"
                value={orderType}
                onChange={(e) => {
                  setOrderType(e.target.value as any);
                  setOrderSuccessMsg(null);
                }}
              >
                <option value="MARKET">MARKET ORDER (Instant LTP)</option>
                <option value="LIMIT">LIMIT ORDER (Specified price)</option>
                <option value="STOP_LIMIT">STOP LOSS LIMIT (Triggered Limit)</option>
              </select>
            </div>
          </div>

          {/* Pricing parameters trigger rows depending on order classification */}
          <div className="bg-[#1c2128] border border-[#30363d] p-3 rounded-lg grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center pb-1">
                <label className="block text-[10px] text-[#8b949e] font-extrabold uppercase tracking-wider">
                  Limit Price
                </label>
                {orderType !== "MARKET" && (
                  <button 
                    type="button"
                    onClick={handleCopyLtp}
                    className="text-[9px] text-[#fada5e] hover:underline"
                  >
                    Copy LTP
                  </button>
                )}
              </div>
              <input 
                type="number" 
                step="0.05"
                disabled={orderType === "MARKET"}
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0d1117] border border-[#30363d] p-2 rounded text-white font-bold text-center font-mono focus:border-[#fada5e] disabled:bg-[#161b22] disabled:text-[#8b949e] disabled:border-[#21262d]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#8b949e] font-extrabold pb-1 uppercase tracking-wider">
                Trigger Price
              </label>
              <input 
                type="number" 
                step="0.05"
                disabled={orderType !== "STOP_LIMIT"}
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0d1117] border border-[#30363d] p-2 rounded text-white font-bold text-center font-mono focus:border-[#fada5e] disabled:bg-[#161b22] disabled:text-[#8b949e] disabled:border-[#21262d]"
              />
            </div>
          </div>

          {/* BRACKET ORDER CO/BO CONTROLS */}
          <div className="border border-[#30363d] bg-[#0d1117]/30 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer py-1 text-[#e6edf3] select-none">
              <input
                type="checkbox"
                checked={useBracket}
                onChange={(e) => setUseBracket(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#fada5e]"
              />
              <span className="font-bold text-xs">Add Bracket Profit Target & Stop Loss Levels (CO/BO)</span>
            </label>

            {useBracket && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden flex flex-col gap-3 mt-3 border-t border-[#30363d]/50 pt-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  {/* Take Profit target in ticks */}
                  <div>
                    <div className="flex justify-between items-center pb-1 text-[10px] text-[#8b949e]">
                      <span>Take Profit Offset</span>
                      <span className="font-bold text-[#3fb950]">+{parseFloat((tpOffsetTicks * 0.05).toFixed(2))} INR</span>
                    </div>
                    <div className="flex items-center font-mono">
                      <button
                        type="button"
                        onClick={() => setTpOffsetTicks(prev => Math.max(5, prev - 10))}
                        className="px-2 py-1 bg-[#21262d] border border-[#30363d] text-white hover:bg-[#30363d] rounded-l text-[10px]"
                      >
                        -10t
                      </button>
                      <span className="w-full bg-[#0d1117] border-y border-[#30363d] py-1 text-center font-bold font-mono text-[#e6edf3] text-xs">
                        {tpOffsetTicks} ticks
                      </span>
                      <button
                        type="button"
                        onClick={() => setTpOffsetTicks(prev => prev + 10)}
                        className="px-2 py-1 bg-[#21262d] border border-[#30363d] text-white hover:bg-[#30363d] rounded-r text-[10px]"
                      >
                        +10t
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1 text-center font-mono">Target LTP: ₹{calculatedTpPrice.toFixed(2)}</p>
                  </div>

                  {/* Stop Loss target in ticks */}
                  <div>
                    <div className="flex justify-between items-center pb-1 text-[10px] text-[#8b949e]">
                      <span>Stop Loss Offset</span>
                      <span className="font-bold text-[#f85149]">-{parseFloat((slOffsetTicks * 0.05).toFixed(2))} INR</span>
                    </div>
                    <div className="flex items-center font-mono">
                      <button
                        type="button"
                        onClick={() => setSlOffsetTicks(prev => Math.max(5, prev - 10))}
                        className="px-2 py-1 bg-[#21262d] border border-[#30363d] text-white hover:bg-[#30363d] rounded-l text-[10px]"
                      >
                        -10t
                      </button>
                      <span className="w-full bg-[#0d1117] border-y border-[#30363d] py-1 text-center font-bold font-mono text-[#e6edf3] text-xs">
                        {slOffsetTicks} ticks
                      </span>
                      <button
                        type="button"
                        onClick={() => setSlOffsetTicks(prev => prev + 10)}
                        className="px-2 py-1 bg-[#21262d] border border-[#30363d] text-white hover:bg-[#30363d] rounded-r text-[10px]"
                      >
                        +10t
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1 text-center font-mono">Stop LTP: ₹{calculatedSlPrice.toFixed(2)}</p>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer py-1 font-mono text-[9px] text-[#8b949e] select-none">
                  <input
                    type="checkbox"
                    checked={isTrailingSL}
                    onChange={(e) => setIsTrailingSL(e.target.checked)}
                    className="w-3 h-3 rounded accent-[#fada5e]"
                  />
                  <span>Inject Trailing SL (automatically raises stop level matching tick direction strength)</span>
                </label>
              </motion.div>
            )}
          </div>

          {/* TELEMETRY LEDGER STATS: Required Margin, Broking fees */}
          <div className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] flex flex-col gap-2 font-mono">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-[#21262d]">
              <span className="text-[#8b949e] font-extrabold uppercase tracking-wide flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#fada5e]" />
                <span>Estimate Margin Ledger</span>
              </span>
              <span className="text-[10px] text-gray-500">
                Type: {productType} {productType === 'MIS' ? '(5x Leveraged)' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-gray-400">Total Contract Value:</span>
                <span className="text-[#e6edf3] font-bold">
                  ₹{(quantity * (orderType === "LIMIT" ? limitPrice : currentLtp)).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[#fada5e] font-bold">Required Margin (Dhan):</span>
                <span className="text-[#3fb950] font-black text-sm">
                  ₹{requiredMargin.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>

            {/* Custom fees breakdown collapsible panel */}
            <div className="mt-1 pb-1 border-t border-[#30363d]/50 pt-2 text-[10px] text-gray-400 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Dhan Brokerage Charges:</span>
                <span className="text-white">₹{feesBreakdown.brokerage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Securities Transaction Tax (STT):</span>
                <span className="text-white">₹{feesBreakdown.stt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Exchange Transaction Fees + GST (18%):</span>
                <span className="text-white">₹{(feesBreakdown.exchangeCharges + feesBreakdown.gst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold border-t border-[#21262d] mt-1 pt-1 text-gray-300">
                <span>Total Roundtrip Taxes & Duties:</span>
                <span className="text-[#f0883e]">₹{feesBreakdown.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Simulated Balance check indicator */}
            <div className="text-[9px] flex items-center justify-between text-[#8b949e] mt-1 pt-1.5 border-t border-[#21262d]">
              <span>Simulated Balance Available: ₹{simulatedBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              {simulatedBalance < requiredMargin ? (
                <span className="text-[#f85149] font-black uppercase">⚠️ Margin Deficit</span>
              ) : (
                <span className="text-[#3fb950] font-bold">✓ Capital Adequate</span>
              )}
            </div>
          </div>

          {/* SUCCESS NOTIFICATION / STATUS INFO BLOCK */}
          {orderSuccessMsg && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="bg-[#242b20] border border-[#3fb950]/40 p-2.5 rounded text-[11px] text-[#3fb950] flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{orderSuccessMsg}</span>
            </motion.div>
          )}

          {/* ACTION BUTTON WITH LOADER */}
          <button
            type="submit"
            disabled={isTransmitting || simulatedBalance < requiredMargin}
            className={`w-full py-3.5 rounded-lg font-black text-xs uppercase shadow-xl tracking-widest cursor-pointer transition-all border flex items-center justify-center gap-2 ${
              simulatedBalance < requiredMargin
                ? "bg-[#21262d] border-[#30363d] text-gray-500 cursor-not-allowed"
                : direction === "BUY"
                  ? "bg-[#2ea44f] hover:brightness-110 text-white border-[#2ea44f] hover:shadow-green-950/20"
                  : "bg-[#da3633] hover:brightness-110 text-white border-[#da3633] hover:shadow-red-950/20"
            }`}
          >
            {isTransmitting ? (
              <>
                <Zap className="w-4 h-4 animate-spin text-yellow-400" />
                <span>Transmitting Order to Dhan Gateway...</span>
              </>
            ) : (
              <>
                <Zap className={`w-4 h-4 ${direction === "BUY" ? "text-green-300" : "text-red-300"}`} />
                <span>
                  Transmit {direction} {productType} {quantity} Shares @ {orderType === "MARKET" ? "LTP" : `₹${limitPrice}`}
                </span>
              </>
            )}
          </button>

          {/* Short-cut description for pro fidelity feeling */}
          <div className="text-[10px] text-[#8b949e] text-center font-sans tracking-wide">
            Your execution is routed directly into the local state portfolio ledger instantly.
          </div>

        </form>
      </motion.div>
    </div>
  );
}
