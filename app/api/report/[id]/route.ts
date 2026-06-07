import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.VISION_BACKEND_URL ?? 'http://localhost:8000';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND}/reports/${encodeURIComponent(id)}/resolve`, {
      method: 'PATCH',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false, error: 'Backend unreachable' }, { status: 503 });
  }
}
