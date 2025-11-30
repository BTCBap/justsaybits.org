import React, { useEffect, useRef } from 'react';

const PS2Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    // Towers (Floating pillars/Memory blocks)
    // We use ratios relative to screen size to ensure full coverage on all devices
    const towers = Array.from({ length: 50 }, () => ({
      xRatio: (Math.random() - 0.5) * 2.5, // Covers 2.5x the width (allows for Z-depth perspective)
      z: Math.random() * 800 + 200,        // Depth (Z)
      yRatio: (Math.random() - 0.5) * 1.5, // Vertical spread ratio
      width: Math.random() * 40 + 30,
      height: Math.random() * 300 + 100,
      // Dynamic bobbing speed
      speed: Math.random() * 0.003 + 0.0015, 
      offset: Math.random() * Math.PI * 2
    }));

    // "Seven Stars" / Orbiting Electrons
    // Radii are stored as ratios of the screen's minimum dimension
    const electrons = Array.from({ length: 7 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radiusRatio: Math.random() * 0.25 + 0.15, // Relative to min(w,h)
      tilt: (Math.random() - 0.5) * 0.5,
      // Much slower speed
      speed: (Math.random() * 0.003 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      yOffsetRatio: (Math.random() - 0.5) * 0.4
    }));

    let time = 0;

    const draw = () => {
      time += 1;
      
      const minDim = Math.min(w, h);

      // 1. Background Gradient (Deep Void)
      const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w);
      gradient.addColorStop(0, '#0f172a'); // Deep Blue/Slate center
      gradient.addColorStop(0.6, '#000000');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // 2. Central Pulsing Light (Breathing effect)
      const pulseScale = 1 + Math.sin(time * 0.01) * 0.1; // Slower pulse
      const centerG = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, minDim * 0.5 * pulseScale);
      centerG.addColorStop(0, 'rgba(40, 80, 200, 0.08)');
      centerG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = centerG;
      ctx.beginPath();
      ctx.arc(w/2, h/2, minDim * 0.5 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Center coordinates
      const cx = w / 2;
      const cy = h / 2;

      // 3. Draw Towers (Sorted by Z for simple painter's algorithm)
      towers.sort((a, b) => b.z - a.z); // Draw furthest first

      towers.forEach(tower => {
        // Bobbing motion: sin wave over time
        const yBob = Math.sin(time * tower.speed + tower.offset) * 50;
        
        // Calculate World Position dynamically based on current screen size
        // This ensures they span the full width/height of any device
        const xWorld = tower.xRatio * w; 
        const yWorld = (tower.yRatio * h) + yBob;

        // Simple perspective projection
        // Scale factor decreases as Z increases
        const scale = 400 / tower.z;
        
        const x2d = cx + xWorld * scale;
        const y2d = cy + yWorld * scale;
        const w2d = tower.width * scale;
        const h2d = tower.height * scale;
        
        // Draw if roughly on screen (with generous margin for wide spread)
        if (scale > 0 && x2d > -w2d && x2d < w + w2d && y2d > -h2d && y2d < h + h2d) {
            // Opacity fades with distance
            const alpha = Math.min(1, Math.max(0, (scale * 0.4))); 
            
            // Draw Pillar
            // Fill
            ctx.fillStyle = `rgba(100, 150, 255, ${alpha * 0.1})`; 
            ctx.fillRect(x2d - w2d/2, y2d - h2d/2, w2d, h2d);
            
            // Stroke (Wireframe look)
            ctx.strokeStyle = `rgba(150, 200, 255, ${alpha * 0.25})`;
            ctx.lineWidth = 1; // Keep lines thin and clean
            ctx.strokeRect(x2d - w2d/2, y2d - h2d/2, w2d, h2d);
        }
      });

      // 4. Draw Orbiting Particles ("Seven Stars")
      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(120, 180, 255, 0.8)";
      
      electrons.forEach(elec => {
        elec.angle += elec.speed;
        
        const radius = elec.radiusRatio * (minDim * 1.5); // Dynamic radius
        const yOffset = elec.yOffsetRatio * minDim;

        // 3D Orbit projection
        const x3d = Math.cos(elec.angle) * radius;
        const z3d = Math.sin(elec.angle) * radius;
        
        // Apply tilt rotation around X axis approximately
        const y3d = z3d * elec.tilt + yOffset;
        
        // Perspective again (assuming generic camera distance)
        const zDepth = 400 + z3d * 0.5; // Flatten depth slightly
        const scale = 400 / zDepth;
        
        const px = cx + x3d * scale;
        const py = cy + y3d * scale;
        
        // Clamp size
        const size = Math.max(0.5, 2 * scale);
        const alpha = Math.min(1, scale);

        ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a faint trail or glow
        if (Math.random() > 0.95) { // Reduced trail frequency
             ctx.fillStyle = `rgba(200, 230, 255, ${alpha * 0.5})`;
             ctx.beginPath();
             ctx.arc(px, py, size * 2, 0, Math.PI * 2);
             ctx.fill();
        }
      });
      
      ctx.shadowBlur = 0;

      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
};

export default PS2Background;