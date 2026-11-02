import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { interaction } from '../utils/Interaction';
import { useMediaQuery, usePrefersReducedMotion } from '../utils/preferences';
import Wordmark from './Wordmark';

interface BootSequenceProps {
  onComplete: () => void;
  /** Called when the crossfade starts so the menu becomes interactive. */
  onReveal?: () => void;
  /** A returning visitor in this session: no gate and a 300 ms fade. */
  short?: boolean;
}

/**
 * Boot timing. The gate waits for a gesture; everything after it is bounded.
 * The visual and the boot pad start from the same gesture, so the chime can
 * never be scheduled late against a suspended context.
 */
const FULL_TOTAL_MS = 1500;
const FULL_FADE_AT_MS = 1150;
const FULL_FADE_MS = 350;

const REDUCED_TOTAL_MS = 420;
const REDUCED_FADE_AT_MS = 300;
const REDUCED_FADE_MS = 120;

const SHORT_TOTAL_MS = 340;
const SHORT_FADE_AT_MS = 30;
const SHORT_FADE_MS = 300;

const SKIP_FADE_MS = 160;
const FONT_WAIT_MS = 180;

/**
 * Hold the first frame until the two text faces are ready, but never longer
 * than a short timeout: a slow font must not become a slow intro.
 */
const settleForFonts = (): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, FONT_WAIT_MS);
    document.fonts.ready.then(finish).catch(finish);
  });
};

interface Tower {
  left: number;
  width: number;
  height: number;
  opacity: number;
}

interface Band {
  key: 'far' | 'mid' | 'near';
  base: number;
  towers: Tower[];
}

interface BandSpec {
  key: Band['key'];
  base: number;
  count: number;
  compactCount: number;
  width: [number, number];
  compactWidth: [number, number];
  height: [number, number];
  compactHeight: [number, number];
  opacity: [number, number];
}

const BANDS: BandSpec[] = [
  {
    key: 'far',
    base: 36,
    count: 14,
    compactCount: 6,
    width: [10, 20],
    compactWidth: [14, 24],
    height: [7, 14],
    compactHeight: [9, 17],
    opacity: [0.2, 0.36],
  },
  {
    key: 'mid',
    base: 31,
    count: 12,
    compactCount: 5,
    width: [22, 42],
    compactWidth: [26, 44],
    height: [12, 23],
    compactHeight: [16, 28],
    opacity: [0.28, 0.46],
  },
  {
    key: 'near',
    base: 26,
    count: 10,
    compactCount: 3,
    width: [44, 78],
    compactWidth: [52, 86],
    height: [21, 37],
    compactHeight: [28, 44],
    opacity: [0.36, 0.58],
  },
];

