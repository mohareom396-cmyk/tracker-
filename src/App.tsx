import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NIFTY_50_STOCKS } from "./data/stocks";
import { TickData, FiiDiiFlow, StockState, AlertItem, ArbPosition, OrderBook } from "./types";
import { HeaderBoard } from "./components/HeaderBoard";
import { TerminalTab, calculateRoundTripCosts } from "./components/TerminalTab";
import { RiskTab } from "./components/RiskTab";
import { MicrostructureTab } from "./components/MicrostructureTab";
import { FlowsTab } from "./components/FlowsTab";
import { MultiExpiryTab } from "./components/MultiExpiryTab";
import { StocksTab } from "./components/StocksTab";
import { JournalTab } from "./components/JournalTab";
import { AlertsTab } from "./components/AlertsTab";
import { DhanExecutionConsole } from "./components/DhanExecutionConsole";
import { MarketHeatmap } from "./components/MarketHeatmap";

// -------------------------------------------------------------
// HELPER: Generate historical tick history (252 ticks for stable VaR)
// -------------------------------------------------------------
const generateHistoricalTicks = (count: number): TickData[] => {
  const ticks: TickData[] = [];
  let currentSpot = 22485.40;
  let currentOI = 12450000;
  let currentPCR = 1.05;
  let currentVolumeRoll = 4500000;
  let currentValueSum = 22485.40 * currentVolumeRoll;

  const now = new Date();
  const DAYS_TO_EXPIRY = 14;
  const nextExpiryDays = DAYS_TO_EXPIRY + 30;
  const RFR = 0.065; // 6.5% Risk Free Rate

  for (let i = count - 1; i >= 0; i--) {
    // Generate tick times in past (1 second interval)
    const tickTime = new Date(now.getTime() - i * 1000);
    const timeStr = tickTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    // Random walk around 22500
    const spotChange = (Math.random() - 0.5) * 8;
    const drift = (22500 - currentSpot) * 0.01; 
    currentSpot = currentSpot + spotChange + drift;

    const tNear = DAYS_TO_EXPIRY / 365;
    const tNext = nextExpiryDays / 365;
    const fairValue = currentSpot * (1 + RFR * tNear) - (0.008 * currentSpot * tNear);
    const fairValueNext = currentSpot * (1 + RFR * tNext) - (0.008 * currentSpot * tNext);

    // Periodic waves for mispricing to guarantee historical opportunities
    const mispricingWave = Math.sin(i / 12) * 12 + Math.cos(i / 25) * 6;
    const noise = (Math.random() - 0.5) * 6;
    const mispricing = mispricingWave + noise;
    const mispricingNext = mispricingWave * 1.1 + (Math.random() - 0.5) * 8;

    const futures = fairValue + mispricing;
    const nextFutures = fairValueNext + mispricingNext;

    const basis = futures - currentSpot;
    const nextBasis = nextFutures - currentSpot;
    const theoreticalBasis = fairValue - currentSpot;

    const impliedCarry = ((Math.pow(futures / currentSpot, 365 / DAYS_TO_EXPIRY)) - 1) * 100;
    const calendarSpread = nextFutures - futures;
    const rollCost = calendarSpread - (fairValueNext - fairValue);

    const dfOI = Math.round((Math.random() - 0.5) * 16000);
    currentOI += dfOI;

    const oiTrend = dfOI >= 0 
      ? (mispricing >= 0 ? "long_buildup" : "short_buildup")
      : (mispricing >= 0 ? "short_covering" : "long_unwinding");

    currentPCR = Math.max(0.4, Math.min(1.8, currentPCR + (Math.random() - 0.5) * 0.015));
    const tickVol = Math.round(1500 + Math.random() * 5500);

    currentVolumeRoll += tickVol;
    currentValueSum += (currentSpot * tickVol);
    const vwap = currentValueSum / currentVolumeRoll;

    const spread = parseFloat((0.5 + Math.random() * 1.5).toFixed(1));
    const zScore = parseFloat((mispricing / 10).toFixed(2));

    ticks.push({
      time: timeStr,
      spot: parseFloat(currentSpot.toFixed(2)),
      futures: parseFloat(futures.toFixed(2)),
      nextFutures: parseFloat(nextFutures.toFixed(2)),
      fairValue: parseFloat(fairValue.toFixed(2)),
      nextFairValue: parseFloat(fairValueNext.toFixed(2)),
      basis: parseFloat(basis.toFixed(2)),
      nextBasis: parseFloat(nextBasis.toFixed(2)),
      theoreticalBasis: parseFloat(theoreticalBasis.toFixed(2)),
      mispricing: parseFloat(mispricing.toFixed(2)),
      impliedCarry: parseFloat(impliedCarry.toFixed(2)),
      zScore,
      calendarSpread: parseFloat(calendarSpread.toFixed(2)),
      rollCost: parseFloat(rollCost.toFixed(2)),
      oi: currentOI,
      oiChange: dfOI,
      oiTrend,
      pcr: parseFloat(currentPCR.toFixed(2)),
      volume: tickVol,
      vwap: parseFloat(vwap.toFixed(2)),
      spread
    });
  }
  return ticks;
};

