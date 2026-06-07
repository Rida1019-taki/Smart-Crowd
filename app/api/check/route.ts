import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.VISION_BACKEND_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const res = await fetch(`${BACKEND}/analyze-upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({
      full: data.isFull ?? data.density >= 40,
      density: data.density,
      personCount: data.personCount,
      capacity: data.capacity,
      avgGapCm: data.avgGapCm ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Vision backend is not running. Start it with: python backend/main.py' },
      { status: 503 }
    );
  }
}
