'use client';

import { useState, useMemo } from 'react';
import { useCrowd, getDensityColor } from '@/context/CrowdContext';

// Staggered exit order: smallest section first to prevent mixing
const EXIT_ORDER_SECTIONS = [
  { id: 'vip',     label: 'VIP Lounge',   wave: 1 },
  { id: 'family',  label: 'Family Zone',  wave: 2 },
  { id: 'away',    label: 'Away Section', wave: 3 },
  { id: 'north-a', label: 'North Stand',  wave: 4 },
  { id: 'south-d', label: 'South Stand',  wave: 5 },
  { id: 'west-b',  label: 'West Stand',   wave: 6 },
  { id: 'east-c',  label: 'East Stand',   wave: 7 },
  { id: 'upper',   label: 'Upper Tier',   wave: 8 },
];

function cong(n: number) {
  if (n < 40) return { bar: 'bg-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', label: 'Flowing'   };
  if (n < 70) return { bar: 'bg-amber-400',   text: 'text-amber-400',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',   label: 'Moderate'  };
  return           { bar: 'bg-rose-400',    text: 'text-rose-400',    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',    label: 'Congested' };
}

export default function ExitPage() {
  const { exitZones, sections, deployExitTeam } = useCrowd();
  const [deployed, setDeployed] = useState<Set<string>>(new Set());
  const [releasedWaves, setReleasedWaves] = useState<Set<number>>(new Set([1, 2]));

  const doDeploy = (id: string) => { deployExitTeam(id); setDeployed(p => new Set([...p, id])); };
  const releaseWave = (wave: number) => setReleasedWaves(p => new Set([...p, wave]));

  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]));
  const exitMap    = Object.fromEntries(exitZones.map(e => [e.linkedSection, e]));

  const totalPeople  = sections.reduce((s, x) => s + x.occupied, 0);
  const avgCong      = Math.round(exitZones.reduce((s, e) => s + e.congestion, 0) / exitZones.length);
  const maxClear     = Math.max(...exitZones.map(e => e.clearTimeMin));
  const criticalExits = exitZones.filter(e => e.congestion >= 70).length;
  const totalFlow    = exitZones.reduce((s, e) => s + e.flow, 0);

  const sorted = useMemo(() =>
    [...exitZones].sort((a, b) => b.congestion - a.congestion),
  [exitZones]);

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">

      {/* Header */}
      <div className="sticky top-14 z-40 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto max-w-7xl flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Exit Management</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Monitoring all departure flows — live</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: 'People inside',  value: totalPeople.toLocaleString(), col: 'zinc'    },
              { label: 'Avg congestion', value: `${avgCong}%`,                col: avgCong > 70 ? 'rose' : avgCong > 40 ? 'amber' : 'emerald' },
              { label: 'Est. clearance', value: `${maxClear} min`,            col: 'blue'    },
              { label: 'Congested exits',value: criticalExits,                col: criticalExits > 0 ? 'rose' : 'emerald' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border px-4 py-2.5 text-center min-w-[82px] ${
                s.col === 'rose'    ? 'border-rose-500/20 bg-rose-500/5' :
                s.col === 'amber'   ? 'border-amber-400/18 bg-amber-400/5' :
                s.col === 'emerald' ? 'border-emerald-400/18 bg-emerald-400/5' :
                s.col === 'blue'    ? 'border-blue-400/18 bg-blue-400/5' :
                                      'border-zinc-700/40 bg-zinc-800/30'
              }`}>
                <div className={`text-lg font-bold leading-none tabular-nums ${
                  s.col === 'rose'    ? 'text-rose-400' :
                  s.col === 'amber'   ? 'text-amber-400' :
                  s.col === 'emerald' ? 'text-emerald-400' :
                  s.col === 'blue'    ? 'text-blue-400' :
                                        'text-zinc-200'
                }`}>{s.value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6 xl:grid-cols-[1fr_360px]">

        {/* Left — exit gate cards */}
        <div className="space-y-4">

          {/* Flow rate bar */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-zinc-200">Total outflow rate</span>
              <span className="text-sm font-bold text-white tabular-nums">{totalFlow.toLocaleString()} people / min</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${cong(avgCong).bar}`}
                style={{ width: `${Math.min(100, Math.round(totalFlow / 14))}%` }} />
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5">
              At this rate, the stadium clears in approximately <span className="text-zinc-400 font-medium">{maxClear} minutes</span>
            </p>
          </div>

          {/* Exit zone cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map(exit => {
              const c      = cong(exit.congestion);
              const isDep  = deployed.has(exit.id);
              const isHigh = exit.congestion >= 70;

              return (
                <div key={exit.id} className={`rounded-2xl border bg-zinc-900 p-5 transition-all duration-500 ${
                  isDep ? 'border-emerald-400/18' : isHigh ? 'border-rose-500/30' : 'border-zinc-800/60'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zinc-100">{exit.name}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {exit.flow} ppl/min · clears in ~{exit.clearTimeMin} min
                      </p>
                    </div>
                    {isDep
                      ? <span className="flex-shrink-0 text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-full px-2.5 py-1">✅ Managed</span>
                      : <span className={`flex-shrink-0 text-[10px] font-bold rounded-full border px-2.5 py-1 ${c.badge}`}>{c.label}</span>
                    }
                  </div>

                  {/* Congestion bar */}
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Congestion</span>
                    <span className={`font-bold ${c.text}`}>{exit.congestion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                      style={{ width: `${exit.congestion}%` }} />
                  </div>

                  {/* Flow mini bar */}
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Flow rate</span>
                    <span className="text-zinc-400 font-medium tabular-nums">{exit.flow} ppl/min</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-4">
                    <div className="h-full rounded-full bg-blue-400 transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.round(exit.flow / 2.4))}%` }} />
                  </div>

                  <button onClick={() => doDeploy(exit.id)} disabled={isDep || !isHigh}
                    className={`w-full rounded-xl py-2 text-xs font-semibold transition-all ${
                      isDep       ? 'bg-emerald-400/6 text-emerald-400 border border-emerald-400/12 cursor-default' :
                      !isHigh     ? 'bg-zinc-800/40 text-zinc-700 border border-zinc-800 cursor-not-allowed' :
                                    'bg-rose-500/12 text-rose-400 border border-rose-500/25 hover:bg-rose-500/22 active:scale-95'
                    }`}>
                    {isDep ? '✅ Staff on site' : !isHigh ? 'No action needed' : '🚨 Deploy exit staff'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — staggered exit plan + per-exit status */}
        <div className="flex flex-col gap-4">

          {/* Staggered release plan */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">🌊 Staggered Exit Plan</p>
              <span className="text-[10px] text-zinc-600">{releasedWaves.size}/8 waves released</span>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {EXIT_ORDER_SECTIONS.map(item => {
                const section  = sectionMap[item.id];
                const exit     = exitMap[item.id];
                const released = releasedWaves.has(item.wave);
                const nextWave = Math.min(...[...Array(8)].map((_, i) => i + 1).filter(w => !releasedWaves.has(w)));

                return (
                  <div key={item.id} className={`px-4 py-3 flex items-center gap-3 transition-colors ${released ? '' : 'opacity-50'}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      released
                        ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
                        : item.wave === nextWave
                        ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30 animate-pulse'
                        : 'bg-zinc-800 text-zinc-600 border border-zinc-700'
                    }`}>{item.wave}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300">{item.label}</span>
                        {released && <span className="text-[9px] text-emerald-400 font-bold">OUT</span>}
                      </div>
                      <p className="text-[10px] text-zinc-700">
                        {section ? `${section.occupied.toLocaleString()} people` : '—'}
                        {exit ? ` · ${exit.flow} ppl/min through ${exit.name}` : ''}
                      </p>
                    </div>

                    {!released && item.wave === nextWave && (
                      <button onClick={() => releaseWave(item.wave)}
                        className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold bg-amber-400/15 text-amber-400 border border-amber-400/25 hover:bg-amber-400/25 active:scale-95 transition-all">
                        Release
                      </button>
                    )}
                    {released && (
                      <span className="flex-shrink-0 text-base">✅</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-exit clearance countdown */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">⏱ Clearance Estimates</p>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {[...exitZones].sort((a, b) => b.clearTimeMin - a.clearTimeMin).map(exit => {
                const c = cong(exit.congestion);
                return (
                  <div key={exit.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">{exit.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${c.bar} transition-all duration-700`}
                          style={{ width: `${exit.congestion}%` }} />
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-12 text-right ${c.text}`}>
                        ~{exit.clearTimeMin} min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tip card */}
          <div className="rounded-2xl border border-blue-400/15 bg-blue-950/15 p-4 text-xs text-blue-200 leading-relaxed">
            <p className="font-semibold text-blue-300 mb-1">💡 Why staggered exits?</p>
            Releasing sections in waves prevents counter-flow and bottlenecks at concourse level. 
            VIP and family sections leave first (smallest), upper tiers last (largest). 
            Each wave reduces overall crush risk by ~40%.
          </div>
        </div>
      </div>
    </div>
  );
}
