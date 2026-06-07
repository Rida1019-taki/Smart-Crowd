'use client';

import { useState, useEffect, useRef } from 'react';
import { useCrowd } from '@/context/CrowdContext';

// Safe value renderer - converts NaN/undefined to 0
const safeNum = (val: any, fallback: number = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

// ── Types ──────────────────────────────────────────────────────────────────────
type Severity   = 'low' | 'medium' | 'high' | 'emergency';
type ReportType = 'crowd' | 'weapon' | 'fight' | 'illegal' | 'other';

interface Report {
  id: string;
  type: ReportType;
  location: string;
  severity: Severity;
  description: string;
  anonymous: boolean;
  ts: string;
  resolved: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<ReportType, string> = {
  crowd: '👥', weapon: '🔪', fight: '🥊', illegal: '🚫', other: '⚠️',
};
const TYPE_LABEL: Record<ReportType, string> = {
  crowd: 'Crowd Overload', weapon: 'Weapon/Threat', fight: 'Fight/Violence',
  illegal: 'Illegal Activity', other: 'Other',
};

function sevBadge(s: Severity) {
  const map: Record<Severity, string> = {
    emergency: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    high:      'bg-orange-500/20 text-orange-400 border-orange-500/40',
    medium:    'bg-amber-500/20 text-amber-400 border-amber-500/40',
    low:       'bg-zinc-700 text-zinc-300 border-zinc-600',
  };
  return map[s];
}

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function densityColor(d: number) {
  if (d >= 80) return { bar: 'bg-rose-500',   text: 'text-rose-400',   label: 'OVERLOAD', ring: 'border-rose-500/40 bg-rose-500/5' };
  if (d >= 60) return { bar: 'bg-amber-400',  text: 'text-amber-400',  label: 'BUSY',     ring: 'border-amber-400/30 bg-amber-400/5' };
  if (d >= 30) return { bar: 'bg-emerald-400',text: 'text-emerald-400',label: 'NORMAL',   ring: 'border-zinc-700 bg-zinc-900' };
  return              { bar: 'bg-zinc-600',   text: 'text-zinc-400',   label: 'QUIET',    ring: 'border-zinc-700 bg-zinc-900' };
}
function congColor(c: number) {
  if (c >= 80) return { bar: 'bg-rose-500',   text: 'text-rose-400',   label: 'JAMMED' };
  if (c >= 60) return { bar: 'bg-amber-400',  text: 'text-amber-400',  label: 'SLOW'   };
  if (c >= 30) return { bar: 'bg-emerald-400',text: 'text-emerald-400',label: 'FLOWING' };
  return              { bar: 'bg-zinc-600',   text: 'text-zinc-400',   label: 'CLEAR'  };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const { zones, exitZones, dispatches, resolveDispatch } = useCrowd();
  const [reports,      setReports]      = useState<Report[]>([]);
  const [filter,       setFilter]       = useState<'all' | 'open' | 'emergency'>('all');
  const [resolving,    setResolving]    = useState<string | null>(null);
  const [alertSound,   setAlertSound]   = useState(false);
  const prevCount = useRef(0);

  // Gate summary stats
  const overloadedGates = zones.filter(z => z.density >= 80);
  const jammedExits     = exitZones.filter(e => e.congestion >= 80);
  const totalQueuing    = zones.reduce((s, z) => s + z.queueLength, 0);
  const openReports     = reports.filter(r => !r.resolved);
  const emergencyCount  = openReports.filter(r => r.severity === 'emergency').length;

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/report');
      const d   = await res.json();
      const list: Report[] = d.reports ?? [];
      // detect new emergency reports
      if (list.filter(r => !r.resolved && r.severity === 'emergency').length > prevCount.current) {
        setAlertSound(true);
        setTimeout(() => setAlertSound(false), 3000);
      }
      prevCount.current = list.filter(r => !r.resolved && r.severity === 'emergency').length;
      setReports(list);
    } catch { /* backend offline */ }
  };

  useEffect(() => {
    fetchReports();
    const id = setInterval(fetchReports, 5000);
    return () => clearInterval(id);
  }, []);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await fetch(`/api/report/${id}/resolve`, { method: 'PATCH' });
      setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: true } : r));
    } finally { setResolving(null); }
  };

  const filtered = reports.filter(r => {
    if (filter === 'open')      return !r.resolved;
    if (filter === 'emergency') return !r.resolved && r.severity === 'emergency';
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <div className={`border-b px-6 py-4 transition-colors ${alertSound ? 'border-rose-500/60 bg-rose-950/30' : 'border-zinc-800/60'}`}>
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              🛡️ Security Reception
              {alertSound && <span className="text-sm bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">🚨 EMERGENCY</span>}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Live reports · Gate monitoring · Security dispatch</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <KPI label="Open Reports"    value={openReports.length}     color={openReports.length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
            <KPI label="Emergencies"     value={emergencyCount}         color={emergencyCount > 0 ? 'text-rose-400 animate-pulse' : 'text-zinc-400'} />
            <KPI label="Gate Overloads"  value={overloadedGates.length} color={overloadedGates.length > 0 ? 'text-rose-400' : 'text-zinc-400'} />
            <KPI label="Exit Jams"       value={jammedExits.length}     color={jammedExits.length > 0 ? 'text-rose-400' : 'text-zinc-400'} />
            <KPI label="Total Queuing"   value={totalQueuing.toLocaleString()} color="text-zinc-300" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 grid lg:grid-cols-[1fr_1fr_340px] gap-6">

        {/* ── ENTRANCE GATES ── */}
        <section>
          <h2 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
            🚪 Entrance Gates
            {overloadedGates.length > 0 && (
              <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-2 py-0.5">
                {overloadedGates.length} overloaded
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {[...zones].sort((a, b) => safeNum(b.density, 0) - safeNum(a.density, 0)).map(z => {
              const d = safeNum(z.density, 0);
              const c = densityColor(d);
              return (
                <div key={z.id} className={`rounded-xl border p-3 ${c.ring}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {d >= 80 && (
                        <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-sm font-semibold text-white">{z.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${c.text}`}>{c.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${c.text}`}>{d}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                      style={{ width: `${d}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>👥 {z.queueLength} queuing</span>
                    <span>⏱ ~{z.waitTime} min wait</span>
                    <span className={z.density >= 80 ? 'text-rose-400 font-semibold' : ''}>
                      {Math.round(z.density * 4.2)} people/hr
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── EXIT GATES ── */}
        <section>
          <h2 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
            🚶 Exit Gates
            {jammedExits.length > 0 && (
              <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-2 py-0.5">
                {jammedExits.length} jammed
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {[...exitZones].sort((a, b) => b.congestion - a.congestion).map(e => {
              const c = congColor(e.congestion);
              return (
                <div key={e.id} className={`rounded-xl border p-3 ${e.congestion >= 80 ? 'border-rose-500/40 bg-rose-500/5' : e.congestion >= 60 ? 'border-amber-400/30 bg-amber-400/5' : 'border-zinc-700 bg-zinc-900'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {e.congestion >= 80 && (
                        <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span className="text-sm font-semibold text-white">{e.name}</span>
                      {!e.isOpen && <span className="text-[10px] text-rose-400 font-bold">CLOSED</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${c.text}`}>{c.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${c.text}`}>{e.congestion}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                      style={{ width: `${e.congestion}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>➡ {e.flow} ppl/min</span>
                    <span>⏱ clears in ~{e.clearTimeMin} min</span>
                    {e.congestion >= 80 && <span className="text-rose-400 font-semibold">⚠ Deploy staff</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security dispatches */}
          {dispatches.filter(d => !d.resolved).length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
              <h3 className="text-xs font-bold text-rose-400 mb-2">🚨 Active Security Dispatches</h3>
              <div className="space-y-2">
                {dispatches.filter(d => !d.resolved).map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-zinc-200 font-medium">{d.zoneName}</span>
                      <span className="text-zinc-500 ml-1">risk {d.fightRisk}%{d.etaMin ? ` · ${d.etaMin}min` : ''}</span>
                    </div>
                    <button
                      onClick={() => resolveDispatch(d.id)}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg px-2 py-1 transition-colors"
                    >
                      ✓ Resolved
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── REPORTS PANEL ── */}
        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-300">📋 Incoming Reports</h2>
            <button
              onClick={fetchReports}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >↻ Refresh</button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3">
            {(['all', 'open', 'emergency'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? f === 'emergency' ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? `All (${reports.length})` : f === 'open' ? `Open (${openReports.length})` : `🚨 Emergency (${emergencyCount})`}
              </button>
            ))}
          </div>

          {/* Report list */}
          <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 580 }}>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-600 text-sm">
                  {filter === 'emergency' ? 'No emergencies 🟢' : 'No reports'}
                </p>
              </div>
            ) : (
              filtered.map(r => (
                <div key={r.id} className={`rounded-xl border p-3 transition-opacity ${
                  r.resolved ? 'opacity-40 border-zinc-800' :
                  r.severity === 'emergency' ? 'border-rose-500/50 bg-rose-500/5' :
                  r.severity === 'high'      ? 'border-orange-500/40 bg-orange-500/5' :
                  r.severity === 'medium'    ? 'border-amber-400/30 bg-amber-400/5' :
                  'border-zinc-700 bg-zinc-900'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{TYPE_ICON[r.type]}</span>
                      <span className="text-xs font-semibold text-zinc-200">{TYPE_LABEL[r.type]}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sevBadge(r.severity)}`}>
                      {r.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-0.5">📍 {r.location}</p>
                  {r.description && (
                    <p className="text-xs text-zinc-500 mb-1 line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-zinc-600">{timeAgo(r.ts)} · {r.anonymous ? 'Anon' : 'Identified'}</span>
                    {!r.resolved && (
                      <button
                        disabled={resolving === r.id}
                        onClick={() => handleResolve(r.id)}
                        className="text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
                      >
                        {resolving === r.id ? '…' : '✓ Mark resolved'}
                      </button>
                    )}
                    {r.resolved && <span className="text-[10px] text-emerald-400">✓ Resolved</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-center min-w-[80px]">
      <div className={`text-lg font-extrabold ${color}`}>{value}</div>
      <div className="text-[9px] text-zinc-600 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}
