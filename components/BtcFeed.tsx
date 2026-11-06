import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../utils/preferences';

const TICKER_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/ticker';
/** Ticker-only poll. Coinbase public REST allows 10 req/s/IP (burst 15); 1 Hz
 *  stays ~10× under that. Candles load once on mount — do not re-poll them. */
const POLL_MS = 1_000;
/** Target sparkline window once enough live ticks have accumulated. */
export const BTC_WINDOW_SECS = 60;
export const BTC_ACCENT = '#6ea8ff';
const MAX_POINTS = 120;

export interface BtcPoint {
  time: number;
  value: number;
}

const candlesUrl = (nowSec: number): string => {
  const start = new Date((nowSec - BTC_WINDOW_SECS * 4) * 1000).toISOString();
  const end = new Date(nowSec * 1000).toISOString();
  return `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start=${start}&end=${end}`;
};

/**
 * Build liveline series without per-poll X remapping (the boot blink/resize).
 *
 * densifyWindow used to re-stretch every tick across a fixed 60s viewport, so
 * historical X positions jumped every poll. A growing `window` prop also
 * resized the chart every second on boot. Instead:
 *   1. Keep only the contiguous ~1s tick run (drop minute candles).
 *   2. On first reveal (≥2 ticks), stretch that seed ONCE into [now-60, now]
 *      and freeze those absolute chart times.
 *   3. Append later ticks with real timestamps; viewport stays windowSecs.
 * Past seed points never move; window never resizes → no blink on boot.
 */
export interface ChartSeries {
  points: BtcPoint[];
  windowSecs: number;
}

/** Frozen one-shot densify baseline — absolute chart times, not recomputed. */
export interface DensifyLock {
  seed: BtcPoint[];
  /** Newest real tick time included in the seed stretch. */
  seedRealMax: number;
}

const liveTicks = (points: BtcPoint[], nowSec: number): BtcPoint[] => {
  if (points.length === 0) return [];
  const sorted = [...points]
    .filter((point) => point.time <= nowSec + 1)
    .sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];

  const newest = sorted[sorted.length - 1];
  const ticks: BtcPoint[] = [newest];
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    const point = sorted[i];
    const newer = ticks[0];
    // Stop at the first gap >5s so minute candles do not join the series.
    if (newer.time - point.time > 5) break;
    ticks.unshift(point);
  }
  return ticks;
};

export const createDensifyLock = (
  ticks: BtcPoint[],
  windowSecs: number,
  nowSec: number,
): DensifyLock => {
  const tMin = ticks[0].time;
  const span = Math.max(1, nowSec - tMin);
  const left = nowSec - windowSecs;
  return {
    seed: ticks.map((point) => ({
      time: left + ((point.time - tMin) / span) * windowSecs,
      value: point.value,
    })),
    seedRealMax: ticks[ticks.length - 1].time,
  };
};

export const applyDensifyLock = (
  ticks: BtcPoint[],
  lock: DensifyLock,
  windowSecs: number,
  nowSec: number,
): BtcPoint[] => {
  const left = nowSec - windowSecs;
  const out: BtcPoint[] = lock.seed.filter((point) => point.time >= left - 1);
  for (const tick of ticks) {
    if (tick.time > lock.seedRealMax) out.push(tick);
  }
  return out;
};

export const buildChartSeries = (
  points: BtcPoint[],
  windowSecs: number,
  nowSec: number = Math.floor(Date.now() / 1000),
  lock: DensifyLock | null = null,
): { series: ChartSeries; lock: DensifyLock | null } => {
  const ticks = liveTicks(points, nowSec);
  if (ticks.length < 2) {
    return { series: { points: [], windowSecs }, lock: null };
  }
  const nextLock = lock ?? createDensifyLock(ticks, windowSecs, nowSec);
  return {
    series: {
      points: applyDensifyLock(ticks, nextLock, windowSecs, nowSec),
      windowSecs,
    },
    lock: nextLock,
  };
};

/** @deprecated Prefer buildChartSeries — kept for any external import. */
export const densifyWindow = (
  points: BtcPoint[],
  windowSecs: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): BtcPoint[] => buildChartSeries(points, windowSecs, nowSec).series.points;

export const formatUsd = (v: number): string =>
  `$${Math.round(v).toLocaleString('en-US')}`;

export interface BtcFeedState {
  data: BtcPoint[];
  /** Chart series for liveline — frozen seed + real appends, fixed window. */
  chartData: BtcPoint[];
  /** Fixed liveline window (BTC_WINDOW_SECS) — never resizes after boot. */
  chartWindow: number;
  value: number | null;
  failed: boolean;
  ready: boolean;
  chartPaused: boolean;
}

const BtcFeedContext = createContext<BtcFeedState | null>(null);

interface BtcFeedProviderProps {
  children: React.ReactNode;
}

