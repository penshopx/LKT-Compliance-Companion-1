import { motion } from 'framer-motion';
import { usePhase, snap, glide } from '../usePhase';

const GUIDES = ['Saldo tidak cocok', 'Dokumen aset hilang', 'Standar belum jelas', 'Pendapatan lintas tahun', 'Persediaan selisih', 'Catatan belum lengkap'];
const ANSWER = 'Mulai dari rekonsiliasi bank per bulan, tandai selisih, lalu konfirmasi perlakuannya dengan akuntan Anda.';

export function SolveScene() {
  const p = usePhase([100, 700, 1400, 2400, 3000, 5300]);
  const guideIdx = usePhase([1900, 2500, 3100, 3700, 4300]);
  const words = ANSWER.split(' ');
  const wordTimes = words.map((_, i) => 2500 + i * 90);
  const shownWords = usePhase(wordTimes);
  const out = p >= 6;
  return (
    <motion.div className="absolute inset-0 paper-grid" style={{ background: 'var(--paper)' }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div className="absolute" style={{ left: '6%', top: '8%' }} animate={{ opacity: out ? 0 : 1 }}>
        <motion.p className="fm" style={{ fontSize: '2vmin', color: 'var(--blue)', letterSpacing: '0.18em', margin: 0, fontWeight: 700 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>03 · SOLUSI MASALAH & KONSULTASI AI</motion.p>
        <motion.h2 className="fd font-extrabold" style={{ fontSize: '7.6vmin', margin: '1.2vmin 0 0', lineHeight: 1, color: 'var(--text)' }}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={snap}>
          Masalah ketemu <span style={{ color: 'var(--blue)' }}>jalan keluar.</span>
        </motion.h2>
      </motion.div>

      {/* left: problem -> solution */}
      <motion.div className="absolute" style={{ left: '6%', top: '34%', width: '38%' }}
        initial={{ opacity: 0, x: -40 }} animate={out ? { opacity: 0, x: -80 } : { opacity: p >= 2 ? 1 : 0, x: p >= 2 ? 0 : -40 }} transition={glide}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '2vmin', padding: '2.6vmin' }}>
          <p className="fm" style={{ fontSize: '1.8vmin', color: 'hsl(354 74% 44%)', margin: 0, letterSpacing: '0.14em', fontWeight: 700 }}>MASALAH</p>
          <motion.p key={guideIdx} className="fd font-bold" style={{ fontSize: '4vmin', margin: '1vmin 0 0' }}
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={snap}>{GUIDES[guideIdx]}</motion.p>
        </div>
        <motion.div style={{ width: '0.5vmin', height: '5vmin', background: 'var(--blue)', margin: '0 0 0 4vmin', transformOrigin: 'top' }}
          initial={{ scaleY: 0 }} animate={{ scaleY: p >= 3 ? 1 : 0 }} transition={{ duration: 0.4 }} />
        <motion.div style={{ background: 'var(--ink)', borderRadius: '2vmin', padding: '2.6vmin' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: p >= 3 ? 1 : 0, y: p >= 3 ? 0 : 20 }} transition={snap}>
          <p className="fm" style={{ fontSize: '1.8vmin', color: 'var(--sky)', margin: 0, letterSpacing: '0.14em', fontWeight: 700 }}>LANGKAH SOLUSI</p>
          <p style={{ fontSize: '2.8vmin', color: 'white', margin: '1vmin 0 0', fontWeight: 600, lineHeight: 1.3 }}>Enam panduan problem–solusi, langkah demi langkah.</p>
          <div style={{ display: 'flex', gap: '1vmin', marginTop: '1.8vmin' }}>
            {GUIDES.map((g, i) => (
              <div key={g} style={{ flex: 1, height: '0.8vmin', borderRadius: '99vmin', background: i <= guideIdx ? 'var(--sky)' : 'var(--ink-line)', transition: 'background .3s' }} />
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* right: AI chat */}
      <motion.div className="absolute" style={{ right: '6%', top: '30%', width: '42%', height: '62%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '2.4vmin', padding: '3vmin', boxSizing: 'border-box', boxShadow: '0 4vmin 8vmin -3vmin hsl(218 80% 30% / .25)', display: 'flex', flexDirection: 'column', gap: '2vmin', transformOrigin: '30% 75%' }}
        initial={{ opacity: 0, y: 60 }} animate={out ? { scale: 3.2, opacity: 0 } : { opacity: p >= 2 ? 1 : 0, y: p >= 2 ? 0 : 60 }}
        transition={out ? { duration: 0.6, ease: [0.7, 0, 0.3, 1] } : { ...glide, delay: 0.15 }}>
        <p className="fm" style={{ fontSize: '1.8vmin', color: 'var(--muted)', margin: 0, letterSpacing: '0.14em' }}>KONSULTASI AI</p>
        <motion.div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: 'var(--blue)', color: 'white', borderRadius: '2vmin 2vmin 0.4vmin 2vmin', padding: '1.8vmin 2.2vmin', fontSize: '2.5vmin', fontWeight: 600, lineHeight: 1.3 }}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: p >= 4 ? 1 : 0, scale: p >= 4 ? 1 : 0.8 }} transition={snap}>
          Saldo kas di buku besar tidak cocok dengan rekening koran. Mulai dari mana?
        </motion.div>
        <motion.div style={{ alignSelf: 'flex-start', maxWidth: '88%', background: 'hsl(214 70% 93%)', color: 'var(--text)', borderRadius: '2vmin 2vmin 2vmin 0.4vmin', padding: '1.8vmin 2.2vmin', fontSize: '2.5vmin', lineHeight: 1.35 }}
          initial={{ opacity: 0 }} animate={{ opacity: p >= 5 ? 1 : 0 }}>
          {words.slice(0, shownWords).join(' ')}
        </motion.div>
        <motion.p className="fm" style={{ marginTop: 'auto', fontSize: '1.7vmin', color: 'var(--muted)', marginBottom: 0 }}
          initial={{ opacity: 0 }} animate={{ opacity: shownWords >= words.length ? 1 : 0 }}>
          Riwayat tersimpan · bisa dihapus kapan saja
        </motion.p>
      </motion.div>

      <motion.div className="absolute inset-0" style={{ background: 'var(--ink)' }}
        initial={{ opacity: 0 }} animate={{ opacity: out ? 1 : 0 }} transition={{ duration: 0.45, delay: 0.2 }} />
    </motion.div>
  );
}
