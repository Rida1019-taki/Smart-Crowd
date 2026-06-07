'use client';

import { useState, useEffect, useRef } from 'react';
import { useCrowd, type EmotionLevel } from '@/context/CrowdContext';
import type { YoloResult } from '@/app/api/yolo/route';

// ── helpers ─────────────────────────────────────────────────────────────────
function pct(n: number) {
  if (n < 40) return { bar: 'bg-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', label: 'OK' };
  if (n < 70) return { bar: 'bg-amber-400',   text: 'text-amber-400',   badge: 'bg-amber-400/10 border-amber-400/20 text-amber-400',     label: 'BUSY' };
  return           { bar: 'bg-rose-500',     text: 'text-rose-400',    badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',       label: 'OVERLOAD' };
}

function sevColor(s: string) {
  if (s === 'critical') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  if (s === 'warning')  return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
}

function emotionStyle(e: EmotionLevel) {
  if (e === 'angry')    return { bar: 'bg-rose-500',   text: 'text-rose-400',    badge: 'bg-rose-500/10 border-rose-500/30 text-rose-400',     icon: '😡', label: 'ANGRY'    };
  if (e === 'agitated') return { bar: 'bg-orange-500', text: 'text-orange-400',  badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400', icon: '😠', label: 'AGITATED' };
  if (e === 'tense')    return { bar: 'bg-amber-400',  text: 'text-amber-400',   badge: 'bg-amber-400/10 border-amber-400/30 text-amber-400',   icon: '😤', label: 'TENSE'    };
  return                       { bar: 'bg-emerald-400',text: 'text-emerald-400', badge: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400', icon: '😊', label: 'CALM' };
}

interface LogEntry {
  id: number;
  ts: string;
  type: 'entrance' | 'exit' | 'ai' | 'section' | 'outdoor' | 'threat';
  severity: 'ok' | 'warn' | 'critical';
  msg: string;
}

let _logId = 0;

// ── page ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { zones, exitZones, sections, outdoorZones, emotionZones, dispatches, aiAnalysis, aiLoading, yoloAvailable, lastUpdated, deployTeam, deployExitTeam, dispatchSecurity, resolveDispatch } = useCrowd();
  const [tab, setTab] = useState<'overview' | 'entrance' | 'exit' | 'sections' | 'outdoor' | 'ai' | 'threats' | 'cameras' | 'log'>('overview');
  const [log, setLog] = useState<LogEntry[]>([]);
  const prevZones    = useRef<typeof zones>([]);
  const prevExits    = useRef<typeof exitZones>([]);
  const prevEmotions = useRef<typeof emotionZones>([]);
  const logEndRef    = useRef<HTMLDivElement>(null);

  // auto-scroll log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  // detect overload transitions and append to log
  useEffect(() => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entries: LogEntry[] = [];

    zones.forEach(z => {
      const prev = prevZones.current.find(p => p.id === z.id);
      if (!prev) return;
      if (z.density >= 70 && prev.density < 70)
        entries.push({ id: ++_logId, ts, type: 'entrance', severity: 'critical', msg: `${z.name} OVERLOADED → ${z.density}% (${z.queueLength} waiting)` });
      else if (z.density < 70 && prev.density >= 70)
        entries.push({ id: ++_logId, ts, type: 'entrance', severity: 'ok', msg: `${z.name} cleared → back to ${z.density}%` });
      else if (z.density >= 40 && prev.density < 40)
        entries.push({ id: ++_logId, ts, type: 'entrance', severity: 'warn', msg: `${z.name} getting busy → ${z.density}%` });
    });

    exitZones.forEach(e => {
      const prev = prevExits.current.find(p => p.id === e.id);
      if (!prev) return;
      if (e.congestion >= 70 && prev.congestion < 70)
        entries.push({ id: ++_logId, ts, type: 'exit', severity: 'critical', msg: `${e.name} CONGESTED → ${e.congestion}% (clears in ${e.clearTimeMin} min)` });
      else if (e.congestion < 70 && prev.congestion >= 70)
        entries.push({ id: ++_logId, ts, type: 'exit', severity: 'ok', msg: `${e.name} flowing again → ${e.congestion}%` });
    });

    emotionZones.forEach(e => {
      const prev = prevEmotions.current.find(p => p.id === e.id);
      if (!prev) return;
      if (e.emotion === 'angry' && prev.emotion !== 'angry')
        entries.push({ id: ++_logId, ts, type: 'threat', severity: 'critical', msg: `😡 FIGHT RISK — ${e.name} → ANGRY (${e.fightRisk}% risk${e.etaMin ? `, incident in ~${e.etaMin} min` : ''})` });
      else if (e.emotion === 'agitated' && prev.emotion !== 'agitated' && prev.emotion !== 'angry')
        entries.push({ id: ++_logId, ts, type: 'threat', severity: 'warn', msg: `😠 Tension rising — ${e.name} → AGITATED (${e.fightRisk}% risk)` });
      else if (e.emotion === 'calm' && (prev.emotion === 'angry' || prev.emotion === 'agitated'))
        entries.push({ id: ++_logId, ts, type: 'threat', severity: 'ok', msg: `✓ Crowd calmed — ${e.name} back to CALM` });
      if (e.securityDispatched && !prev.securityDispatched)
        entries.push({ id: ++_logId, ts, type: 'threat', severity: 'critical', msg: `🚨 Security AUTO-DISPATCHED to ${e.name} (risk ${e.fightRisk}%)` });
    });

    if (entries.length) setLog(p => [...p.slice(-199), ...entries]);
    prevZones.current    = zones;
    prevExits.current    = exitZones;
    prevEmotions.current = emotionZones;
  }, [zones, exitZones, emotionZones]);

  // log AI alerts
  const prevAiRef = useRef<string>('');
  useEffect(() => {
    if (!aiAnalysis) return;
    const key = JSON.stringify(aiAnalysis.alerts.map(a => a.gateId + a.severity));
    if (key === prevAiRef.current) return;
    prevAiRef.current = key;
    const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entries: LogEntry[] = aiAnalysis.alerts
      .filter(a => a.severity !== 'info')
      .map(a => ({
        id: ++_logId, ts, type: 'ai' as const,
        severity: a.severity === 'critical' ? 'critical' : 'warn',
        msg: `[AI] ${a.message}`,
      }));
    if (entries.length) setLog(p => [...p.slice(-199), ...entries]);
  }, [aiAnalysis]);

  // summary stats
  const totalInside     = sections.reduce((s, x) => s + x.occupied, 0);
  const totalCapacity   = sections.reduce((s, x) => s + x.capacity, 0);
  const overloadGates   = zones.filter(z => z.density >= 70).length;
  const congExits       = exitZones.filter(e => e.congestion >= 70).length;
  const totalQueuePpl   = zones.reduce((s, z) => s + z.queueLength, 0);
  const critAlerts      = aiAnalysis?.alerts.filter(a => a.severity === 'critical').length ?? 0;
  const angryZones      = emotionZones.filter(e => e.emotion === 'angry').length;
  const agitatedZones   = emotionZones.filter(e => e.emotion === 'agitated').length;
  const threatsTotal    = angryZones + agitatedZones;
  const activeDispatches = dispatches.filter(d => !d.resolved).length;

  // ── Camera analysis state ─────────────────────────────────────────────────
  const [cameraResults, setCameraResults] = useState<Record<string, YoloResult>>({});
  const [cameraLoading, setCameraLoading] = useState<Record<string, boolean>>({});
  const [cameraInputs,  setCameraInputs]  = useState<Record<string, string>>({
    'gate-north': '',
    'gate-away':  '',
    'gate-west':  '',
  });

  const analyzeCamera = async (zoneId: string, imageUrl: string) => {
    if (!imageUrl.trim()) return;
    setCameraLoading(p => ({ ...p, [zoneId]: true }));
    try {
      const res  = await fetch('/api/yolo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'url', zoneId, imageUrl }),
      });
      const data: YoloResult = await res.json();
      setCameraResults(p => ({ ...p, [zoneId]: data }));
    } catch {
      setCameraResults(p => ({ ...p, [zoneId]: { ...({} as YoloResult), error: 'Backend unreachable' } }));
    } finally {
      setCameraLoading(p => ({ ...p, [zoneId]: false }));
    }
  };

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'entrance',  label: `🚪 Entrance (${overloadGates} ⚠)` },
    { id: 'exit',      label: `🚶 Exit (${congExits} ⚠)` },
    { id: 'threats',   label: `😡 Threats${threatsTotal > 0 ? ` (${threatsTotal})` : ''}` },
    { id: 'cameras',   label: `📷 YOLO${yoloAvailable ? ' 🟢' : ' 🔴'}` },
    { id: 'sections',  label: '💺 Sections' },
    { id: 'outdoor',   label: '🚗 Outdoor' },
    { id: 'ai',        label: `🤖 AI${critAlerts > 0 ? ` (${critAlerts})` : ''}` },
    { id: 'log',       label: `📋 Log (${log.length})` },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">

      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-950 px-6 py-4 sticky top-14 z-40 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
            <p className="text-xs text-zinc-500">Full stadium overview · Updated {lastUpdated}</p>
          </div>
          <div className="flex items-center gap-2">
            {aiLoading && <span className="text-[10px] text-amber-400 animate-pulse">AI updating…</span>}
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl flex items-center gap-0.5 overflow-x-auto scrollbar-none mt-3">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Inside stadium', value: totalInside.toLocaleString(), sub: `/ ${totalCapacity.toLocaleString()}`, col: 'zinc' },
                { label: 'Capacity used',  value: `${Math.round(totalInside / totalCapacity * 100)}%`, sub: 'of seats filled', col: totalInside / totalCapacity > 0.9 ? 'rose' : 'emerald' },
                { label: 'Queuing outside',value: totalQueuePpl.toLocaleString(), sub: 'across all gates', col: totalQueuePpl > 1500 ? 'rose' : 'amber' },
                { label: 'Gate overloads', value: overloadGates, sub: `of ${zones.length} gates`, col: overloadGates > 0 ? 'rose' : 'emerald' },
                { label: 'Fight threats',  value: threatsTotal, sub: `${angryZones} angry · ${agitatedZones} agitated`, col: angryZones > 0 ? 'rose' : agitatedZones > 0 ? 'amber' : 'emerald' },
                { label: 'Security sent',  value: activeDispatches, sub: 'active dispatches', col: activeDispatches > 0 ? 'rose' : 'emerald' },
              ].map(s => {
                const base = 'rounded-2xl border px-4 py-3 text-center';
                const cls  = s.col === 'rose'    ? `${base} border-rose-500/20 bg-rose-500/5` :
                             s.col === 'emerald' ? `${base} border-emerald-400/20 bg-emerald-400/5` :
                             s.col === 'amber'   ? `${base} border-amber-400/20 bg-amber-400/5` :
                                                   `${base} border-zinc-700/40 bg-zinc-800/30`;
                const tc   = s.col === 'rose'    ? 'text-rose-400'    :
                             s.col === 'emerald' ? 'text-emerald-400' :
                             s.col === 'amber'   ? 'text-amber-400'   : 'text-zinc-200';
                return (
                  <div key={s.label} className={cls}>
                    <div className={`text-2xl font-bold tabular-nums leading-none mb-1 ${tc}`}>{s.value}</div>
                    <div className="text-[10px] text-zinc-600">{s.sub}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Entrance + Exit side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Entrance quick view */}
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200">🚪 Entrance Gates</span>
                  {overloadGates > 0
                    ? <span className="text-[10px] font-bold text-rose-400 border border-rose-500/30 rounded-full px-2 py-0.5">{overloadGates} overloaded</span>
                    : <span className="text-[10px] font-semibold text-emerald-400">All clear</span>}
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {[...zones].sort((a,b) => b.density - a.density).map(z => {
                    const c = pct(z.density);
                    return (
                      <div key={z.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-zinc-200 truncate">{z.name}</span>
                            <span className={`text-xs font-bold tabular-nums ${c.text}`}>{z.density}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${z.density}%` }} />
                          </div>
                        </div>
                        <button onClick={() => deployTeam(z.id)}
                          className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
                          Deploy
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exit quick view */}
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200">🚶 Exit Flows</span>
                  {congExits > 0
                    ? <span className="text-[10px] font-bold text-rose-400 border border-rose-500/30 rounded-full px-2 py-0.5">{congExits} congested</span>
                    : <span className="text-[10px] font-semibold text-emerald-400">Flowing</span>}
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {[...exitZones].sort((a,b) => b.congestion - a.congestion).map(e => {
                    const c = pct(e.congestion);
                    return (
                      <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-zinc-200 truncate">{e.name}</span>
                            <span className={`text-xs font-bold tabular-nums ${c.text}`}>{e.congestion}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${e.congestion}%` }} />
                          </div>
                        </div>
                        <button onClick={() => deployExitTeam(e.id)}
                          className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
                          Deploy
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Threats preview */}
            {threatsTotal > 0 && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-rose-500/20 flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-300">😡 Active Threats</span>
                  <button onClick={() => setTab('threats')} className="text-[10px] text-rose-500/70 hover:text-rose-400">Manage →</button>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {[...emotionZones].filter(e => e.emotion === 'angry' || e.emotion === 'agitated').sort((a,b) => b.fightRisk - a.fightRisk).map(e => {
                    const s = emotionStyle(e.emotion);
                    return (
                      <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-200">{e.name}</p>
                          <p className="text-[10px] text-zinc-500">
                            {e.triggers.slice(0,2).join(' · ')}
                            {e.etaMin !== null && <span className={`ml-2 font-semibold ${s.text}`}>⚠ ~{e.etaMin} min</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${s.text}`}>{e.fightRisk}%</span>
                          {!e.securityDispatched && (
                            <button onClick={() => dispatchSecurity(e.id)}
                              className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-colors font-semibold">
                              🚨 Send
                            </button>
                          )}
                          {e.securityDispatched && <span className="text-[10px] text-emerald-400 font-medium animate-pulse">En route</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI summary */}
            {aiAnalysis && (
              <div className={`rounded-2xl border p-4 ${
                aiAnalysis.overallStatus === 'critical' ? 'border-rose-500/20 bg-rose-950/15' :
                aiAnalysis.overallStatus === 'busy'     ? 'border-amber-400/15 bg-amber-950/12' :
                                                          'border-emerald-400/15 bg-emerald-950/12'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-zinc-400">🤖 AI Summary</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                    aiAnalysis.overallStatus === 'critical' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                    aiAnalysis.overallStatus === 'busy'     ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
                                                              'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                  }`}>{aiAnalysis.overallStatus}</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{aiAnalysis.summary}</p>
              </div>
            )}

            {/* Recent log preview */}
            {log.length > 0 && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200">📋 Recent Events</span>
                  <button onClick={() => setTab('log')} className="text-[10px] text-zinc-500 hover:text-zinc-300">View all →</button>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {[...log].reverse().slice(0, 6).map(e => (
                    <div key={e.id} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="text-[10px] text-zinc-600 font-mono mt-0.5 flex-shrink-0">{e.ts}</span>
                      <span className={`text-[10px] rounded-full border px-1.5 py-0.5 flex-shrink-0 font-bold ${
                        e.severity === 'critical' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                        e.severity === 'warn'     ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
                                                    'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                      }`}>{e.severity.toUpperCase()}</span>
                      <span className="text-xs text-zinc-400 leading-snug">{e.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ENTRANCE ── */}
        {tab === 'entrance' && (
          <div className="space-y-3">
            {[...zones].sort((a,b) => b.density - a.density).map(z => {
              const c = pct(z.density);
              return (
                <div key={z.id} className={`rounded-2xl border bg-zinc-900 p-5 ${z.density >= 70 ? 'border-rose-500/30' : 'border-zinc-800/60'}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`h-2 w-2 rounded-full ${c.bar} ${z.density >= 70 ? 'animate-pulse' : ''}`} />
                        <span className="text-base font-semibold text-zinc-100">{z.name}</span>
                        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${c.badge}`}>{c.label}</span>
                      </div>
                      <p className="text-xs text-zinc-500">{z.queueLength} people queuing · ~{z.waitTime} min wait</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-2xl font-bold tabular-nums ${c.text}`}>{z.density}%</span>
                      <button onClick={() => deployTeam(z.id)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-medium">
                        Deploy Team
                      </button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${z.density}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── EXIT ── */}
        {tab === 'exit' && (
          <div className="space-y-3">
            {[...exitZones].sort((a,b) => b.congestion - a.congestion).map(e => {
              const c = pct(e.congestion);
              return (
                <div key={e.id} className={`rounded-2xl border bg-zinc-900 p-5 ${e.congestion >= 70 ? 'border-rose-500/30' : 'border-zinc-800/60'}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`h-2 w-2 rounded-full ${c.bar} ${e.congestion >= 70 ? 'animate-pulse' : ''}`} />
                        <span className="text-base font-semibold text-zinc-100">{e.name}</span>
                        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${c.badge}`}>{c.label}</span>
                        {!e.isOpen && <span className="text-[10px] font-bold text-zinc-600 border border-zinc-700 rounded-full px-2 py-0.5">CLOSED</span>}
                      </div>
                      <p className="text-xs text-zinc-500">{e.flow} ppl/min · clears in ~{e.clearTimeMin} min</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-2xl font-bold tabular-nums ${c.text}`}>{e.congestion}%</span>
                      <button onClick={() => deployExitTeam(e.id)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-medium">
                        Deploy Team
                      </button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${e.congestion}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── SECTIONS ── */}
        {tab === 'sections' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...sections].sort((a,b) => (b.occupied/b.capacity) - (a.occupied/a.capacity)).map(s => {
              const occ = Math.round(s.occupied / s.capacity * 100);
              const c   = pct(occ);
              return (
                <div key={s.id} className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{s.stand}</p>
                      <p className="text-[11px] text-zinc-600">{s.name}</p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${c.text}`}>{occ}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${occ}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>{s.occupied.toLocaleString()} occupied</span>
                    <span>capacity {s.capacity.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── OUTDOOR ── */}
        {tab === 'outdoor' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...outdoorZones].sort((a,b) => b.density - a.density).map(z => {
              const c = pct(z.density);
              const icon = z.type === 'parking' ? '🅿️' : z.type === 'metro' ? '🚇' : z.type === 'bus' ? '🚌' : '🚗';
              return (
                <div key={z.id} className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{z.name}</p>
                        <p className="text-[11px] text-zinc-600 capitalize">{z.type} · {z.waitTime} min wait</p>
                      </div>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${c.text}`}>{z.density}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${z.density}%` }} />
                  </div>
                  {z.spotsTotal && (
                    <p className="text-[10px] text-zinc-600">
                      {z.spotsAvailable} / {z.spotsTotal} spots free
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── THREATS ── */}
        {tab === 'threats' && (
          <div className="space-y-5">

            {/* Active critical banner */}
            {angryZones > 0 && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/25 p-4 flex items-center gap-4">
                <span className="text-3xl animate-pulse">🚨</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-rose-300">FIGHT RISK DETECTED</p>
                  <p className="text-xs text-rose-400/70 mt-0.5">
                    {angryZones} zone{angryZones > 1 ? 's' : ''} at ANGRY level — security intervention required immediately
                  </p>
                </div>
              </div>
            )}

            {/* Emotion zone cards */}
            <div className="space-y-3">
              {[...emotionZones].sort((a, b) => b.fightRisk - a.fightRisk).map(e => {
                const s = emotionStyle(e.emotion);
                return (
                  <div key={e.id} className={`rounded-2xl border bg-zinc-900 p-5 transition-all duration-500 ${
                    e.emotion === 'angry'    ? 'border-rose-500/40' :
                    e.emotion === 'agitated' ? 'border-orange-500/30' :
                    e.emotion === 'tense'    ? 'border-amber-400/20' :
                                               'border-zinc-800/60'
                  }`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xl">{s.icon}</span>
                          <span className="text-base font-bold text-zinc-100">{e.name}</span>
                          <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${s.badge}`}>{s.label}</span>
                          {e.securityDispatched && (
                            <span className="text-[10px] font-bold border rounded-full px-2 py-0.5 text-emerald-400 border-emerald-400/30 bg-emerald-400/10 animate-pulse">
                              🚨 Security en route
                            </span>
                          )}
                        </div>
                        {e.etaMin !== null && (
                          <p className={`text-sm font-semibold ${s.text} mb-1`}>
                            ⚠ Incident predicted in <span className="tabular-nums">{e.etaMin}</span> minute{e.etaMin !== 1 ? 's' : ''}
                          </p>
                        )}
                        {e.triggers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {e.triggers.map(t => (
                              <span key={t} className="text-[10px] text-zinc-500 border border-zinc-700/60 bg-zinc-800/50 rounded-full px-2 py-0.5">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-3xl font-bold tabular-nums leading-none ${s.text}`}>{e.fightRisk}%</span>
                        <span className="text-[10px] text-zinc-600">fight risk</span>
                        {!e.securityDispatched ? (
                          <button onClick={() => dispatchSecurity(e.id)}
                            disabled={e.emotion === 'calm'}
                            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                              e.emotion === 'calm'
                                ? 'bg-zinc-800/50 text-zinc-700 cursor-not-allowed'
                                : 'bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                            }`}>
                            🚨 Send Security
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-medium">Dispatched {e.dispatchedAt}</span>
                        )}
                      </div>
                    </div>

                    {/* Risk bar */}
                    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${e.fightRisk}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dispatch history */}
            {dispatches.length > 0 && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/60">
                  <p className="text-sm font-semibold text-zinc-200">Security Dispatch Log</p>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {[...dispatches].reverse().map(d => (
                    <div key={d.id} className="px-4 py-3 flex items-center gap-3">
                      <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">{d.ts}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 font-medium">{d.zoneName}</p>
                        <p className="text-[10px] text-zinc-600">Risk {d.fightRisk}%{d.etaMin ? ` · Incident in ~${d.etaMin} min` : ''}</p>
                      </div>
                      {d.resolved ? (
                        <span className="text-[10px] text-emerald-400 border border-emerald-400/20 rounded-full px-2 py-0.5">Resolved</span>
                      ) : (
                        <button onClick={() => resolveDispatch(d.id)}
                          className="text-[10px] text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5 hover:text-emerald-400 hover:border-emerald-400/30 transition-colors">
                          Mark resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI ── */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {!aiAnalysis && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-8 text-center text-zinc-600 text-sm">
                {aiLoading ? 'Running AI analysis…' : 'No AI analysis yet'}
              </div>
            )}

            {aiAnalysis && (
              <>
                {/* Alerts */}
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/60">
                    <p className="text-sm font-semibold text-zinc-200">Alerts</p>
                  </div>
                  <div className="divide-y divide-zinc-800/40">
                    {aiAnalysis.alerts.length === 0 && <p className="px-4 py-4 text-sm text-zinc-600">No active alerts</p>}
                    {aiAnalysis.alerts.map((a, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${sevColor(a.severity)}`}>{a.severity.toUpperCase()}</span>
                          <span className="text-xs text-zinc-400">{a.message}</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 ml-0.5">→ {a.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Predictions */}
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/60">
                    <p className="text-sm font-semibold text-zinc-200">⏱ 15-min Predictions</p>
                  </div>
                  <div className="divide-y divide-zinc-800/40">
                    {aiAnalysis.predictions.map(pred => {
                      const z   = zones.find(z => z.id === pred.gateId);
                      const c   = pct(pred.in15min);
                      const tc  = pred.trend === 'up' ? 'text-rose-400' : pred.trend === 'down' ? 'text-emerald-400' : 'text-zinc-600';
                      const ico = pred.trend === 'up' ? '↑' : pred.trend === 'down' ? '↓' : '→';
                      return (
                        <div key={pred.gateId} className="px-4 py-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-zinc-200">{z?.name ?? pred.gateId}</span>
                              <span className={`text-xs font-bold tabular-nums ${c.text}`}>{pred.in15min}%</span>
                              <span className={`text-xs font-bold ${tc}`}>{ico}</span>
                            </div>
                            <p className="text-[10px] text-zinc-600 leading-snug">{pred.reasoning}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Security actions */}
                {aiAnalysis.securityActions?.length > 0 && (
                  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800/60">
                      <p className="text-sm font-semibold text-zinc-200">🔒 Security Actions</p>
                    </div>
                    <div className="divide-y divide-zinc-800/40">
                      {aiAnalysis.securityActions.map((a, i) => {
                        const priColor = a.priority === 'high' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                                         a.priority === 'medium' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
                                                                    'text-zinc-400 border-zinc-700 bg-zinc-800/30';
                        return (
                          <div key={i} className="px-4 py-3 flex items-start gap-3">
                            <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 flex-shrink-0 ${priColor}`}>{a.priority.toUpperCase()}</span>
                            <div className="flex-1">
                              <p className="text-xs text-zinc-300 leading-snug">{a.action}</p>
                              <p className="text-[10px] text-zinc-600 mt-0.5">{a.staffNeeded} staff needed</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CAMERAS / YOLO ── */}
        {tab === 'cameras' && (
          <div className="space-y-5">

            {/* Backend status */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
              yoloAvailable
                ? 'border-emerald-400/20 bg-emerald-950/10'
                : 'border-rose-500/20 bg-rose-950/10'
            }`}>
              <span className="text-2xl">{yoloAvailable ? '🟢' : '🔴'}</span>
              <div className="flex-1">
                <p className={`text-sm font-bold ${yoloAvailable ? 'text-emerald-300' : 'text-rose-300'}`}>
                  YOLO Backend {yoloAvailable ? 'Online' : 'Offline'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {yoloAvailable
                    ? 'YOLOv8 + DeepFace active — real camera data overrides simulation'
                    : 'Start the Python backend to enable real vision analysis'}
                </p>
              </div>
              {!yoloAvailable && (
                <div className="text-[10px] font-mono text-zinc-600 bg-zinc-800 rounded-lg px-3 py-2 whitespace-nowrap">
                  cd backend && python main.py
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5">
              <p className="text-sm font-semibold text-zinc-200 mb-3">How YOLO integration works</p>
              <div className="grid gap-3 sm:grid-cols-3 text-xs text-zinc-500">
                {[
                  { icon: '📷', title: 'Camera / Image', desc: 'Stadium camera RTSP stream or snapshot URL sent to Python backend' },
                  { icon: '🤖', title: 'YOLOv8 + DeepFace', desc: 'YOLOv8 counts persons per zone · DeepFace detects dominant emotion' },
                  { icon: '📊', title: 'Live Dashboard', desc: 'Density and emotion override simulation — auto-dispatch when risk ≥ 80%' },
                ].map(s => (
                  <div key={s.title} className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-3">
                    <div className="text-xl mb-1">{s.icon}</div>
                    <p className="font-semibold text-zinc-300 mb-0.5">{s.title}</p>
                    <p>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-zone image analyzer */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-zinc-200">Analyze a gate — paste image URL or camera snapshot</p>
              {Object.keys(cameraInputs).map(zoneId => {
                const zone   = zones.find(z => z.id === zoneId);
                const result = cameraResults[zoneId];
                const loading = cameraLoading[zoneId];
                const eStyle = result ? (
                  result.emotionLevel === 'angry'    ? { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: '😡' } :
                  result.emotionLevel === 'agitated' ? { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  icon: '😠' } :
                  result.emotionLevel === 'tense'    ? { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30',   icon: '😤' } :
                                                       { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', icon: '😊' }
                ) : null;

                return (
                  <div key={zoneId} className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-zinc-200">{zone?.name ?? zoneId}</span>
                      {result && !result.error && (
                        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${eStyle?.text} ${eStyle?.bg} ${eStyle?.border}`}>
                          {eStyle?.icon} {result.emotionLevel?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* URL input */}
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="https://... image URL or camera snapshot"
                        value={cameraInputs[zoneId]}
                        onChange={e => setCameraInputs(p => ({ ...p, [zoneId]: e.target.value }))}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        onClick={() => analyzeCamera(zoneId, cameraInputs[zoneId])}
                        disabled={loading || !cameraInputs[zoneId].trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Analyzing…' : 'Analyze'}
                      </button>
                    </div>

                    {/* Result */}
                    {result && !result.error && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: 'Persons',     value: result.personCount },
                          { label: 'Density',     value: `${result.density}%` },
                          { label: 'Emotion',     value: result.rawEmotion },
                          { label: 'Fight risk',  value: `${result.fightRisk}%` },
                          { label: 'ETA incident',value: result.etaMin ? `~${result.etaMin} min` : 'None' },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-center">
                            <p className="text-sm font-bold text-zinc-200 tabular-nums">{s.value}</p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {result?.error && (
                      <p className="text-xs text-rose-400 mt-1">{result.error} — make sure the Python backend is running</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Setup guide */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5">
              <p className="text-sm font-semibold text-zinc-200 mb-3">Setup Guide</p>
              <div className="space-y-2 text-xs font-mono text-zinc-500">
                {[
                  '# 1. Go to backend folder',
                  'cd backend',
                  '',
                  '# 2. Create virtual environment',
                  'python -m venv venv && venv\\Scripts\\activate',
                  '',
                  '# 3. Install dependencies (YOLOv8 + DeepFace)',
                  'pip install -r requirements.txt',
                  '',
                  '# 4. Start the backend (auto-downloads yolov8n.pt on first run)',
                  'python main.py',
                  '',
                  '# Backend runs on http://localhost:8000',
                  '# Dashboard auto-detects it and switches from simulation to live data',
                ].map((line, i) => (
                  <p key={i} className={line.startsWith('#') ? 'text-zinc-600' : 'text-zinc-300'}>{line || '\u00A0'}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === 'log' && (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Event Log</p>
              <button onClick={() => setLog([])} className="text-[10px] text-zinc-600 hover:text-rose-400 transition-colors">Clear</button>
            </div>
            {log.length === 0 && (
              <p className="px-4 py-8 text-sm text-zinc-600 text-center">No events recorded yet. Events appear automatically when thresholds change.</p>
            )}
            <div className="divide-y divide-zinc-800/30 max-h-[60vh] overflow-y-auto">
              {[...log].reverse().map(e => (
                <div key={e.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-[10px] text-zinc-600 font-mono mt-0.5 flex-shrink-0">{e.ts}</span>
                  <span className={`text-[10px] rounded-full border px-1.5 py-0.5 flex-shrink-0 font-bold whitespace-nowrap ${
                    e.severity === 'critical' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                    e.severity === 'warn'     ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
                                                'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                  }`}>{e.severity === 'critical' ? '⚠ CRITICAL' : e.severity === 'warn' ? '! WARN' : '✓ OK'}</span>
                  <span className={`text-[10px] rounded-full border px-1.5 py-0.5 flex-shrink-0 font-medium ${
                    e.type === 'entrance' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                    e.type === 'exit'     ? 'text-purple-400 border-purple-400/20 bg-purple-400/10' :
                    e.type === 'ai'       ? 'text-amber-400 border-amber-400/20 bg-amber-400/10' :
                    e.type === 'threat'   ? 'text-rose-400 border-rose-500/20 bg-rose-500/10' :
                                            'text-zinc-400 border-zinc-700 bg-zinc-800/30'
                  }`}>{e.type}</span>
                  <span className="text-xs text-zinc-400 leading-snug">{e.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
