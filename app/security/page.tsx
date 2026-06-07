'use client';

import { useState } from 'react';
import { useCrowd, getDensityColor } from '@/context/CrowdContext';

export default function SecurityPage() {
  const { zones, aiAnalysis, aiLoading, lastUpdated, deployTeam } = useCrowd();
  const [deployed, setDeployed] = useState<Set<string>>(new Set());

  const doDeploy = (id: string) => { deployTeam(id); setDeployed(p => new Set([...p, id])); };

  const sorted  = [...zones].sort((a, b) => b.density - a.density);
  const totalQ  = zones.reduce((s, z) => s + z.queueLength, 0);
  const critCnt = zones.filter(z => z.density > 75).length;

  const sbg = { calm: 'border-emerald-400/15 bg-emerald-950/15', busy: 'border-amber-400/15 bg-amber-950/12', critical: 'border-rose-500/20 bg-rose-950/15' };
  const stx = { calm: 'text-emerald-300', busy: 'text-amber-300', critical: 'text-rose-300' };

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">
      <div className="sticky top-14 z-40 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto max-w-7xl flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Gate Operations</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{aiLoading ? 'Updating…' : `Last updated ${lastUpdated}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: 'Alerts',       value: aiAnalysis?.alerts.length ?? 0,  col: 'rose'    },
              { label: 'Queuing',      value: totalQ.toLocaleString(),          col: 'amber'   },
              { label: 'Congested',    value: critCnt,                          col: critCnt > 0 ? 'rose' : 'emerald' },
              { label: 'Deployed',     value: deployed.size,                    col: 'emerald' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border px-4 py-2.5 text-center min-w-[80px] ${
                s.col === 'rose' ? 'border-rose-500/20 bg-rose-500/5' :
                s.col === 'amber'? 'border-amber-400/18 bg-amber-400/5' :
                                   'border-emerald-400/18 bg-emerald-400/5'
              }`}>
                <div className={`text-xl font-bold leading-none ${s.col === 'rose' ? 'text-rose-400' : s.col === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>{s.value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          {aiAnalysis && (
            <div className={`mb-5 rounded-2xl border p-4 ${sbg[aiAnalysis.overallStatus]}`}>
              <p className={`text-sm font-medium leading-relaxed ${stx[aiAnalysis.overallStatus]}`}>{aiAnalysis.summary}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map(zone => {
              const c      = getDensityColor(zone.density);
              const isHigh = zone.density > 75;
              const isDep  = deployed.has(zone.id);
              const aiAct  = aiAnalysis?.securityActions.find(a => a.gateId === zone.id);
              const canAct = zone.density > 50 && !isDep;

              return (
                <div key={zone.id} className={`rounded-2xl border bg-zinc-900 p-5 transition-all duration-500 ${
                  isDep ? 'border-emerald-400/15' : isHigh ? 'border-rose-500/30' : 'border-zinc-800/60'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zinc-100 truncate">{zone.name}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">{zone.queueLength} waiting · ~{zone.waitTime} min</p>
                    </div>
                    {isDep
                      ? <span className="flex-shrink-0 text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-full px-2.5 py-1">✅ Done</span>
                      : <span className={`flex-shrink-0 text-[10px] font-bold rounded-full px-2.5 py-1 border ${c.badge}`}>{c.label}</span>
                    }
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600">Capacity</span>
                    <span className={`font-bold ${c.text}`}>{zone.density}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${zone.density}%` }} />
                  </div>
                  {aiAct && !isDep && (
                    <div className={`rounded-xl p-2.5 mb-3 text-xs leading-relaxed ${
                      aiAct.priority === 'high'   ? 'bg-rose-500/8 text-rose-300 border border-rose-500/15' :
                      aiAct.priority === 'medium' ? 'bg-amber-400/8 text-amber-300 border border-amber-400/15' :
                                                     'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40'
                    }`}>
                      <span className="font-semibold">{aiAct.priority === 'high' ? '🚨' : aiAct.priority === 'medium' ? '⚠️' : 'ℹ️'} {aiAct.staffNeeded} staff needed</span><br />
                      {aiAct.action}
                    </div>
                  )}
                  <button onClick={() => doDeploy(zone.id)} disabled={isDep || !canAct}
                    className={`w-full rounded-xl py-2 text-xs font-semibold transition-all ${
                      isDep       ? 'bg-emerald-400/6 text-emerald-400 border border-emerald-400/12 cursor-default' :
                      !canAct     ? 'bg-zinc-800/40 text-zinc-700 border border-zinc-800 cursor-not-allowed' :
                      isHigh      ? 'bg-rose-500/12 text-rose-400 border border-rose-500/25 hover:bg-rose-500/22 active:scale-95' :
                                    'bg-amber-400/10 text-amber-400 border border-amber-400/18 hover:bg-amber-400/18 active:scale-95'
                    }`}>
                    {isDep ? '✅ Staff deployed' : !canAct ? 'No action needed' :
                     aiAct?.priority === 'high' ? '🚔 Deploy team now' : '👮 Open extra lane'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">⚡ Alert Feed</p>
            </div>
            <div className="divide-y divide-zinc-800/40 overflow-y-auto" style={{ maxHeight: 360 }}>
              {aiAnalysis?.alerts.length ? aiAnalysis.alerts.map((a, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      a.severity === 'critical' ? 'bg-rose-500 animate-pulse' :
                      a.severity === 'warning'  ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <div>
                      <p className={`text-xs leading-relaxed ${
                        a.severity === 'critical' ? 'text-rose-400' :
                        a.severity === 'warning'  ? 'text-amber-300' : 'text-blue-300'
                      }`}>{a.message}</p>
                      <p className="text-[10px] text-zinc-700 mt-0.5 italic">→ {a.action}</p>
                    </div>
                  </div>
                </div>
              )) : <p className="px-4 py-8 text-center text-xs text-zinc-700">{aiLoading ? 'Loading…' : 'No alerts'}</p>}
            </div>
          </div>

          {aiAnalysis && (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <p className="text-sm font-semibold text-zinc-200">⏱ 15-Min Outlook</p>
              </div>
              <div className="divide-y divide-zinc-800/40">
                {aiAnalysis.predictions.filter(p => p.trend !== 'stable').map(pred => {
                  const z = zones.find(z => z.id === pred.gateId);
                  if (!z) return null;
                  const c = getDensityColor(pred.in15min);
                  return (
                    <div key={pred.gateId} className="px-4 py-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-zinc-300">{z.name}</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${c.text}`}>{pred.in15min}%</span>
                          <span className={`text-xs font-bold ${pred.trend === 'up' ? 'text-rose-400' : 'text-emerald-400'}`}>{pred.trend === 'up' ? '↑' : '↓'}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-snug">{pred.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Congested', v: zones.filter(z => z.density > 75).length, c: 'rose'    },
              { l: 'Moderate',  v: zones.filter(z => z.density > 50 && z.density <= 75).length, c: 'amber' },
              { l: 'Clear',     v: zones.filter(z => z.density <= 50).length, c: 'emerald' },
            ].map(s => (
              <div key={s.l} className={`rounded-xl border px-3 py-3 text-center ${s.c === 'rose' ? 'border-rose-500/15 bg-rose-500/5' : s.c === 'amber' ? 'border-amber-400/15 bg-amber-400/5' : 'border-emerald-400/15 bg-emerald-400/5'}`}>
                <div className={`text-2xl font-bold ${s.c === 'rose' ? 'text-rose-400' : s.c === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>{s.v}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
