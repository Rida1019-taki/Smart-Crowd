'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AIAnalysis } from '@/app/api/analyze/route';

export type { AIAnalysis };

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Zone {
  id: string; name: string; shortName: string;
  density: number; queueLength: number; waitTime: number;
}

export interface OutdoorZone {
  id: string; name: string;
  type: 'parking' | 'metro' | 'bus' | 'rideshare';
  density: number; waitTime: number;
  spotsTotal?: number; spotsAvailable?: number;
}

export interface StadiumSection {
  id: string; name: string; stand: string;
  capacity: number; occupied: number;
}

export interface ExitZone {
  id: string;
  name: string;
  linkedSection: string;   // section id
  congestion: number;      // 0-100
  flow: number;            // people / min
  clearTimeMin: number;    // estimated minutes to fully clear
  isOpen: boolean;
}

export type EmotionLevel = 'calm' | 'tense' | 'agitated' | 'angry';

export interface EmotionZone {
  id: string;
  name: string;
  location: string;       // gate or section name
  emotion: EmotionLevel;
  fightRisk: number;      // 0-100
  etaMin: number | null;  // minutes until predicted incident (null = no imminent risk)
  triggers: string[];     // factors driving the risk
  securityDispatched: boolean;
  dispatchedAt: string | null;
}

export interface SecurityDispatch {
  id: number;
  ts: string;
  zoneId: string;
  zoneName: string;
  fightRisk: number;
  etaMin: number | null;
  resolved: boolean;
}

interface CrowdContextType {
  zones: Zone[];
  outdoorZones: OutdoorZone[];
  sections: StadiumSection[];
  exitZones: ExitZone[];
  emotionZones: EmotionZone[];
  dispatches: SecurityDispatch[];
  aiAnalysis: AIAnalysis | null;
  aiLoading: boolean;
  yoloAvailable: boolean;
  lastUpdated: string;
  deployTeam: (zoneId: string) => void;
  deployExitTeam: (exitId: string) => void;
  dispatchSecurity: (zoneId: string) => void;
  resolveDispatch: (id: number) => void;
}

// ── Initial data ───────────────────────────────────────────────────────────────
const INITIAL_ZONES: Zone[] = [
  { id: 'gate-north',  name: 'Portail A1',  shortName: 'A1',  density: 82, queueLength: 344, waitTime: 9  },
  { id: 'gate-south',  name: 'Portail A2',  shortName: 'A2',  density: 41, queueLength: 172, waitTime: 5  },
  { id: 'gate-east-a', name: 'Portail B1',  shortName: 'B1',  density: 63, queueLength: 264, waitTime: 7  },
  { id: 'gate-east-b', name: 'Portail B2',  shortName: 'B2',  density: 28, queueLength: 117, waitTime: 3  },
  { id: 'gate-west',   name: 'Portail C1',  shortName: 'C1',  density: 70, queueLength: 294, waitTime: 8  },
  { id: 'gate-vip',    name: 'Portail VIP', shortName: 'VIP', density: 18, queueLength: 38,  waitTime: 1  },
  { id: 'gate-away',   name: 'Portail D1',  shortName: 'D1',  density: 87, queueLength: 365, waitTime: 10 },
];

const INITIAL_OUTDOOR: OutdoorZone[] = [
  { id: 'parking-a', name: 'Parking Lot A', type: 'parking',  density: 78, waitTime: 5,  spotsTotal: 500, spotsAvailable: 110 },
  { id: 'parking-b', name: 'Parking Lot B', type: 'parking',  density: 44, waitTime: 2,  spotsTotal: 400, spotsAvailable: 224 },
  { id: 'parking-c', name: 'Parking Lot C', type: 'parking',  density: 62, waitTime: 3,  spotsTotal: 300, spotsAvailable: 114 },
  { id: 'metro-n',   name: 'Metro — North', type: 'metro',    density: 74, waitTime: 8  },
  { id: 'metro-s',   name: 'Metro — South', type: 'metro',    density: 36, waitTime: 3  },
  { id: 'bus-hub',   name: 'Bus Terminal',  type: 'bus',      density: 83, waitTime: 10 },
  { id: 'rideshare', name: 'Rideshare Zone',type: 'rideshare', density: 55, waitTime: 6  },
];

