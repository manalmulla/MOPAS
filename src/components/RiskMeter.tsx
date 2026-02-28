import React from 'react';
import { motion } from 'motion/react';

interface RiskMeterProps {
  score: number;
  level: string;
}

export default function RiskMeter({ score, level }: RiskMeterProps) {
  const getColor = () => {
    if (score < 30) return '#b8a9f0'; // var(--success) — lavender
    if (score < 60) return '#f0c4e8'; // var(--warn)    — blush
    if (score < 85) return '#ff8fab'; // var(--danger)  — pink-red
    return '#ff5c85';                 // deep pink-red
  };

  const color = getColor();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}>

      {/* Circular gauge */}
      <div style={{ position: 'relative', width: 192, height: 192 }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx="96" cy="96" r="80"
            stroke="rgba(196,168,255,0.1)"
            strokeWidth="12"
            fill="transparent"
          />
          {/* Fill */}
          <motion.circle
            cx="96" cy="96" r="80"
            stroke={color}
            strokeWidth="12"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={502.4}
            initial={{ strokeDashoffset: 502.4 }}
            animate={{ strokeDashoffset: 502.4 - (502.4 * score) / 100 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>

        {/* Center text */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 700, color, letterSpacing: '-1px', lineHeight: 1 }}>
            {score}%
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color, marginTop: 4 }}>
            {level} Risk
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 4, background: 'rgba(196,168,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 2, boxShadow: `0 0 10px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </div>

    </div>
  );
}