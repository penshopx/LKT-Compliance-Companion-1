import { motion } from 'framer-motion';
import { usePhase, snap } from '../usePhase';

const WORDS = [
  { w: 'Neraca.', x: '7%', y: '14%' },
  { w: 'Catatan atas laporan.', x: '38%', y: '28%' },
  { w: 'Standar mana?', x: '12%', y: '44%' },
  { w: 'Referensi tersebar.', x: '46%', y: '58%' },
  { w: 'Tenggat?', x: '20%', y: '70%' },
];

export function HookScene() {
  const p = usePhase([150, 600, 1050, 1500, 1950, 2700, 3500, 4900]);
  const calm = p >= 6;
  return (
    <motion.div
      className="absolute inset-0 ink-grid"
      style={{ background: 'var(--ink)' }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {WORDS.map((item, i) => (
        <motion.div
          key={item.w}
          className="fd absolute font-extrabold"
          style={{ left: item.x, top: item.y, fontSize: '8.5vmin', color: i === 4 ? 'var(--signal)' : 'hsl(210 60% 96%)', whiteSpace: 'nowrap' }}
          initial={{ opacity: 0, y: '40%', rotate: i % 2 ? 3 : -3 }}
          animate={
            calm
              ? { opacity: 0.12, y: 0, rotate: 0, scale: 0.92 }
              : p > i
                ? { opacity: 1, y: 0, rotate: i % 2 ? 1.5 : -1.5 }
                : { opacity: 0, y: '40%' }
          }
          transition={snap}
        >
          {item.w}
        </motion.div>
      ))}

      <motion.div
        className="absolute"
        style={{ left: '7%', bottom: '15%', right: '7%' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: calm ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="fm" style={{ fontSize: '2vmin', color: 'var(--sky)', letterSpacing: '0.2em', margin: 0 }}>
          LAPORAN KEUANGAN TAHUNAN
        </p>
        <motion.p
          className="fd font-bold"
          style={{ fontSize: '6.4vmin', color: 'white', margin: '1.5vmin 0 0', lineHeight: 1.05 }}
          initial={{ y: 30 }}
          animate={{ y: calm ? 0 : 30 }}
          transition={snap}
        >
          Persiapannya sering terasa <span style={{ color: 'var(--sky)' }}>tercerai-berai.</span>
        </motion.p>
      </motion.div>

      {/* ledger line sweep -> expands into paper curtain */}
      <motion.div
        className="absolute left-0 right-0"
        style={{ top: '50%', height: '100%', marginTop: '-50%', background: 'var(--paper)', transformOrigin: 'center' }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={p >= 8 ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
        transition={{ duration: 0.55, ease: [0.7, 0, 0.2, 1] }}
      />
      <motion.div
        className="absolute left-0"
        style={{ top: '50%', height: '0.6vmin', width: '100%', background: 'var(--sky)', transformOrigin: 'left' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: p >= 7 ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.7, 0, 0.2, 1] }}
      />
    </motion.div>
  );
}
