import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../utils/preferences';

const TICKER_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/ticker';
const CANDLES_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60';
const POLL_MS = 2_000;
export const BTC_WINDOW_SECS = 900;
export const BTC_ACCENT = '#6ea8ff';
const MAX_POINTS = 180;

export interface BtcPoint {
  time: number;
  value: number;
}

export const formatUsd = (v: number): string =>
  `$${Math.round(v).toLocaleString('en-US')}`;

export interface BtcFeedState {
  data: BtcPoint[];
  value: number | null;
  failed: boolean;
  ready: boolean;
  chartPaused: boolean;
}

const BtcFeedContext = createContext<BtcFeedState | null>(null);

interface BtcFeedProviderProps {
  paused?: boolean;
  children: React.ReactNode;
}

/** One Coinbase feed shared by the price label and the liveline chart. */
export const BtcFeedProvider: React.FC<BtcFeedProviderProps> = ({ paused = false, children }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [data, setData] = useState<BtcPoint[]>([]);
  const [value, setValue] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  );
  const valueRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applyTick = (price: number, time: number) => {
      if (cancelled || !Number.isFinite(price) || !Number.isFinite(time)) return;
      setValue(price);
      setFailed(false);
      setData((prev) => {
        const last = prev[prev.length - 1];
        const next =
          last && last.time === time
            ? [...prev.slice(0, -1), { time, value: price }]
            : [...prev, { time, value: price }];
        const cutoff = time - BTC_WINDOW_SECS * 2;
        const trimmed = next.filter((point) => point.time >= cutoff);
        return trimmed.length > MAX_POINTS ? trimmed.slice(-MAX_POINTS) : trimmed;
      });
    };

    const loadHistory = async () => {
      try {
        const response = await fetch(CANDLES_URL);
        if (!response.ok) throw new Error('candles');
        const candles: number[][] = await response.json();
        const points = candles
          .map((row) => ({ time: row[0], value: row[4] }))
          .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
          .reverse();
        if (cancelled || points.length === 0) return;
        setData(points.slice(-MAX_POINTS));
        setValue(points[points.length - 1].value);
        setFailed(false);
      } catch {
        if (!cancelled && valueRef.current === null) setFailed(true);
      }
    };

    const poll = async () => {
      if (document.hidden || paused) return;
      try {
        const response = await fetch(TICKER_URL);
        if (!response.ok) throw new Error('ticker');
        const json: { price?: string; time?: string } = await response.json();
        const price = Number(json.price);
        const time = json.time
          ? Math.floor(new Date(json.time).getTime() / 1000)
          : Math.floor(Date.now() / 1000);
        applyTick(price, time);
      } catch {
        if (!cancelled && valueRef.current === null) setFailed(true);
      }
    };

    void loadHistory().then(() => {
      if (!cancelled) void poll();
    });
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paused]);

  const ready = value !== null && data.length > 1;
  const chartPaused = paused || hidden || reducedMotion;
  const state = useMemo(
    () => ({ data, value, failed, ready, chartPaused }),
    [data, value, failed, ready, chartPaused],
  );

  return <BtcFeedContext.Provider value={state}>{children}</BtcFeedContext.Provider>;
};

export const useBtcFeed = (): BtcFeedState => {
  const ctx = useContext(BtcFeedContext);
  if (!ctx) {
    return { data: [], value: null, failed: true, ready: false, chartPaused: true };
  }
  return ctx;
};

export const BtcPriceLabel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { value, failed } = useBtcFeed();
  const text = value !== null ? formatUsd(value) : failed ? '—' : '…';
  return (
    <div
      className={`btc-price ps2-tnum ${compact ? 'btc-price--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={value !== null ? `Bitcoin ${formatUsd(value)}` : 'Bitcoin price loading'}
    >
      <div className="btc-price__value">{text}</div>
    </div>
  );
};
