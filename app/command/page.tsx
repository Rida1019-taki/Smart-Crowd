'use client';

import { useCrowd } from '@/context/CrowdContext';
import { useState, useMemo } from 'react';

// Safe value renderer - converts NaN/undefined to 0
const safeNum = (val: any, fallback: number = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

// ── Decision engine ────────────────────────────────────────────────────────────
type Priority = 'critical' | 'high' | 'medium' | 'low';
type Category = 'crowd' | 'emotion' | 'exit' | 'security' | 'preventive';

interface Decision {
  id: string;
  category: Category;
  priority: Priority;
  title: string;
  trigger: string;
  actions: string[];
  staffNeeded: number;
  eta: string;
  location: string;
}

const CAT_ICON: Record<Category, string> = {
  crowd:      '👥',
  emotion:    '🎭',
  exit:       '🚶',
  security:   '🛡️',
  preventive: '⚠️',
};
const PRI_COLOR: Record<Priority, string> = {
  critical: 'border-rose-500/50 bg-rose-500/5 text-rose-400',
  high:     'border-orange-500/40 bg-orange-500/5 text-orange-400',
  medium:   'border-amber-400/30 bg-amber-400/5 text-amber-400',
  low:      'border-zinc-700 bg-zinc-900 text-zinc-400',
};
const PRI_BADGE: Record<Priority, string> = {
  critical: 'badge badge-crit',
  high:     'badge badge-high',
  medium:   'badge badge-warn',
  low:      'badge badge-safe',
};

// ── Unique features panel ──────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '📡',
    title: 'Prédiction IA des foules',
    desc: 'Prédire les surcharges de portails 15 min à l\'avance grâce aux données historiques de densité.',
    status: 'Bientôt',
    color: 'text-sky-400',
  },
  {
    icon: '🗺️',
    title: 'Planificateur d\'évacuation',
    desc: 'Générer les meilleurs chemins d\'évacuation par section en temps réel, en évitant les couloirs encombrés.',
    status: 'Bientôt',
    color: 'text-violet-400',
  },
  {
    icon: '📲',
    title: 'Application mobile fans',
    desc: 'Envoyer des recommandations de portails sur les téléphones des fans avant leur arrivée.',
    status: 'Bientôt',
    color: 'text-emerald-400',
  },
  {
    icon: '🔗',
    title: 'Intégration CCTV',
    desc: 'Se connecter aux caméras existantes du stade — aucun matériel supplémentaire. Chaque caméra devient un capteur IA.',
    status: 'Bêta',
    color: 'text-amber-400',
  },
  {
    icon: '📊',
    title: 'Rapport post-événement',
    desc: 'Générer des rapports PDF professionnels par événement : heures de pointe, cartes de flux, journaux d\'incidents.',
    status: 'Disponible',
    color: 'text-emerald-400',
  },
  {
    icon: '🚨',
    title: 'Annonces PA automatiques',
    desc: 'Déclencher automatiquement des annonces sonores quand les seuils de foule sont dépassés.',
    status: 'Bientôt',
    color: 'text-rose-400',
  },
];

