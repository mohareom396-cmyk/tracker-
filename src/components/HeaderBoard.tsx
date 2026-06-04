import React, { useState, useEffect } from "react";
import { Activity, TrendingUp, Percent, Coins, AlertOctagon, Clock, Play, Pause, Landmark } from "lucide-react";
import { TickData } from "../types";

interface HeaderBoardProps {
  latestTick: TickData;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  capital: number;
}

export const HeaderBoard: React.FC<HeaderBoardProps> = ({
  latestTick,
  isLive,
  setIsLive,
  capital,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [marketOpen, setMarketOpen] = useState<boolean>(true);

  // Maintain real-time clock and calculate the IST market status (9:15 to 15:30)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Format time as HH:MM:SS in 24h
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );

      // Check simple Indian market hours (9:15 to 15:30)
      const hours = now.getHours();
      const mins = now.getMinutes();
      const timeInMins = hours * 60 + mins;
      const openTime = 9 * 60 + 15;
      const closeTime = 15 * 60 + 30;
      
      // Let it remain open in simulation, but display status correctly
      const isWeekDay = now.getDay() !== 0 && now.getDay() !== 6;
      setMarketOpen(isWeekDay && timeInMins >= openTime && timeInMins <= closeTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const spotValue = latestTick.spot;
  const futuresValue = latestTick.futures;
  const fairValueValue = latestTick.fairValue;
  const basisValue = latestTick.basis;
  const mispricingValue = latestTick.mispricing;
  
  const isBasisExtreme = Math.abs(basisValue) > 35;
  const isArbOpportunity = Math.abs(mispricingValue) > 20;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 1. STICKY TOP HEADER */}
      <header className="sticky top-0 z-40 bg-[#0f0a21]/90 backdrop-blur-md border border-[#2b1f54] rounded-lg px-4 py-3 flex flex-wrap md:flex-row items-center justify-between gap-4 shadow-xl shadow-black/40">
        <div className="flex items-center gap-3">
          {/* Live pulsing dot indicators */}
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? "bg-[#10b981]" : "bg-[#f43f5e]"}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? "bg-[#10b981]" : "bg-[#f43f5e]"}`}></span>
          </div>

          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#f3f4f6] flex items-center gap-2 font-mono">
              NIFTY 50 ARBITRAGE INTEL DESK <span className="text-[10px] text-[#cfbcff] font-mono border border-[#52339c]/70 px-1.5 py-0.5 rounded bg-[#1f163b] px-2 shadow">PROP QUANT EDITION</span>
            </h1>
            <p className="text-[9px] text-[#847ea1] tracking-widest font-mono mt-0.5">INSTITUTIONAL HIGH-FREQUENCY CARRY DESK &bull; NSE DERIVATIVES</p>
          </div>
        </div>

        {/* Live controls, Market Status Badge and clock */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Clock Display */}
          <div className="flex items-center gap-1.5 bg-[#17112e] px-3 py-1.5 rounded border border-[#2c1e57] text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-[#a78bfa]" />
            <span className="text-xs text-[#c084fc] font-bold">{currentTime}</span>
          </div>

          {/* Market Open Status Badge */}
          <div className={`px-2.5 py-1.5 rounded border text-[10px] font-black uppercase font-mono tracking-wider flex items-center gap-1 ${
            marketOpen 
              ? "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30" 
              : "bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/30"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? "bg-[#10b981] animate-pulse" : "bg-[#f43f5e]"}`} />
            <span>NSE MARKET: {marketOpen ? "OPEN / IST" : "CLOSED / OUT-OF-HOURS"}</span>
          </div>

          {/* Play/Pause controls */}
          <div className="flex items-center gap-1 bg-[#17112e] border border-[#2c1e57] p-1 rounded-md text-xs">
            <button
              onClick={() => setIsLive(true)}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all text-[10px] font-bold font-mono cursor-pointer ${
                isLive ? "bg-[#10b981]/25 text-[#34d399] border border-[#10b981]/30" : "text-[#7b7593] hover:bg-[#251a44]"
              }`}
              title="Resume Live simulation ticks"
            >
              <Play className="w-3 h-3" />
              <span>LIVE FEED</span>
            </button>
            <button
              onClick={() => setIsLive(false)}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all text-[10px] font-bold font-mono cursor-pointer ${
                !isLive ? "bg-[#f43f5e]/25 text-[#f87171] border border-[#f43f5e]/30" : "text-[#7b7593] hover:bg-[#251a44]"
              }`}
              title="Pause Live simulation ticks"
            >
              <Pause className="w-3 h-3" />
              <span>PAUSE</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. SIX ALWAYS-VISIBLE STAT CARDS */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Nifty Spot */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Nifty 50 Spot</span>
            <Activity className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="my-2.5">
            <div className="text-lg sm:text-l font-black text-[#10b981] font-mono leading-none tracking-tight">
              ₹{spotValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>INDEX BASKET</span>
            <span className="text-[#10b981] font-semibold">TICK-BY-TICK</span>
          </div>
        </div>

        {/* Card 2: Nifty Futures */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Current Futures</span>
            <TrendingUp className={`w-4 h-4 ${futuresValue >= spotValue ? "text-[#10b981]" : "text-[#ef4444]"}`} />
          </div>
          <div className="my-2.5">
            <div className={`text-lg sm:text-l font-black font-mono leading-none tracking-tight ${
              futuresValue >= spotValue ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              ₹{futuresValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>CURR EXP EXPIRY</span>
            <span className={futuresValue >= spotValue ? "text-[#10b981]" : "text-[#ef4444]"}>MUTEXP ACTIVE</span>
          </div>
        </div>

        {/* Card 3: Theor Fair Value */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Theoretical FV</span>
            <Percent className={`w-4 h-4 ${fairValueValue >= spotValue ? "text-[#10b981]" : "text-[#ef4444]"}`} />
          </div>
          <div className="my-2.5">
            <div className={`text-lg sm:text-l font-black font-mono leading-none tracking-tight ${
              fairValueValue >= spotValue ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              ₹{fairValueValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>6.50% CARRY RATIO</span>
            <span className="text-[#10b981]">FAIR VALUE</span>
          </div>
        </div>

        {/* Card 4: Basis */}
        <div className={`premium-card p-3 rounded-lg flex flex-col justify-between transition-all ${
          isBasisExtreme ? "border-[#f43f5e]! shadow-[0_0_15px_rgba(244,63,94,0.15)]" : ""
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Basis Spread (F-S)</span>
            <Coins className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="my-2.5">
            <div className={`text-lg sm:text-l font-black font-mono leading-none tracking-tight ${
              basisValue >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              {basisValue >= 0 ? "+" : ""}
              {basisValue.toFixed(2)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>FUT - SPOT</span>
            <span className={isBasisExtreme ? "text-[#ef4444] font-bold" : "text-[#10b981]"}>
              {isBasisExtreme ? "WIDE SPREAD" : "STANDARD"}
            </span>
          </div>
        </div>

        {/* Card 5: Mispricing */}
        <div className={`premium-card p-3 rounded-lg flex flex-col justify-between transition-all ${
          isArbOpportunity ? "border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse-subtle" : ""
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Theoretical Misprice</span>
            <AlertOctagon className={`w-4 h-4 ${isArbOpportunity ? "text-[#f59e0b]" : "text-[#8b84a3]"}`} />
          </div>
          <div className="my-2.5">
            <div className={`text-lg sm:text-l font-black font-mono leading-none tracking-tight ${
              mispricingValue >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              {mispricingValue >= 0 ? "+" : ""}
              {mispricingValue.toFixed(2)}
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>FUT - FV</span>
            <span className={`font-semibold ${isArbOpportunity ? "text-[#f59e0b]" : "text-[#10b981]"}`}>
              {isArbOpportunity ? "ARB ACTIVE" : "EFFICIENT"}
            </span>
          </div>
        </div>

        {/* Card 6: Implied Carry Rate */}
        <div className="premium-card p-3 rounded-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b84a3] uppercase font-bold tracking-wider font-sans">Implied Carry Rate</span>
            <Landmark className={`w-4 h-4 ${latestTick.impliedCarry >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`} />
          </div>
          <div className="my-2.5">
            <div className={`text-lg sm:text-l font-black font-mono leading-none tracking-tight ${
              latestTick.impliedCarry >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
            }`}>
              {latestTick.impliedCarry.toFixed(2)}%
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#8b84a3] font-mono">
            <span>ANNUALISED YIELD</span>
            <span className={`font-semibold ${latestTick.impliedCarry >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>T+14 SETTL</span>
          </div>
        </div>
      </section>
    </div>
  );
};