const INITIAL_SECTIONS: StadiumSection[] = [
  { id: 'north-a', name: 'Block A', stand: 'North Stand',  capacity: 2400, occupied: 1992 },
  { id: 'west-b',  name: 'Block B', stand: 'West Stand',   capacity: 3200, occupied: 2112 },
  { id: 'east-c',  name: 'Block C', stand: 'East Stand',   capacity: 3200, occupied: 2752 },
  { id: 'south-d', name: 'Block D', stand: 'South Stand',  capacity: 2400, occupied: 1536 },
  { id: 'upper',   name: 'Upper Tier', stand: 'Upper Deck', capacity: 8000, occupied: 6240 },
  { id: 'vip',     name: 'VIP Lounge', stand: 'VIP',        capacity: 800,  occupied: 592  },
  { id: 'away',    name: 'Away Section', stand: 'Away End', capacity: 1500, occupied: 1305 },
  { id: 'family',  name: 'Family Zone', stand: 'Family',    capacity: 1200, occupied: 744  },
];

const INITIAL_EXITS: ExitZone[] = [
  { id: 'exit-north',   name: 'Sortie A1',  linkedSection: 'north-a', congestion: 78, flow: 145, clearTimeMin: 14, isOpen: true },
  { id: 'exit-west',    name: 'Sortie C1',  linkedSection: 'west-b',  congestion: 65, flow: 120, clearTimeMin: 18, isOpen: true },
  { id: 'exit-east',    name: 'Sortie B1',  linkedSection: 'east-c',  congestion: 85, flow: 160, clearTimeMin: 17, isOpen: true },
  { id: 'exit-south',   name: 'Sortie A2',  linkedSection: 'south-d', congestion: 55, flow: 90,  clearTimeMin: 17, isOpen: true },
  { id: 'exit-upper-n', name: 'Sortie U1',  linkedSection: 'upper',   congestion: 88, flow: 200, clearTimeMin: 31, isOpen: true },
  { id: 'exit-upper-s', name: 'Sortie U2',  linkedSection: 'upper',   congestion: 82, flow: 190, clearTimeMin: 33, isOpen: true },
  { id: 'exit-vip',     name: 'Sortie VIP', linkedSection: 'vip',     congestion: 32, flow: 45,  clearTimeMin: 13, isOpen: true },
  { id: 'exit-away',    name: 'Sortie D1',  linkedSection: 'away',    congestion: 91, flow: 170, clearTimeMin: 8,  isOpen: true },
];

// ── Emotion zones — monitored hotspots ────────────────────────────────────────
// Each entry represents a camera/sensor zone that monitors crowd emotion
const INITIAL_EMOTIONS: EmotionZone[] = [
  { id: 'em-gate-away',  name: 'Zone Portail D1',  location: 'gate-away',  emotion: 'agitated', fightRisk: 74, etaMin: 8,  triggers: ['Fans visiteurs mélangés', 'Longue attente', 'Surpeuplement'], securityDispatched: false, dispatchedAt: null },
  { id: 'em-gate-north', name: 'File Portail A1',  location: 'gate-north', emotion: 'tense',    fightRisk: 52, etaMin: null, triggers: ['Haute densité', 'Progression lente'], securityDispatched: false, dispatchedAt: null },
  { id: 'em-upper',      name: 'Tribune Haute',    location: 'upper',      emotion: 'calm',     fightRisk: 18, etaMin: null, triggers: [], securityDispatched: false, dispatchedAt: null },
  { id: 'em-away-sec',   name: 'Section Visiteurs',location: 'away',       emotion: 'tense',    fightRisk: 61, etaMin: null, triggers: ['Chants rivaux', 'Forte occupation'], securityDispatched: false, dispatchedAt: null },
  { id: 'em-gate-west',  name: 'Zone Portail C1',  location: 'gate-west',  emotion: 'calm',     fightRisk: 29, etaMin: null, triggers: ['Densité modérée'], securityDispatched: false, dispatchedAt: null },
  { id: 'em-exit-east',  name: 'Couloir Sortie B1',location: 'exit-east',  emotion: 'tense',    fightRisk: 55, etaMin: null, triggers: ['Congestion à la sortie', 'Foule frustrée'], securityDispatched: false, dispatchedAt: null },
  { id: 'em-family',     name: 'Zone Famille',     location: 'family',     emotion: 'calm',     fightRisk: 8,  etaMin: null, triggers: [], securityDispatched: false, dispatchedAt: null },
];

