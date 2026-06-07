'use client';

import { useCrowd } from '@/context/CrowdContext';
import { useToast } from '@/context/ToastContext';
import { useState } from 'react';
import Link from 'next/link';

type SectionId = 'north' | 'south' | 'east' | 'west' | 'upper' | 'away' | 'vip' | 'family';

function densityToColor(d: number) {
  if (d >= 75) return { fill: '#ef4444', text: '#fca5a5', label: 'FULL',   ring: 'ring-rose-500' };
  if (d >= 50) return { fill: '#f59e0b', text: '#fcd34d', label: 'BUSY',   ring: 'ring-amber-400' };
  if (d >= 25) return { fill: '#22c55e', text: '#86efac', label: 'NORMAL', ring: 'ring-emerald-400' };
  return               { fill: '#3f3f46', text: '#71717a', label: 'QUIET',  ring: 'ring-zinc-600' };
}

function emotionIcon(e: string) {
  if (e === 'angry')    return '😡';
  if (e === 'agitated') return '😤';
  if (e === 'tense')    return '😰';
  return '😊';
}

export default function StadiumPage() {
  const { sections, zones, emotionZones, dispatches } = useCrowd();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<SectionId | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);

  const sectionMap: Record<SectionId, typeof sections[0] | undefined> = {
    north:  sections.find(s => s.stand === 'North Stand'),
    south:  sections.find(s => s.stand === 'South Stand'),
    east:   sections.find(s => s.stand === 'East Stand'),
    west:   sections.find(s => s.stand === 'West Stand'),
    upper:  sections.find(s => s.stand === 'Upper Deck'),
    away:   sections.find(s => s.stand === 'Away End'),
    vip:    sections.find(s => s.stand === 'VIP'),
    family: sections.find(s => s.stand === 'Family'),
  };

  const gateMap: Record<SectionId, typeof zones[0] | undefined> = {
    north:  zones.find(z => z.id === 'gate-north'),
    south:  zones.find(z => z.id === 'gate-south'),
    east:   zones.find(z => z.id === 'gate-east-a'),
    west:   zones.find(z => z.id === 'gate-west'),
    upper:  zones.find(z => z.id === 'gate-north'),
    away:   zones.find(z => z.id === 'gate-away'),
    vip:    zones.find(z => z.id === 'gate-vip'),
    family: zones.find(z => z.id === 'gate-south'),
  };

  function getDensity(id: SectionId) {
    const s = sectionMap[id];
    if (!s) return 0;
    const pct = Math.round((s.occupied / s.capacity) * 100);
    return isNaN(pct) ? 0 : pct;
  }

  function getEmotion(id: SectionId): string {
    const names: Record<SectionId, string> = {
      north: 'north', south: 'south', east: 'east', west: 'west',
      upper: 'upper', away: 'away-sec', vip: 'vip', family: 'family',
    };
    const ez = emotionZones.find(z => z.id.includes(names[id]));
    return ez?.emotion ?? 'calm';
  }

  const activeDispatches = dispatches.filter(d => !d.resolved).length;
  const totalOccupied = sections.reduce((a, s) => a + s.occupied, 0);
  const totalCapacity = sections.reduce((a, s) => a + s.capacity, 0);
  const overallPct = Math.round((totalOccupied / totalCapacity) * 100);

  const sel = selected ? sectionMap[selected] : null;
  const selDensity = selected ? getDensity(selected) : 0;
  const selColor = densityToColor(selDensity);
  const selGate = selected ? gateMap[selected] : null;
  const selEmotion = selected ? getEmotion(selected) : 'calm';
  const selEz = selected ? emotionZones.find(z => z.id.includes(selected)) : null;

  type SectionDef = { id: SectionId; x: number; y: number; w: number; h: number; rx?: number; label: string };
  const svgSections: SectionDef[] = [
    { id: 'north',  x: 120, y: 20,  w: 360, h: 80,  label: 'North Stand'  },
    { id: 'south',  x: 120, y: 300, w: 360, h: 80,  label: 'South Stand'  },
    { id: 'west',   x: 20,  y: 100, w: 80,  h: 200, label: 'West'         },
    { id: 'east',   x: 500, y: 100, w: 80,  h: 200, label: 'East'         },
    { id: 'upper',  x: 30,  y: 30,  w: 80,  h: 60,  label: 'Upper N',     },
    { id: 'away',   x: 490, y: 30,  w: 80,  h: 60,  label: 'Away End',    },
    { id: 'vip',    x: 30,  y: 310, w: 80,  h: 60,  label: 'VIP',         },
    { id: 'family', x: 490, y: 310, w: 80,  h: 60,  label: 'Family',      },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-5" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">🏟️ Carte du Stade en Direct</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Simulation en temps réel de la foule — cliquez sur une zone pour plus de détails</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="rounded-xl bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
              Total: <span className="font-bold text-white">{totalOccupied.toLocaleString()}</span>
              <span className="text-zinc-500"> / {totalCapacity.toLocaleString()}</span>
            </div>
            <div className={`rounded-xl px-3 py-1.5 text-xs font-bold ${overallPct >= 75 ? 'bg-rose-500/20 text-rose-400' : overallPct >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {overallPct}% capacité
            </div>
            {activeDispatches > 0 && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-400 animate-pulse">
                🚨 {activeDispatches} security dispatch{activeDispatches > 1 ? 'es' : ''}
              </div>
            )}
            <button
              onClick={() => {
                setEmergencyActive(prev => !prev);
                showToast(emergencyActive ? '🚨 Emergency mode DEACTIVATED' : '🚨 EMERGENCY MODE ACTIVATED — All security to pre-deployment stations', emergencyActive ? 'warning' : 'error');
              }}
              className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                emergencyActive
                  ? 'bg-rose-600 text-white animate-pulse border border-rose-400'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
              }`}
            >
              {emergencyActive ? '🚨 EMERGENCY ACTIVE' : '🚨 Emergency'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-8">
        {/* ── SVG Stadium map ── */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800/60 p-6">
          <svg viewBox="0 0 600 400" className="w-full" style={{ maxHeight: 420 }}>
            {/* Pitch */}
            <rect x="120" y="100" width="360" height="200" rx="8" fill="#166534" stroke="#15803d" strokeWidth="2" />
            {/* Centre circle */}
            <circle cx="300" cy="200" r="40" fill="none" stroke="#15803d" strokeWidth="1.5" />
            <line x1="300" y1="100" x2="300" y2="300" stroke="#15803d" strokeWidth="1.5" />
            {/* Goals */}
            <rect x="118" y="175" width="12" height="50" fill="#052e16" stroke="#15803d" strokeWidth="1" />
            <rect x="470" y="175" width="12" height="50" fill="#052e16" stroke="#15803d" strokeWidth="1" />

            {/* Tribunes */}
            {svgSections.map(s => {
              const d  = getDensity(s.id);
              const c  = densityToColor(d);
              const em = getEmotion(s.id);
              const isSelected = selected === s.id;
              const ez = emotionZones.find(z => z.id.includes(s.id));
              const hasDispatch = dispatches.some(d => !d.resolved && d.zoneId.includes(s.id));
              return (
                <g key={s.id} onClick={() => setSelected(isSelected ? null : s.id)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={s.x} y={s.y} width={s.w} height={s.h} rx={6}
                    fill={c.fill}
                    fillOpacity={isSelected ? 1 : 0.75}
                    stroke={isSelected ? '#fff' : c.fill}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  {/* Section label */}
                  <text
                    x={s.x + s.w / 2} y={s.y + s.h / 2 - 6}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#fff" fontSize="9" fontWeight="bold"
                  >{s.label}</text>
                  <text
                    x={s.x + s.w / 2} y={s.y + s.h / 2 + 8}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={c.text} fontSize="8"
                  >{d}%</text>
                  {/* Emotion emoji */}
                  <text
                    x={s.x + s.w - 10} y={s.y + 12}
                    textAnchor="middle" fontSize="10"
                  >{emotionIcon(em)}</text>
                  {/* Alert dot */}
                  {(hasDispatch || (ez && ez.fightRisk >= 70)) && (
                    <circle cx={s.x + 8} cy={s.y + 8} r="5" fill="#ef4444">
                      <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Légende */}
            <g transform="translate(120, 370)">
              {[{c:'#ef4444',l:'Complet'},{c:'#f59e0b',l:'Occupé'},{c:'#22c55e',l:'Normal'},{c:'#3f3f46',l:'Calme'}].map((item, i) => (
                <g key={i} transform={`translate(${i * 80}, 0)`}>
                  <rect x="0" y="0" width="10" height="10" rx="2" fill={item.c} />
                  <text x="14" y="9" fill="#a1a1aa" fontSize="8">{item.l}</text>
                </g>
              ))}
            </g>
          </svg>

          {/* Note de légende */}
          <p className="text-center text-xs text-zinc-600 mt-2">Cliquez sur une tribune pour détailler · 🔴 = sécurité déployée ou haut risque</p>
        </div>

        {/* ── Side panel ── */}
        <div className="flex flex-col gap-4">

          {/* Détail de la section sélectionnée */}
          {selected && sel ? (
            <div className={`rounded-2xl border p-5 ${selColor.ring} ring-1`} style={{ borderColor: selColor.fill + '44', background: selColor.fill + '11' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white text-base">{sel.stand} — {sel.name}</h2>
                <span className="text-lg">{emotionIcon(selEmotion)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="Occupé" value={sel.occupied.toLocaleString()} />
                <Stat label="Capacité" value={sel.capacity.toLocaleString()} />
                <Stat label="Remplissage" value={`${selDensity}%`} color={selColor.text} />
                <Stat label=" Émotion" value={selEmotion} color={selColor.text} />
              </div>
              {/* Barre de remplissage */}
              <div className="bg-zinc-800 rounded-full h-2 mb-3">
                <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${selDensity}%`, background: selColor.fill }} />
              </div>
              {selGate && (
                <p className="text-xs text-zinc-500">File du portail : <span className="text-zinc-300 font-medium">{selGate.queueLength} personnes · ~{selGate.waitTime} min d'attente</span></p>
              )}
              {selEz && selEz.fightRisk >= 35 && (
                <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2">
                  <p className="text-xs font-bold text-rose-400 mb-1">⚠ Risque d'incident: {selEz.fightRisk}%</p>
                  {selEz.triggers.map(t => (
                    <span key={t} className="inline-block text-[10px] bg-rose-500/10 text-rose-300 rounded px-1.5 py-0.5 mr-1 mb-1">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <p className="text-zinc-500 text-sm">Cliquez sur une zone pour l'inspecter</p>
            </div>
          )}

          {/* Résumé émotionnel */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-bold text-white mb-3">Émotion de la Foule</h3>
            <div className="space-y-2">
              {emotionZones.slice(0, 5).map(ez => (
                <div key={ez.id} className="flex items-center gap-2">
                  <span className="text-sm">{emotionIcon(ez.emotion)}</span>
                  <span className="text-xs text-zinc-400 flex-1 truncate">{ez.name}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 rounded-full w-16 bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${ez.fightRisk}%`,
                          background: ez.fightRisk >= 70 ? '#ef4444' : ez.fightRisk >= 40 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold w-6 text-right ${ez.fightRisk >= 70 ? 'text-rose-400' : ez.fightRisk >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isNaN(ez.fightRisk) ? 0 : ez.fightRisk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes actives */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-bold text-white mb-3">Menaces Actives</h3>
            {dispatches.filter(d => !d.resolved).length === 0 ? (
              <p className="text-xs text-emerald-400">✓ Aucune alerte de sécurité</p>
            ) : (
              <div className="space-y-2">
                {dispatches.filter(d => !d.resolved).slice(0, 4).map(d => (
                  <div key={d.id} className="flex items-start gap-2 text-xs">
                    <span className="text-rose-400 font-bold mt-0.5">🚨</span>
                    <div>
                      <p className="text-zinc-200 font-medium">{d.zoneName}</p>
                      <p className="text-zinc-500">Risk {d.fightRisk}%{d.etaMin ? ` · ${d.etaMin} min` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/report"
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white px-4 py-2.5 text-sm font-semibold transition-colors">
            🚨 Signaler un Incident
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
      <div className="text-lg font-bold" style={{ color: color ?? '#fff' }}>{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}
