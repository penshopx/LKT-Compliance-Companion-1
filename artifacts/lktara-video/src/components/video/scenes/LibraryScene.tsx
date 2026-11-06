import { motion } from 'framer-motion';
import { usePhase, snap, glide } from '../usePhase';

const SOURCES = [
  ['OJK', 'Laporan keuangan berkala emiten'],
  ['PPPK Kemenkeu', 'Laporan tahunan KJPP'],
  ['Hukumonline', 'Kepada siapa LK disampaikan'],
  ['Universitas Ciputra', 'Pentingnya LKT'],
  ['Zahir', 'Annual vs financial report'],
  ['Kledo', 'Laporan keuangan tahunan'],
  ['SIP Law Firm', 'Laporan keuangan tahunan'],
  ['Ajaib', 'Annual report'],
  ['Wordsmith', 'Jenis LKT'],
  ['BCA Ocean', 'Annual report perusahaan'],
  ['Levner', 'Annual report adalah'],
];
const QUERY = 'laporan keuangan tahunan';

function Card({ src, i, marked }: { src: string[]; i: number; marked: boolean }) {
  return (
    <div style={{ width: '30vmin', flexShrink: 0, background: 'var(--ink-2)', border: `1px solid ${marked ? 'var(--signal)' : 'var(--ink-line)'}`, borderRadius: '1.8vmin', padding: '2.2vmin', boxSizing: 'border-box', position: 'relative' }}>
      <p className="fm" style={{ fontSize: '1.7vmin', color: 'var(--sky)', margin: 0, letterSpacing: '0.12em' }}>{String(i + 1).padStart(2, '0')} · {src[0].toUpperCase()}</p>
      <p className="fd font-bold" style={{ fontSize: '2.9vmin', color: 'white', margin: '1.2vmin 0 1.6vmin', lineHeight: 1.1, minHeight: '6.4vmin' }}>{src[1]}</p>
      <span className="fm" style={{ fontSize: '1.5vmin', color: 'hsl(38 96% 70%)', border: '1px solid hsl(38 96% 52% / .4)', borderRadius: '99vmin', padding: '0.4vmin 1.2vmin' }}>Belum diverifikasi</span>
      {marked && (
        <motion.div style={{ position: 'absolute', top: '-1vmin', right: '2vmin', width: '3vmin', height: '4.4vmin', background: 'var(--signal)', clipPath: 'polygon(0 0,100% 0,100% 100%,50% 75%,0 100%)' }}
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={snap} />
      )}
    </div>
  );
}

export function LibraryScene() {
  const p = usePhase([100, 400, 2600, 3300, 4700]);
  const typedTimes = Array.from({ length: QUERY.length }, (_, i) => 500 + i * 70);
  const typed = usePhase(typedTimes);
  const out = p >= 5;
  return (
    <motion.div className="absolute inset-0 ink-grid" style={{ background: 'var(--ink)' }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {/* headline */}
      <motion.div className="absolute" style={{ left: '6%', top: '9%', width: '60%' }}
        animate={{ y: out ? '-60%' : 0, opacity: out ? 0 : 1 }} transition={glide}>
        <motion.p className="fm" style={{ fontSize: '2vmin', color: 'var(--sky)', letterSpacing: '0.18em', margin: 0, fontWeight: 700 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>02 · PUSTAKA REFERENSI</motion.p>
        <motion.h2 className="fd font-extrabold" style={{ fontSize: '8.6vmin', color: 'white', margin: '1.4vmin 0 0', lineHeight: 1 }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={snap}>
          <span style={{ color: 'var(--sky)' }}>11</span> sumber, satu pustaka.
        </motion.h2>
      </motion.div>

      {/* search bar */}
      <motion.div className="absolute" style={{ left: '6%', top: '33%', width: '56%', display: 'flex', alignItems: 'center', gap: '2vmin', background: 'hsl(210 80% 99%)', borderRadius: '1.6vmin', padding: '2vmin 2.6vmin', boxSizing: 'border-box' }}
        initial={{ scaleX: 0.2, opacity: 0 }} animate={out ? { opacity: 0, y: -40 } : { scaleX: p >= 2 ? 1 : 0.2, opacity: p >= 2 ? 1 : 0 }}
        transition={glide}>
        <svg viewBox="0 0 24 24" style={{ width: '3.4vmin', height: '3.4vmin' }} fill="none" stroke="var(--blue)" strokeWidth="2.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <span style={{ fontSize: '3vmin', color: 'var(--text)', fontWeight: 600 }}>{QUERY.slice(0, typed)}</span>
        <motion.span style={{ width: '0.3vmin', height: '3.4vmin', background: 'var(--blue)' }} animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
      </motion.div>

      {/* scope note */}
      <motion.div className="absolute fm" style={{ right: '6%', top: '33%', width: '28%', fontSize: '2vmin', color: 'hsl(210 60% 90%)', lineHeight: 1.6, borderLeft: '0.4vmin solid var(--signal)', paddingLeft: '2vmin' }}
        initial={{ opacity: 0, x: 30 }} animate={{ opacity: p >= 4 && !out ? 1 : 0, x: p >= 4 ? 0 : 30 }} transition={snap}>
        OJK → khusus perusahaan publik<br />PPPK → khusus KJPP<br /><span style={{ color: 'var(--signal)' }}>Cek cakupan sebelum dipakai.</span>
      </motion.div>

      {/* card rails */}
      {[0, 1].map((row) => (
        <motion.div key={row} className="absolute" style={{ left: 0, top: row === 0 ? '52%' : '74%', display: 'flex', gap: '2vmin' }}
          initial={{ x: row === 0 ? '10vmin' : '-40vmin', opacity: 0 }}
          animate={out ? { y: '-120vh', opacity: 0 } : { x: row === 0 ? '-24vmin' : '-4vmin', opacity: 1 }}
          transition={out ? { duration: 0.6, ease: [0.7, 0, 0.3, 1], delay: row * 0.08 } : { duration: 5, ease: 'linear', opacity: { duration: 0.4 } }}>
          {(row === 0 ? SOURCES.slice(0, 6) : SOURCES.slice(6)).map((s, j) => {
            const i = row === 0 ? j : j + 6;
            return <Card key={s[0]} src={s} i={i} marked={p >= 3 && i === 2} />;
          })}
        </motion.div>
      ))}

      <motion.div className="absolute inset-0" style={{ background: 'var(--paper)', transformOrigin: 'bottom' }}
        initial={{ scaleY: 0 }} animate={{ scaleY: out ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.15, ease: [0.7, 0, 0.2, 1] }} />
    </motion.div>
  );
}
