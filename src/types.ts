export interface TickData {
  time: string;
  spot: number;
  futures: number;
  nextFutures: number;
  fairValue: number;
  nextFairValue: number;
  basis: number;
  nextBasis: number;
  theoreticalBasis: number;
  mispricing: number;
  impliedCarry: number;
  zScore: number;
  calendarSpread: number;
  rollCost: number;
  oi: number;
  oiChange: number;
  oiTrend: 'long_buildup' | 'short_buildup' | 'short_covering' | 'long_unwinding';
  pcr: number;
  volume: number;
  vwap: number;
  spread: number;
}

export interface FiiDiiFlow {
  date: string;
  fii: number;
  dii: number;
  net: number;
  cumulative5Day: number;
}

export interface StockState {
  symbol: string;
  name: string;
  weight: number;
  price: number;
  changePercent: number;
  contribution: number;
  buyQty: number;
  totalValue: number;
  volume: number;
  sector: string;
}

export interface TradeLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AlertItem {
  id: string;
  timestamp: string;
  type: 'OVERPRICED' | 'UNDERPRICED' | 'EXPIRED';
  mispricing: number;
  zScore: number;
  netOpportunity: number;
  transactionCost: number;
  recommendedAction: string;
  spot: number;
  futures: number;
}

export interface ArbPosition {
  id: string;
  entryTime: string;
  exitTime?: string;
  entryPriceSpot: number;
  entryPriceFutures: number;
  entryMispricing: number;
  exitMispricing?: number;
  currentSpot: number;
  currentFutures: number;
  qty: number;
  side: 'Long Futures' | 'Short Futures';
  status: 'OPEN' | 'CLOSED';
  grossPnl: number;
  netPnl: number;
  transactionCosts: number;
  holdingTimeTicks: number;
  fillCount: number;
  spotPriceAtEntry?: number;
  futuresPriceAtEntry?: number;
  basisAtEntry?: number;
}

export interface OrderBookLevel {
  price: number;
  qty: number;
  accumulatedQty?: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercent: number;
}