export default function CommandPage() {
  const { zones, exitZones, emotionZones, dispatches, sections } = useCrowd();
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // ── Generate decisions from live data ────────────────────────────────────────
  const decisions = useMemo<Decision[]>(() => {
    const out: Decision[] = [];

    // Gate overloads
    zones.filter(z => safeNum(z.density, 0) >= 70).forEach(z => {
      const d = safeNum(z.density, 0);
      const q = safeNum(z.queueLength, 0);
      const w = safeNum(z.waitTime, 0);
      const priority: Priority = d >= 90 ? 'critical' : d >= 80 ? 'high' : 'medium';
      out.push({
        id:       `gate-${z.id}`,
        category: 'crowd',
        priority,
        title:    `${z.name} est ${d >= 90 ? 'gravement' : 'fortement'} surchargé`,
        trigger:  `${d}% densité · ${q} personnes en file · ${w} min d'attente`,
        actions: [
          `Déployer 2–3 agents supplémentaires à ${z.name} immédiatement`,
          'Ouvrir une voie d\'entrée secondaire si disponible',
          `Rediriger les fans via PA : "Utilisez ${zones.filter(x => safeNum(x.density, 0) < 40)[0]?.name ?? 'les portails alternatifs'}"`,
          'Alerter les agents de parking pour ralentir le flux de véhicules',
          d >= 90 ? '⚠️ Envisager la fermeture temporaire et la redistribution' : 'Surveiller toutes les 5 minutes',
        ],
        staffNeeded: d >= 90 ? 4 : 2,
        eta: `${w + 5} min pour normaliser si action immédiate`,
        location: z.name,
      });
    });

    // Exit congestion
    exitZones.filter(e => e.congestion >= 75).forEach(e => {
      out.push({
        id:       `exit-${e.id}`,
        category: 'exit',
        priority: e.congestion >= 90 ? 'critical' : 'high',
        title:    `${e.name} dangereusement encombré`,
        trigger:  `${e.congestion}% congestion · ${e.flow} pers/min · libération dans ${e.clearTimeMin} min`,
        actions: [
          `Poster 2 agents à ${e.name} pour guider la foule`,
          'Ouvrir tous les sous-portails et sorties de secours du couloir',
          `Échelonner la sortie : retenir la tribune ${e.linkedSection} pendant 5 min`,
          'Coordonner avec les équipes de transport pour un départ anticipé',
          e.congestion >= 90 ? '🚨 Alerter le responsable incendie — risque d\'écrasement' : 'Annoncer au PA de ralentir la sortie',
        ],
        staffNeeded: 3,
        eta: `${Math.max(1, e.clearTimeMin - 5)} min de gain avec intervention`,
        location: e.name,
      });
    });

    // Emotion / fight risk
    emotionZones.filter(e => e.fightRisk >= 50).forEach(e => {
      const priority: Priority = e.fightRisk >= 80 ? 'critical' : e.fightRisk >= 65 ? 'high' : 'medium';
      out.push({
        id:       `em-${e.id}`,
        category: e.fightRisk >= 70 ? 'security' : 'emotion',
        priority,
        title:    `Tension détectée à ${e.name}`,
        trigger:  `Risque de bagarre ${e.fightRisk}% · Émotion : ${e.emotion}${e.etaMin ? ` · Incident dans ~${e.etaMin} min` : ''}`,
        actions: [
          `Envoyer 2 agents de sécurité à ${e.location} immédiatement`,
          'Séparer les groupes de fans en conflit si mélange domicile/extérieur détecté',
          `${e.fightRisk >= 70 ? '🚨 Alerter le correspondant police' : 'Augmenter la présence visible de sécurité'}`,
          'Vérifier la caméra CCTV de cette zone',
          'Préparer l\'équipe médicale en standby si le risque dépasse 85%',
        ],
        staffNeeded: e.fightRisk >= 70 ? 4 : 2,
        eta: e.etaMin ? `~${e.etaMin} min avant l\'incident prédit` : 'Surveillance en cours',
        location: e.name,
      });
    });

    // Preventive: any section >85% capacity
    sections.filter(s => (s.occupied / s.capacity) > 0.85).forEach(s => {
      const pct = Math.round((s.occupied / s.capacity) * 100);
      out.push({
        id:       `sec-${s.id}`,
        category: 'preventive',
        priority: pct >= 95 ? 'critical' : 'medium',
        title:    `${s.stand} — ${s.name} proche de la capacité maximale`,
        trigger:  `${pct}% rempli · ${s.occupied} / ${s.capacity} personnes`,
        actions: [
          `Suspendre le scan des billets jusqu'à ce que ${Math.round(s.capacity * 0.1)} personnes sortent`,
          'Vérifier les accès non autorisés ou la fraude de billets',
          `Informer l'équipe de stewarding de ${s.stand} de surveiller les mouvements`,
          'Signaler pour révision de capacité post-événement',
        ],
        staffNeeded: 1,
        eta: 'Préventif — surveiller avant escalade',
        location: `${s.stand} · ${s.name}`,
      });
    });

    // Sort: critical → high → medium → low
    const order: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return out.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [zones, exitZones, emotionZones, sections]);

  const active = decisions.filter(d => !acknowledged.has(d.id));
  const ack    = decisions.filter(d =>  acknowledged.has(d.id));
  const critCount = active.filter(d => d.priority === 'critical').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>

      {/* ── Header ── */}
      <div className={`border-b px-6 py-5 transition-colors ${critCount > 0 ? 'border-rose-500/40' : 'border-zinc-800/60'}`}
        style={{ background: critCount > 0 ? 'rgba(239,68,68,0.04)' : 'var(--surface)' }}>
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-lg">
                🎯
              </div>
              <div>
              <h1 className="text-heading text-white text-lg">Centre de Commandement</h1>
              <p className="text-label text-zinc-500">Aide à la Décision IA · Gestion des Incidents en Temps Réel</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {critCount > 0 && (
              <div className="badge badge-crit animate-pulse text-xs px-3 py-1.5">
                🚨 {critCount} Alerte{critCount > 1 ? 's' : ''} Critique{critCount > 1 ? 's' : ''}
              </div>
            )}
            <div className="flex gap-2">
              <Kpi n={active.length}        label="Ouvertes"   color={active.length > 0 ? '#ef4444' : '#10b981'} />
              <Kpi n={dispatches.filter(d=>!d.resolved).length} label="Envoyés"    color="#f59e0b" />
              <Kpi n={ack.length}            label="Résolus"    color="#10b981" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 grid xl:grid-cols-[1fr_340px] gap-8">

        {/* ── Decision cards ── */}
        <div className="space-y-4">
          {active.length === 0 && (
            <div className="card flex flex-col items-center justify-center py-20 text-center animate-fade-up">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-heading text-white mb-1">Tout est calme</p>
              <p className="text-zinc-500 text-sm">Aucun incident ne nécessite une action immédiate.</p>
            </div>
          )}

          {active.map((d, i) => (
            <div key={d.id} className={`card animate-fade-up border ${PRI_COLOR[d.priority]}`}
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'var(--surface-2)' }}>
                      {CAT_ICON[d.category]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={PRI_BADGE[d.priority]}>{d.priority}</span>
                        <span className="text-[10px] text-zinc-500 text-label">{{
                          crowd: 'foule', emotion: 'émotion', exit: 'sortie', security: 'sécurité', preventive: 'préventif'
                        }[d.category]}</span>
                      </div>
                      <h3 className="font-semibold text-white text-sm leading-snug">{d.title}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{d.trigger}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAcknowledged(prev => new Set([...prev, d.id]))}
                    className="btn btn-ghost text-xs flex-shrink-0 whitespace-nowrap"
                  >
                    ✓ Fait
                  </button>
                </div>

                {/* Actions */}
                <div className="rounded-xl p-3.5 mb-3" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-label text-zinc-500 mb-2">Plan d'action</p>
                  <ol className="space-y-1.5">
                    {d.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-zinc-700 text-zinc-300 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-zinc-300">{a}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>📍 {d.location}</span>
                  <span>👮 {d.staffNeeded} agents nécessaires</span>
                  <span>⏱ {d.eta}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Resolved */}
          {ack.length > 0 && (
            <div className="card p-4 opacity-50">
              <p className="text-label text-zinc-500 mb-2">Traités ({ack.length})</p>
              <div className="space-y-1">
                {ack.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="text-emerald-500">✓</span>
                    <span>{d.title}</span>
                    <button onClick={() => setAcknowledged(prev => { const s = new Set(prev); s.delete(d.id); return s; })}
                      className="ml-auto text-zinc-600 hover:text-zinc-400">↩ Annuler</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Side: Unique Features + What to do guide ── */}
        <div className="space-y-5">

          {/* Quick reference */}
          <div className="card p-5">
            <h2 className="font-bold text-white text-sm mb-4">📖 Guide de Réponse Rapide</h2>
            <div className="space-y-3">
              {[
                { icon: '🔴', title: 'Surcharge portail >90%', steps: ['Fermer le portail temporairement', 'Rediriger vers le portail ouvert le plus proche', 'Déployer des barrières de foule', 'Appeler le correspondant police'] },
                { icon: '🟠', title: 'Bagarre / violence détectée', steps: ['Envoyer 4 agents de sécurité dans la zone', 'Séparer les groupes de fans', 'Alerter le service médical en standby', 'Vérifier les CCTV et documenter'] },
                { icon: '🟡', title: 'Sortie encombrée >80%', steps: ['Retenir la tribune 5 min', 'Ouvrir les sorties de secours', 'Diffuser message PA d\'échelonnement', 'Coordonner les transports'] },
                { icon: '⚫', title: 'Évacuation générale nécessaire', steps: ['Activer l\'annonce PA', 'Ouvrir TOUTES les sorties de secours', 'Alerter les pompiers', 'Guider vers les points de rassemblement'] },
              ].map(r => (
                <details key={r.title} className="group rounded-xl overflow-hidden">
                  <summary className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                    style={{ background: 'var(--surface-2)' }}>
                    <span>{r.icon}</span>
                    <span>{r.title}</span>
                    <span className="ml-auto text-zinc-600 group-open:rotate-90 transition-transform">›</span>
                  </summary>
                  <ol className="px-3 py-2 space-y-1">
                    {r.steps.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                        <span className="text-zinc-600 font-bold">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </div>

          {/* Future features */}
          <div className="card p-5">
            <h2 className="font-bold text-white text-sm mb-1">💡 Feuille de Route</h2>
            <p className="text-xs text-zinc-500 mb-4">Fonctionnalités qui rendront CrowdCheck prêt au marché</p>
            <div className="space-y-3">
              {FEATURES.map(f => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{f.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-white">{f.title}</span>
                      <span className={`text-[9px] font-bold text-label px-1.5 py-0.5 rounded-full border ${
                        f.status === 'Disponible' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                        f.status === 'Bêta'       ? 'border-amber-400/30 text-amber-400 bg-amber-400/10' :
                                                    'border-zinc-600 text-zinc-500 bg-zinc-800'
                      }`}>{f.status}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Kpi({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 px-3 py-2 text-center min-w-[60px]"
      style={{ background: 'var(--surface)' }}>
      <div className="text-xl font-extrabold" style={{ color }}>{n}</div>
      <div className="text-[9px] text-zinc-600 text-label mt-0.5">{label}</div>
    </div>
  );
}
