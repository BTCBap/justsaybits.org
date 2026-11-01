import React, { useEffect, useRef } from 'react';

interface PS2BackgroundProps {
  /** True while an opaque screen or the boot overlay covers the background. */
  paused?: boolean;
  /** The visitor's reduced-motion setting, in addition to the OS preference. */
  reducedMotion?: boolean;
}

const PS2Background: React.FC<PS2BackgroundProps> = ({ paused = false, reducedMotion = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const reducedPropRef = useRef(reducedMotion);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    refreshRef.current();
  }, [paused]);

  useEffect(() => {
    reducedPropRef.current = reducedMotion;
    refreshRef.current();
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches || reducedPropRef.current;
    let raf = 0;
    let lastFrame = 0;
    let time = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    // The fog, horizon and vignette are static, so they are painted once into
    // an offscreen plate and blitted per frame instead of rebuilding gradients.
    let plate: HTMLCanvasElement | null = null;
    let bloomGradient: CanvasGradient | null = null;

    // A fixed seed keeps the monolith field composed the same way on every
    // load, so the background reads as a designed place rather than noise.
    let seed = 0x9e3779b9;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Towers (floating pillars / memory blocks). Positions are ratios so they
    // cover any viewport; the depth sort is fixed and done once.
    const towers = Array.from({ length: 50 }, () => ({
      xRatio: (random() - 0.5) * 2.5,
      z: random() * 800 + 200,
      yRatio: (random() - 0.5) * 1.5,
      width: random() * 40 + 30,
      height: random() * 300 + 100,
      speed: random() * 0.003 + 0.0015,
      offset: random() * Math.PI * 2,
    })).sort((a, b) => b.z - a.z);

    // Orbiting particles ("seven stars").
    const electrons = Array.from({ length: 7 }, () => ({
      angle: random() * Math.PI * 2,
      radiusRatio: random() * 0.25 + 0.15,
      tilt: (random() - 0.5) * 0.5,
      speed: (random() * 0.003 + 0.001) * (random() > 0.5 ? 1 : -1),
      yOffsetRatio: (random() - 0.5) * 0.4,
    }));

    // One small sprite replaces a per-particle shadowBlur.
    const glow = document.createElement('canvas');
    glow.width = 64;
    glow.height = 64;
    const glowCtx = glow.getContext('2d');
    if (glowCtx) {
      const g = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(200, 230, 255, 0.9)');
      g.addColorStop(0.25, 'rgba(120, 180, 255, 0.35)');
      g.addColorStop(1, 'rgba(120, 180, 255, 0)');
      glowCtx.fillStyle = g;
      glowCtx.fillRect(0, 0, 64, 64);
    }

    const buildPlate = () => {
      plate = document.createElement('canvas');
      plate.width = canvas.width;
      plate.height = canvas.height;
      const plateCtx = plate.getContext('2d');
      if (!plateCtx) return;
      plateCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = cssWidth / 2;
      const cy = cssHeight / 2;
      const minDim = Math.min(cssWidth, cssHeight);

      // Deep PS2 blue fog: one blue field, no purple, near-black at the rim.
      const fog = plateCtx.createRadialGradient(cx, cssHeight * 0.44, 0, cx, cssHeight * 0.44, Math.max(cssWidth, cssHeight) * 0.78);
      fog.addColorStop(0, '#0b2040');
      fog.addColorStop(0.42, '#061226');
      fog.addColorStop(0.78, '#020812');
      fog.addColorStop(1, '#01040a');
      plateCtx.fillStyle = fog;
      plateCtx.fillRect(0, 0, cssWidth, cssHeight);

      // A low horizon band, the PS2 boot's brightest quiet line.
      const horizon = plateCtx.createLinearGradient(0, cssHeight * 0.5, 0, cssHeight * 0.82);
      horizon.addColorStop(0, 'rgba(0, 0, 0, 0)');
      horizon.addColorStop(0.62, 'rgba(74, 142, 236, 0.05)');
      horizon.addColorStop(0.74, 'rgba(120, 180, 255, 0.08)');
      horizon.addColorStop(1, 'rgba(0, 0, 0, 0)');
      plateCtx.fillStyle = horizon;
      plateCtx.fillRect(0, 0, cssWidth, cssHeight);

      // Calm the edges so the centre keeps the light.
      const vignette = plateCtx.createRadialGradient(cx, cy, minDim * 0.25, cx, cy, Math.max(cssWidth, cssHeight) * 0.8);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.62, 'rgba(0, 0, 0, 0.16)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
      plateCtx.fillStyle = vignette;
      plateCtx.fillRect(0, 0, cssWidth, cssHeight);
    };

    const buildGradients = () => {
      const minDim = Math.min(cssWidth, cssHeight);

      // The single bloom behind the composition carries the light.
      bloomGradient = ctx.createRadialGradient(cssWidth / 2, cssHeight / 2, 0, cssWidth / 2, cssHeight / 2, minDim * 0.62);
      bloomGradient.addColorStop(0, 'rgba(56, 124, 224, 0.13)');
      bloomGradient.addColorStop(0.55, 'rgba(24, 70, 150, 0.06)');
      bloomGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
      cssHeight = Math.max(1, Math.round(rect.height || window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildPlate();
      buildGradients();
      draw();
    };

    const draw = () => {
      const w = cssWidth;
      const h = cssHeight;
      const minDim = Math.min(w, h);

      // One slow camera pan: the field drifts rather than bobbing in place.
      const camX = Math.sin(time * 0.0008) * 0.035;
      const camY = Math.cos(time * 0.0006) * 0.02;
      const dolly = 1 + Math.sin(time * 0.0005) * 0.012;

      if (plate) {
        ctx.drawImage(plate, 0, 0, w, h);
      }

      if (bloomGradient) {
        const pulseScale = 1 + Math.sin(time * 0.01) * 0.06;
        ctx.globalAlpha = 0.7 + Math.sin(time * 0.01) * 0.2;
        ctx.fillStyle = bloomGradient;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, minDim * 0.52 * pulseScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const cx = w / 2;
      const cy = h / 2;

      towers.forEach(tower => {
        const yBob = Math.sin(time * tower.speed + tower.offset) * 50;
        const xWorld = tower.xRatio * w - camX * w;
        const yWorld = tower.yRatio * h + yBob - camY * h;
        const scale = (400 / tower.z) * dolly;
        const x2d = cx + xWorld * scale;
        const y2d = cy + yWorld * scale;
        const w2d = tower.width * scale;
        const h2d = tower.height * scale;

        if (scale > 0 && x2d > -w2d && x2d < w + w2d && y2d > -h2d && y2d < h + h2d) {
          const alpha = Math.min(1, Math.max(0, scale * 0.4));
          ctx.fillStyle = `rgba(110, 168, 255, ${alpha * 0.1})`;
          ctx.fillRect(x2d - w2d / 2, y2d - h2d / 2, w2d, h2d);
          ctx.strokeStyle = `rgba(150, 200, 255, ${alpha * 0.25})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x2d - w2d / 2, y2d - h2d / 2, w2d, h2d);
        }
      });

      electrons.forEach(elec => {
        elec.angle += elec.speed * 2;
        const radius = elec.radiusRatio * (minDim * 1.5);
        const yOffset = elec.yOffsetRatio * minDim;
        const x3d = Math.cos(elec.angle) * radius;
        const z3d = Math.sin(elec.angle) * radius;
        const y3d = z3d * elec.tilt + yOffset;
        const zDepth = 400 + z3d * 0.5;
        const scale = 400 / zDepth;
        const px = cx + x3d * scale - camX * minDim * 0.5;
        const py = cy + y3d * scale - camY * minDim * 0.5;
        const size = Math.max(0.5, 2 * scale);
        const alpha = Math.min(1, scale);

        ctx.globalAlpha = alpha * 0.85;
        const spriteSize = Math.max(8, size * 9);
        ctx.drawImage(glow, px - spriteSize / 2, py - spriteSize / 2, spriteSize, spriteSize);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const canAnimate = () => !pausedRef.current && !document.hidden && !reducedMotion;

    const frame = (timestamp: number) => {
      if (!canAnimate()) {
        raf = 0;
        return;
      }
      if (!lastFrame) lastFrame = timestamp;
      // Cap at 30 fps: the layer is decorative, and this halves its GPU cost.
      if (timestamp - lastFrame >= 33) {
        lastFrame = timestamp;
        time += 2;
        draw();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || !canAnimate()) return;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    refreshRef.current = () => {
      reducedMotion = motionQuery.matches || reducedPropRef.current;
      if (canAnimate()) {
        draw();
        start();
      } else {
        stop();
        if (reducedMotion && !document.hidden) draw();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else refreshRef.current();
    };

    const handleMotionPreference = () => {
      reducedMotion = motionQuery.matches || reducedPropRef.current;
      if (reducedMotion) stop();
      refreshRef.current();
    };

    resize();
    if (reducedMotion) {
      // Static frame: the fog and one composition, no animation.
      draw();
    } else {
      start();
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    motionQuery.addEventListener('change', handleMotionPreference);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="ps2-backdrop fixed inset-0 z-0 pointer-events-none w-full h-full"
    />
  );
};

export default PS2Background;
