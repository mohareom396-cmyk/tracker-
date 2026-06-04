import React, { useState, useMemo } from "react";
import { Search, Grid, List, TrendingUp, TrendingDown, RefreshCw, Layers, BarChart3, PieChart } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { StockState } from "../types";

interface StocksTabProps {
  stocks: StockState[];
}

type SortField = 'symbol' | 'weight' | 'price' | 'changePercent' | 'contribution' | 'buyQty' | 'totalValue' | 'volume';

export const StocksTab: React.FC<StocksTabProps> = ({
  stocks,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"TABLE" | "HEATMAP">("TABLE");
  const [sortField, setSortField] = useState<SortField>("weight");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
  const [chartMetric, setChartMetric] = useState<"WEIGHT" | "CONTRIBUTION">("WEIGHT");

  // Get list of sectors
  const sectors = useMemo(() => {
    const list = new Set(stocks.map(s => s.sector));
    return ["ALL", ...Array.from(list)];
  }, [stocks]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "ASC" ? "DESC" : "ASC");
    } else {
      setSortField(field);
      setSortDirection("DESC");
    }
  };

  // Filter & Sort Stocks
  const processedStocks = useMemo(() => {
    let result = stocks.filter(stock => {
      const matchSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          stock.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSector = selectedSector === "ALL" || stock.sector === selectedSector;
      return matchSearch && matchSector;
    });

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // String comparisons
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "ASC" 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      // Numeric comparisons
      return sortDirection === "ASC"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });

    return result;
  }, [stocks, searchQuery, selectedSector, sortField, sortDirection]);

  // Top 10 stocks data for the charts
  const topConstituentChartData = useMemo(() => {
    const list = [...stocks];
    if (chartMetric === "WEIGHT") {
      list.sort((a, b) => b.weight - a.weight);
      return list.slice(0, 10).map(s => ({
        name: s.symbol,
        value: s.weight,
        displayLabel: `${s.weight.toFixed(2)}%`,
        color: "#c084fc"
      }));
    } else {
      list.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      return list.slice(0, 10).map(s => ({
        name: s.symbol,
        value: s.contribution,
        displayLabel: `${s.contribution >= 0 ? "+" : ""}${s.contribution.toFixed(2)} pts`,
        color: s.contribution >= 0 ? "#39d353" : "#f85149"
      }));
    }
  }, [stocks, chartMetric]);

  // Return background gradient for Heatmap tiles based on price percent change
  const getHeatmapColor = (changePercent: number) => {
    if (changePercent > 1.5) return "bg-[#2ea44f] text-black font-extrabold";
    if (changePercent > 0.5) return "bg-[#39d353]/30 text-[#39d353] border-[#39d353]/40";
    if (changePercent > 0) return "bg-[#39d353]/15 text-[#39d353] border-[#39d353]/20";
    if (changePercent < -1.5) return "bg-[#f85149] text-black font-extrabold";
    if (changePercent < -0.5) return "bg-[#f85149]/30 text-[#f85149] border-[#f85149]/30";
    if (changePercent < 0) return "bg-[#f85149]/15 text-[#f85149] border-[#f85149]/20";
    return "bg-[#161b22] text-[#8b949e] border-[#21262d]";
  };

  return (
    <div id="content-stocks-panel" className="flex flex-col gap-4 w-full">
      
      {/* Search & Configurations bar */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="flex items-center bg-[#0d1117] border border-[#21262d] rounded px-2.5 py-1.5 w-full md:w-56 text-xs">
            <Search className="w-4 h-4 text-[#6e7681] mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search ticker symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-0 outline-none text-[#e6edf3] placeholder-[#6e7681] w-full"
            />
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21262d] px-2.5 py-1.5 rounded text-xs text-[#8b949e]">
            <span className="text-[10px] font-bold uppercase shrink-0 font-sans">SECTOR:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-transparent text-white border-0 outline-none py-0.5 cursor-pointer font-bold uppercase text-[10px]"
            >
              {sectors.map((sec, idx) => (
                <option key={idx} value={sec} className="bg-[#0d1117]">{sec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View mode buttons */}
        <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#21262d] p-1 rounded">
          <button
            onClick={() => setViewMode("TABLE")}
            className={`px-2.5 py-1 rounded flex items-center gap-1 text-[10px] uppercase font-bold cursor-pointer transition-all ${
              viewMode === "TABLE" ? "bg-[#21262d] text-white" : "text-[#6e7681] hover:text-[#e6edf3]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Table View</span>
          </button>
          <button
            onClick={() => setViewMode("HEATMAP")}
            className={`px-2.5 py-1 rounded flex items-center gap-1 text-[10px] uppercase font-bold cursor-pointer transition-all ${
              viewMode === "HEATMAP" ? "bg-[#21262d] text-white" : "text-[#6e7681] hover:text-[#e6edf3]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Heatmap bento</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC TOP CONSTITUENTS GRAPHICAL OVERVIEW CARD */}
      <div className="premium-card p-4 rounded-lg font-mono flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between border-b border-[#21262d] pb-2">
          <div>
            <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <BarChart3 className="w-4 h-4 text-[#c084fc]" />
              <span>NIFTY 50 Top 10 Weight & Contribution Desk Analytics</span>
            </h4>
            <p className="text-[10px] text-[#8b84a3] font-sans">Visualizing extreme index concentration drivers and real-time support factors</p>
          </div>

          <div className="flex bg-[#0d1117] border border-[#21262d] rounded p-0.5 text-[9px] font-bold">
            <button
              onClick={() => setChartMetric("WEIGHT")}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                chartMetric === "WEIGHT" ? "bg-[#21262d] text-white font-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <PieChart className="w-3 h-3 text-[#c084fc]" />
              <span>CONSTITUENT WEIGHT %</span>
            </button>
            <button
              onClick={() => setChartMetric("CONTRIBUTION")}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                chartMetric === "CONTRIBUTION" ? "bg-[#21262d] text-white font-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3 h-3 text-[#39d353]" />
              <span>POINT CONTRIBUTION</span>
            </button>
          </div>
        </div>

        <div className="w-full h-[190px] text-[9.5px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topConstituentChartData} layout="horizontal" margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid stroke="#1f242c" vertical={false} />
              <XAxis dataKey="name" stroke="#8b949e" tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#8b949e" 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => chartMetric === "WEIGHT" ? `${val}%` : `${val} pts`}
              />
              <Tooltip 
                contentStyle={{ background: "#0d1117", border: "1px solid #21262d" }}
                labelFormatter={(label) => `Constituent: ${label}`}
                formatter={(value: any) => [chartMetric === "WEIGHT" ? `${value.toFixed(2)}%` : `${parseFloat(value).toFixed(2)} Index pts`, chartMetric]}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={28}>
                {topConstituentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RENDER TABLE VIEW */}
      {viewMode === "TABLE" ? (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#000000]/25 text-[#6e7681] text-[9px] uppercase border-[#21262d] border font-sans font-black">
                <tr>
                  <th className="px-3 py-2 cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('symbol')}>SYMBOL {sortField === 'symbol' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('weight')}>WEIGHT% {sortField === 'weight' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('price')}>PRICE (INR) {sortField === 'price' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('changePercent')}>CHANGE% {sortField === 'changePercent' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('contribution')}>Daily Contribution {sortField === 'contribution' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none font-sans" onClick={() => handleSort('buyQty')}>BUY QTY (Lots) {sortField === 'buyQty' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none" onClick={() => handleSort('totalValue')}>TOTAL VALUE (Cr) {sortField === 'totalValue' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-right cursor-pointer hover:bg-[#21262d] select-none font-sans" onClick={() => handleSort('volume')}>VOLUME {sortField === 'volume' && (sortDirection === 'ASC' ? '▲' : '▼')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50 bg-[#0d1117]/10">
                {processedStocks.map((stock, idx) => {
                  const isUp = stock.changePercent >= 0;
                  return (
                    <tr key={idx} className="hover:bg-[#161b22]/70 font-mono text-[11px] h-10 transition-colors">
                      <td className="px-3 py-2">
                        <span className="font-extrabold text-white text-[11px] block">{stock.symbol}</span>
                        <span className="text-[9px] text-[#6e7681] font-sans block truncate max-w-[120px]">{stock.name}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{stock.weight.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-white font-bold">₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`px-3 py-2 text-right font-black ${isUp ? "text-[#39d353]" : "text-[#f85149]"}`}>
                        <span className="flex items-center justify-end gap-1">
                          {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${stock.contribution >= 0 ? "text-[#39d353]" : "text-[#f85149]"}`}>
                        {stock.contribution >= 0 ? "+" : ""}{stock.contribution.toFixed(2)} pts
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 font-sans">{stock.buyQty.toLocaleString()} lts</td>
                      <td className="px-3 py-2 text-right text-[#39d353]">₹{stock.totalValue.toFixed(1)} Cr</td>
                      <td className="px-3 py-2 text-right text-gray-300 font-sans">{(stock.volume / 1000).toFixed(1)}K</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RENDER HEATMAP GRID VIEW */
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2.5">
            {processedStocks.map((stock, idx) => {
              const bgClass = getHeatmapColor(stock.changePercent);
              return (
                <div 
                  key={idx} 
                  className={`border border-[#21262d]/50 p-2.5 rounded-md flex flex-col justify-between h-[82px] cursor-help font-mono transition-all text-center select-none ${bgClass}`}
                  title={`${stock.name} (${stock.sector}) - Weight: ${stock.weight}%`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-extrabold uppercase tracking-wide inline-block">{stock.symbol}</span>
                    <span className="text-[8px] opacity-75">{stock.weight.toFixed(1)}%</span>
                  </div>
                  
                  <div className="text-sm font-black my-1 font-mono tracking-tight leading-none">
                    {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                  </div>

                  <div className="flex justify-between items-center text-[8px] opacity-75">
                    <span>₹{Math.round(stock.price)}</span>
                    <span>{stock.sector.substring(0, 8)}..</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
