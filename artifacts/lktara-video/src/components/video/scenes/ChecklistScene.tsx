import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePhase, snap, glide } from '../usePhase';

const ROWS = [
  'Konfirmasi standar akuntansi',
  'Kumpulkan saldo & rekonsiliasi bank',
  'Daftar aset tetap & penyusutan',
  'Siapkan catatan atas laporan',
  'Tinjau bersama akuntan',
];
const STATUS = ['Selesai', 'Selesai', 'Selesai', 'Berjalan', 'Belum'];
const TARGET = 58;

export function ChecklistScene() {
  const p = usePhase([100, 700, 1250, 1800, 2350, 2900, 3600, 4700]);
  const [pct, setPct] = useState(0);
  const target = p >= 5 ? TARGET : p >= 2 ? (p - 1) * 14 : 0;
  useEffect(() => {
    setPct(target);
  }, [target]);
  const R = 15;
  const C = 2 * Math.PI * R;
  const out = p >= 8;
  return (
    <motion.div
      className="absolute inset-0 paper-grid"
      style={{ background: 'var(--paper)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="absolute"
        style={{ left: '6%', top: '16%', width: '34%' }}
        animate={{ x: out ? '-30%' : 0, opacity: out ? 0 : 1 }}
        transition={glide}
      >
        <motion.p className="fm" style={{ fontSize: '2vmin', color: 'var(--blue)', letterSpacing: '0.18em', margin: 0, fontWeight: 700 }}
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={snap}>
          01 · DAFTAR PERSIAPAN
        </motion.p>
        <motion.h2 className="fd font-extrabold" style={{ fontSize: '8.6vmin', lineHeight: 0.98, margin: '2vmin 0 0', color: 'var(--text)' }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ ...snap, delay: 0.15 }}>
          Checklist per tahun buku.
        </motion.h2>
        <motion.p style={{ fontSize: '3.1vmin', color: 'var(--muted)', margin: '3vmin 0 0', lineHeight: 1.35 }}
          initial={{ opacity: 0 }} animate={{ opacity: p >= 3 ? 1 : 0 }} transition={{ duration: 0.4 }}>
          Status, catatan, dan progres yang selalu terlihat.
        </motion.p>
        <motion.div className="fm" style={{ marginTop: '4vmin', display: 'inline-flex', gap: '1.2vmin', alignItems: 'center', background: 'var(--ink)', color: 'white', fontSize: '2.2vmin', padding: '1.4vmin 2.4vmin', borderRadius: '1.2vmin' }}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: p >= 7 ? 1 : 0, scale: p >= 7 ? 1 : 0.8 }} transition={snap}>
          <span style={{ color: 'var(--sky)' }}>↓</span> Ekspor CSV
        </motion.div>
      </motion.div>

      {/* product panel */}
      <motion.div
        className="absolute"
        style={{ right: '5%', top: '10%', width: '50%', height: '80%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '2.4vmin', boxShadow: '0 4vmin 8vmin -3vmin hsl(218 80% 30% / .25)', padding: '4vmin', boxSizing: 'border-box' }}
        initial={{ y: '8%', scale: 1.06, opacity: 0 }}
        animate={out ? { x: '-140%', opacity: 0, scale: 0.94 } : { y: 0, scale: 1, opacity: 1 }}
        transition={out ? { duration: 0.6, ease: [0.7, 0, 0.3, 1] } : glide}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '3vmin' }}>
          <svg viewBox="0 0 36 36" style={{ width: '16vmin', height: '16vmin' }}>
            <circle cx="18" cy="18" r={R} fill="none" stroke="hsl(214 45% 91%)" strokeWidth="3.4" />
            <motion.circle cx="18" cy="18" r={R} fill="none" stroke="var(--blue)" strokeWidth="3.4" strokeLinecap="round"
              strokeDasharray={C} transform="rotate(-90 18 18)"
              animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 0.6, ease: 'easeOut' }} />
            <text x="18" y="20.5" textAnchor="middle" className="fd" style={{ fontSize: '8px', fontWeight: 800, fill: 'var(--text)' }}>{pct}%</text>
          </svg>
          <div>
            <p className="fm" style={{ fontSize: '1.9vmin', color: 'var(--muted)', margin: 0, letterSpacing: '0.14em' }}>TAHUN BUKU 2024</p>
            <p className="fd font-bold" style={{ fontSize: '4.2vmin', margin: '0.6vmin 0 0' }}>Progres persiapan</p>
            <p className="fm" style={{ fontSize: '1.8vmin', color: 'var(--signal)', margin: '0.8vmin 0 0' }}>contoh ilustratif</p>
          </div>
        </div>
        <div style={{ marginTop: '3.4vmin', display: 'flex', flexDirection: 'column', gap: '1.4vmin' }}>
          {ROWS.map((row, i) => {
            const done = p >= i + 2 && STATUS[i] === 'Selesai';
            const shown = p >= i + 1;
            const st = shown && p >= i + 2 ? STATUS[i] : 'Belum';
            return (
              <motion.div key={row}
                style={{ display: 'flex', alignItems: 'center', gap: '2vmin', padding: '1.5vmin 2vmin', borderRadius: '1.4vmin', background: done ? 'hsl(214 70% 93%)' : 'hsl(214 45% 96%)' }}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : 30 }} transition={snap}>
                <motion.div style={{ width: '3.4vmin', height: '3.4vmin', borderRadius: '0.9vmin', display: 'grid', placeItems: 'center', background: done ? 'var(--blue)' : 'transparent', border: done ? 'none' : '0.3vmin solid var(--line)', color: 'white', fontSize: '2.2vmin', fontWeight: 800 }}
                  animate={{ scale: done ? [1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
                  {done ? '✓' : ''}
                </motion.div>
                <span style={{ flex: 1, fontSize: '2.6vmin', fontWeight: 600, color: 'var(--text)' }}>{row}</span>
                <span className="fm" style={{ fontSize: '1.8vmin', padding: '0.5vmin 1.4vmin', borderRadius: '99vmin', fontWeight: 700,
                  background: st === 'Selesai' ? 'hsl(158 60% 90%)' : st === 'Berjalan' ? 'hsl(38 96% 90%)' : 'hsl(214 45% 91%)',
                  color: st === 'Selesai' ? 'var(--ok)' : st === 'Berjalan' ? 'hsl(30 90% 32%)' : 'var(--muted)' }}>{st}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div className="absolute inset-0" style={{ background: 'var(--ink)', transformOrigin: 'right' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: out ? 1 : 0 }} transition={{ duration: 0.55, delay: 0.1, ease: [0.7, 0, 0.2, 1] }} />
    </motion.div>
  );
}
