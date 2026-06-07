'use client';

import { useCrowd } from '@/context/CrowdContext';
import { useMemo } from 'react';

// Safe value renderer - converts NaN/undefined to 0
const safeNum = (val: any, fallback: number = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

export default function AnalyticsPage() {
  const { zones, exitZones, sections, emotionZones, dispatches } = useCrowd();

  const stats = useMemo(() => {
    const totalCapacity = sections.reduce((sum, s) => sum + s.capacity, 0);
    const totalOccupied = sections.reduce((sum, s) => sum + s.occupied, 0);
    const avgOccupancy = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // Gates: with NaN guards
    const validZones = zones.filter(z => z && typeof z.density === 'number' && !isNaN(z.density));
    const busiestGate = validZones.length > 0 ? validZones.reduce((max, z) => z.density > max.density ? z : max) : { name: 'N/A', density: 0 };
    const quietestGate = validZones.length > 0 ? validZones.reduce((min, z) => z.density < min.density ? z : min) : { name: 'N/A', density: 0 };
    
    const gateDensitySum = validZones.reduce((sum, z) => sum + z.density, 0);
    const avgGateDensity = validZones.length > 0 ? Math.round(gateDensitySum / validZones.length) : 0;

    // Wait times: with NaN guards
    const validWaitTimes = zones.filter(z => z && typeof z.waitTime === 'number' && !isNaN(z.waitTime));
    const waitTimeSum = validWaitTimes.reduce((sum, z) => sum + z.waitTime, 0);
    const avgWaitTime = validWaitTimes.length > 0 ? Math.round(waitTimeSum / validWaitTimes.length) : 0;
    
    const queueSum = zones.reduce((sum, z) => sum + (typeof z.queueLength === 'number' && !isNaN(z.queueLength) ? z.queueLength : 0), 0);
    const totalQueueing = queueSum;

    // Exits: with NaN guards
    const validExits = exitZones.filter(e => e && typeof e.congestion === 'number' && !isNaN(e.congestion));
    const exitCongestionSum = validExits.reduce((sum, e) => sum + e.congestion, 0);
    const avgExitCongestion = validExits.length > 0 ? Math.round(exitCongestionSum / validExits.length) : 0;
    const busiestExit = validExits.length > 0 ? validExits.reduce((max, e) => e.congestion > max.congestion ? e : max) : { name: 'N/A', congestion: 0 };

    // Emotions: with NaN guards
    const validEmotions = emotionZones.filter(e => e && typeof e.fightRisk === 'number' && !isNaN(e.fightRisk));
    const emotionRiskSum = validEmotions.reduce((sum, e) => sum + e.fightRisk, 0);
    const avgRisk = validEmotions.length > 0 ? Math.round(emotionRiskSum / validEmotions.length) : 0;
    const highRiskZones = validEmotions.filter(e => e.fightRisk >= 70).length;
    const openIncidents = dispatches.filter(d => !d.resolved).length;

    return {
      totalCapacity, totalOccupied, avgOccupancy,
      busiestGate, quietestGate, avgGateDensity,
      avgWaitTime, totalQueueing,
      avgExitCongestion, busiestExit,
      avgRisk, highRiskZones, openIncidents,
    };
  }, [zones, exitZones, sections, emotionZones, dispatches]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-5" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto max-w-7xl">
          <h1 className="text-heading text-white text-lg mb-1">📊 Analyse & Perspectives</h1>
          <p className="text-label text-zinc-500">Métriques de performance en temps réel du stade</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Main KPIs Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Capacité du Stade', value: `${stats.avgOccupancy}%`, sub: `${stats.totalOccupied} / ${stats.totalCapacity}`, color: stats.avgOccupancy >= 80 ? '#ef4444' : stats.avgOccupancy >= 60 ? '#f59e0b' : '#10b981' },
            { label: 'Densité Portails', value: `${stats.avgGateDensity}%`, sub: `${stats.busiestGate.name} au pic`, color: stats.avgGateDensity >= 75 ? '#ef4444' : '#10b981' },
            { label: 'Temps Attente', value: `${stats.avgWaitTime} min`, sub: `${stats.totalQueueing} personnes en queue`, color: stats.avgWaitTime >= 10 ? '#f59e0b' : '#10b981' },
            { label: 'Congestion Sortie', value: `${stats.avgExitCongestion}%`, sub: `${stats.busiestExit.name} plus occupée`, color: stats.avgExitCongestion >= 75 ? '#ef4444' : '#10b981' },
          ].map((kpi, i) => (
            <div key={i} className="card p-4 border-l-4" style={{ borderColor: kpi.color }}>
              <p className="text-label text-zinc-500 mb-2">{kpi.label}</p>
              <div className="text-3xl font-extrabold mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
              <p className="text-xs text-zinc-400">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Secondary metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { icon: '🎭', title: 'Risque Foule', value: stats.avgRisk, unit: '%', color: stats.avgRisk >= 60 ? 'text-rose-400' : 'text-amber-400' },
            { icon: '⚠️', title: 'Zones Risque', value: stats.highRiskZones, unit: 'zones', color: stats.highRiskZones > 0 ? 'text-rose-400' : 'text-emerald-400' },
            { icon: '🚨', title: 'Incidents Ouverts', value: stats.openIncidents, unit: 'actifs', color: stats.openIncidents > 0 ? 'text-rose-400' : 'text-emerald-400' },
          ].map((m, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label text-zinc-500 mb-1">{m.title}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value} <span className="text-xs text-zinc-500">{m.unit}</span></p>
                </div>
                <span className="text-4xl">{m.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Gate & Exit details */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Portails */}
          <div className="card p-5">
            <h2 className="font-bold text-white mb-4">🏪 Classement des Portails</h2>
            <div className="space-y-3">
              {zones
                .map(z => ({ ...z, density: safeNum(z.density, 0) }))
                .sort((a, b) => b.density - a.density)
                .map((z, i) => {
                  const d = safeNum(z.density, 0);
                  const q = safeNum(z.queueLength, 0);
                  const w = safeNum(z.waitTime, 0);
                  return (
                    <div key={z.id} className="flex items-center gap-3">
                      <div className="text-lg font-bold text-zinc-500 w-6">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white truncate">{z.name}</span>
                          <span className="text-xs font-bold" style={{ color: d >= 80 ? '#ef4444' : d >= 60 ? '#f59e0b' : '#10b981' }}>
                            {d}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${d}%`,
                              background: d >= 80 ? '#ef4444' : d >= 60 ? '#f59e0b' : '#10b981',
                            }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{q} people · {w} min wait</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Sorties */}
          <div className="card p-5">
            <h2 className="font-bold text-white mb-4">🚪 Classement Congestion Sorties</h2>
            <div className="space-y-3">
              {exitZones
                .map(e => ({ ...e, congestion: safeNum(e.congestion, 0) }))
                .sort((a, b) => b.congestion - a.congestion)
                .map((e, i) => {
                  const c = safeNum(e.congestion, 0);
                  const f = safeNum(e.flow, 0);
                  const ct = safeNum(e.clearTimeMin, 0);
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <div className="text-lg font-bold text-zinc-500 w-6">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white truncate">{e.name}</span>
                          <span className="text-xs font-bold" style={{ color: c >= 85 ? '#ef4444' : c >= 65 ? '#f59e0b' : '#10b981' }}>
                            {c}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${c}%`,
                              background: c >= 85 ? '#ef4444' : c >= 65 ? '#f59e0b' : '#10b981',
                            }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{f} ppl/min · {ct} min clear</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>

        {/* Recommandations */}
        <div className="card p-6 mt-8 border-l-4 border-amber-500/50">
          <h2 className="font-bold text-white mb-3">💡 Recommandations Système</h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            {stats.avgOccupancy >= 80 && <li>• <strong>Stade près de la capacité:</strong> Envisager une libération échelonnée ou des ventes supplémentaires</li>}
            {stats.busiestGate.density >= 85 && <li>• <strong>{stats.busiestGate.name} critique:</strong> Ouvrir des portails alternatifs et augmenter le personnel</li>}
            {stats.avgWaitTime >= 12 && <li>• <strong>Longues files d'attente:</strong> Déployer des voies de billetterie supplémentaires</li>}
            {stats.avgExitCongestion >= 75 && <li>• <strong>Goulot d'étranglement:</strong> Échelonner l'évacuation pour réduire les pics</li>}
            {stats.highRiskZones > 0 && <li>• <strong>Alerte sécurité:</strong> {stats.highRiskZones} zone(s) signalée(s) pour tension — renforcer présence visible</li>}
            {stats.openIncidents > 0 && <li>• <strong>Incidents actifs:</strong> {stats.openIncidents} dépêche(s) en cours — prioriser résolution</li>}
            {stats.avgOccupancy < 50 && <li>• ✓ <strong>Bonne capacité:</strong> Stade bien distribué — continuer opérations normales</li>}
          </ul>
        </div>

      </div>
    </div>
  );
}
