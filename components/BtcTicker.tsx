import React, { useEffect, useRef, useState } from 'react';
import { Liveline, type LivelinePoint } from 'liveline';
import { usePrefersReducedMotion } from '../utils/preferences';

const TICKER_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/ticker';
const CANDLES_URL = 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60';
const POLL_MS = 5_000;
const WINDOW_SECS = 300;
const ACCENT = '#6ea8ff';
const MAX_POINTS = 120;

const formatUsd = (v: number): string =>
  `$${Math.round(v).toLocaleString('en-US')}`;

interface BtcTickerProps {
  compact?: boolean;
  /** Pause polling and chart motion while the menu is covered. */
  paused?: boolean;
}

/**
 * Compact BTC/USD sparkline beside the menu clock.
 * Coinbase public REST (CORS-friendly); liveline for the line.
 */
const BtcTicker: React.FC<BtcTickerProps> = ({ compact = false, paused = false }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [data, setData] = useState<LivelinePoint[]>([]);
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
        const cutoff = time - WINDOW_SECS * 2;
        const trimmed = next.filter((point) => point.time >= cutoff);
        return trimmed.length > MAX_POINTS ? trimmed.slice(-MAX_POINTS) : trimmed;
      });
    };

    const loadHistory = async () => {
      try {
        const response = await fetch(CANDLES_URL);
        if (!response.ok) throw new Error('candles');
        const candles: number[][] = await response.json();
        // Coinbase: [time, low, high, open, close, volume], newest first.
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

  if (failed && value === null) {
    return (
      <div className={`btc-ticker btc-ticker--muted ${compact ? 'btc-ticker--compact' : ''}`} aria-hidden="true">
        <div className="btc-ticker__fallback ps2-tnum">
          <div className="btc-ticker__price">—</div>
          <div className="btc-ticker__label">BTC</div>
        </div>
      </div>
    );
  }

  const ready = value !== null && data.length > 0;
  const chartPaused = paused || hidden || reducedMotion;

  return (
    <div
      className={`btc-ticker ${compact ? 'btc-ticker--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={value !== null ? `Bitcoin ${formatUsd(value)}` : 'Bitcoin price loading'}
    >
      <div className="btc-ticker__chart" aria-hidden="true">
        <Liveline
          data={data}
          value={value ?? 0}
          theme="dark"
          color={ACCENT}
          showValue
          formatValue={formatUsd}
          badge={false}
          grid={false}
          scrub={false}
          degen={false}
          exaggerate
          momentum={!reducedMotion}
          pulse={!reducedMotion}
          loading={!ready}
          paused={chartPaused}
          window={WINDOW_SECS}
          padding={{ top: 26, right: 6, bottom: 2, left: 6 }}
          lineWidth={1.5}
          lerpSpeed={reducedMotion ? 1 : 0.1}
          emptyText=""
        />
      </div>
    </div>
  );
};

export default BtcTicker;
