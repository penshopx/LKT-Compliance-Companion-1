import { motion } from 'framer-motion';
import { usePhase, snap } from '../usePhase';

export function OutroScene() {
  const p = usePhase([50, 350, 900, 1500, 2900]);
  const out = p >= 5;
  return (
    <motion.div className="absolute inset-0" style={{ background: 'var(--ink)' }}>
      <motion.div className="absolute inset-0 paper-grid" style={{ background: 'var(--paper)', transformOrigin: 'center' }}
        initial={{ scaleY: 0.006 }} animate={{ scaleY: 1 }} transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }} />
      <div className="absolute inset-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3.4vmin' }}>
          <motion.div style={{ position: 'relative', width: '17vmin', height: '17vmin', borderRadius: '3.6vmin', background: 'var(--sky)', display: 'grid', placeItems: 'center' }}
            initial={{ scale: 0, rotate: -12 }} animate={{ scale: p >= 2 ? (out ? 0.9 : 1) : 0, rotate: 0, opacity: out ? 0 : 1 }} transition={snap}>
            <span className="fd font-extrabold" style={{ fontSize: '12vmin', color: 'var(--ink)', lineHeight: 1 }}>L</span>
            <motion.span style={{ position: 'absolute', right: '-1.6vmin', top: '-1.6vmin', width: '4.4vmin', height: '4.4vmin', borderRadius: '50%', background: 'var(--signal)', border: '0.9vmin solid var(--paper)' }}
              initial={{ scale: 0 }} animate={{ scale: p >= 3 ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: p >= 2 && !out ? 1 : 0, x: p >= 2 ? 0 : -30 }} transition={{ ...snap, delay: 0.1 }}>
            <p className="fd font-extrabold" style={{ fontSize: '15vmin', margin: 0, lineHeight: 0.9, color: 'var(--ink)' }}>LKTara</p>
            <motion.div style={{ height: '0.8vmin', background: 'var(--blue)', marginTop: '1.4vmin', transformOrigin: 'left' }}
              initial={{ scaleX: 0 }} animate={{ scaleX: p >= 3 ? 1 : 0 }} transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }} />
          </motion.div>
        </div>
        <motion.p className="fd font-bold" style={{ fontSize: '5.4vmin', margin: '6vmin 0 0', color: 'var(--blue)' }}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: p >= 4 && !out ? 1 : 0, y: p >= 4 ? 0 : 24 }} transition={snap}>
          Persiapkan LKT dengan lebih terarah.
        </motion.p>
        <motion.p className="fm" style={{ fontSize: '1.9vmin', margin: '2vmin 0 0', color: 'var(--muted)', letterSpacing: '0.16em' }}
          initial={{ opacity: 0 }} animate={{ opacity: p >= 4 && !out ? 1 : 0 }}>
          PENDAMPING LAPORAN KEUANGAN TAHUNAN
        </motion.p>
      </div>
      <motion.div className="absolute inset-0" style={{ background: 'var(--ink)' }}
        initial={{ opacity: 0 }} animate={{ opacity: out ? 1 : 0 }} transition={{ duration: 0.45 }} />
    </motion.div>
  );
}