// risk → emotion label
function riskToEmotion(risk: number): EmotionLevel {
  if (risk >= 80) return 'angry';
  if (risk >= 60) return 'agitated';
  if (risk >= 35) return 'tense';
  return 'calm';
}

// Derive triggers based on risk factors
const TRIGGERS_POOL = [
  'Surpeuplement', 'Longue attente', 'Progression lente', 'Groupes rivaux proches',
  'Fans visiteurs mélangés', 'Foule frustrée', 'Congestion à la sortie',
  'Chants rivaux qui montent', 'Forte occupation', 'Tension liée à l\'alcool',
  'Bousculades détectées', 'Altércations verbales signalées', 'Stress thermique',
];
function pickTriggers(risk: number, prev: string[]): string[] {
  const count = risk >= 80 ? 3 : risk >= 60 ? 2 : risk >= 35 ? 1 : 0;
  if (count === 0) return [];
  // keep existing triggers and maybe swap one
  const pool = TRIGGERS_POOL.filter(t => !prev.includes(t));
  const keep = prev.slice(0, Math.max(0, count - 1));
  const add  = pool.sort(() => Math.random() - 0.5).slice(0, count - keep.length);
  return [...keep, ...add].slice(0, count);
}

let _dispatchId = 0;

function calcEmotion(e: EmotionZone, densityHint: number): Partial<EmotionZone> {
  // Walk risk up/down with density influence + random walk
  const prev    = isNaN(e.fightRisk) ? 30 : e.fightRisk;
  const drift   = (Math.random() - 0.44) * 9; // slight upward bias in busy zones
  const dFactor = densityHint > 75 ? 6 : densityHint > 55 ? 2 : -3;
  const raw     = Math.round(Math.max(0, Math.min(99, prev + drift + dFactor * 0.4)));
  const emotion = riskToEmotion(raw);
  const etaMin  = raw >= 70 ? Math.max(1, Math.round((100 - raw) / 4)) : null;
  const triggers = pickTriggers(raw, e.triggers);
  return { fightRisk: raw, emotion, etaMin, triggers };
}

function calcExit(e: ExitZone, congestion: number): Partial<ExitZone> {
  const flow = Math.round(Math.max(10, 240 - congestion * 1.9));
  const clearTimeMin = Math.round(Math.max(1, congestion / 3.2));
  return { congestion, flow, clearTimeMin };
}

function calcGate(d: number) {
  return { queueLength: Math.round(d * 4.2), waitTime: Math.max(1, Math.round(d / 9)) };
}
function calcOutdoor(z: OutdoorZone, d: number): Partial<OutdoorZone> {
  const base: Partial<OutdoorZone> = { density: d, waitTime: Math.max(1, Math.round(d / 8)) };
  if (z.spotsTotal) base.spotsAvailable = Math.round(z.spotsTotal * (1 - d / 100));
  return base;
}
function nowStr() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Context ────────────────────────────────────────────────────────────────────
const CrowdContext = createContext<CrowdContextType | null>(null);

