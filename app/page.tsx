'use client';

import { useState, useRef, useCallback } from 'react';

type Result = {
  full: boolean;
  density: number;
  personCount: number;
  capacity: number;
  avgGapCm?: number | null;
};

type Status = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

export default function Home() {
  const [status, setStatus]       = useState<Status>('idle');
  const [result, setResult]       = useState<Result | null>(null);
  const [error, setError]         = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [fileName, setFileName]   = useState('');
  const [progress, setProgress]   = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyzeImage = async (file: File): Promise<Result> => {
    const form = new FormData();
    form.append('zoneId', 'default');
    form.append('file', file);
    const res = await fetch('/api/check', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur lors de l\'analyse');
    return data as Result;
  };

  const analyzeVideo = async (file: File): Promise<Result> => {
    const form = new FormData();
    form.append('zoneId', 'default');
    form.append('file', file);
    const res = await fetch('/api/check/video', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur de chargement');
    const { jobId } = data;
    setStatus('polling');
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`/api/check/video/${jobId}`);
      const job  = await poll.json();
      setProgress(job.progress ?? 0);
      if (job.status === 'done') {
        const s = job.summary;
        return {
          full:        s.isFull ?? s.maxDensity >= 70,
          density:     s.avgDensity ?? 0,
          personCount: Math.round((s.avgDensity / 100) * (s.capacity ?? 400)),
          capacity:    s.capacity ?? 400,
        };
      }
      if (job.status === 'error') throw new Error(job.error ?? 'Processing failed');
    }
    throw new Error('Timed out — video may be too long');
  };

  const handleFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|avi|mov|mkv|webm|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(file.name);
    if (!isVideo && !isImage) {
      setError('Unsupported file. Please upload an image (JPG, PNG…) or video (MP4, AVI…).');
      return;
    }
    setError(''); setResult(null); setProgress(0);
    setFileName(file.name);
    setStatus('uploading');
    try {
      const res = isVideo ? await analyzeVideo(file) : await analyzeImage(file);
      setResult(res);
      setStatus('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStatus('error');
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => { setStatus('idle'); setResult(null); setError(''); setFileName(''); setProgress(0); };
  const isLoading = status === 'uploading' || status === 'polling';

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            Smart<span className="text-emerald-400">Crowd</span>
          </h1>
          <p className="text-zinc-500 text-sm">
            Téléchargez une image ou une vidéo — nous vous dirons si c'est plein
          </p>
        </div>

        {/* Upload zone */}
        {(status === 'idle' || status === 'error') && (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`
              border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer
              transition-all duration-200 select-none
              ${dragOver
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/50'}
            `}
          >
            <div className="text-5xl mb-4">{dragOver ? '📂' : '📁'}</div>
            <p className="text-white font-semibold text-lg mb-1">
              {dragOver ? 'Drop to analyze' : 'Drop your file here'}
            </p>
            <p className="text-zinc-500 text-sm mb-5">or click to browse</p>
            <p className="text-zinc-600 text-xs leading-relaxed">
              Images: JPG · PNG · WEBP · GIF
              <br />
              Videos: MP4 · AVI · MOV · MKV
            </p>
            {error && (
              <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5">
                <p className="text-rose-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="border-2 border-zinc-800 rounded-2xl p-14 text-center bg-zinc-900">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 animate-spin" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">
              {status === 'uploading' ? 'Uploading & analyzing…' : 'Processing video…'}
            </p>
            <p className="text-zinc-600 text-sm truncate px-4">{fileName}</p>
            {status === 'polling' && (
              <div className="mt-6 px-4">
                <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-zinc-600 text-xs mt-2">{progress}% complete</p>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {status === 'done' && result && (
          <div className={`border-2 rounded-2xl p-10 text-center ${
            result.full ? 'border-rose-500/60 bg-rose-500/5' : 'border-emerald-500/60 bg-emerald-500/5'
          }`}>
            <div className={`text-7xl font-black tracking-tight mb-2 ${result.full ? 'text-rose-400' : 'text-emerald-400'}`}>
              {result.full ? 'FULL' : 'NOT FULL'}
            </div>
            <p className={`text-sm mb-8 ${result.full ? 'text-rose-400/60' : 'text-emerald-400/60'}`}>
              {result.full ? 'Area has exceeded safe capacity' : 'Area has space available'}
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{result.density}%</div>
                <div className="text-xs text-zinc-500 mt-0.5">Occupied</div>
              </div>
              <div className="w-px bg-zinc-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{result.personCount}</div>
                <div className="text-xs text-zinc-500 mt-0.5">People</div>
              </div>
              <div className="w-px bg-zinc-800" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{result.capacity}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Capacity</div>
              </div>
            </div>
            {result.avgGapCm != null && result.avgGapCm < 900 && (
              <p className={`text-xs mb-4 ${result.full ? 'text-rose-400/70' : 'text-emerald-400/70'}`}>
                Avg. gap between people: <span className="font-bold">{result.avgGapCm} cm</span>
                {result.avgGapCm < 50 ? ' — too close' : ' — safe spacing'}
              </p>
            )}
            <div className="bg-zinc-800 rounded-full h-3 overflow-hidden mb-8">
              <div
                className={`h-full rounded-full transition-all duration-700 ${result.full ? 'bg-rose-500' : 'bg-emerald-400'}`}
                style={{ width: `${result.density}%` }}
              />
            </div>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Check another file
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.mp4,.avi,.mov,.mkv,.webm,.m4v"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          className="hidden"
        />
      </div>
    </div>
  );
}
