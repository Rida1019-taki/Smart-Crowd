import { NextRequest, NextResponse } from 'next/server';

const YOLO_URL = process.env.YOLO_BACKEND_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const res  = await fetch(`${YOLO_URL}/video-status/${jobId}`, { next: { revalidate: 0 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
