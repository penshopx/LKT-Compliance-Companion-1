import { motion } from 'framer-motion';
import { usePhase, snap } from '../usePhase';

const LINES = [
  { t: 'Pendamping,', c: 'var(--sky)' },
  { t: 'bukan pengganti', c: 'white' },
  { t: 'akuntan atau konsultan pajak.', c: 'hsl(210 60% 80%)' },
];

export function HonestScene() {
  const p = usePhase([80, 500, 950, 1600, 3200]);
  const out = p >= 5;
  return (
    <motion.div className="absolute inset-0 ink-grid" style={{ background: 'var(--ink)' }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <div className="absolute" style={{ left: '8%', top: '20%', right: '8%' }}>
        {LINES.map((l, i) => (
          <div key={l.t} style={{ overflow: 'hidden' }}>
            <motion.p className="fd font-extrabold"
              style={{ fontSize: i === 2 ? '7vmin' : '12vmin', color: l.c, margin: 0, lineHeight: 1.04 }}
              initial={{ y: '105%' }}
              animate={{ y: out ? '-105%' : p > i ? 0 : '105%' }}
              transition={out ? { duration: 0.4, ease: [0.7, 0, 0.3, 1], delay: i * 0.05 } : snap}>
              {l.t}
            </motion.p>
          </div>
        ))}
        <motion.p className="fm" style={{ fontSize: '2.2vmin', color: 'hsl(210 60% 85%)', margin: '5vmin 0 0', letterSpacing: '0.06em', borderTop: '1px solid var(--ink-line)', paddingTop: '2.4vmin' }}
          initial={{ opacity: 0 }} animate={{ opacity: p >= 4 && !out ? 1 : 0 }}>
          Tidak menyusun laporan otomatis · tidak menyampaikan pajak atau laporan ke regulator · tanpa jaminan kepatuhan
        </motion.p>
      </div>
      <motion.div className="absolute" style={{ left: 0, right: 0, top: '50%', height: '0.6vmin', background: 'var(--sky)', transformOrigin: 'center' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: out ? 1 : 0 }} transition={{ duration: 0.45, delay: 0.15, ease: [0.7, 0, 0.2, 1] }} />
    </motion.div>
  );
}
