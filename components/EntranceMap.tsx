'use client';

import { useCrowd, getDensityColor } from '@/context/CrowdContext';

// Gate SVG positions (viewBox 0 0 700 480)
// Stadium ellipse: cx=350, cy=240, rx=158, ry=122
const GATES = [
  { id: 'gate-north',  label: 'Portail A1',  sub: 'Entrée Principale',   gx: 350, gy: 70,  lx:350, ly:58,  tx:0,   ty:-1, px1:350,py1:89,  px2:350,py2:118 },
  { id: 'gate-south',  label: 'Portail A2',  sub: 'Entrée Sud',          gx: 350, gy: 412, lx:350, ly:432, tx:0,   ty:1,  px1:350,py1:393, px2:350,py2:362 },
  { id: 'gate-east-a', label: 'Portail B1',  sub: 'Est Haut',             gx: 548, gy: 178, lx:568, ly:178, tx:1,   ty:0,  px1:513,py1:178, px2:494,py2:188 },
  { id: 'gate-east-b', label: 'Portail B2',  sub: 'Est Bas',              gx: 548, gy: 302, lx:568, ly:302, tx:1,   ty:0,  px1:513,py1:302, px2:494,py2:293 },
  { id: 'gate-west',   label: 'Portail C1',  sub: 'Entrée Ouest',        gx: 152, gy: 240, lx:132, ly:240, tx:-1,  ty:0,  px1:187,py1:240, px2:192,py2:240 },
  { id: 'gate-vip',    label: 'Portail VIP', sub: 'Entrée Premium',      gx: 218, gy: 104, lx:198, ly:92,  tx:-1,  ty:-1, px1:238,py1:120, px2:254,py2:143 },
  { id: 'gate-away',   label: 'Portail D1',  sub: 'Fans Visiteurs',       gx: 482, gy: 378, lx:502, ly:394, tx:1,   ty:1,  px1:462,py1:362, px2:445,py2:348 },
];

