'use client';

import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  gateOverloadThreshold:   70,  // % densité
  exitCongestionThreshold: 75,  // % densité
  fightRiskThreshold:      60,  // % risque
  emergencyThreshold:      90,  // % densité
  maxQueueTime:            15,  // minutes
  notificationsEnabled:    true,
  soundAlertsEnabled:      true,
  autoDispatchEnabled:     true,
  simulationSpeed:         1,   // 0.5 = lent, 1 = normal, 2 = rapide
};

type Settings = typeof DEFAULT_SETTINGS;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('crowdcheck-settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const handleChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('crowdcheck-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('crowdcheck-settings');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-5" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto max-w-4xl">
          <h1 className="text-heading text-white text-lg mb-1">⚙️ System Settings</h1>
          <p className="text-label text-zinc-500">Configure alert thresholds & system behavior</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">

        {/* Alert */}
        {saved && (
          <div className="card mb-6 bg-emerald-500/10 border-emerald-500/30 p-4 flex items-center gap-3 animate-fade-up">
            <span className="text-emerald-400 text-lg">✓</span>
            <p className="text-emerald-300">Settings saved successfully</p>
          </div>
        )}

        {/* Alert Thresholds Section */}
        <div className="card p-6 mb-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            🚨 Alert Thresholds
          </h2>
          <p className="text-xs text-zinc-500 mb-6">When these metrics are exceeded, the system generates alerts for staff</p>

          <div className="space-y-6">
            {[
              { key: 'gateOverloadThreshold', label: 'Gate Overload Alert', unit: '%', min: 30, max: 95, desc: 'Trigger alert when gate density exceeds this' },
              { key: 'exitCongestionThreshold', label: 'Exit Congestion Alert', unit: '%', min: 40, max: 95, desc: 'Trigger alert when exit congestion exceeds this' },
              { key: 'fightRiskThreshold', label: 'Fight Risk Alert', unit: '%', min: 20, max: 90, desc: 'Trigger alert when crowd tension exceeds this' },
              { key: 'emergencyThreshold', label: 'Emergency Threshold', unit: '%', min: 80, max: 100, desc: 'Trigger emergency dispatch when gate density exceeds this' },
              { key: 'maxQueueTime', label: 'Max Acceptable Queue Time', unit: 'min', min: 5, max: 30, desc: 'Alert if wait time exceeds this duration' },
            ].map(s => (
              <div key={s.key} className="pb-6 border-b border-zinc-800 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-white">{s.label}</p>
                    <p className="text-xs text-zinc-500">{s.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      min={s.min}
                      max={s.max}
                      value={Number(settings[s.key as keyof Settings])}
                      onChange={e => handleChange(s.key as keyof Settings, parseInt(e.target.value))}
                      className="w-16 px-2 py-1 rounded bg-zinc-800 text-white text-sm font-bold text-right border border-zinc-700 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-zinc-400 text-sm">{s.unit}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={Number(settings[s.key as keyof Settings])}
                  onChange={e => handleChange(s.key as keyof Settings, parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-full accent-emerald-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Behavior Section */}
        <div className="card p-6 mb-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            ⚡ System Behavior
          </h2>

          <div className="space-y-4">
            {[
              { key: 'notificationsEnabled', label: 'Enable Toast Notifications', desc: 'Show on-screen alerts for events' },
              { key: 'soundAlertsEnabled', label: 'Enable Sound Alerts', desc: 'Play audio alarm on critical incidents' },
              { key: 'autoDispatchEnabled', label: 'Auto-Dispatch Security', desc: 'Automatically dispatch staff on high-risk detection' },
            ].map(s => (
              <label key={s.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[s.key as keyof Settings] as boolean}
                  onChange={e => handleChange(s.key as keyof Settings, e.target.checked)}
                  className="w-4 h-4 rounded border border-zinc-600 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <p className="font-medium text-white">{s.label}</p>
                  <p className="text-xs text-zinc-500">{s.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Simulation Section */}
        <div className="card p-6 mb-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            🎮 Simulation Settings
          </h2>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-white">Simulation Speed</p>
                <p className="text-xs text-zinc-500">How fast the live simulation updates (1 = normal)</p>
              </div>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  min="0.25"
                  max="3"
                  step="0.25"
                  value={settings.simulationSpeed}
                  onChange={e => handleChange('simulationSpeed', parseFloat(e.target.value))}
                  className="w-16 px-2 py-1 rounded bg-zinc-800 text-white text-sm font-bold text-right border border-zinc-700 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-zinc-400 text-sm">x</span>
              </div>
            </div>
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={settings.simulationSpeed}
              onChange={e => handleChange('simulationSpeed', parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-full accent-blue-500"
            />
          </div>
        </div>

        {/* Info Card */}
        <div className="card p-5 border-l-4 border-blue-500/50 mb-8">
          <h3 className="font-bold text-blue-400 mb-2">ℹ Default Recommendations</h3>
          <ul className="text-xs text-zinc-400 space-y-1">
            <li>• <strong>Gate threshold:</strong> 70% balances sensitivity with false alarms</li>
            <li>• <strong>Exit threshold:</strong> 75% prevents dangerous crush situations</li>
            <li>• <strong>Fight risk:</strong> 60% catches tension before escalation</li>
            <li>• <strong>Queue time:</strong> 15 min is typical for major venues</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            💾 Save Settings
          </button>
          <button
            onClick={handleReset}
            className="btn btn-ghost"
          >
            ↺ Reset to Defaults
          </button>
        </div>

      </div>
    </div>
  );
}
