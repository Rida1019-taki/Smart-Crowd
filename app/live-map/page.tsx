'use client';

import { useCrowd, getDensityColor } from '@/context/CrowdContext';
import EntranceMap from '@/components/EntranceMap';

export default function LiveMapPage() {
  const { zones, aiAnalysis, aiLoading } = useCrowd();
  const sorted = [...zones].sort((a, b) => a.density - b.density);

  const statusColors = {
    calm:     'text-emerald-400 bg-emerald-400/8 border-emerald-400/18',
    busy:     'text-amber-400 bg-amber-400/8 border-amber-400/18',
    critical: 'text-rose-400 bg-rose-500/8 border-rose-500/18',
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-6 py-5">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Entrance Gates</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Live queue status — all entrances</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {aiLoading
                ? <><span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />Updating…</>
                : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</>
              }
            </div>
            {aiAnalysis && (
              <div className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${statusColors[aiAnalysis.overallStatus]}`}>
                {aiAnalysis.overallStatus === 'calm' ? '🟢 All clear' : aiAnalysis.overallStatus === 'busy' ? '🟡 Getting busy' : '🔴 Congested'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <EntranceMap />
          {aiAnalysis && (
            <div className={`rounded-2xl border p-4 ${
              aiAnalysis.overallStatus === 'critical' ? 'border-rose-500/20 bg-rose-950/15' :
              aiAnalysis.overallStatus === 'busy'     ? 'border-amber-400/15 bg-amber-950/12' :
                                                        'border-emerald-400/15 bg-emerald-950/12'
            }`}>
              <p className={`text-sm font-medium leading-relaxed ${
                aiAnalysis.overallStatus === 'critical' ? 'text-rose-300' :
                aiAnalysis.overallStatus === 'busy'     ? 'text-amber-300' : 'text-emerald-300'
              }`}>{aiAnalysis.summary}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Gate list */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">All Gates</p>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {sorted.map((zone, i) => {
                const c    = getDensityColor(zone.density);
                const best = aiAnalysis?.fanRecommendation.gateId === zone.id;
                return (
                  <div key={zone.id} className={`px-4 py-3 ${best ? 'bg-emerald-950/15' : ''}`}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${c.bg} ${zone.density > 75 ? 'animate-pulse' : ''}`} />
                        <span className="text-sm text-zinc-200 font-medium truncate">{zone.name}</span>
                        {best && <span className="text-[10px] font-bold rounded-full bg-emerald-400/12 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 whitespace-nowrap">Best</span>}
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${c.text}`}>{zone.density}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${zone.density}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>{zone.queueLength} waiting</span>
                      <span>~{zone.waitTime} min</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 15-min forecast */}
          {aiAnalysis && (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <p className="text-sm font-semibold text-zinc-200">⏱ In 15 Minutes</p>
              </div>
              <div className="p-3 space-y-2">
                {aiAnalysis.predictions.slice(0, 7).map(pred => {
                  const z = zones.find(z => z.id === pred.gateId);
                  if (!z) return null;
                  const c = getDensityColor(pred.in15min);
                  const icon = pred.trend === 'up' ? '↑' : pred.trend === 'down' ? '↓' : '→';
                  const tc   = pred.trend === 'up' ? 'text-rose-400' : pred.trend === 'down' ? 'text-emerald-400' : 'text-zinc-600';
                  return (
                    <div key={pred.gateId} className="rounded-xl border border-zinc-800/50 bg-zinc-800/25 px-3 py-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-zinc-300">{z.shortName}</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${c.text}`}>{pred.in15min}%</span>
                          <span className={`text-xs font-bold ${tc}`}>{icon}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-snug">{pred.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alerts */}
          {aiAnalysis && aiAnalysis.alerts.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <p className="text-sm font-semibold text-zinc-200">⚡ Alerts</p>
              </div>
              <div className="divide-y divide-zinc-800/40 max-h-52 overflow-y-auto">
                {aiAnalysis.alerts.map((a, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className={`text-xs leading-relaxed mb-1 ${
                      a.severity === 'critical' ? 'text-rose-400' :
                      a.severity === 'warning'  ? 'text-amber-400' : 'text-blue-400'
                    }`}>{a.message}</p>
                    <p className="text-[10px] text-zinc-600 italic">→ {a.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