export default function EntranceMap() {
  const { zones } = useCrowd();
  const zoneMap   = Object.fromEntries(zones.map(z => [z.id, z]));

  return (
    <div className="w-full rounded-3xl border border-white/5 bg-zinc-900 overflow-hidden shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <p className="text-sm font-semibold text-white">Stadium Entrance Overview</p>
          <p className="text-xs text-zinc-500 mt-0.5">Live gate queue status · updates every 3 s</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {[['#34d399','Low'],['#fbbf24','Moderate'],['#f43f5e','Busy']].map(([clr, lbl]) => (
            <span key={lbl} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full inline-block" style={{ background: clr }} />
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* SVG */}
      <svg viewBox="0 0 700 480" className="w-full" style={{ background: '#0f0f15' }}>

        {/* ── Ambient glow under stadium ─────────── */}
        <ellipse cx={350} cy={240} rx={210} ry={165} fill="rgba(16,185,129,0.03)" />

        {/* ── Approach path lines ────────────────── */}
        {GATES.map(g => {
          const zone = zoneMap[g.id];
          if (!zone) return null;
          const c = getDensityColor(zone.density);
          return (
            <line key={`path-${g.id}`}
              x1={g.px1} y1={g.py1} x2={g.px2} y2={g.py2}
              stroke={c.stroke} strokeWidth={2} strokeDasharray="4 3" opacity={0.35}
            />
          );
        })}

        {/* ── Stadium building ───────────────────── */}
        {/* Outer ring */}
        <ellipse cx={350} cy={240} rx={162} ry={125} fill="#0c0c14" stroke="#1f2035" strokeWidth={2} />
        {/* Seating tier */}
        <ellipse cx={350} cy={240} rx={148} ry={113} fill="#111118" stroke="#252535" strokeWidth={1} />
        {/* Pitch */}
        <ellipse cx={350} cy={240} rx={102} ry={78} fill="#0d2218" stroke="#1a3828" strokeWidth={1.5} />
        {/* Pitch markings */}
        <ellipse cx={350} cy={240} rx={95}  ry={71} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <line x1={350} y1={169} x2={350} y2={311} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <ellipse cx={350} cy={240} rx={22}  ry={22} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <circle cx={350} cy={240} r={2.5}   fill="rgba(255,255,255,0.2)" />
        {/* Penalty areas */}
        <rect x={255} y={213} width={34} height={54} rx={2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <rect x={411} y={213} width={34} height={54} rx={2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

        {/* ── Stadium center label ───────────────── */}
        <text x={350} y={238} textAnchor="middle" fontSize={10} fontWeight={700}
          fill="rgba(255,255,255,0.1)" letterSpacing={4}>
          STADIUM
        </text>
        <text x={350} y={252} textAnchor="middle" fontSize={7}
          fill="rgba(255,255,255,0.06)" letterSpacing={2}>
          CAPACITY 80,000
        </text>

        {/* ── Gate markers ───────────────────────── */}
        {GATES.map(g => {
          const zone = zoneMap[g.id];
          if (!zone) return null;
          const c      = getDensityColor(zone.density);
          const isHigh = zone.density > 75;

          // Queue bar direction (extends away from stadium center)
          const qBarW  = 38;
          const qFill  = Math.round((zone.density / 100) * qBarW);
          const isVert = g.tx === 0;
          const barX   = isVert ? g.gx - qBarW / 2 : (g.tx > 0 ? g.gx + 38 : g.gx - 38 - qBarW);
          const barY   = isVert ? (g.ty > 0 ? g.gy + 22 : g.gy - 30) : g.gy - 4;

          return (
            <g key={g.id}>
              {/* Pulse ring for busy gates */}
              {isHigh && (
                <ellipse cx={g.gx} cy={g.gy} rx={32} ry={20}
                  fill="none" stroke={c.stroke} strokeWidth={1} opacity={0.25}
                  className="animate-ping"
                />
              )}

              {/* Gate badge */}
              <rect x={g.gx - 34} y={g.gy - 18} width={68} height={36}
                rx={10} fill={c.fill} stroke={c.stroke} strokeWidth={isHigh ? 1.8 : 1}
              />

              {/* Gate name */}
              <text x={g.gx} y={g.gy - 4} textAnchor="middle" fontSize={8.5}
                fill="rgba(255,255,255,0.65)" fontWeight={500}>
                {g.label}
              </text>

              {/* Density % */}
              <text x={g.gx} y={g.gy + 9} textAnchor="middle" fontSize={12}
                fill={c.stroke} fontWeight={700}>
                {zone.density}%
              </text>

              {/* Sub-label below badge */}
              <text
                x={g.lx} y={g.ly}
                textAnchor={g.tx < 0 ? 'end' : g.tx > 0 ? 'start' : 'middle'}
                fontSize={7} fill="rgba(255,255,255,0.28)">
                {g.sub}
              </text>

              {/* Wait time tag */}
              <rect x={g.gx - 22} y={g.gy + 20} width={44} height={14} rx={4}
                fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
              />
              <text x={g.gx} y={g.gy + 30} textAnchor="middle" fontSize={7.5}
                fill="rgba(255,255,255,0.55)">
                ~{zone.waitTime} min wait
              </text>

              {/* Queue bar (outside gate, away from stadium) */}
              <rect x={barX} y={barY} width={qBarW} height={6} rx={3}
                fill="rgba(255,255,255,0.05)"
              />
              <rect x={barX} y={barY} width={qFill} height={6} rx={3}
                fill={c.stroke} opacity={0.55}
              />
            </g>
          );
        })}

        {/* ── Best gate annotation ───────────────── */}
        {(() => {
          const best = [...Object.values(zoneMap)].sort((a,b) => a.density - b.density)[0];
          const g    = GATES.find(x => x.id === best?.id);
          if (!g) return null;
          return (
            <g>
              <rect x={g.gx - 30} y={g.gy - 46} width={60} height={14} rx={4}
                fill="#34d399" opacity={0.9}
              />
              <text x={g.gx} y={g.gy - 36} textAnchor="middle" fontSize={7.5}
                fill="#052e16" fontWeight={700}>
                ✓ BEST ENTRY
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
