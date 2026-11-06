import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../utils/preferences';

const TICKER_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/ticker';
const CANDLES_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60';
/** Ticker-only poll. Coinbase public REST allows 10 req/s/IP (burst 15); 1 Hz
 *  stays ~10× under that. Candles load once on mount — do not re-poll them. */
const POLL_MS = 1_000;
/** 5-minute sparkline window — shorter than 15m so each tick moves more. */
export const BTC_WINDOW_SECS = 300;
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
