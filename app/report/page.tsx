'use client';

import { useState, useEffect } from 'react';

type ReportType = 'crowd' | 'weapon' | 'fight' | 'illegal' | 'other';
type Severity   = 'low' | 'medium' | 'high' | 'emergency';

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

const TYPE_OPTS: { value: ReportType; label: string; icon: string }[] = [
  { value: 'crowd',   label: 'Crowd Overload', icon: '👥' },
  { value: 'weapon',  label: 'Weapon / Threat', icon: '🔪' },
  { value: 'fight',   label: 'Fight / Violence', icon: '🥊' },
  { value: 'illegal', label: 'Illegal Activity', icon: '🚫' },
  { value: 'other',   label: 'Other',            icon: '⚠️'  },
];

const SEV_OPTS: { value: Severity; label: string; color: string }[] = [
  { value: 'low',       label: 'Low',       color: 'bg-zinc-700 text-zinc-200' },
  { value: 'medium',    label: 'Medium',    color: 'bg-amber-500/20 text-amber-400' },
  { value: 'high',      label: 'High',      color: 'bg-orange-500/20 text-orange-400' },
  { value: 'emergency', label: 'Emergency', color: 'bg-rose-500/20 text-rose-400' },
];

const LOCATIONS = [
  'Portail A1', 'Portail A2', 'Portail B1', 'Portail B2',
  'Portail C1', 'Portail VIP', 'Portail D1',
  'Tribune Nord', 'Tribune Sud', 'Tribune Est', 'Tribune Ouest',
  'Tribune Haute', 'Section Visiteurs', 'Salon VIP', 'Zone Famille',
  'Parking A', 'Parking B', 'Métro Nord', 'Autre / Inconnu',
];

function sevColor(s: Severity) {
  if (s === 'emergency') return 'text-rose-400';
  if (s === 'high')      return 'text-orange-400';
  if (s === 'medium')    return 'text-amber-400';
  return 'text-zinc-400';
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function ReportPage() {
  const [type,        setType]        = useState<ReportType>('crowd');
  const [location,    setLocation]    = useState('Portail A1');
  const [severity,    setSeverity]    = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [anonymous,   setAnonymous]   = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState('');
  const [reports,     setReports]     = useState<Report[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/report');
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      // backend offline — show empty feed
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, location, severity, description, anonymous }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
        setDescription('');
        fetchReports();
        setTimeout(() => setSubmitted(false), 4000);
      } else {
        setError(data.error ?? 'Submission failed');
      }
    } catch {
      setError('Backend is offline. Start python backend/main.py to enable live reporting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <div className="border-b border-zinc-800/60 px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-extrabold text-white">🚨 Incident Report</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Report crowd issues, threats, or suspicious activity in the stadium</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 grid md:grid-cols-[1fr_340px] gap-8">

        {/* ── Report form ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-6">
          <h2 className="font-bold text-white mb-5">Submit a Report</h2>

          {submitted && (
            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
              <p className="text-emerald-400 text-sm font-medium">✓ Report submitted — security has been notified</p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3">
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Type of incident</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TYPE_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                      type === opt.value
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold'
                        : 'bg-zinc-800 border border-transparent text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="text-xs">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Location</label>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Severity</label>
              <div className="flex gap-2 flex-wrap">
                {SEV_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      severity === opt.value
                        ? `${opt.color} border-current`
                        : 'bg-zinc-800 border-transparent text-zinc-500 hover:bg-zinc-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Description <span className="font-normal text-zinc-600">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what you saw..."
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Anonymous */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setAnonymous(!anonymous)}
                className={`w-10 h-5 rounded-full transition-colors relative ${anonymous ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${anonymous ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-zinc-400">Submit anonymously</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : '🚨 Submit Report'}
            </button>
          </form>
        </div>

        {/* ── Recent reports feed ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-sm">Recent Reports</h2>
            <button
              onClick={fetchReports}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >↻ Refresh</button>
          </div>

          {loadingFeed ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-rose-400 rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-zinc-600 text-center">No reports yet.<br />Be the first to report an issue.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1" style={{ maxHeight: 520 }}>
              {reports.map(r => {
                const typeOpt = TYPE_OPTS.find(t => t.value === r.type);
                return (
                  <div key={r.id} className={`rounded-xl p-3 border ${r.resolved ? 'border-zinc-800 opacity-50' : 'border-zinc-700'} bg-zinc-800/50`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{typeOpt?.icon} <span className="text-zinc-200 font-semibold text-xs">{typeOpt?.label}</span></span>
                      {r.resolved && <span className="text-[10px] text-emerald-400 font-semibold">✓ Resolved</span>}
                    </div>
                    <p className="text-xs text-zinc-400 mb-1">{r.location} · <span className={`font-semibold ${sevColor(r.severity)}`}>{r.severity.toUpperCase()}</span></p>
                    {r.description && <p className="text-xs text-zinc-500 mb-1 line-clamp-2">{r.description}</p>}
                    <p className="text-[10px] text-zinc-600">{timeAgo(r.ts)} · {r.anonymous ? 'Anonymous' : 'Identified'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
