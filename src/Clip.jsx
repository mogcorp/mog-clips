import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } from 'remotion';

const font = '"Inter","Arial Black","Helvetica Neue",Arial,sans-serif';

// Group words into short caption lines of up to 3 words (break on long gaps)
function groups(words) {
  const out = []; let cur = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length >= 3 || (prev && w.s - prev.e > 0.6)) { out.push(cur); cur = []; }
    cur.push(w);
  });
  if (cur.length) out.push(cur);
  return out.map(g => ({ s: g[0].s, e: g[g.length - 1].e, words: g }));
}

const Captions = ({ words, layoutTop }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const t = frame / fps;
  const gs = React.useMemo(() => groups(words || []), [words]);
  const g = gs.find((x, i) => t >= x.s - 0.05 && t < (gs[i + 1] ? gs[i + 1].s - 0.05 : x.e + 0.4));
  if (!g) return null;
  const pop = spring({ frame: frame - Math.round(g.s * fps), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: layoutTop, textAlign: 'center', transform: `scale(${0.85 + 0.15 * pop})` }}>
      {g.words.map((w, i) => {
        const on = t >= w.s && t < w.e + 0.08;
        return (
          <span key={i} style={{
            display: 'inline-block', margin: '0 12px', fontFamily: font, fontWeight: 900, fontSize: 92, lineHeight: 1.1,
            textTransform: 'uppercase', color: on ? '#FFE14D' : '#FFFFFF',
            WebkitTextStroke: '10px #000', paintOrder: 'stroke fill',
            textShadow: '0 8px 24px rgba(0,0,0,.6)',
          }}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Hook = ({ hook }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  if (!hook) return null;
  const inS = spring({ frame, fps, config: { damping: 16 } });
  const big = interpolate(frame, [0, 3 * fps, 3.4 * fps], [1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: 150 + 20 * (1 - big), display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - inS) * -80}px)`, opacity: inS }}>
      <div style={{
        background: '#FFFFFF', color: '#000', fontFamily: font, fontWeight: 900, textAlign: 'center',
        fontSize: 54 + 14 * big, lineHeight: 1.15, padding: `${18 + 8 * big}px ${30 + 8 * big}px`, borderRadius: 22,
        boxShadow: '0 12px 40px rgba(0,0,0,.45)', maxWidth: 960,
      }}>{hook}</div>
    </div>
  );
};

export const Clip = ({ src, hook, words, credit, layout }) => {
  const url = /^https?:/.test(src) ? src : staticFile(src);
  const fill = layout === 'fill';
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {!fill && (
        <AbsoluteFill style={{ filter: 'blur(40px) brightness(.55)', transform: 'scale(1.25)' }}>
          <OffthreadVideo src={url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <OffthreadVideo src={url} style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : { width: '100%', objectFit: 'contain' }} />
      </AbsoluteFill>
      <Hook hook={hook} />
      <Captions words={words} layoutTop={fill ? 1180 : 1330} />
      {credit ? <div style={{ position: 'absolute', bottom: 120, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,.75)', fontFamily: font, fontWeight: 600, fontSize: 34 }}>{credit}</div> : null}
    </AbsoluteFill>
  );
};
