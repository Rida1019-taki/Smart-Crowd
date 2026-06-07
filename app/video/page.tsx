'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useCrowd } from '@/context/CrowdContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FrameResult {
  sec: number;
  personCount: number;
  density: number;
  rawEmotion: string;
  emotionLevel: 'calm' | 'tense' | 'agitated' | 'angry';
  fightRisk: number;
}

interface VideoSummary {
  zoneId: string;
  durationSec: number;
  sampledFrames: number;
  avgDensity: number;
  maxDensity: number;
  maxFightRisk: number;
  peakEmotion: string;
  overloadSecs: number[];
  overloadCount: number;
  verdict: string;
  isFull: boolean;
}

interface VideoJob {
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  zoneId: string;
  filename: string;
  duration?: number;
  frames: FrameResult[];
  summary: VideoSummary | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emotionStyle(e: string) {
  if (e === 'angry')    return { text: 'text-rose-400',    bar: 'bg-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: '😡' };
  if (e === 'agitated') return { text: 'text-orange-400',  bar: 'bg-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  icon: '😠' };
  if (e === 'tense')    return { text: 'text-amber-400',   bar: 'bg-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30',   icon: '😤' };
  return                       { text: 'text-emerald-400', bar: 'bg-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', icon: '😊' };
}

function densityStyle(d: number) {
  if (d >= 70) return { bar: 'bg-rose-500',    text: 'text-rose-400',    label: 'OVERLOADED' };
  if (d >= 40) return { bar: 'bg-amber-400',   text: 'text-amber-400',   label: 'BUSY'       };
  return               { bar: 'bg-emerald-400', text: 'text-emerald-400', label: 'NORMAL'     };
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VideoAnalysisPage() {
  const { zones, yoloAvailable } = useCrowd();

  const [selectedZone, setSelectedZone] = useState('gate-north');
  const [file,         setFile]         = useState<File | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [jobId,        setJobId]        = useState<string | null>(null);
  const [job,          setJob]          = useState<VideoJob | null>(null);
  const [pastJobs,     setPastJobs]     = useState<VideoJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll job status
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/yolo/video/${id}`);
        const data: VideoJob = await res.json();
        setJob(data);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch { /* ignore */ }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFile = (f: File) => {
    const allowed = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(mp4|avi|mov|mkv|webm|m4v)$/i)) {
      alert('Please upload a video file (mp4, avi, mov, mkv, webm)');
      return;
    }
    setFile(f);
    setJob(null);
    setJobId(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('zoneId', selectedZone);
    form.append('file', file);
    try {
      const res  = await fetch('/api/yolo/video', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setJobId(data.jobId);
      setJob({ status: 'queued', progress: 0, zoneId: selectedZone, filename: file.name, frames: [], summary: null, error: null });
      startPolling(data.jobId);
    } catch (e) {
      alert('Upload failed — make sure the Python backend is running (python backend/main.py)');
    } finally {
      setUploading(false);
    }
  };

  const zoneName = zones.find(z => z.id === selectedZone)?.name ?? selectedZone;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">

      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-5">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">📹 Video Crowd Analysis</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Upload stadium footage → YOLO detects every person → dashboard shows if the crowd is full
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
            yoloAvailable
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${yoloAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            {yoloAvailable ? 'YOLO backend online' : 'YOLO backend offline — run python backend/main.py'}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Upload card */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-6 space-y-5">
          <p className="text-sm font-semibold text-zinc-200">Upload video</p>

          {/* Zone selector */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-zinc-500 flex-shrink-0">Gate / Zone:</label>
            <select
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-12 ${
              dragOver
                ? 'border-emerald-400 bg-emerald-950/15'
                : file
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm,.m4v"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <span className="text-4xl">{file ? '🎬' : '📁'}</span>
            {file ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
                <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-zinc-300 font-medium">Drop video here or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">MP4 · AVI · MOV · MKV · WebM</p>
              </div>
            )}
          </div>

          {/* Analyze button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading || (job?.status === 'running' || job?.status === 'queued')}
            className="w-full py-3 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading…' : job?.status === 'running' ? 'Analyzing…' : job?.status === 'queued' ? 'Queued…' : '🔍 Analyze Video'}
          </button>
        </div>

        {/* Progress */}
        {job && (job.status === 'queued' || job.status === 'running') && (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">
                {job.status === 'queued' ? 'Waiting to start…' : `Analyzing ${job.filename}`}
              </p>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{job.progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            {job.duration && (
              <p className="text-xs text-zinc-500">
                Video duration: {fmtSec(job.duration)} · Sampled frames so far: {job.frames.length}
              </p>
            )}

            {/* Live partial results */}
            {job.frames.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-zinc-500 mb-2">Live frame results</p>
                <div className="flex gap-0.5 h-12 items-end overflow-hidden rounded-lg">
                  {job.frames.map((f, i) => {
                    const s = densityStyle(f.density);
                    return (
                      <div
                        key={i}
                        title={`${fmtSec(f.sec)} · ${f.density}% · ${f.personCount} ppl`}
                        className={`flex-1 min-w-[2px] rounded-t-sm transition-all ${s.bar} opacity-80`}
                        style={{ height: `${Math.max(4, f.density)}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {job?.status === 'error' && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/15 p-5">
            <p className="text-sm font-bold text-rose-300 mb-1">Analysis failed</p>
            <p className="text-xs text-rose-400/70">{job.error}</p>
          </div>
        )}

        {/* Results */}
        {job?.status === 'done' && job.summary && (() => {
          const s   = job.summary;
          const ds  = densityStyle(s.maxDensity);
          const es  = emotionStyle(EMOTION_MAP[s.peakEmotion] ?? 'calm');
          return (
            <div className="space-y-5">

              {/* Verdict banner */}
              <div className={`rounded-2xl border p-5 flex items-center gap-5 ${
                s.isFull ? 'border-rose-500/40 bg-rose-950/20' : 'border-emerald-400/20 bg-emerald-950/10'
              }`}>
                <span className="text-5xl">{s.isFull ? '🚨' : '✅'}</span>
                <div>
                  <p className={`text-xl font-extrabold ${s.isFull ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {s.isFull ? 'CROWD OVERLOAD DETECTED' : 'CROWD WITHIN SAFE LIMITS'}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">{s.verdict}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Zone: {zoneName} · {fmtSec(s.durationSec)} video · {s.sampledFrames} frames analyzed</p>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Peak density',    value: `${s.maxDensity}%`,    col: s.maxDensity >= 70 ? 'rose' : s.maxDensity >= 40 ? 'amber' : 'emerald' },
                  { label: 'Average density', value: `${s.avgDensity}%`,    col: s.avgDensity >= 70 ? 'rose' : s.avgDensity >= 40 ? 'amber' : 'emerald' },
                  { label: 'Peak fight risk', value: `${s.maxFightRisk}%`,  col: s.maxFightRisk >= 70 ? 'rose' : s.maxFightRisk >= 40 ? 'amber' : 'emerald' },
                  { label: 'Overload segments', value: s.overloadCount,     col: s.overloadCount > 0 ? 'rose' : 'emerald' },
                ].map(k => {
                  const base = 'rounded-2xl border px-4 py-3 text-center';
                  const cls  = k.col === 'rose'    ? `${base} border-rose-500/20 bg-rose-500/5` :
                               k.col === 'amber'   ? `${base} border-amber-400/20 bg-amber-400/5` :
                                                     `${base} border-emerald-400/20 bg-emerald-400/5`;
                  const tc   = k.col === 'rose'    ? 'text-rose-400' :
                               k.col === 'amber'   ? 'text-amber-400' : 'text-emerald-400';
                  return (
                    <div key={k.label} className={cls}>
                      <p className={`text-2xl font-bold tabular-nums ${tc}`}>{k.value}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{k.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Timeline chart */}
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-zinc-200">Density timeline</p>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" />Normal</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />Busy</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />Overload</span>
                  </div>
                </div>
                <div className="flex gap-0.5 h-20 items-end">
                  {job.frames.map((f, i) => {
                    const st = densityStyle(f.density);
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end group relative">
                        <div
                          className={`rounded-t-sm ${st.bar} transition-all`}
                          style={{ height: `${Math.max(2, f.density)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap text-zinc-200">
                          {fmtSec(f.sec)} · {f.density}% · {f.personCount} ppl
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>0:00</span>
                  <span>{fmtSec(s.durationSec)}</span>
                </div>
              </div>

              {/* Emotion timeline */}
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5">
                <p className="text-sm font-semibold text-zinc-200 mb-3">Emotion timeline</p>
                <div className="flex gap-0.5 h-10 items-end">
                  {job.frames.map((f, i) => {
                    const st = emotionStyle(f.emotionLevel);
                    const h  = f.emotionLevel === 'angry' ? 100 : f.emotionLevel === 'agitated' ? 70 : f.emotionLevel === 'tense' ? 45 : 20;
                    return (
                      <div key={i} className={`flex-1 rounded-t-sm ${st.bar} opacity-80`} style={{ height: `${h}%` }} />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>0:00</span>
                  <span>{fmtSec(s.durationSec)}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(['calm', 'tense', 'agitated', 'angry'] as const).map(e => {
                    const st    = emotionStyle(e);
                    const count = job.frames.filter(f => f.emotionLevel === e).length;
                    const pct   = Math.round((count / job.frames.length) * 100);
                    return (
                      <div key={e} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${st.text} ${st.bg} ${st.border}`}>
                        {st.icon} {e} <span className="font-bold">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overload timestamps */}
              {s.overloadSecs.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
                  <p className="text-sm font-semibold text-rose-300 mb-3">⚠ Overload detected at these moments</p>
                  <div className="flex flex-wrap gap-2">
                    {s.overloadSecs.map((sec, i) => (
                      <span key={i} className="text-xs font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg px-2 py-1">
                        {fmtSec(sec)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Map raw DeepFace emotion → emotionLevel key for emotionStyle()
const EMOTION_MAP: Record<string, string> = {
  angry: 'angry', disgust: 'agitated', fear: 'agitated',
  sad: 'tense', surprise: 'tense', neutral: 'calm', happy: 'calm',
};
