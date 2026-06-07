'use client';

import { useCrowd, getDensityColor } from '@/context/CrowdContext';

const STALLS = [
  { id: 's1', name: 'Stand 1 — Burgers & Wraps', nearGate: 'gate-north',  icon: '🍔', items: ['Classic Burger', 'Chicken Wrap', 'Fries'], price: '8–12 €' },
  { id: 's2', name: 'Stand 2 — Pizza Corner',    nearGate: 'gate-west',   icon: '🍕', items: ['Margherita Slice', 'Pepperoni', 'Veggie'], price: '5–9 €' },
  { id: 's3', name: 'Stand 3 — Hot Dogs',         nearGate: 'gate-south',  icon: '🌭', items: ['Classic Dog', 'Cheese Dog', 'Nachos'], price: '4–8 €' },
  { id: 's4', name: 'Stand 4 — Grill Station',    nearGate: 'gate-east-a', icon: '🥩', items: ['Grilled Chicken', 'Kofta Kebab', 'Salads'], price: '9–15 €' },
  { id: 's5', name: 'Stand 5 — Snacks & Drinks',  nearGate: 'gate-east-b', icon: '🥤', items: ['Cold Drinks', 'Popcorn', 'Pretzels'], price: '2–5 €' },
  { id: 's6', name: 'VIP Lounge Bar',             nearGate: 'gate-vip',    icon: '🍷', items: ['Premium Drinks', 'Canapés', 'Desserts'], price: '15–30 €' },
];

const RESTAURANTS = [
  { name: 'La Terrasse',    cuisine: 'Mediterranean',  distance: '5 min walk', rating: 4.8, price: '$$', open: true,  icon: '🌿', note: 'Rooftop views, great for post-match' },
  { name: 'Stadium Grill',  cuisine: 'Burgers & Ribs', distance: '2 min walk', rating: 4.5, price: '$',  open: true,  icon: '🔥', note: 'Fast service, handles match-day crowds well' },
  { name: 'Casa Verde',     cuisine: 'Vegetarian',     distance: '8 min walk', rating: 4.7, price: '$$', open: true,  icon: '🥗', note: 'Cosy spot, book ahead on match nights' },
  { name: 'The Sports Bar', cuisine: 'Bar & Pub Food', distance: '3 min walk', rating: 4.3, price: '$',  open: true,  icon: '🍺', note: 'Pre-match atmosphere, big screens inside' },
  { name: 'Al Fassia',      cuisine: 'Local Cuisine',  distance: '10 min walk', rating: 4.9, price: '$$$', open: true, icon: '🏺', note: 'Award-winning local kitchen, worth the walk' },
];

export default function FoodPage() {
  const { zones } = useCrowd();
  const zoneMap   = Object.fromEntries(zones.map(z => [z.id, z]));

  // Best stall = one whose nearby gate is least congested
  const sortedStalls = [...STALLS].sort((a, b) => {
    const dA = zoneMap[a.nearGate]?.density ?? 50;
    const dB = zoneMap[b.nearGate]?.density ?? 50;
    return dA - dB;
  });
  const bestStall = sortedStalls[0];

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">

      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-bold text-white">Food & Drinks</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Stadium stalls and nearby restaurants</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">

        {/* AI-driven best stall banner */}
        {bestStall && (() => {
          const nearZone = zoneMap[bestStall.nearGate];
          const wait     = nearZone ? Math.max(1, Math.round(nearZone.density / 14)) : 4;
          const c        = nearZone ? getDensityColor(nearZone.density) : null;
          return (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-5">
              <div className="flex items-start gap-4">
                <span className="text-4xl flex-shrink-0">{bestStall.icon}</span>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Shortest queue right now</p>
                  <h2 className="text-lg font-bold text-emerald-400">{bestStall.name}</h2>
                  <p className="text-sm text-zinc-300 mt-1">
                    Nearby gate is <span className={c?.text}>{c?.label.toLowerCase()}</span> — estimated <strong className="text-white">~{wait} min wait</strong> at this stall
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bestStall.items.map(item => (
                      <span key={item} className="text-xs text-zinc-500 border border-zinc-800 rounded-full px-2.5 py-0.5">{item}</span>
                    ))}
                    <span className="text-xs text-emerald-400 border border-emerald-400/20 rounded-full px-2.5 py-0.5">{bestStall.price}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* All stalls */}
        <div>
          <h2 className="text-base font-bold text-white mb-4">Stadium Stalls</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedStalls.map((stall, i) => {
              const nearZone = zoneMap[stall.nearGate];
              const wait     = nearZone ? Math.max(1, Math.round(nearZone.density / 14)) : 4;
              const c        = nearZone ? getDensityColor(nearZone.density) : null;
              const isBest   = i === 0;

              return (
                <div key={stall.id} className={`rounded-2xl border bg-zinc-900 p-4 ${
                  isBest ? 'border-emerald-400/20' : 'border-zinc-800/60'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{stall.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-100 leading-tight">{stall.name.split(' — ')[0]}</p>
                        <p className="text-xs text-zinc-600">{stall.name.split(' — ')[1]}</p>
                      </div>
                    </div>
                    {isBest && <span className="text-[10px] font-bold rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 whitespace-nowrap flex-shrink-0">Best now</span>}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {c && (
                      <div className={`flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden`}>
                        <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                          style={{ width: `${nearZone?.density ?? 50}%` }} />
                      </div>
                    )}
                    <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${c?.text}`}>~{wait} min</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {stall.items.map(item => (
                      <span key={item} className="text-[10px] text-zinc-600 border border-zinc-800/80 rounded-full px-2 py-0.5">{item}</span>
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-500">{stall.price}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nearby restaurants */}
        <div>
          <h2 className="text-base font-bold text-white mb-4">Nearby Restaurants</h2>
          <div className="space-y-3">
            {RESTAURANTS.map(r => (
              <div key={r.name} className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0 mt-0.5">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="font-semibold text-zinc-100">{r.name}</span>
                        <span className="text-xs text-zinc-600 ml-2">{r.cuisine}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-amber-400">{'★'.repeat(Math.round(r.rating))} {r.rating}</span>
                        <span className="text-xs text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">{r.price}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-1.5">
                      <span>📍 {r.distance}</span>
                      <span className={r.open ? 'text-emerald-400' : 'text-rose-400'}>
                        {r.open ? '✓ Open' : 'Closed'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 italic">{r.note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
