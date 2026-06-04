import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { Server, TrendingUp, Layers, HelpCircle } from "lucide-react";
import { TickData, OrderBook } from "../types";

interface MicrostructureTabProps {
  history: TickData[];
  orderBook: OrderBook;
}

export const MicrostructureTab: React.FC<MicrostructureTabProps> = ({
  history,
  orderBook,
}) => {
  const last50Ticks = history.slice(-50);

  // Derive simple staircase visual depth ladder
  const combinedLadder = React.useMemo(() => {
    // Intertwined ladder: lists best asks descending first, then bids descending
    const askPart = [...orderBook.asks].reverse().map(a => ({ type: "ASK" as const, price: a.price, qty: a.qty }));
    const bidPart = [...orderBook.bids].map(b => ({ type: "BID" as const, price: b.price, qty: b.qty }));
    return [...askPart, ...bidPart];
  }, [orderBook]);

  const maxLadderQty = React.useMemo(() => {
    return Math.max(...combinedLadder.map(l => l.qty), 1);
  }, [combinedLadder]);

  return (
    <div id="content-microstructure" className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* 1. L2 LADDER & DEPTH (4 cols) */}
      <div className="lg:col-span-4 bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono flex flex-col h-[490px]">
        <div className="border-b border-[#21262d] pb-2.5 mb-3 flex items-center justify-between">
          <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Layers className="w-4 h-4 text-[#58a6ff]" />
            <span>High Density Order Book Ladder</span>
          </h4>
          <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded uppercase font-black font-sans">L2 DEPT</span>
        </div>

        <div className="text-[9px] text-[#6e7681] grid grid-cols-3 uppercase border-b border-[#21262d] pb-1 mb-1 font-bold font-sans">
          <span>VOLUME DEPTH</span>
          <span className="text-center">PRICE STEP (INR)</span>
          <span className="text-right">VOLUME DEPTH</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-[2px] h-[340px]">
          {combinedLadder.map((row, idx) => {
            const isAsk = row.type === "ASK";
            const percentWidth = `${(row.qty / maxLadderQty) * 100}%`;
            
            return (
              <div 
                key={idx} 
                className={`flex justify-between items-center px-2 py-1.5 rounded relative text-[10px] overflow-hidden ${
                  isAsk 
                    ? "text-[#f85149] hover:bg-[#f85149]/5" 
                    : "text-[#39d353] hover:bg-[#39d353]/5"
                }`}
              >
                {/* Visual bar fill background relative to side */}
                {isAsk ? (
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-[#f85149]/5 pointer-events-none rounded transition-all duration-300"
                    style={{ width: percentWidth }}
                  />
                ) : (
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-[#39d353]/5 pointer-events-none rounded transition-all duration-300"
                    style={{ width: percentWidth }}
                  />
                )}

                {/* Left Side (Bids show qty left, Asks show blank) */}
                <span className="z-10 font-sans text-[9px] font-bold">
                  {!isAsk ? `${row.qty} lts` : ""}
                </span>

                {/* Center price step */}
                <span className={`z-10 font-bold ${isAsk ? "text-[#f85149]" : "text-[#39d353]"}`}>
                  ₹{row.price.toFixed(1)}
                </span>

                {/* Right Side (Basks show qty, Bids show blank) */}
                <span className="z-10 font-sans text-right text-[9px] font-bold">
                  {isAsk ? `${row.qty} lts` : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-[#030712] border border-[#21262d] p-2.5 rounded mt-3 text-[9px] text-[#6e7681] leading-relaxed flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
          <span>The order book represents top level-2 orders matched directly on a 500ms ticker clock thread. High volume nodes suggest potential support/resistance points of arbitrage execution.</span>
        </div>
      </div>

      {/* 2. MICROSTRUCTURE CHARTS (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        
        {/* Chart A: VWAP and Spot Overlay */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-[#21262d] pb-2 mb-3">
            <div>
              <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block">VWAP Price Tracking Index Overlay</span>
              <span className="text-[9px] text-[#6e7681]">Tracks the Nifty Spot against VWAP on execution</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#58a6ff]" /> NIFTY SPOT</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#f0883e]" /> VWAP IND</span>
            </div>
          </div>

          <div className="w-full h-[180px] text-[9px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last50Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid stroke="#21262d" vertical={false} />
                <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} />
                <YAxis stroke="#6e7681" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(val) => `₹${Math.round(val)}`} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                <Line type="monotone" dataKey="spot" stroke="#58a6ff" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="vwap" stroke="#f0883e" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Multi Charts Split Row: Bid-Ask Spread & Volume Ticks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart B: Bid-Ask Spread */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
              Bid-Ask Spread Margin (Points)
            </span>
            <div className="w-full h-[130px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last50Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} tickFormatter={(t) => t.substring(3)} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Line type="monotone" dataKey="spread" stroke="#bc8cff" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart C: Volume per tick */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 font-mono">
            <span className="text-[10px] font-black text-[#6e7681] uppercase font-sans tracking-wider block border-b border-[#21262d] pb-2 mb-3">
              Trading volume size per tick (Lots)
            </span>
            <div className="w-full h-[130px] text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last50Ticks} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#21262d" vertical={false} />
                  <XAxis dataKey="time" stroke="#6e7681" tickLine={false} axisLine={false} tickFormatter={(t) => t.substring(3)} />
                  <YAxis stroke="#6e7681" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }} />
                  <Bar dataKey="volume" fill="#39d353" fillOpacity={0.4} stroke="#39d353" strokeWidth={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