/** One Coinbase feed shared by the price label and the liveline chart. */
export const BtcFeedProvider: React.FC<BtcFeedProviderProps> = ({ children }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [data, setData] = useState<BtcPoint[]>([]);
  const [value, setValue] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  );
  const valueRef = useRef<number | null>(null);
  /** One-shot densify baseline — set on first reveal, never recomputed. */
  const densifyLockRef = useRef<DensifyLock | null>(null);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Mount once per provider lifetime. The effect must not re-run or it reseeds
  // candles and wipes tick history. Chart keeps animating across screen hops.
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
        const response = await fetch(candlesUrl(Math.floor(Date.now() / 1000)));
        if (!response.ok) throw new Error('candles');
        const candles: number[][] = await response.json();
        const points = candles
          .map((row) => ({ time: row[0], value: row[4] }))
          .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
          .sort((a, b) => a.time - b.time);
        if (cancelled || points.length === 0) return;
        // Seed shape only — do not set price from the last candle close.
        // Price stays … and liveline stays loading until the first live ticker.
        setData(points.slice(-MAX_POINTS));
        setFailed(false);
      } catch {
        // Candles are optional shape seed only — never blank the sparkline
        // on a candles miss. Ticker poll owns `failed`.
      }
    };

    const poll = async () => {
      // Keep collecting ticks while a content screen covers the menu so the
      // sparkline stays live on return. Only a hidden tab skips the poll.
      if (document.hidden) return;
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
  }, []);

  // Gate the liveline morph on a live ticker. Stretch the first tick run once,
  // then append with real times — fixed 60s window, no per-poll remap/resize.
  const series = useMemo(() => {
    if (value === null) {
      densifyLockRef.current = null;
      return { points: [], windowSecs: BTC_WINDOW_SECS };
    }
    const built = buildChartSeries(
      data,
      BTC_WINDOW_SECS,
      Math.floor(Date.now() / 1000),
      densifyLockRef.current,
    );
    densifyLockRef.current = built.lock;
    return built.series;
  }, [data, value]);
  const chartData = series.points;
  const chartWindow = series.windowSecs;
  const ready = value !== null && chartData.length > 1;
  // Keep animating under content screens — freezing caused a catch-up jump on
  // return. Only pause when the tab is hidden or the user prefers reduced motion.
  const chartPaused = hidden || reducedMotion;
  const state = useMemo(
    () => ({ data, chartData, chartWindow, value, failed, ready, chartPaused }),
    [data, chartData, chartWindow, value, failed, ready, chartPaused],
  );

  return <BtcFeedContext.Provider value={state}>{children}</BtcFeedContext.Provider>;
};

export const useBtcFeed = (): BtcFeedState => {
  const ctx = useContext(BtcFeedContext);
  if (!ctx) {
    return { data: [], chartData: [], chartWindow: BTC_WINDOW_SECS, value: null, failed: true, ready: false, chartPaused: true };
  }
  return ctx;
};

/** Frame-rate-independent lerp — same curve liveline uses for smoothValue. */
const lerpPrice = (current: number, target: number, speed: number, dt: number): number => {
  const factor = 1 - Math.pow(1 - speed, dt / 16.67);
  return current + (target - current) * factor;
};

const PRICE_LERP_SPEED = 0.12;

/**
 * Price readout with fluid digit motion. Liveline used to drive this via
 * `showValue` (RAF textContent of its lerped smoothValue). Splitting the
 * chrome into a plain React label made updates snap on each poll — restore
 * the same lerp so dollars roll instead of jump.
 */
export const BtcPriceLabel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { value, failed, chartPaused } = useBtcFeed();
  const reducedMotion = usePrefersReducedMotion();
  const valueElRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const [announced, setAnnounced] = useState<string | null>(null);

  useEffect(() => {
    targetRef.current = value;
    if (value === null) return;
    // First tick or reduced/paused chrome: land on the value immediately.
    if (displayRef.current === null || reducedMotion || chartPaused) {
      displayRef.current = value;
      const text = formatUsd(value);
      if (valueElRef.current) valueElRef.current.textContent = text;
      setAnnounced(text);
    }
  }, [value, reducedMotion, chartPaused]);

  useEffect(() => {
    if (!(failed && value === null)) return;
    displayRef.current = null;
    targetRef.current = null;
    if (valueElRef.current) valueElRef.current.textContent = '—';
    setAnnounced(null);
  }, [failed, value]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const target = targetRef.current;
      const current = displayRef.current;
      if (
        target !== null &&
        current !== null &&
        !reducedMotion &&
        !chartPaused &&
        valueElRef.current
      ) {
        let next = lerpPrice(current, target, PRICE_LERP_SPEED, dt);
        // formatUsd rounds to dollars — snap when within half a dollar.
        if (Math.abs(next - target) < 0.5) next = target;
        displayRef.current = next;
        const text = formatUsd(next);
        if (valueElRef.current.textContent !== text) {
          valueElRef.current.textContent = text;
          setAnnounced(text);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [reducedMotion, chartPaused]);

  const loading = value === null && !failed;
  const ariaLabel =
    announced !== null ? `Bitcoin ${announced}` : failed ? 'Bitcoin price unavailable' : 'Bitcoin price loading';

  return (
    <div
      className={`btc-price ps2-tnum ${compact ? 'btc-price--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div ref={valueElRef} className="btc-price__value">
        {loading ? '…' : failed && value === null ? '—' : null}
      </div>
    </div>
  );
};
