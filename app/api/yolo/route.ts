import { NextRequest, NextResponse } from 'next/server';

const YOLO_URL = process.env.YOLO_BACKEND_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface YoloResult {
  zoneId: string;
  personCount: number;
  capacity: number;
  density: number;
  rawEmotion: string;
  emotionLevel: 'calm' | 'tense' | 'agitated' | 'angry';
  fightRisk: number;
  etaMin: number | null;
  timestamp: string;
  processingMs: number;
  models: { yolo: boolean; deepface: boolean };
  error?: string;
}

// ── Check backend health ───────────────────────────────────────────────────────
export async function GET() {
  try {
    const res = await fetch(`${YOLO_URL}/status`, { next: { revalidate: 0 } });
    const data = await res.json();
    return NextResponse.json({ available: true, ...data });
  } catch {
    return NextResponse.json({ available: false }, { status: 200 });
  }
}

// ── Analyze image by URL ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mode, zoneId, imageUrl, cameraUrl } = body;

  try {
    let result: YoloResult;

    if (mode === 'camera' && cameraUrl) {
      const res = await fetch(
        `${YOLO_URL}/analyze-camera?zoneId=${encodeURIComponent(zoneId)}&cameraUrl=${encodeURIComponent(cameraUrl)}`,
        { method: 'GET', next: { revalidate: 0 } }
      );
      result = await res.json();

    } else if (mode === 'url' && imageUrl) {
      const res = await fetch(`${YOLO_URL}/analyze-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, imageUrl }),
      });
      result = await res.json();

    } else {
      return NextResponse.json({ error: 'Missing mode or required fields' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'YOLO backend unreachable. Is python main.py running?', detail: String(err) },
      { status: 503 }
    );
  }
}