// -------------------------------------------------------------
// HELPER: Initial FII/DII Cash Flow History
// -------------------------------------------------------------
const generateFiiDiiFlows = (): FiiDiiFlow[] => {
  const data: FiiDiiFlow[] = [];
  const now = new Date();
  let cumulative = 5200;

  for (let i = 19; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const fii = Math.round((Math.random() - 0.44) * 2600);
    const dii = Math.round((Math.random() - 0.32) * 1900);
    const net = fii + dii;
    cumulative += net;

    data.push({
      date: dateStr,
      fii,
      dii,
      net,
      cumulative5Day: cumulative
    });
  }
  return data;
};

// -------------------------------------------------------------
// HELPER: Initial Alerts Seed
// -------------------------------------------------------------
const generateInitialAlerts = (): AlertItem[] => {
  const alerts: AlertItem[] = [];
  const now = new Date();

  alerts.push({
    id: "alert-ini-1",
    timestamp: new Date(now.getTime() - 4 * 60 * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type: "OVERPRICED",
    mispricing: 24.85,
    zScore: 2.48,
    netOpportunity: 19.35,
    transactionCost: 5.50,
    recommendedAction: "SELL FUTURES_NEAR + BUY SPOT INDEX",
    spot: 22485.00,
    futures: 22530.00
  });

  alerts.push({
    id: "alert-ini-2",
    timestamp: new Date(now.getTime() - 10 * 60 * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type: "UNDERPRICED",
    mispricing: -21.40,
    zScore: -2.14,
    netOpportunity: 15.90,
    transactionCost: 5.50,
    recommendedAction: "BUY FUTURES_NEAR + SHORT SPOT INDEX",
    spot: 22510.00,
    futures: 22495.00
  });

  return alerts;
};

export default function App() {
  // Configured with Active Navigation and Previous Version Views (Dhan Auto-Pilot, Sector Heatmap Treemap)
  const [activeTab, setActiveTab] = useState<"TERMINAL" | "RISK" | "MICROSTRUCTURE" | "FLOWS" | "MULTI-EXPIRY" | "STOCKS" | "JOURNAL" | "ALERTS" | "DHAN_PILOT" | "SECTOR_TREEMAP">("TERMINAL");
  
  const [isLive, setIsLive] = useState<boolean>(true);
  const [capital, setCapital] = useState<number>(5000000); // 50 Lakhs available INR capital
  const [drawdownThreshold, setDrawdownThreshold] = useState<number>(-15000); // -15,000 INR liquidation alert barrier

  const [history, setHistory] = useState<TickData[]>(() => generateHistoricalTicks(252));
  const [flows, setFlows] = useState<FiiDiiFlow[]>(() => generateFiiDiiFlows());
  const [alerts, setAlerts] = useState<AlertItem[]>(() => generateInitialAlerts());
  const [positions, setPositions] = useState<ArbPosition[]>([]); // active + closed trades ledger

  // Counter to calculate volatility spikes every ~40 ticks
  const tickCounterRef = useRef<number>(0);

  // Maintain Live Level 2 Bid/Ask Order Book (Refreshed asynchronously every 500ms)
  const [orderBook, setOrderBook] = useState<OrderBook>({
    bids: [],
    asks: [],
    spread: 1.2,
    spreadPercent: 0.005,
  });

  const latestTick = useMemo(() => {
    return history[history.length - 1] || {
      time: "00:00:00", spot: 22500, futures: 22515, nextFutures: 22550,
      fairValue: 22502.5, nextFairValue: 22538, basis: 15, nextBasis: 50,
      theoreticalBasis: 2.5, mispricing: 12.5, impliedCarry: 6.5, zScore: 1.2,
      calendarSpread: 35, rollCost: 1.5, oi: 12450000, oiChange: 5000,
      oiTrend: 'long_buildup', pcr: 1.05, volume: 3000, vwap: 22501, spread: 1.2
    };
  }, [history]);

  // Nifty Stocks State
  const [stocks, setStocks] = useState<StockState[]>(() => {
    return NIFTY_50_STOCKS.map((s) => {
      const initialChange = parseFloat((Math.random() * 3 - 1.2).toFixed(2));
      const buyQty = Math.max(5, Math.round(s.weight * 120));
      const initialPrice = parseFloat((s.basePrice * (1 + initialChange / 100)).toFixed(2));
      const vol = Math.round(452000 + Math.random() * 3500000);
      return {
        symbol: s.symbol,
        name: s.name,
        weight: s.weight,
        price: initialPrice,
        changePercent: initialChange,
        contribution: parseFloat((initialChange * s.weight * 0.12).toFixed(2)),
        buyQty,
        totalValue: parseFloat((initialPrice * buyQty).toFixed(2)),
        volume: vol,
        sector: s.sector
      };
    });
  });

  // -------------------------------------------------------------
  // PRIMARY MASTER SIMULATION: 1000ms MASTER TICK CLOCK
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      tickCounterRef.current += 1;
      
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        
        // 1. Spot Price: walk ±15. Volatility spikes every ~40 ticks
        let spotChange = (Math.random() - 0.5) * 14;
        if (tickCounterRef.current % 40 === 0) {
          // news spike event
          const spikeDir = Math.random() > 0.5 ? 1 : -1;
          spotChange += (spikeDir * 80);
        }
        
        // light index mean-reversion pull
        const drift = (22500 - last.spot) * 0.02;
        const nextSpot = parseFloat((last.spot + spotChange + drift).toFixed(2));

        // 2. Fair Value metrics
        const DAYS_TO_EXPIRY = 14;
        const nextExpiryDays = DAYS_TO_EXPIRY + 30;
        const RFR = 0.065;
        const fvNear = nextSpot * (1 + RFR * (DAYS_TO_EXPIRY / 365)) - (0.008 * nextSpot * (DAYS_TO_EXPIRY / 365));
        const fvNext = nextSpot * (1 + RFR * (nextExpiryDays / 365)) - (0.008 * nextSpot * (nextExpiryDays / 365));

        // 3. Futures overlays with wave noise
        const wave = Math.sin(tickCounterRef.current / 12) * 14;
        const noiseNear = (Math.random() - 0.5) * 18;
        const noiseNext = (Math.random() - 0.5) * 22;

        const nextFuturesNear = parseFloat((fvNear + wave + noiseNear).toFixed(2));
        const nextFuturesNext = parseFloat((fvNext + wave * 1.15 + noiseNext).toFixed(2));

        const basisNear = parseFloat((nextFuturesNear - nextSpot).toFixed(2));
        const basisNext = parseFloat((nextFuturesNext - nextSpot).toFixed(2));
        const theoreticalBasis = parseFloat((fvNear - nextSpot).toFixed(2));

        const mispricingNear = parseFloat((nextFuturesNear - fvNear).toFixed(2));
        const impliedCarry = parseFloat((((Math.pow(nextFuturesNear / nextSpot, 365 / DAYS_TO_EXPIRY)) - 1) * 100).toFixed(2));

        const calendarSpread = parseFloat((nextFuturesNext - nextFuturesNear).toFixed(2));
        const rollCost = parseFloat((calendarSpread - (fvNext - fvNear)).toFixed(2));

        // 4. Time logs
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

        // 5. Open Interest accumulation
        const dOI = Math.round((Math.random() - 0.5) * 18000);
        const nextOI = Math.max(8000000, last.oi + dOI);
        const oiTrend = dOI >= 0 
          ? (mispricingNear >= 0 ? 'long_buildup' : 'short_buildup')
          : (mispricingNear >= 0 ? 'short_covering' : 'long_unwinding');

        // PCR
        const nextPCR = Math.max(0.4, Math.min(1.8, parseFloat((last.pcr + (Math.random() - 0.5) * 0.02).toFixed(2))));
        
        // Ticks volumes
        const tickVol = Math.round(1800 + Math.random() * 5900);
        const nextVolRoll = last.volume + tickVol;
        const nextVwap = parseFloat(((last.vwap * last.volume + nextSpot * tickVol) / nextVolRoll).toFixed(2));

        const spread = parseFloat((0.5 + Math.random() * 1.5).toFixed(1));
        const zScore = parseFloat((mispricingNear / 10).toFixed(2));

        // 6. Push Live Alert organically based on mispricing thresholds (₹20 absolute)
        const mispricingAbs = Math.abs(mispricingNear);
        if (mispricingAbs > 20 && Math.random() > 0.75) {
          const type = mispricingNear > 0 ? "OVERPRICED" : "UNDERPRICED";
          const action = type === "OVERPRICED" ? "SELL FUTURES_NEAR + BUY SPOT INDEX" : "BUY FUTURES_NEAR + SHORT SPOT INDEX";
          const costsSingle = calculateRoundTripCosts(nextSpot, nextFuturesNear, 150);
          const breakEven = parseFloat((costsSingle.total / 150).toFixed(2));
          const netOpp = parseFloat((mispricingAbs - breakEven).toFixed(2));

          const newAlert: AlertItem = {
            id: `alert-live-${Date.now()}`,
            timestamp: timeStr,
            type,
            mispricing: mispricingNear,
            zScore,
            netOpportunity: netOpp > 0 ? netOpp : 0,
            transactionCost: breakEven,
            recommendedAction: action,
            spot: nextSpot,
            futures: nextFuturesNear
          };

          setAlerts(prevA => [newAlert, ...prevA].slice(0, 60));
        }

        // 7. Update Nifty Component stocks
        setStocks(prevStocks => {
          const idxReturn = ((nextSpot - last.spot) / last.spot) * 100;
          return prevStocks.map(stock => {
            const beta = 0.82 + (stock.weight / 15);
            const deviation = (Math.random() - 0.5) * 0.35;
            const pricingChange = (idxReturn * beta) + deviation;

            const nextPrice = parseFloat((stock.price * (1 + pricingChange / 100)).toFixed(2));
            const changePercent = parseFloat((stock.changePercent + pricingChange).toFixed(2));
            const contrib = parseFloat((changePercent * stock.weight * 0.12).toFixed(2));

            return {
              ...stock,
              price: nextPrice,
              changePercent,
              contribution: contrib,
              volume: stock.volume + Math.round(15000 + Math.random() * 20000),
              totalValue: parseFloat((nextPrice * stock.buyQty).toFixed(2))
            };
          });
        });

        // 8. Drift flows slightly looking active
        setFlows(prevF => {
          const updated = [...prevF];
          if (updated.length > 0) {
            const lastRow = { ...updated[updated.length - 1] };
            lastRow.fii += Math.round((Math.random() - 0.5) * 45);
            lastRow.dii += Math.round((Math.random() - 0.5) * 35);
            lastRow.net = lastRow.fii + lastRow.dii;
            updated[updated.length - 1] = lastRow;
          }
          return updated;
        });

        // Combine history timeline (keep last 252 for stats)
        const nextTicks = [...prev, {
          time: timeStr,
          spot: nextSpot,
          futures: nextFuturesNear,
          nextFutures: nextFuturesNext,
          fairValue: parseFloat(fvNear.toFixed(2)),
          nextFairValue: parseFloat(fvNext.toFixed(2)),
          basis: basisNear,
          nextBasis: basisNext,
          theoreticalBasis,
          mispricing: mispricingNear,
          impliedCarry,
          zScore,
          calendarSpread,
          rollCost,
          oi: nextOI,
          oiChange: dOI,
          oiTrend,
          pcr: nextPCR,
          volume: nextVolRoll,
          vwap: nextVwap,
          spread
        }];

        return nextTicks.slice(-252);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  // -------------------------------------------------------------
  // SECONDARY BOOK SIMULATOR: 500ms ORDERBOOK FEED CLOCK
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const futures = latestTick.futures;
      const spread = parseFloat((0.4 + Math.random() * 1.1).toFixed(1));
      
      const bids: OrderBook["bids"] = [];
      const asks: OrderBook["asks"] = [];

      const bestBid = futures - spread / 2;
      const bestAsk = futures + spread / 2;

      for (let i = 0; i < 5; i++) {
        bids.push({
          price: parseFloat((bestBid - i * 0.5).toFixed(1)),
          qty: Math.round(45 + Math.random() * 195)
        });
        asks.push({
          price: parseFloat((bestAsk + i * 0.5).toFixed(1)),
          qty: Math.round(45 + Math.random() * 195)
        });
      }

      setOrderBook({
        bids,
        asks,
        spread,
        spreadPercent: parseFloat(((spread / futures) * 100).toFixed(4))
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isLive, latestTick.futures]);

  // -------------------------------------------------------------
  // OPEN POSITIONS TICK PORTFOLIO MULTIPLIER PNL TRACKER
  // -------------------------------------------------------------
  useEffect(() => {
    if (history.length === 0) return;
    const latest = history[history.length - 1];

    setPositions(prev => {
      let changed = false;
      const updated = prev.map(pos => {
        if (pos.status === 'CLOSED') return pos;

        // Carry PnL equations
        let gross = 0;
        if (pos.side === "Long Futures") {
          // Cash & Carry (Spot Buy + Futures Sell)
          const spotPnL = (latest.spot - pos.spotPriceAtEntry!) * pos.qty;
          const futuresPnL = (pos.futuresPriceAtEntry! - latest.futures) * pos.qty;
          gross = spotPnL + futuresPnL;
        } else {
          // Reverse Carry (Short Spot + Buy Futures)
          const spotPnL = (pos.spotPriceAtEntry! - latest.spot) * pos.qty;
          const futuresPnL = (latest.futures - pos.futuresPriceAtEntry!) * pos.qty;
          gross = spotPnL + futuresPnL;
        }

        const net = gross - pos.transactionCosts;
        const ticks = pos.holdingTimeTicks + 1;

        if (pos.grossPnl !== gross || pos.netPnl !== net || pos.holdingTimeTicks !== ticks) {
          changed = true;
          return {
            ...pos,
            currentSpot: latest.spot,
            currentFutures: latest.futures,
            grossPnl: parseFloat(gross.toFixed(2)),
            netPnl: parseFloat(net.toFixed(2)),
            holdingTimeTicks: ticks
          };
        }
        return pos;
      });

      return changed ? updated : prev;
    });
  }, [history]);

  // -------------------------------------------------------------
  // POS ACTIONS INTERACTORS
  // -------------------------------------------------------------
  
  // Generic open position dispatcher
  const handleOpenArbitrage = (side: 'Long Futures' | 'Short Futures', qtyShares: number) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const singleCost = calculateRoundTripCosts(latestTick.spot, latestTick.futures, qtyShares);
    const mispricing = latestTick.futures - latestTick.fairValue;

    setPositions(prev => {
      // Find matching open strategy leg to average together (VWAP)
      const existingIdx = prev.findIndex(p => p.status === 'OPEN' && p.side === side);
      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        const newQty = existing.qty + qtyShares;
        const avgSpot = (existing.spotPriceAtEntry! * existing.qty + latestTick.spot * qtyShares) / newQty;
        const avgFutures = (existing.futuresPriceAtEntry! * existing.qty + latestTick.futures * qtyShares) / newQty;
        const avgMis = (existing.entryMispricing * existing.qty + mispricing * qtyShares) / newQty;
        const nextCosts = existing.transactionCosts + singleCost.total;

        const updated = [...prev];
        updated[existingIdx] = {
          ...existing,
          qty: newQty,
          spotPriceAtEntry: avgSpot,
          futuresPriceAtEntry: avgFutures,
          entryMispricing: avgMis,
          transactionCosts: nextCosts,
          fillCount: (existing.fillCount || 1) + 1,
        };
        return updated;
      }

      // Create new position block
      const newPos: ArbPosition = {
        id: `pos-${Date.now()}`,
        entryTime: timeStr,
        entryPriceSpot: latestTick.spot,
        entryPriceFutures: latestTick.futures,
        entryMispricing: mispricing,
        currentSpot: latestTick.spot,
        currentFutures: latestTick.futures,
        qty: qtyShares,
        side,
        status: 'OPEN',
        grossPnl: 0,
        netPnl: -singleCost.total,
        transactionCosts: singleCost.total,
        holdingTimeTicks: 0,
        fillCount: 1,
        spotPriceAtEntry: latestTick.spot,
        futuresPriceAtEntry: latestTick.futures,
      };
      return [newPos, ...prev];
    });
  };

  // Execute manual trades from Router ticket
  const handleExecuteManualTrade = (symbol: string, type: "BUY" | "SELL", qtyShares: number, price: number) => {
    // Treat Buy Future / Sell Spot or vice versa as standard strategy blocks
    const side: 'Long Futures' | 'Short Futures' = type === "SELL" ? "Long Futures" : "Short Futures";
    handleOpenArbitrage(side, qtyShares);
  };

  // Close / Liquidate position
  const handleExecuteLiquidation = (pos: ArbPosition) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    
    setPositions(prev => {
      return prev.map(p => {
        if (p.id !== pos.id) return p;
        return {
          ...p,
          status: 'CLOSED',
          exitTime: timeStr,
          exitMispricing: latestTick.mispricing,
          grossPnl: p.grossPnl,
          netPnl: p.netPnl
        };
      });
    });
  };

  // Find breached positions that crossed drawdown boundaries (Net PnL <= -15000)
  const breachedPositions = useMemo(() => {
    return positions.filter(pos => pos.status === 'OPEN' && pos.netPnl <= drawdownThreshold);
  }, [positions, drawdownThreshold]);

  return (
    <div className="min-h-screen bg-transparent text-[#e6edf3] font-sans flex flex-col p-4 sm:p-5 gap-4">
      {/* 1. STICKY TOP STATS HEADER */}
      <HeaderBoard 
        latestTick={latestTick} 
        isLive={isLive} 
        setIsLive={setIsLive} 
        capital={capital} 
      />

      {/* 2. RESPONSIVE TABS BAR (INCLUDING DETAILED DHAN & HEATMAP VIEWS FROM PREVIOUS VERSION) */}
      <nav className="flex items-center border border-[#231b44] bg-[#0c0919]/90 backdrop-blur rounded-lg p-1.5 overflow-x-auto w-full no-scrollbar select-none gap-1 shrink-0 font-mono shadow-md">
        {([
          { id: "TERMINAL", name: "TERMINAL" },
          { id: "RISK", name: "RISK MATRIX" },
          { id: "MICROSTRUCTURE", name: "MICROSTRUCTURE" },
          { id: "FLOWS", name: "INST FLOWS" },
          { id: "MULTI-EXPIRY", name: "MUT-EXP HYP" },
          { id: "STOCKS", name: "NIFTY COMPONENTS" },
          { id: "JOURNAL", name: "TRADE JOURNAL" },
          { id: "ALERTS", name: "SIGNAL FEEDS" },
          { id: "DHAN_PILOT", name: "⚡ DHAN PILOT" },
          { id: "SECTOR_TREEMAP", name: "📊 SECTOR MAP" }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold cursor-pointer transition-all shrink-0 select-none ${
              activeTab === tab.id 
                ? "bg-[#2a1b55] text-[#d6c4ff] border border-[#5a3da6] shadow-[0_0_10px_rgba(124,58,237,0.3)] font-black" 
                : "text-[#7b7593] hover:text-[#d6c4ff] hover:bg-[#15102a]/45"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </nav>

      {/* 3. DYNAMIC TAB CONTAINER CONTENT AREA */}
      <main className="flex-1 bg-[#090615]/40 backdrop-blur-sm rounded-lg w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full"
          >
            {activeTab === "TERMINAL" && (
              <TerminalTab 
                history={history}
                orderBook={orderBook}
                latestTick={latestTick}
                onExecuteManualTrade={handleExecuteManualTrade}
                onOpenAutoArbitrage={handleOpenArbitrage}
                activePositions={positions.filter(p => p.status === 'OPEN')}
                breachedPositions={breachedPositions}
                executeLiquidation={handleExecuteLiquidation}
                drawdownThreshold={drawdownThreshold}
              />
            )}

            {activeTab === "RISK" && (
              <RiskTab 
                history={history}
                latestTick={latestTick}
                activePositions={positions.filter(p => p.status === 'OPEN')}
                capital={capital}
                setCapital={setCapital}
              />
            )}

            {activeTab === "MICROSTRUCTURE" && (
              <MicrostructureTab 
                history={history}
                orderBook={orderBook}
              />
            )}

            {activeTab === "FLOWS" && (
              <FlowsTab 
                flowsHistory={flows}
                latestTick={latestTick}
                history={history}
              />
            )}

            {activeTab === "MULTI-EXPIRY" && (
              <MultiExpiryTab 
                history={history}
                latestTick={latestTick}
                daysToExpiry={14}
              />
            )}

            {activeTab === "STOCKS" && (
              <StocksTab 
                stocks={stocks}
              />
            )}

            {activeTab === "JOURNAL" && (
              <JournalTab 
                positions={positions}
              />
            )}

            {activeTab === "ALERTS" && (
              <AlertsTab 
                alerts={alerts}
                onClearAlerts={() => setAlerts([])}
              />
            )}

            {activeTab === "DHAN_PILOT" && (
              <DhanExecutionConsole 
                latestTick={latestTick}
              />
            )}

            {activeTab === "SECTOR_TREEMAP" && (
              <MarketHeatmap 
                stocks={stocks}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. PROFESSIONAL HIGH-CONFORMANCE DISCLAIMER FOOTER */}
      <footer className="border-t border-[#21262d]/50 pt-3 mt-4 text-center font-mono shrink-0 select-none">
        <span className="text-[10px] text-[#6e7681] tracking-widest font-bold">
          SIMULATED DATA &mdash; EDUCATIONAL USE ONLY &mdash; NOT CONNECTED TO NSE/BSE LIVE FEEDS
        </span>
      </footer>
    </div>
  );
}
