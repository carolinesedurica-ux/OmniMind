import React, { useEffect, useState, useMemo } from 'react';
import { motion, useScroll, useSpring, useTransform, AnimatePresence } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export default function AtmosphericBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [timeState, setTimeState] = useState<{ hue: string; intensity: number }>({
    hue: 'cyan',
    intensity: 0.5,
  });

  // Time of day logic
  useEffect(() => {
    const updateAtmosphere = () => {
      const now = new Date();
      const hours = now.getHours();
      
      // Early morning (4-8): Cyan leaning
      // Day (8-17): Cyan intense
      // Evening (17-21): Violet leaning
      // Night (21-4): Violet intense
      
      let hue = 'cyan';
      let intensity = 0.5;

      if (hours >= 17 || hours < 5) {
        hue = 'violet';
        intensity = hours >= 21 || hours < 4 ? 0.3 : 0.2;
      } else {
        hue = 'cyan';
        intensity = hours >= 10 && hours < 15 ? 0.4 : 0.3;
      }

      setTimeState({ hue, intensity });
    };

    updateAtmosphere();
    const interval = setInterval(updateAtmosphere, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Generate particles
  useEffect(() => {
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 20,
      delay: Math.random() * -20,
    }));
    setParticles(newParticles);
  }, []);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMoved, setIsMoved] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsMoved(true);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050506]">
      {/* Dynamic Gradients */}
      <motion.div 
        animate={{
          scale: [1, 1.2, 1],
          opacity: [timeState.intensity, timeState.intensity + 0.1, timeState.intensity],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute -top-1/4 -left-1/4 w-full h-full rounded-full blur-[160px] ${
          timeState.hue === 'cyan' ? 'bg-cyan/15' : 'bg-violet/15'
        }`}
      />
      
      <motion.div 
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [timeState.intensity - 0.1, timeState.intensity, timeState.intensity - 0.1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute -bottom-1/4 -right-1/4 w-full h-full rounded-full blur-[160px] ${
          timeState.hue === 'cyan' ? 'bg-violet/15' : 'bg-cyan/15'
        }`}
      />

      {/* Mouse Follow Glow */}
      <motion.div 
        animate={{
          x: mousePos.x - 200,
          y: mousePos.y - 200,
          opacity: isMoved ? 0.4 : 0
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 50, mass: 0.5 }}
        className={`absolute w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none ${
          timeState.hue === 'cyan' ? 'bg-cyan/10' : 'bg-violet/10'
        }`}
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_center,#ffffff1a_1px,transparent_1px)] bg-[size:100px_100px]" />

      {/* Moving Particles */}
      <svg className="absolute inset-0 w-full h-full">
        <AnimatePresence>
          {particles.map((p) => (
            <motion.circle
              key={p.id}
              initial={{ cx: `${p.x}%`, cy: `${p.y}%`, opacity: 0 }}
              animate={{ 
                cx: [`${p.x}%`, `${p.x + (Math.random() * 10 - 5)}%`, `${p.x}%`],
                cy: [`${p.y}%`, `${p.y - 40}%`],
                opacity: [0, 0.2, 0]
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "linear"
              }}
              r={p.size}
              fill={timeState.hue === 'cyan' ? 'var(--color-cyan)' : 'var(--color-violet)'}
              className="filter blur-[1px]"
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* Scanner Effect */}
      <motion.div 
        animate={{ top: ['-20%', '120%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan/20 to-transparent opacity-30 shadow-[0_0_20px_rgba(0,242,255,0.2)]"
      />
    </div>
  );
}
