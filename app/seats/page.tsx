'use client';

import { useCrowd } from '@/context/CrowdContext';

function pct(s: { occupied: number; capacity: number }) {
  return Math.round((s.occupied / s.capacity) * 100);
}

function sectionColor(p: number) {
  if (p < 60) return { bar: 'bg-emerald-400', text: 'text-emerald-400', ring: 'ring-emerald-400/20', label: 'Available' };
  if (p < 80) return { bar: 'bg-amber-400',   text: 'text-amber-400',   ring: 'ring-amber-400/20',   label: 'Filling'   };
  return           { bar: 'bg-rose-400',    text: 'text-rose-400',    ring: 'ring-rose-500/20',    label: 'Full'      };
}

// Simplified oval SVG section positions (viewBox 0 0 480 360)
const SVG_SECTIONS = [
  { id: 'north-a', label: 'A',  x: 175, y: 22,  w: 130, h: 44 },
  { id: 'west-b',  label: 'B',  x: 14,  y: 100, w: 68,  h: 160 },
  { id: 'east-c',  label: 'C',  x: 398, y: 100, w: 68,  h: 160 },
  { id: 'south-d', label: 'D',  x: 175, y: 296, w: 130, h: 44  },
  { id: 'upper',   label: 'U',  x: 90,  y: 22,  w: 80,  h: 318, opacity: 0.55 },
  { id: 'vip',     label: 'V',  x: 310, y: 22,  w: 80,  h: 80,  opacity: 0.55 },
  { id: 'away',    label: 'AW', x: 310, y: 260, w: 80,  h: 80,  opacity: 0.55 },
  { id: 'family',  label: 'F',  x: 90,  y: 260, w: 80,  h: 80,  opacity: 0.55 },
];

export default function SeatsPage() {
  const { sections } = useCrowd();
  const sectionMap   = Object.fromEntries(sections.map(s => [s.id, s]));

  const totalCap = sections.reduce((s, x) => s + x.capacity, 0);
  const totalOcc = sections.reduce((s, x) => s + x.occupied, 0);
  const overallPct = Math.round((totalOcc / totalCap) * 100);

  const fullest  = [...sections].sort((a, b) => pct(b) - pct(a))[0];
  const emptiest = [...sections].sort((a, b) => pct(a) - pct(b))[0];

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">

      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-6 py-5">
        <div className="mx-auto max-w-5xl flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Seat Occupancy</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Live per-section fill rate inside the stadium</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{overallPct}%</div>
              <div className="text-[10px] text-zinc-600">Overall</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{totalOcc.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-600">of {totalCap.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 grid gap-6 xl:grid-cols-[1fr_340px]">

        {/* SVG stadium visual */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">Stadium Bowl</p>
            </div>
            <div className="p-4 stadium-svg-bg" style={{ background: '#0a0a12' }}>
              <svg viewBox="0 0 480 360" className="w-full">
                {/* Pitch */}
                <ellipse cx={240} cy={180} rx={120} ry={90} fill="#0d2218" stroke="#1a3828" strokeWidth={1.5} />
                <ellipse cx={240} cy={180} rx={113} ry={83} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                <line x1={240} y1={97} x2={240} y2={263} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <ellipse cx={240} cy={180} rx={24} ry={24} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <circle cx={240} cy={180} r={2.5} fill="rgba(255,255,255,0.2)" />
                <text x={240} y={182} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.08)" fontWeight={700} letterSpacing={4}>PITCH</text>

                {/* Sections */}
                {SVG_SECTIONS.map(sv => {
                  const section = sectionMap[sv.id];
                  if (!section) return null;
                  const p   = pct(section);
                  const c   = sectionColor(p);
                  const cx  = sv.x + sv.w / 2;
                  const cy  = sv.y + sv.h / 2;
                  const fillColor = p < 60 ? 'rgba(52,211,153,0.15)' : p < 80 ? 'rgba(251,191,36,0.15)' : 'rgba(244,63,94,0.18)';
                  const stroke    = p < 60 ? '#34d399' : p < 80 ? '#fbbf24' : '#f43f5e';

                  return (
                    <g key={sv.id} opacity={sv.opacity ?? 1}>
                      <rect x={sv.x} y={sv.y} width={sv.w} height={sv.h} rx={6}
                        fill={fillColor} stroke={stroke} strokeWidth={p > 80 ? 1.5 : 1}
                      />
                      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)" fontWeight={500}>
                        {sv.label}
                      </text>
                      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={13} fill={stroke} fontWeight={700}>
                        {p}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* AI insight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-950/15 p-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Most space</p>
              <p className="font-bold text-emerald-400 text-sm">{emptiest.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{emptiest.stand} · {pct(emptiest)}% full</p>
              <p className="text-xs text-zinc-600 mt-1">{emptiest.capacity - emptiest.occupied} seats available</p>
            </div>
            <div className="rounded-2xl border border-rose-500/15 bg-rose-950/12 p-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Most full</p>
              <p className="font-bold text-rose-400 text-sm">{fullest.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{fullest.stand} · {pct(fullest)}% full</p>
              <p className="text-xs text-zinc-600 mt-1">{fullest.capacity - fullest.occupied} seats remaining</p>
            </div>
          </div>
        </div>

        {/* Section list */}
        <div className="space-y-3">
          {/* Overall bar */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-zinc-200">Stadium Total</span>
              <span className="text-sm font-bold text-white tabular-nums">{overallPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${sectionColor(overallPct).bar}`}
                style={{ width: `${overallPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
              <span>{totalOcc.toLocaleString()} seated</span>
              <span>{(totalCap - totalOcc).toLocaleString()} empty</span>
            </div>
          </div>

          {/* Per section */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">By Section</p>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {[...sections].sort((a, b) => pct(b) - pct(a)).map(s => {
                const p = pct(s);
                const c = sectionColor(p);
                return (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-zinc-200">{s.name}</span>
                        <span className="text-[10px] text-zinc-600 ml-2">{s.stand}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                          p < 60 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                          p < 80 ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                                   'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>{c.label}</span>
                        <span className={`text-xs font-bold tabular-nums ${c.text}`}>{p}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all duration-1000 ${c.bar}`} style={{ width: `${p}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-700">
                      <span>{s.occupied.toLocaleString()} seated</span>
                      <span>{s.capacity.toLocaleString()} capacity</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
