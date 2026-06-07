import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.YOLO_BACKEND_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const res = await fetch(`${BACKEND}/analyze-video`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Vision backend is not running. Start it with: python backend/main.py' },
      { status: 503 }
    );
  }
}
