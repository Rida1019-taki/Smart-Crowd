'use client';

import { useMemo } from 'react';
import { useCrowd } from '@/context/CrowdContext';

// Safe value renderer - converts NaN/undefined to 0
const safeNum = (val: any, fallback: number = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const KICKOFF_HOUR  = 20;
const KICKOFF_MIN   = 0;
const MATCH_DATE_OVERRIDE: null | [number, number, number] = null; // set to [YYYY, M-1, D] to override date

interface Phase {
  id: string;
  label: string;
  icon: string;
  offsetMin: number; // minutes relative to kickoff (negative = before)
  durationMin: number;
  crowdLevel: 'low' | 'medium' | 'high';
  parking: 'clear' | 'filling' | 'full';
  tip: string;
}

const PHASES: Phase[] = [
  {
    id: 'early',
    label: '3h Before',
    icon: '🌅',
    offsetMin: -180,
    durationMin: 60,
    crowdLevel: 'low',
    parking: 'clear',
    tip: 'Best time to arrive for parking. Roads are clear, gates are quiet. Perfect for exploring fan zones.',
  },
  {
    id: 'doors-open',
    label: '2h Before',
    icon: '🚗',
    offsetMin: -120,
    durationMin: 60,
    crowdLevel: 'medium',
    parking: 'filling',
    tip: 'Parking lots start filling. Recommended window if you want a close spot. Grab food before the rush.',
  },
  {
    id: 'rush',
    label: '1h Before',
    icon: '⚡',
    offsetMin: -60,
    durationMin: 45,
    crowdLevel: 'high',
    parking: 'full',
    tip: 'Peak arrival time — expect queues at all gates. Consider Park A (last to fill). Allow 30+ min extra.',
  },
  {
    id: 'final-call',
    label: '15 min Before',
    icon: '🚨',
    offsetMin: -15,
    durationMin: 15,
    crowdLevel: 'high',
    parking: 'full',
    tip: 'Last push before kickoff. Gates are at maximum capacity. Head straight to your assigned gate.',
  },
  {
    id: 'kickoff',
    label: 'Kickoff',
    icon: '⚽',
    offsetMin: 0,
    durationMin: 45,
    crowdLevel: 'low',
    parking: 'full',
    tip: 'Everyone inside! If you haven\'t arrived yet, wait 10 minutes — gates become very easy.',
  },
  {
    id: 'first-half',
    label: 'First Half',
    icon: '🏃',
    offsetMin: 5,
    durationMin: 40,
    crowdLevel: 'low',
    parking: 'full',
    tip: 'Great time for concessions — stalls are empty once play begins. Beat the half-time rush.',
  },
  {
    id: 'half-time',
    label: 'Half Time',
    icon: '☕',
    offsetMin: 45,
    durationMin: 15,
    crowdLevel: 'medium',
    parking: 'full',
    tip: '15-minute break. Food stalls and toilets will peak in the first 8 min. Head out at min 43.',
  },
  {
    id: 'second-half',
    label: 'Second Half',
    icon: '🎯',
    offsetMin: 60,
    durationMin: 45,
    crowdLevel: 'low',
    parking: 'full',
    tip: 'Same as first half — stalls quiet. If you need to leave early, go at 75-80 min to beat traffic.',
  },
  {
    id: 'full-time',
    label: 'Full Time',
    icon: '🎉',
    offsetMin: 105,
    durationMin: 30,
    crowdLevel: 'high',
    parking: 'full',
    tip: 'Massive exit wave. Expect 30–45 min to clear. Head to transport early, or wait 15 min inside.',
  },
  {
    id: 'post-match',
    label: 'Post Match',
    icon: '🌙',
    offsetMin: 135,
    durationMin: 60,
    crowdLevel: 'medium',
    parking: 'filling',
    tip: 'Crowds thinning. Parking lots start clearing. Nearby restaurants are buzzing — great time for a meal.',
  },
];

const CROWD_DOT = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-rose-500' };
const CROWD_BG  = { low: 'bg-emerald-400/5', medium: 'bg-amber-400/5', high: 'bg-rose-500/7' };
const CROWD_BD  = { low: 'border-emerald-400/15', medium: 'border-amber-400/18', high: 'border-rose-500/22' };
const CROWD_LBL = { low: 'Low crowd', medium: 'Busy', high: 'Peak crowd' };
const CROWD_TX  = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-rose-400' };
const PARK_COL  = { clear: 'text-emerald-400', filling: 'text-amber-400', full: 'text-rose-400' };
const PARK_LBL  = { clear: 'Parking clear', filling: 'Parking filling', full: 'Parking full' };

function toTime(offsetMin: number): string {
  const total = KICKOFF_HOUR * 60 + KICKOFF_MIN + offsetMin;
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function TimelinePage() {
  const { zones } = useCrowd();

  const nowMinOffset = useMemo(() => {
    const now = new Date();
    const kickoff = MATCH_DATE_OVERRIDE
      ? new Date(...MATCH_DATE_OVERRIDE, KICKOFF_HOUR, KICKOFF_MIN)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), KICKOFF_HOUR, KICKOFF_MIN);
    return Math.round((now.getTime() - kickoff.getTime()) / 60000);
  }, []);

  const activeIdx = PHASES.findLastIndex(p => nowMinOffset >= p.offsetMin);
  const activePhase = PHASES[activeIdx] ?? null;

  const avgDensity = zones.length > 0 
    ? Math.round(zones.reduce((s, z) => s + safeNum(z.density, 0), 0) / zones.length)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 pb-12">

      <div className="border-b border-zinc-800/60 bg-zinc-900/50 px-6 py-5">
        <div className="mx-auto max-w-2xl flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Match Day Flow</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Your full match day — from parking to post-match</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-xs text-zinc-600">Kickoff</div>
              <div className="text-base font-bold text-white tabular-nums">{toTime(0)}</div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="text-center">
              <div className="text-xs text-zinc-600">Gate pressure</div>
              <div className={`text-base font-bold tabular-nums ${
                avgDensity > 75 ? 'text-rose-400' : avgDensity > 50 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{avgDensity}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">

        {activePhase && (
          <div className={`rounded-2xl border p-5 mb-8 ${CROWD_BG[activePhase.crowdLevel]} ${CROWD_BD[activePhase.crowdLevel]}`}>
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">{activePhase.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${CROWD_TX[activePhase.crowdLevel]}`}>NOW — {activePhase.label}</span>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 border ${CROWD_TX[activePhase.crowdLevel]} border-current/30 bg-current/5`}>{CROWD_LBL[activePhase.crowdLevel]}</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">{activePhase.tip}</p>
              </div>
            </div>
          </div>
        )}

        {!activePhase && (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4 mb-8 text-sm text-zinc-400">
            Match day timeline starts 3 hours before kickoff at {toTime(-180)}.
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800/80" />

          <div className="space-y-2">
            {PHASES.map((phase, idx) => {
              const isActive = phase.id === activePhase?.id;
              const isPast   = idx < (activeIdx ?? -1);
              const isFuture = !isActive && !isPast;

              return (
                <div key={phase.id} className={`relative pl-12 transition-opacity duration-300 ${isFuture ? 'opacity-40' : ''}`}>
                  {/* Dot */}
                  <div className={`absolute left-0 top-4 h-9 w-9 rounded-full flex items-center justify-center text-lg transition-all duration-300 ${
                    isActive
                      ? `${CROWD_BG[phase.crowdLevel]} border-2 ${CROWD_BD[phase.crowdLevel]} shadow-lg`
                      : isPast
                      ? 'bg-zinc-900 border border-zinc-700'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`}>
                    <span className={isActive ? '' : isPast ? 'grayscale opacity-50' : 'grayscale opacity-30'}>{phase.icon}</span>
                    {isActive && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${CROWD_DOT[phase.crowdLevel]} ring-2 ring-zinc-950`} />
                    )}
                  </div>

                  <div className={`rounded-2xl border p-4 ${
                    isActive ? `${CROWD_BG[phase.crowdLevel]} ${CROWD_BD[phase.crowdLevel]}` : 'border-zinc-800/60 bg-zinc-900/50'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold ${isActive ? CROWD_TX[phase.crowdLevel] : isPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                          {phase.label}
                        </span>
                        {isActive && <span className="text-[10px] font-bold bg-white/10 text-white rounded-full px-2 py-0.5">YOU ARE HERE</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[11px]">
                        <span className={PARK_COL[phase.parking]}>{PARK_LBL[phase.parking]}</span>
                        <span className="text-zinc-700">·</span>
                        <span className={`font-medium tabular-nums ${isActive ? CROWD_TX[phase.crowdLevel] : 'text-zinc-600'}`}>{toTime(phase.offsetMin)}</span>
                      </div>
                    </div>
                    <p className={`text-xs leading-relaxed ${isActive ? 'text-zinc-200' : isPast ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {phase.tip}
                    </p>
                    {/* Crowd level bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-700 w-14">Crowd</span>
                      <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${CROWD_DOT[phase.crowdLevel]}`}
                          style={{ width: phase.crowdLevel === 'low' ? '25%' : phase.crowdLevel === 'medium' ? '55%' : '90%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-8">
          Times are based on a {toTime(0)} kickoff. Crowd estimates are derived from live gate data.
        </p>
      </div>
    </div>
  );
}