export function CrowdProvider({ children }: { children: ReactNode }) {
  const [zones,         setZones]         = useState<Zone[]>(INITIAL_ZONES);
  const [outdoorZones,  setOutdoorZones]  = useState<OutdoorZone[]>(INITIAL_OUTDOOR);
  const [sections,      setSections]      = useState<StadiumSection[]>(INITIAL_SECTIONS);
  const [exitZones,     setExitZones]     = useState<ExitZone[]>(INITIAL_EXITS);
  const [emotionZones,  setEmotionZones]  = useState<EmotionZone[]>(INITIAL_EMOTIONS);
  const [dispatches,    setDispatches]    = useState<SecurityDispatch[]>([]);
  const [aiAnalysis,    setAiAnalysis]    = useState<AIAnalysis | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(nowStr());
  const [yoloAvailable, setYoloAvailable] = useState(false);

  // Check if YOLO backend is running
  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('/api/yolo');
        const data = await res.json();
        setYoloAvailable(!!data.available);
      } catch { setYoloAvailable(false); }
    };
    check();
    const iv = setInterval(check, 15000); // re-check every 15 s
    return () => clearInterval(iv);
  }, []);

  // YOLO polling — every 5 s when backend is available
  // Pulls real density + emotion data and overrides simulation for matching zones
  useEffect(() => {
    if (!yoloAvailable) return;
    const CAMERA_MAP: Record<string, string> = {
      // Map zone IDs to camera URLs. Replace with real RTSP/snapshot URLs.
      // 'gate-north': 'rtsp://192.168.1.10/stream1',
      // 'gate-away':  'rtsp://192.168.1.11/stream1',
      // For demo, use a public crowd image:
      'gate-north': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/2019-10-07_19-19-30_football.jpg/1280px-2019-10-07_19-19-30_football.jpg',
      'gate-away':  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/2019-10-07_19-19-30_football.jpg/1280px-2019-10-07_19-19-30_football.jpg',
    };

    const poll = async () => {
      for (const [zoneId, imageUrl] of Object.entries(CAMERA_MAP)) {
        try {
          const res = await fetch('/api/yolo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'url', zoneId, imageUrl }),
          });
          const data = await res.json();
          if (data.error) continue;

          // Update gate density from YOLO
          setZones(prev => prev.map(z => {
            if (z.id !== zoneId) return z;
            return { ...z, density: data.density, ...calcGate(data.density) };
          }));

          // Update emotion zone from DeepFace
          setEmotionZones(prev => prev.map(e => {
            if (e.location !== zoneId) return e;
            const newRisk    = data.fightRisk;
            const newEmotion = data.emotionLevel as EmotionLevel;
            if (newRisk >= 80 && !e.securityDispatched) {
              const ts = nowStr();
              setDispatches(d => [...d, {
                id: ++_dispatchId, ts,
                zoneId: e.id, zoneName: e.name,
                fightRisk: newRisk, etaMin: data.etaMin, resolved: false,
              }]);
              return { ...e, fightRisk: newRisk, emotion: newEmotion, etaMin: data.etaMin, securityDispatched: true, dispatchedAt: ts };
            }
            return { ...e, fightRisk: newRisk, emotion: newEmotion, etaMin: data.etaMin };
          }));
        } catch { /* skip on error */ }
      }
    };

    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [yoloAvailable]);

  // Gate simulation — every 3 s (only when YOLO not available for that zone)
  useEffect(() => {
    const iv = setInterval(() => setZones(prev => prev.map(z => {
      const d = Math.round(Math.max(8, Math.min(97, z.density + (Math.random() - 0.48) * 13)));
      return { ...z, density: d, ...calcGate(d) };
    })), 3000);
    return () => clearInterval(iv);
  }, []);

  // Outdoor simulation — every 5 s
  useEffect(() => {
    const iv = setInterval(() => setOutdoorZones(prev => prev.map(z => {
      const d = Math.round(Math.max(5, Math.min(99, z.density + (Math.random() - 0.46) * 8)));
      return { ...z, ...calcOutdoor(z, d) } as OutdoorZone;
    })), 5000);
    return () => clearInterval(iv);
  }, []);

  // Seat simulation — every 12 s (people are seated, small drift)
  useEffect(() => {
    const iv = setInterval(() => setSections(prev => prev.map(s => {
      const delta  = Math.round((Math.random() - 0.5) * 18);
      const newOcc = Math.round(Math.max(s.capacity * 0.3, Math.min(s.capacity, s.occupied + delta)));
      return { ...s, occupied: newOcc };
    })), 12000);
    return () => clearInterval(iv);
  }, []);

  // Exit simulation — every 4 s (congestion ebbs and flows)
  useEffect(() => {
    const iv = setInterval(() => setExitZones(prev => prev.map(e => {
      if (!e.isOpen) return e;
      const c = Math.round(Math.max(5, Math.min(99, e.congestion + (Math.random() - 0.46) * 11)));
      return { ...e, ...calcExit(e, c) } as ExitZone;
    })), 4000);
    return () => clearInterval(iv);
  }, []);

  // Emotion simulation — every 5 s + auto-dispatch when risk ≥ 80
  useEffect(() => {
    const iv = setInterval(() => {
      setZones(currentZones => {
        setEmotionZones(prev => prev.map(e => {
          const linked = currentZones.find(z => z.id === e.location || z.shortName.toLowerCase() === e.location.toLowerCase());
          const densityHint = linked?.density ?? 50;
          const update = calcEmotion(e, densityHint);
          const newRisk = update.fightRisk ?? e.fightRisk;

          // Auto-dispatch when crosses 80 and not already dispatched
          if (newRisk >= 80 && !e.securityDispatched) {
            const ts = nowStr();
            setDispatches(d => [...d, {
              id: ++_dispatchId,
              ts,
              zoneId: e.id,
              zoneName: e.name,
              fightRisk: newRisk,
              etaMin: update.etaMin ?? null,
              resolved: false,
            }]);
            return { ...e, ...update, securityDispatched: true, dispatchedAt: ts };
          }

          // Reset dispatch flag if risk drops back below 65
          if (newRisk < 65 && e.securityDispatched) {
            return { ...e, ...update, securityDispatched: false, dispatchedAt: null };
          }

          return { ...e, ...update };
        }));
        return currentZones;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  // AI analysis — every 8 s
  const runAnalysis = useCallback(async (currentZones: Zone[]) => {
    setAiLoading(true);
    try {
      const res  = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gates: currentZones.map(z => ({
            id: z.id, name: z.name, density: z.density,
            queueLength: z.queueLength, waitTime: z.waitTime,
          })),
        }),
      });
      const data = await res.json();
      if (data.analysis) { setAiAnalysis(data.analysis); setLastUpdated(nowStr()); }
    } catch { /* graceful fail */ } finally { setAiLoading(false); }
  }, []);

  useEffect(() => { runAnalysis(INITIAL_ZONES); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const iv = setInterval(() => setZones(cur => { runAnalysis(cur); return cur; }), 8000);
    return () => clearInterval(iv);
  }, [runAnalysis]);

  const deployTeam = useCallback((id: string) => setZones(prev => prev.map(z => {
    if (z.id !== id) return z;
    const d = Math.max(8, z.density - 28);
    return { ...z, density: d, ...calcGate(d) };
  })), []);

  const deployExitTeam = useCallback((exitId: string) => setExitZones(prev => prev.map(e => {
    if (e.id !== exitId) return e;
    const c = Math.max(5, e.congestion - 30);
    return { ...e, ...calcExit(e, c) } as ExitZone;
  })), []);

  const dispatchSecurity = useCallback((zoneId: string) => {
    const ts = nowStr();
    setEmotionZones(prev => prev.map(e => {
      if (e.id !== zoneId) return e;
      setDispatches(d => [...d, {
        id: ++_dispatchId,
        ts,
        zoneId: e.id,
        zoneName: e.name,
        fightRisk: e.fightRisk,
        etaMin: e.etaMin,
        resolved: false,
      }]);
      // Dispatch also reduces risk (security presence calms crowd)
      const newRisk = Math.max(10, e.fightRisk - 30);
      return { ...e, securityDispatched: true, dispatchedAt: ts,
        fightRisk: newRisk, emotion: riskToEmotion(newRisk),
        etaMin: null, triggers: [] };
    }));
  }, []);

  const resolveDispatch = useCallback((id: number) => {
    setDispatches(prev => prev.map(d => d.id === id ? { ...d, resolved: true } : d));
  }, []);

  return (
    <CrowdContext.Provider value={{ zones, outdoorZones, sections, exitZones, emotionZones, dispatches, aiAnalysis, aiLoading, yoloAvailable, lastUpdated, deployTeam, deployExitTeam, dispatchSecurity, resolveDispatch }}>
      {children}
    </CrowdContext.Provider>
  );
}

export function useCrowd() {
  const ctx = useContext(CrowdContext);
  if (!ctx) throw new Error('useCrowd must be inside CrowdProvider');
  return ctx;
}

// ── Color helpers ──────────────────────────────────────────────────────────────
export function getDensityColor(d: number) {
  if (d < 50) return {
    text: 'text-emerald-400', bg: 'bg-emerald-400', bar: 'bg-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    fill: 'rgba(52,211,153,0.18)', stroke: '#34d399', label: 'Clear',
  };
  if (d <= 75) return {
    text: 'text-amber-400', bg: 'bg-amber-400', bar: 'bg-amber-400',
    badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    fill: 'rgba(251,191,36,0.18)', stroke: '#fbbf24', label: 'Moderate',
  };
  return {
    text: 'text-rose-400', bg: 'bg-rose-400', bar: 'bg-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    fill: 'rgba(244,63,94,0.22)', stroke: '#f43f5e', label: 'Busy',
  };
}
