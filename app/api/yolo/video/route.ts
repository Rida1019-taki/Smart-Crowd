import { NextRequest, NextResponse } from 'next/server';

const YOLO_URL = process.env.YOLO_BACKEND_URL ?? 'http://localhost:8000';

// Upload video → backend returns jobId
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    // Forward multipart directly to Python backend
    const res = await fetch(`${YOLO_URL}/analyze-video`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'YOLO backend unreachable. Is python main.py running?', detail: String(err) },
      { status: 503 }
    );
  }
}
