import { useState, useMemo } from "react";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  TrendingUp as TrendIcon,
  Search,
  Activity,
  Flame,
  BadgeAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StockState {
  symbol: string;
  name: string;
  weight: number;
  price: number;
  changePercent: number;
  buyQty: number;
  totalValue: number;
  volume: number;
  sector: string;
}

interface MarketHeatmapProps {
  stocks: StockState[];
  onStockClick?: (stock: StockState) => void;
}

export function MarketHeatmap({ stocks, onStockClick }: MarketHeatmapProps) {
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [minWeightFilter, setMinWeightFilter] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // NIFTY Index Breadth Calculations
  const breadthMeta = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let totalAdvancesWeight = 0;
    let totalDeclinesWeight = 0;

    stocks.forEach((s) => {
      if (s.changePercent > 0) {
        advances++;
        totalAdvancesWeight += s.weight;
      } else if (s.changePercent < 0) {
        declines++;
        totalDeclinesWeight += s.weight;
      } else {
        unchanged++;
      }
    });

    const advancesRatio = (advances / stocks.length) * 100;
    const declinesRatio = (declines / stocks.length) * 100;

    return {
      advances,
      declines,
      unchanged,
      advancesRatio,
      declinesRatio,
      totalAdvancesWeight,
      totalDeclinesWeight,
    };
  }, [stocks]);

  // Sectoral Weight & Contribution structure
  const sectorDataList = useMemo(() => {
    const map: Record<
      string, 
      { name: string; weight: number; sumChangeTimesWeight: number; stocksCount: number; stocks: StockState[] }
    > = {};

    stocks.forEach((s) => {
      if (!map[s.sector]) {
        map[s.sector] = {
          name: s.sector,
          weight: 0,
          sumChangeTimesWeight: 0,
          stocksCount: 0,
          stocks: []
        };
      }
      const sector = map[s.sector];
      sector.weight += s.weight;
      sector.sumChangeTimesWeight += s.changePercent * s.weight;
      sector.stocksCount += 1;
      sector.stocks.push(s);
    });

    const list = Object.values(map).map((sec) => {
      // Weighted average sector change percent
      const avgChange = sec.weight > 0 ? sec.sumChangeTimesWeight / sec.weight : 0;
      return {
        name: sec.name,
        weight: sec.weight,
        avgChange: parseFloat(avgChange.toFixed(3)),
        stocksCount: sec.stocksCount,
        stocks: sec.stocks.sort((a, b) => b.weight - a.weight), // heavyweights first
      };
    });

    // Sort sectors by their combined Nifty weight (representing real market structure!)
    return list.sort((a, b) => b.weight - a.weight);
  }, [stocks]);

  // Top Movers
  const topGainersAndLosers = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
    const topGainers = sorted.slice(0, 4);
    const topLosers = sorted.slice(-4).reverse(); // reverse so worst losers are shown first
    return { topGainers, topLosers };
  }, [stocks]);

  // Filter and process sector-specific entries
  const filteredSectors = useMemo(() => {
    return sectorDataList
      .map((sec) => {
        // Filter stocks within this sector
        const matchedStocks = sec.stocks.filter((st) => {
          const matchesSearch = searchQuery 
            ? st.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || st.name.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
          const matchesWeight = st.weight >= minWeightFilter;
          return matchesSearch && matchesWeight;
        });

        return {
          ...sec,
          stocks: matchedStocks
        };
      })
      .filter((sec) => {
        // Keep sector if it has stocks and matches sector tab
        if (selectedSector !== "ALL" && sec.name !== selectedSector) return false;
        return sec.stocks.length > 0;
      });
  }, [sectorDataList, selectedSector, minWeightFilter, searchQuery]);

  // Dynamic color scale helper based on percentage returns
  const getTileColorClasses = (changePercent: number) => {
    if (changePercent >= 2.0) {
      return "bg-[#1f883d] text-white border-[#3fb950] shadow-[inset_0_0_8px_rgba(63,185,80,0.4)]";
    } else if (changePercent >= 0.7) {
      return "bg-[#1f592d] text-emerald-100 border-[#2ea44f]/80";
    } else if (changePercent > 0.0) {
      return "bg-[#133a1e] text-emerald-300 border-[#225c2e]/60";
    } else if (changePercent === 0.0) {
      return "bg-[#21262d] text-[#c9d1d9] border-[#30363d]";
    } else if (changePercent >= -0.7) {
      return "bg-[#3c1d1d] text-rose-300 border-[#6e2c2c]/60";
    } else if (changePercent >= -2.0) {
      return "bg-[#612020] text-rose-100 border-[#da3633]/80";
    } else {
      return "bg-[#a42e2b] text-white border-[#f85149] shadow-[inset_0_0_8px_rgba(248,81,73,0.4)]";
    }
  };

  return (
    <div id="heatmap-panel-root" className="flex flex-col gap-5 w-full">
      
      {/* 1. TOP MARKET BREADTH BAR & METRIC ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Nifty 50 Index Breadth (Advances vs Declines Meter) */}
        <div className="lg:col-span-8 bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#58a6ff] inline-block animate-pulse"></span>
              <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wide">Nifty 50 Index Market Breadth</h4>
            </div>
            <div className="text-[10px] font-bold text-[#8b949e]">
              CO COMPONENTS: {breadthMeta.advances} Advancing | {breadthMeta.declines} Declining
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Horizontal Advance vs Decline Bar */}
            <div className="h-5 rounded-md overflow-hidden flex bg-[#30363d] text-[10px] font-bold font-mono">
              <div 
                className="bg-[#2ea44f] transition-all duration-700 flex items-center justify-start pl-3 text-white truncate"
                style={{ width: `${Math.max(8, breadthMeta.advancesRatio)}%` }}
              >
                <span>ADV: {breadthMeta.advancesRatio.toFixed(0)}%</span>
              </div>
              {breadthMeta.unchanged > 0 && (
                <div 
                  className="bg-[#8b949e] transition-all duration-700 flex items-center justify-center text-[#0d1117] truncate"
                  style={{ width: `${(breadthMeta.unchanged / stocks.length) * 100}%` }}
                >
                  <span>{breadthMeta.unchanged}</span>
                </div>
              )}
              <div 
                className="bg-[#da3633] transition-all duration-700 flex items-center justify-end pr-3 text-white truncate"
                style={{ width: `${Math.max(8, breadthMeta.declinesRatio)}%` }}
              >
                <span>DEC: {breadthMeta.declinesRatio.toFixed(0)}%</span>
              </div>
            </div>

            {/* Sub details: attribution weights */}
            <div className="flex items-center justify-between text-[10px] text-[#8b949e] font-mono select-none px-0.5 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2ea44f]"></span>
                <span>Advancing Index Weight: <span className="font-bold text-[#3fb950]">{breadthMeta.totalAdvancesWeight.toFixed(2)}%</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#da3633]"></span>
                <span>Declining Index Weight: <span className="font-bold text-[#f85149]">{breadthMeta.totalDeclinesWeight.toFixed(2)}%</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Top gainers / losers side highlights */}
        <div className="lg:col-span-4 bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#21262d] pb-2 mb-2">
            <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wide">Extreme Velocity Tickers</h4>
            <span className="text-[9px] text-[#8b949e] font-bold">TOP OUTLIERS</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Top 2 Gainers list */}
            <div>
              <div className="text-[9px] font-bold text-[#2ea44f] flex items-center gap-1 uppercase tracking-wider mb-1">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>GAIN LEADERS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {topGainersAndLosers.topGainers.slice(0, 2).map((g) => (
                  <div key={g.symbol} className="bg-[#1c2420] border border-[#2ea44f]/25 rounded p-1 flex justify-between items-center text-[10px]">
                    <span className="font-bold text-[#3fb950]">{g.symbol}</span>
                    <span className="font-bold text-[#3fb950]">+{g.changePercent.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 2 Losers list */}
            <div>
              <div className="text-[9px] font-bold text-[#da3633] flex items-center gap-1 uppercase tracking-wider mb-1">
                <TrendingDown className="w-2.5 h-2.5" />
                <span>DRAG LEADERS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {topGainersAndLosers.topLosers.slice(0, 2).map((l) => (
                  <div key={l.symbol} className="bg-[#241e1e] border border-[#da3633]/25 rounded p-1 flex justify-between items-center text-[10px]">
                    <span className="font-bold text-[#f85149]">{l.symbol}</span>
                    <span className="font-bold text-[#f85149]">{l.changePercent.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. LIVE MARKET SECTORIAL STRUCTURE INDEX MAP */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#21262d] pb-2.5 mb-3">
          <div>
            <h4 className="font-bold text-xs text-[#e6edf3] uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>Nifty 50 Index Structural Weights Contribution</span>
            </h4>
            <p className="text-[10px] text-[#8b949e] mt-0.5">Sectors listed by aggregate index weight. Contribution is live weighted price performance average.</p>
          </div>
          <div className="text-[9px] font-mono tracking-wider font-bold text-[#8b949e]">
            NSE INDEX CATEGORIES: {sectorDataList.length} SECTORIAL CLASSES
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
          {sectorDataList.map((sec) => {
            const isSecUp = sec.avgChange >= 0;
            const absoluteChange = Math.abs(sec.avgChange);
            const intensityBar = Math.min(100, Math.round(absoluteChange * 45));

            return (
              <div 
                key={sec.name} 
                className="bg-[#0d1117] border border-[#30363d] rounded p-2 flex flex-col justify-between hover:border-yellow-500/30 transition-all group"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-[9px] text-[#8b949e] font-extrabold uppercase group-hover:text-white transition-colors truncate" title={sec.name}>
                    {sec.name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-semibold mt-1">
                    <span className="text-[#8b949e]">{sec.weight.toFixed(2)}% index</span>
                    <span className={`font-mono font-bold ${isSecUp ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                      {isSecUp ? "+" : ""}{sec.avgChange.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Performance level strip indicator */}
                <div className="h-1 bg-[#1a1f26] rounded-full mt-2 overflow-hidden flex">
                  <div 
                    className={`h-full ${isSecUp ? "bg-[#3fb950]" : "bg-[#f85149]"} transition-all duration-300`}
                    style={{ width: `${Math.max(12, intensityBar)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. INTERACTIVE SEARCH & FILTERS CONTROLS */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sector Tabs */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedSector("ALL")}
              className={`px-3 py-1 text-[10px] tracking-wider uppercase font-bold border rounded transition-all whitespace-nowrap cursor-pointer ${
                selectedSector === "ALL"
                  ? "bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/50"
                  : "bg-[#0d1117] text-[#8b949e] border-[#30363d] hover:text-[#e6edf3] hover:bg-[#1f242c]"
              }`}
            >
              ALL COMPONENT SECTORS
            </button>
            {sectorDataList.map((sec) => (
              <button
                key={sec.name}
                onClick={() => setSelectedSector(sec.name)}
                className={`px-3 py-1 text-[10px] tracking-wider uppercase font-semibold border rounded transition-all whitespace-nowrap cursor-pointer ${
                  selectedSector === sec.name
                    ? "bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/50"
                    : "text-[#c9d1d9] bg-[#0d1117] border-[#30363d] hover:text-[#e6edf3] hover:bg-[#1f242c]"
                }`}
              >
                {sec.name.split(" ")[0]} ({sec.stocksCount})
              </button>
            ))}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="h-3.5 w-3.5 text-[#8b949e] absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Find specific stock..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-[#3fb950] outline-none rounded text-[11px] font-mono text-[#e6edf3]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Weight limit filter */}
            <select
              value={minWeightFilter}
              onChange={(e) => setMinWeightFilter(parseFloat(e.target.value))}
              className="bg-[#0d1117] border border-[#30363d] text-[11px] font-mono text-[#8b949e] focus:text-[#e6edf3] focus:border-[#3fb950] rounded px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="0">All Weights</option>
              <option value="1.0">&ge; 1.0% Index Weight</option>
              <option value="2.5">&ge; 2.5% Heavyweights</option>
              <option value="5.0">&ge; 5.0% Giants Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. THE LIVE NIFTY 50 COMPONENT HEATMAP TREE */}
      <div className="bg-[#10141b] border-2 border-[#1f242c] rounded-xl p-4 md:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#21262d] pb-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ea44f] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2ea44f]"></span>
            </span>
            <h3 className="font-black text-xs md:text-sm text-[#e6edf3] uppercase tracking-widest font-mono">
              NIFTY 50 COMPONENT HEATMAP PORTAL
            </h3>
          </div>
          <span className="text-[10px] text-[#8b949e] font-mono">
            BOX HEIGHTS REFLECT INDEX WEIGHT &middot; COLOR REFLECTS TICK RETURN %
          </span>
        </div>

        <div className="flex flex-col gap-6">
          {filteredSectors.map((sector) => (
            <div key={sector.name} className="border border-[#21262d] rounded-lg bg-[#161b22]/40 overflow-hidden">
              {/* Sector Header Area */}
              <div className="bg-[#21262d]/50 px-4 py-2 flex items-center justify-between border-b border-[#21262d]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#e6edf3] uppercase tracking-wide">
                    {sector.name}
                  </span>
                  <span className="text-[10px] text-[#8b949e] font-mono bg-[#0d1117] border border-[#30363d] px-1.5 py-0.2 rounded-md">
                    Weight: {sector.weight.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-[#8b949e]">Sector Momentum:</span>
                  <span className={`font-bold ${sector.avgChange >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                    {sector.avgChange >= 0 ? "▲" : "▼"} {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Grid content of stocks in this sector */}
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {sector.stocks.map((stock) => {
                  const isUp = stock.changePercent >= 0;
                  const colorClass = getTileColorClasses(stock.changePercent);

                  // Heavyweights should clearly stand out to satisfy Treemap representation
                  const isGiant = stock.weight >= 2.5;
                  const borderPulseClass = isGiant ? "border-2 col-span-2 row-span-1" : "";

                  return (
                    <motion.div
                      key={stock.symbol}
                      whileHover={{ scale: 1.015, zIndex: 10 }}
                      onClick={() => onStockClick?.(stock)}
                      title={`COMPANY: ${stock.name}\nPRICE: ₹${stock.price.toLocaleString()}\nWEIGHT: ${stock.weight}%\nGAIN/LOSS: ${stock.changePercent}%\nVOLUME: ${stock.volume.toLocaleString()}`}
                      className={`relative min-h-[58px] p-2 sm:p-2.5 rounded-md border flex flex-col justify-between transition-all duration-300 cursor-pointer overflow-hidden ${colorClass} ${borderPulseClass}`}
                    >
                      {/* Weighted sizing representation: background graphic or larger layout */}
                      <div className="flex items-start justify-between">
                        <span className={`font-black tracking-tight leading-none ${isGiant ? "text-[12px] sm:text-[14px]" : "text-[10px] sm:text-[11px]"}`}>
                          {stock.symbol}
                        </span>
                        
                        <span className={`font-bold leading-none select-none font-mono tracking-tighter ${isGiant ? "text-[11px] sm:text-[12px]" : "text-[9px] sm:text-[10px]"}`}>
                          {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
                        </span>
                      </div>

                      {/* Display pricing and its weight */}
                      <div className="flex items-end justify-between mt-2 pt-1 border-t border-white/5">
                        <span className={`text-[#8b949e] font-mono leading-none hidden sm:inline ${isGiant ? "text-[9px] font-bold text-white/50" : "text-[8px]"}`}>
                          W:{stock.weight.toFixed(2)}%
                        </span>
                        <span className={`font-mono text-right font-semibold leading-none text-white/90 ${isGiant ? "text-[11px]" : "text-[9px]"}`}>
                          ₹{stock.price.toFixed(1)}
                        </span>
                      </div>

                      {/* Giant Star Stamp Watermark for heavy index components */}
                      {isGiant && (
                        <span className="absolute right-0.5 bottom-0.5 pointer-events-none opacity-[0.06] text-white">
                          <Activity className="w-9 h-9" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