/** Small deterministic PRNG (mulberry32) so every boot draws the same field. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const between = (random: () => number, min: number, max: number): number =>
  min + (max - min) * random();

const buildBands = (compact: boolean): Band[] => {
  const random = seededRandom(0x5a17b17);

  return BANDS.map((spec) => {
    const count = compact ? spec.compactCount : spec.count;
    const widthRange = compact ? spec.compactWidth : spec.width;
    const heightRange = compact ? spec.compactHeight : spec.height;
    // A little overscan keeps both edges populated when the camera drifts.
    const span = 116;
    const step = span / count;

    const towers = Array.from({ length: count }, (_, index) => ({
      left: -8 + step * index + (random() - 0.5) * step * 0.72,
      width: Math.round(between(random, widthRange[0], widthRange[1])),
      height: Number(between(random, heightRange[0], heightRange[1]).toFixed(2)),
      opacity: Number(between(random, spec.opacity[0], spec.opacity[1]).toFixed(2)),
    }));

    return { key: spec.key, base: spec.base, towers };
  });
};

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete, onReveal, short = false }) => {
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const bands = useMemo(() => buildBands(coarsePointer), [coarsePointer]);

  const [started, setStarted] = useState(short);
  const [leaving, setLeaving] = useState(false);
  const [fadeMs, setFadeMs] = useState(short ? SHORT_FADE_MS : FULL_FADE_MS);

  const startedRef = useRef(short);
  const leavingRef = useRef(false);
  const doneRef = useRef(false);
  const revealedRef = useRef(false);
  const timers = useRef<number[]>([]);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  const clearTimers = useCallback(() => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  }, []);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onRevealRef.current?.();
  }, []);

  const leave = useCallback((duration: number) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setFadeMs(duration);
    setLeaving(true);
  }, []);

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimers();
    interaction.stopStart();
    onCompleteRef.current();
  }, [clearTimers]);

  /** First gesture: start the scene and ask for audio in the same activation. */
  const begin = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void interaction.start();

    const reduced = reducedRef.current;
    const fadeAt = reduced ? REDUCED_FADE_AT_MS : FULL_FADE_AT_MS;
    const fade = reduced ? REDUCED_FADE_MS : FULL_FADE_MS;

    void settleForFonts().then(() => {
      if (leavingRef.current || doneRef.current) return;
      setStarted(true);
      setFadeMs(fade);
      schedule(() => {
        reveal();
        leave(fade);
      }, fadeAt);
      schedule(complete, reduced ? REDUCED_TOTAL_MS : FULL_TOTAL_MS);
    });
  }, [complete, leave, reveal, schedule]);

  const skip = useCallback(() => {
    if (!startedRef.current || doneRef.current) return;
    clearTimers();
    reveal();
    interaction.stopStart();
    leave(SKIP_FADE_MS);
    schedule(complete, SKIP_FADE_MS + 20);
  }, [clearTimers, complete, leave, reveal, schedule]);

  // Returning visitor: the menu fades in without the gate or a second chime.
  useEffect(() => {
    if (!short) return;
    startedRef.current = true;
    let cancelled = false;
    void settleForFonts().then(() => {
      if (cancelled) return;
      setStarted(true);
      setFadeMs(SHORT_FADE_MS);
      schedule(() => {
        reveal();
        leave(SHORT_FADE_MS);
      }, SHORT_FADE_AT_MS);
      schedule(complete, SHORT_TOTAL_MS);
    });
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [short, clearTimers, complete, leave, reveal, schedule]);

  // Any key starts the system; any key after that skips it. Tab is left alone
  // so keyboard users can reach the Skip control.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || event.key === 'Shift'
        || event.key === 'Tab'
        || event.key === 'CapsLock'
      ) {
        return;
      }

      if (!startedRef.current) {
        if (event.key === 'Escape') return;
        event.preventDefault();
        begin();
        return;
      }

      if (doneRef.current) return;
      if (leavingRef.current) return;
      event.preventDefault();
      skip();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [begin, skip]);

  useEffect(() => () => {
    clearTimers();
    interaction.stopStart();
  }, [clearTimers]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!startedRef.current) {
      begin();
      return;
    }
    if (!leavingRef.current) skip();
  };

  return (
    <div
      className={`boot ${reducedMotion ? 'boot--static' : ''} ${short ? 'boot--short' : ''} ${
        leaving ? 'boot--leaving' : ''
      }`}
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${fadeMs}ms` }}
      aria-hidden={leaving ? true : undefined}
      onPointerDown={handlePointerDown}
    >
      {!started ? (
        <div
          className="boot__gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="boot-title"
        >
          <div className="boot__gate-inner">
            <Wordmark decorative />
            <h1 id="boot-title" className="sr-only">justsaybits.org</h1>
            <button type="button" className="boot__power" autoFocus onClick={begin}>
              Power on
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="sr-only" role="status">Starting system</span>
          <div className="boot__scene" aria-hidden="true">
            <div className="boot__sky" />
            <div className="boot__camera">
              <div className="boot__stage">
                {bands.map((band) => (
                  <div
                    key={band.key}
                    className={`boot__band boot__band--${band.key}`}
                    style={{ bottom: `${band.base}%` }}
                  >
                    {band.towers.map((tower, index) => (
                      <span
                        key={index}
                        className="boot__tower"
                        style={{
                          left: `${tower.left.toFixed(2)}%`,
                          width: tower.width,
                          height: `${tower.height}vh`,
                          opacity: tower.opacity,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="boot__fog boot__fog--horizon" />
              <div className="boot__fog boot__fog--low" />
            </div>
            <div className="boot__bloom" />
            <div className="boot__mark">
              <Wordmark decorative />
            </div>
            <div className="boot__vignette" />
            {!short && (
              <div className="boot__progress">
                <span />
              </div>
            )}
          </div>

          {!short && (
            <button type="button" className="boot__skip" onClick={skip}>
              Skip
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default BootSequence;
