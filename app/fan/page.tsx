'use client';

import { useState, useEffect, useRef } from 'react';
import { useCrowd, getDensityColor } from '@/context/CrowdContext';

export default function FanPage() {
  const { zones, aiAnalysis } = useCrowd();
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifText,    setNotifText]    = useState('');
  const prevKey = useRef('');
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!aiAnalysis) return;
    const critical = aiAnalysis.alerts.find(a => a.severity === 'critical');
    const key = critical?.message || '';
    if (!key || key === prevKey.current) return;
    prevKey.current = key;
    if (hideRef.current) clearTimeout(hideRef.current);
    setNotifText(key);
    setNotifVisible(true);
    hideRef.current = setTimeout(() => setNotifVisible(false), 6000);
  }, [aiAnalysis]);

  const rec     = aiAnalysis?.fanRecommendation;
  const recZone = zones.find(z => z.id === rec?.gateId);
  const recC    = recZone ? getDensityColor(recZone.density) : null;
  const sorted  = [...zones].sort((a, b) => a.density - b.density);

  return (
    <div className="min-h-screen bg-zinc-950 pb-16">

      {/* Alert banner */}
      {notifVisible && (
        <div className="fixed top-14 right-4 z-50 max-w-[320px] animate-slide-in-right">
          <div className="rounded-2xl border border-rose-500/20 bg-zinc-900/95 backdrop-blur-sm px-4 py-3 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5 flex-shrink-0">🚨</span>
              <p className="text-sm text-zinc-200 leading-relaxed flex-1">{notifText}</p>
              <button onClick={() => setNotifVisible(false)} className="text-zinc-600 hover:text-zinc-400 text-sm flex-shrink-0">✕</button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-5 py-5">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold text-white">Which gate should I use?</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Based on live queue data at all entrances</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pt-5 space-y-4">

        {/* Best gate hero */}
        {rec && recZone && recC ? (
          <div className={`rounded-3xl border p-6 ${
            recZone.density < 50
              ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 to-zinc-900'
              : 'border-amber-400/20 bg-gradient-to-br from-amber-950/30 to-zinc-900'
          }`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <p className="text-xs text-zinc-600 mb-1">Best entrance right now</p>
                <h2 className={`text-3xl font-bold ${recC.text}`}>{rec.gateName}</h2>
                <p className="text-zinc-300 text-base mt-1.5 leading-relaxed">{rec.reason}</p>
              </div>
              <div className={`rounded-2xl border text-center px-4 py-3 flex-shrink-0 ${recC.badge}`}>
                <div className="text-2xl font-bold tabular-nums leading-none">{recZone.density}%</div>
                <div className="text-[10px] mt-1 font-semibold">{recC.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">~{rec.estimatedWait} min</div>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${recC.bar}`} style={{ width: `${recZone.density}%` }} />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm">Checking all gates…</span>
            </div>
          </div>
        )}

        {/* Warnings visible to fan */}
        {aiAnalysis && aiAnalysis.alerts.filter(a => a.severity !== 'info').length > 0 && (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-200">Heads up</p>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {aiAnalysis.alerts.filter(a => a.severity !== 'info').slice(0, 3).map((a, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">{a.severity === 'critical' ? '🔴' : '🟡'}</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All gates */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60">
            <p className="text-sm font-semibold text-zinc-200">All entrances — quietest first</p>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {sorted.map(zone => {
              const c    = getDensityColor(zone.density);
              const isRec = aiAnalysis?.fanRecommendation.gateId === zone.id;
              const pred  = aiAnalysis?.predictions.find(p => p.gateId === zone.id);
              const tIcon = pred?.trend === 'up' ? '↑' : pred?.trend === 'down' ? '↓' : '';
              const tCol  = pred?.trend === 'up' ? 'text-rose-400' : 'text-emerald-400';
              return (
                <div key={zone.id} className={`px-4 py-3 ${isRec ? 'bg-emerald-950/15' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${c.bg} ${zone.density > 75 ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-zinc-200 font-medium">{zone.name}</span>
                        {isRec && <span className="text-[10px] font-bold rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5">Best</span>}
                        {pred && pred.trend !== 'stable' && <span className={`text-xs font-bold ${tCol}`}>{tIcon}</span>}
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${zone.density}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold tabular-nums ${c.text}`}>{zone.density}%</div>
                      <div className="text-[10px] text-zinc-600">~{zone.waitTime} min</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tip */}
        {aiAnalysis?.alerts.find(a => a.severity === 'info') && (
          <div className="rounded-2xl border border-blue-500/15 bg-blue-950/12 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">💡</span>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {aiAnalysis.alerts.find(a => a.severity === 'info')?.action}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-5">
          <p className="text-sm font-semibold text-zinc-400 mb-3">Good to know</p>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li>· Away fans must use the Away Gate only</li>
            <li>· VIP Gate is for premium ticket holders</li>
            <li>· Gates open 90 minutes before kick-off</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
