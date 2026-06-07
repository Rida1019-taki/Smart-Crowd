'use client';

import { useCrowd, getDensityColor } from '@/context/CrowdContext';

// Safe value renderer - converts NaN/undefined to 0
const safeNum = (val: any, fallback: number = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const TYPE_META = {
  parking:  { icon: '🅿️', label: 'Parking'  },
  metro:    { icon: '🚇', label: 'Metro'    },
  bus:      { icon: '🚌', label: 'Bus'      },
  rideshare:{ icon: '🚕', label: 'Rideshare'},
};

const APPROACH_ROUTES = [
  { id: 'r1', name: 'North Boulevard',    note: 'Main approach from city centre',     status: 82 },
  { id: 'r2', name: 'East Ring Road',     note: 'From motorway — exits 4 and 5',     status: 47 },
  { id: 'r3', name: 'South Avenue',       note: 'Residential approach, 2 lanes',     status: 61 },
  { id: 'r4', name: 'West Stadium Drive', note: 'VIP and coach drop-off access',     status: 29 },
];

export default function OutsidePage() {
  const { outdoorZones } = useCrowd();
  const parking   = outdoorZones.filter(z => z.type === 'parking');
  const transport = outdoorZones.filter(z => z.type !== 'parking');

  const bestParking   = [...parking].sort((a, b) => a.density - b.density)[0];
  const bestTransport = [...transport].sort((a, b) => a.density - b.density)[0];
  const bestRoute     = [...APPROACH_ROUTES].sort((a, b) => a.status - b.status)[0];

  const totalSpots = parking.reduce((s, z) => s + (z.spotsTotal || 0), 0);
  const avail      = parking.reduce((s, z) => s + (z.spotsAvailable || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">

      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-6 py-5">
        <div className="mx-auto max-w-5xl flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Getting to the Stadium</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Parking, transport and road conditions — live</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">

        {/* Top recommendations */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: '🅿️', label: 'Best parking', value: bestParking?.name ?? '—', sub: `${bestParking?.spotsAvailable ?? 0} spots free`, color: 'emerald' },
            { icon: '🚇', label: 'Best transport', value: bestTransport?.name ?? '—', sub: `~${bestTransport?.waitTime ?? '?'} min wait`, color: 'blue' },
            { icon: '🛣️', label: 'Clearest road', value: bestRoute.name, sub: bestRoute.note, color: 'amber' },
          ].map(r => (
            <div key={r.label} className={`rounded-2xl border p-4 ${
              r.color === 'emerald' ? 'border-emerald-400/20 bg-emerald-950/20' :
              r.color === 'blue'    ? 'border-blue-400/20 bg-blue-950/15' :
                                      'border-amber-400/20 bg-amber-950/15'
            }`}>
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">{r.label}</div>
              <div className={`font-bold text-sm ${r.color === 'emerald' ? 'text-emerald-300' : r.color === 'blue' ? 'text-blue-300' : 'text-amber-300'}`}>{r.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{r.sub}</div>
            </div>
          ))}
        </div>

        {/* Parking */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">🅿️ Parking</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{avail.toLocaleString()} of {totalSpots.toLocaleString()} spots available</p>
            </div>
            <div className="h-2 w-32 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                style={{ width: `${Math.round((avail / totalSpots) * 100)}%` }} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/60">
            {parking.map(lot => {
              const c    = getDensityColor(lot.density);
              const pct  = Math.round((1 - lot.density / 100) * 100);
              return (
                <div key={lot.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-zinc-100">{lot.name}</span>
                    <span className={`text-[11px] font-bold rounded-full border px-2.5 py-0.5 ${c.badge}`}>{c.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${lot.density}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-base font-bold text-zinc-200">{lot.spotsAvailable ?? 0}</div>
                      <div className="text-[10px] text-zinc-600">Free</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-zinc-200">{lot.spotsTotal ?? 0}</div>
                      <div className="text-[10px] text-zinc-600">Total</div>
                    </div>
                    <div>
                      <div className={`text-base font-bold ${c.text}`}>{lot.density}%</div>
                      <div className="text-[10px] text-zinc-600">Full</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    {lot.density < 50 ? '✓ Easy access, plenty of space' :
                     lot.density < 75 ? '⚠ Filling up — still available' :
                                        '🔴 Almost full — consider alternatives'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transport */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-base font-bold text-white">🚇 Public Transport & Rideshare</h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {transport.map(z => {
              const d    = safeNum(z.density, 0);
              const w    = safeNum(z.waitTime, 0);
              const c    = getDensityColor(d);
              const meta = TYPE_META[z.type];
              return (
                <div key={z.id} className="px-5 py-4 flex items-center gap-4">
                  <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-medium text-zinc-200 text-sm">{z.name}</span>
                      <span className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${c.badge}`}>{c.label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${d}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-base font-bold tabular-nums ${c.text}`}>{d}%</div>
                    <div className="text-xs text-zinc-600">~{w} min</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Road conditions */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-base font-bold text-white">🛣️ Approach Roads</h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {APPROACH_ROUTES.map(route => {
              const c = getDensityColor(route.status);
              return (
                <div key={route.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <div className="min-w-0">
                      <span className="font-medium text-zinc-200 text-sm">{route.name}</span>
                      <p className="text-xs text-zinc-600 mt-0.5">{route.note}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[11px] font-bold rounded-full border px-2.5 py-0.5 ${c.badge}`}>{c.label}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${route.status}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
