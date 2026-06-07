import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.YOLO_BACKEND_URL ?? 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/reports?limit=50`, { next: { revalidate: 0 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ reports: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: 'Backend unreachable' }, { status: 503 });
  }
}
