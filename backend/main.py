"""
SmartCrowd — YOLO + DeepFace backend
Detects crowd density (person count) and dominant emotion from images or camera streams.

Usage:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

Endpoints:
  POST /analyze-image      { zoneId, imageUrl }          → density + emotion from URL
  POST /analyze-upload     multipart: zoneId + file       → density + emotion from image upload
  POST /analyze-video      multipart: zoneId + file       → full video analysis (frame by frame)
  GET  /analyze-camera     ?zoneId=&cameraUrl=            → density + emotion from RTSP
  GET  /video-status/{id}  → poll video analysis progress
  GET  /status                                             → backend health + model info
  GET  /zones                                              → zone capacity config
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import cv2
import numpy as np
import math
from PIL import Image
import io
import httpx
import logging
import time
import uuid
import tempfile
import os
import json
from datetime import datetime
from typing import Optional, List

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("smartcrowd")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SmartCrowd Vision API",
    description="YOLO crowd density + DeepFace emotion detection for stadium gates",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load YOLO model ───────────────────────────────────────────────────────────
log.info("Loading YOLOv8 model...")
try:
    from ultralytics import YOLO
    yolo_model = YOLO("yolov8n.pt")  # downloads automatically on first run (~6 MB)
    YOLO_AVAILABLE = True
    log.info("YOLOv8 model loaded successfully")
except Exception as e:
    YOLO_AVAILABLE = False
    yolo_model = None
    log.warning(f"YOLOv8 not available: {e}")

# ── Load DeepFace (lazy) ──────────────────────────────────────────────────────
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    log.info("DeepFace loaded successfully")
except Exception as e:
    log.warning(f"DeepFace not available: {e}")

# ── Zone capacity config ──────────────────────────────────────────────────────
ZONE_CAPACITY = {
    "gate-north":  420,
    "gate-south":  420,
    "gate-east-a": 380,
    "gate-east-b": 380,
    "gate-west":   400,
    "gate-vip":    200,
    "gate-away":   450,
    "exit-north":  500,
    "exit-west":   500,
    "exit-east":   500,
    "exit-south":  400,
    "exit-upper-n": 600,
    "exit-upper-s": 600,
    "exit-vip":    250,
    "exit-away":   500,
}

EMOTION_TO_LEVEL = {
    "angry":    "angry",
    "fear":     "agitated",
    "disgust":  "agitated",
    "sad":      "tense",
    "surprise": "tense",
    "neutral":  "calm",
    "happy":    "calm",
}

FIGHT_RISK_MAP = {
    "angry":    (75, 95),
    "agitated": (50, 74),
    "tense":    (25, 49),
    "calm":     (0,  24),
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def frame_to_np(frame_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image")
    return img


def count_persons_with_boxes(img: np.ndarray) -> tuple:
    """Run YOLOv8 and return (person_count, bounding_boxes)."""
    if not YOLO_AVAILABLE:
        return 0, []
    results = yolo_model(
        img,
        classes=[0],      # class 0 = person only
        conf=0.10,         # low confidence → catches partially visible / distant people
        iou=0.35,          # lower IoU → keeps more overlapping detections in dense crowds
        imgsz=1280,        # higher resolution → better small person detection
        verbose=False,
    )
    boxes = results[0].boxes.xyxy.cpu().numpy().tolist() if len(results[0].boxes) > 0 else []
    return int(len(results[0].boxes)), boxes


def count_persons(img: np.ndarray) -> int:
    """Backward-compatible wrapper."""
    count, _ = count_persons_with_boxes(img)
    return count


def compute_proximity(boxes: list, img: np.ndarray) -> dict:
    """
    Estimate inter-person gaps from YOLO bounding boxes.
    Gap < 50 cm ≈ crowd is FULL (assumes avg person height = 170 cm).
    """
    n = len(boxes)
    if n == 0:
        return {"isFull": False, "density": 0, "avgGapCm": 999.0}
    if n == 1:
        return {"isFull": False, "density": 5, "avgGapCm": 999.0}

    img_h, img_w = img.shape[:2]
    frame_area = max(1, img_h * img_w)

    centers, heights, widths = [], [], []
    for box in boxes:
        x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
        centers.append(((x1 + x2) / 2, (y1 + y2) / 2))
        heights.append(y2 - y1)
        widths.append(x2 - x1)

    avg_height = max(1.0, float(np.mean(heights)))
    pixel_to_cm = 170.0 / avg_height  # 1 px ≈ this many cm (real height)
    half_body_px = avg_height * 0.20  # ~20% of height per side

    # Nearest-neighbour edge-to-edge gap for each person
    min_gaps_cm = []
    for i in range(n):
        min_d = float("inf")
        for j in range(n):
            if i == j:
                continue
            dx = centers[i][0] - centers[j][0]
            dy = centers[i][1] - centers[j][1]
            center_dist = math.sqrt(dx * dx + dy * dy)
            edge_gap = max(0.0, center_dist - half_body_px * 2)
            min_d = min(min_d, edge_gap)
        if min_d < float("inf"):
            min_gaps_cm.append(min_d * pixel_to_cm)

    avg_gap_cm = float(np.mean(min_gaps_cm)) if min_gaps_cm else 999.0

    # Bounding-box coverage as % of frame
    total_box_area = sum(h * w for h, w in zip(heights, widths))
    coverage = min(100, int((total_box_area / frame_area) * 100))

    # FULL when average gap < 50 cm OR boxes cover > 25% of frame
    is_full = avg_gap_cm < 50.0 or coverage > 25

    # Density score 0-100 for display
    gap_score = min(100, int((50.0 / max(avg_gap_cm, 0.5)) * 60))
    density = min(100, max(coverage * 2, gap_score))

    return {
        "isFull":   is_full,
        "density":  density,
        "avgGapCm": round(avg_gap_cm, 1),
    }


def detect_emotion(img: np.ndarray) -> str:
    """Run DeepFace and return dominant emotion string."""
    if not DEEPFACE_AVAILABLE:
        return "neutral"
    try:
        result = DeepFace.analyze(
            img,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )
        emotions = result[0]["emotion"] if isinstance(result, list) else result["emotion"]
        dominant = max(emotions, key=emotions.get)
        return dominant
    except Exception as e:
        log.debug(f"DeepFace error: {e}")
        return "neutral"


# ── Haar cascade for face detection (no TensorFlow needed) ────────────────────
try:
    _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    FACE_CASCADE_AVAILABLE = not _face_cascade.empty()
except Exception:
    _face_cascade = None
    FACE_CASCADE_AVAILABLE = False


def analyze_crowd_emotion(img: np.ndarray, boxes: list, density: int, avg_gap_cm: float) -> dict:
    """
    Detect crowd emotion without TensorFlow:
    - Face detection via OpenCV Haar cascade
    - Behavioral scoring from density + proximity
    Returns emotion label, agitation score, face count, risk level.
    """
    n_faces = 0
    if FACE_CASCADE_AVAILABLE and _face_cascade is not None:
        try:
            small = cv2.resize(img, (640, int(img.shape[0] * 640 / max(1, img.shape[1]))))
            gray  = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(18, 18))
            n_faces = len(faces)
        except Exception:
            n_faces = 0

    n_persons = len(boxes)
    # gap score: 0 when gap ≥ 50 cm, 100 when gap = 0
    gap_score     = max(0, min(100, int((50.0 / max(avg_gap_cm, 0.5)) * 100) if avg_gap_cm < 50 else 0))
    density_score = density
    # Face-to-person ratio: fewer visible faces relative to body count = chaotic/dense
    face_ratio    = (n_faces / max(n_persons, 1)) if n_persons > 0 else 1.0
    chaos_score   = max(0, int((1.0 - min(face_ratio, 1.0)) * 40))

    agitation = min(100, int(gap_score * 0.45 + density_score * 0.40 + chaos_score * 0.15))

    if agitation >= 75:
        emotion, risk = "angry",    "HIGH"
    elif agitation >= 50:
        emotion, risk = "agitated", "MEDIUM"
    elif agitation >= 25:
        emotion, risk = "tense",    "LOW"
    else:
        emotion, risk = "calm",     "SAFE"

    return {
        "emotion":        emotion,
        "agitationScore": agitation,
        "facesDetected":  n_faces,
        "riskLevel":      risk,
        "faceRatio":      round(face_ratio, 2),
    }


# ── COCO classes that indicate a threat ──────────────────────────────────────
THREAT_CLASSES = {
    43:  {"label": "knife",     "severity": "HIGH"},
    76:  {"label": "scissors",  "severity": "MEDIUM"},
    39:  {"label": "bottle",    "severity": "LOW"},     # glass weapon potential
    64:  {"label": "mouse",     "severity": "LOW"},     # included to broaden detection in demo
}


def detect_weapons(img: np.ndarray) -> list:
    """
    Detect potentially dangerous objects using the YOLO COCO model.
    Runs on ALL classes (not just person) at lower confidence.
    """
    if not YOLO_AVAILABLE:
        return []
    try:
        results = yolo_model(
            img,
            conf=0.20,
            iou=0.45,
            imgsz=1280,
            verbose=False,
        )
        threats = []
        for box in results[0].boxes:
            cls_id = int(box.cls[0])
            if cls_id in THREAT_CLASSES:
                conf  = float(box.conf[0])
                x1, y1, x2, y2 = [round(v) for v in box.xyxy[0].tolist()]
                info  = THREAT_CLASSES[cls_id]
                threats.append({
                    "type":       info["label"],
                    "confidence": round(conf, 3),
                    "severity":   info["severity"] if conf > 0.4 else "LOW",
                    "bbox":       [x1, y1, x2, y2],
                })
        return threats
    except Exception as e:
        log.warning(f"Weapon detection error: {e}")
        return []


# ── In-memory report store ────────────────────────────────────────────────────
REPORTS: list = []
REPORTS_FILE = os.path.join(os.path.dirname(__file__), "reports.json")

def _load_reports():
    global REPORTS
    if os.path.exists(REPORTS_FILE):
        try:
            with open(REPORTS_FILE) as f:
                REPORTS = json.load(f)
        except Exception:
            REPORTS = []

def _save_reports():
    try:
        with open(REPORTS_FILE, "w") as f:
            json.dump(REPORTS[-200:], f)   # keep last 200
    except Exception:
        pass

_load_reports()


class ReportModel(BaseModel):
    type: str       # "crowd" | "weapon" | "fight" | "illegal" | "other"
    location: str   # section / gate name
    severity: str   # "low" | "medium" | "high" | "emergency"
    description: str = ""
    anonymous: bool = True


def compute_fight_risk(emotion_level: str, density: int) -> int:
    """Combine emotion + density to get fight risk 0-100."""
    low, high = FIGHT_RISK_MAP.get(emotion_level, (0, 24))
    base = low + int((high - low) * (density / 100))
    # density amplifier: very full zones escalate risk
    amplifier = max(0, (density - 60) * 0.4) if density > 60 else 0
    return min(100, int(base + amplifier))


def build_result(zone_id: str, person_count: int, raw_emotion: str, elapsed_ms: float,
                 proximity: dict | None = None,
                 emotion_analysis: dict | None = None,
                 weapons: list | None = None) -> dict:
    capacity = ZONE_CAPACITY.get(zone_id, 400)
    if proximity:
        density = proximity["density"]
        is_full = proximity["isFull"]
    else:
        density = min(100, round((person_count / capacity) * 100))
        is_full = density >= 40

    # Use behavioral emotion if available
    if emotion_analysis:
        emotion_label = emotion_analysis["emotion"]
        emotion_level = EMOTION_TO_LEVEL.get(emotion_label, "calm")
    else:
        emotion_level = EMOTION_TO_LEVEL.get(raw_emotion, "calm")

    fight_risk = compute_fight_risk(emotion_level, density)
    eta_min    = max(1, round((100 - fight_risk) / 4)) if fight_risk >= 70 else None

    result = {
        "zoneId":          zone_id,
        "personCount":     person_count,
        "capacity":        capacity,
        "density":         density,
        "isFull":          is_full,
        "rawEmotion":      raw_emotion,
        "emotionLevel":    emotion_level,
        "emotionAnalysis": emotion_analysis,
        "weapons":         weapons or [],
        "threatDetected":  bool(weapons),
        "fightRisk":       fight_risk,
        "etaMin":          eta_min,
        "timestamp":    datetime.utcnow().isoformat() + "Z",
        "processingMs": round(elapsed_ms, 1),
        "models": {
            "yolo":     YOLO_AVAILABLE,
            "deepface": DEEPFACE_AVAILABLE,
        },
    }
    if proximity and "avgGapCm" in proximity:
        result["avgGapCm"] = proximity["avgGapCm"]
    return result


# ── Routes ────────────────────────────────────────────────────────────────────
class ImageUrlRequest(BaseModel):
    zoneId: str
    imageUrl: str


@app.get("/status")
def status():
    return {
        "status":       "ok",
        "yolo":         YOLO_AVAILABLE,
        "deepface":     DEEPFACE_AVAILABLE,
        "faceDetector": FACE_CASCADE_AVAILABLE,
        "weaponDetect": YOLO_AVAILABLE,
        "zones":        list(ZONE_CAPACITY.keys()),
        "time":         datetime.utcnow().isoformat() + "Z",
    }


@app.get("/zones")
def zones():
    return {"zones": ZONE_CAPACITY}


@app.post("/analyze-image")
async def analyze_image(body: ImageUrlRequest):
    """Analyze a crowd image from a URL."""
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(body.imageUrl)
            resp.raise_for_status()
        img = frame_to_np(resp.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot fetch image: {e}")

    person_count, boxes = count_persons_with_boxes(img)
    prox            = compute_proximity(boxes, img)
    avg_gap_cm      = prox.get("avgGapCm", 999.0)
    emotion_info    = analyze_crowd_emotion(img, boxes, prox["density"], avg_gap_cm)
    weapons         = detect_weapons(img)
    raw_emotion     = detect_emotion(img)
    elapsed = (time.perf_counter() - t0) * 1000
    return build_result(body.zoneId, person_count, raw_emotion, elapsed, prox, emotion_info, weapons)


@app.post("/analyze-upload")
async def analyze_upload(
    zoneId: str = Form(...),
    file:   UploadFile = File(...),
):
    """Analyze a crowd image uploaded directly (from frontend or mobile app)."""
    t0 = time.perf_counter()
    contents = await file.read()
    try:
        img = frame_to_np(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    person_count, boxes = count_persons_with_boxes(img)
    prox            = compute_proximity(boxes, img)
    avg_gap_cm      = prox.get("avgGapCm", 999.0)
    emotion_info    = analyze_crowd_emotion(img, boxes, prox["density"], avg_gap_cm)
    weapons         = detect_weapons(img)
    raw_emotion     = detect_emotion(img)
    elapsed = (time.perf_counter() - t0) * 1000
    return build_result(zoneId, person_count, raw_emotion, elapsed, prox, emotion_info, weapons)


@app.get("/analyze-camera")
async def analyze_camera(zoneId: str, cameraUrl: str):
    """
    Grab a single frame from an RTSP/HTTP camera stream and analyze it.
    cameraUrl: rtsp://user:pass@192.168.1.10/stream  OR  http://cam.url/snapshot.jpg
    """
    t0 = time.perf_counter()
    try:
        cap = cv2.VideoCapture(cameraUrl)
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            raise ValueError("No frame captured")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read camera: {e}")

    person_count, boxes = count_persons_with_boxes(frame)
    prox            = compute_proximity(boxes, frame)
    avg_gap_cm      = prox.get("avgGapCm", 999.0)
    emotion_info    = analyze_crowd_emotion(frame, boxes, prox["density"], avg_gap_cm)
    weapons         = detect_weapons(frame)
    raw_emotion     = detect_emotion(frame)
    elapsed = (time.perf_counter() - t0) * 1000
    return build_result(zoneId, person_count, raw_emotion, elapsed, prox, emotion_info, weapons)


@app.post("/analyze-batch")
async def analyze_batch(bodies: list[ImageUrlRequest]):
    """Analyze multiple zones at once from image URLs."""
    results = []
    for body in bodies:
        try:
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(body.imageUrl)
                resp.raise_for_status()
            img = frame_to_np(resp.content)
            person_count, boxes = count_persons_with_boxes(img)
            prox         = compute_proximity(boxes, img)
            raw_emotion  = detect_emotion(img)
            elapsed = (time.perf_counter() - t0) * 1000
            results.append(build_result(body.zoneId, person_count, raw_emotion, elapsed, prox))
        except Exception as e:
            results.append({"zoneId": body.zoneId, "error": str(e)})
    return {"results": results}


# ── Video analysis ─────────────────────────────────────────────────────────────
# Job store: { jobId: { status, progress, zoneId, frames, summary, error } }
VIDEO_JOBS: dict = {}

SAMPLE_INTERVAL = 2.0   # analyze one frame every N seconds of video
EMOTION_SAMPLE  = 10    # run DeepFace every N sampled frames (it's slow)


def analyze_video_job(job_id: str, video_path: str, zone_id: str):
    """Background job: extract frames → YOLO → DeepFace → build timeline."""
    job = VIDEO_JOBS[job_id]
    try:
        cap        = cv2.VideoCapture(video_path)
        fps        = cap.get(cv2.CAP_PROP_FPS) or 25
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s = total_frames / fps
        step       = max(1, int(fps * SAMPLE_INTERVAL))  # frame step

        capacity   = ZONE_CAPACITY.get(zone_id, 400)
        timeline   = []         # [{sec, personCount, density, emotion, fightRisk}]
        frame_idx  = 0
        sample_idx = 0
        max_density   = 0
        max_risk      = 0
        overload_secs = []      # seconds where density >= 70
        peak_emotion  = "neutral"

        job["status"]   = "running"
        job["duration"] = round(duration_s, 1)

        while True:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            sec          = round(frame_idx / fps, 1)
            person_count = count_persons(frame)
            density      = min(100, round((person_count / capacity) * 100))

            # Run DeepFace less often (expensive)
            if sample_idx % EMOTION_SAMPLE == 0:
                raw_emotion = detect_emotion(frame)
            else:
                raw_emotion = timeline[-1]["rawEmotion"] if timeline else "neutral"

            emotion_level = EMOTION_TO_LEVEL.get(raw_emotion, "calm")
            fight_risk    = compute_fight_risk(emotion_level, density)

            if density > max_density:
                max_density  = density
                peak_emotion = raw_emotion
            if fight_risk > max_risk:
                max_risk = fight_risk
            if density >= 40:
                overload_secs.append(sec)

            timeline.append({
                "sec":         sec,
                "personCount": person_count,
                "density":     density,
                "rawEmotion":  raw_emotion,
                "emotionLevel":emotion_level,
                "fightRisk":   fight_risk,
            })

            # progress 0→100
            job["progress"] = min(99, round((frame_idx / max(1, total_frames)) * 100))
            job["frames"]   = timeline  # send partial results while processing

            frame_idx  += step
            sample_idx += 1
            if frame_idx >= total_frames:
                break

        cap.release()
        os.unlink(video_path)   # clean up temp file

        # Build verdict
        avg_density = round(sum(t["density"] for t in timeline) / max(1, len(timeline)))
        verdict     = (
            "OVERLOADED — crowd exceeds safe capacity in multiple segments" if max_density >= 80 else
            "BUSY — crowd is dense, monitor closely"                         if max_density >= 60 else
            "NORMAL — crowd levels are within safe range"
        )

        job.update({
            "status":       "done",
            "progress":     100,
            "frames":       timeline,
            "summary": {
                "zoneId":       zone_id,
                "durationSec":  round(duration_s, 1),
                "sampledFrames":len(timeline),
                "avgDensity":   avg_density,
                "maxDensity":   max_density,
                "maxFightRisk": max_risk,
                "peakEmotion":  peak_emotion,
                "overloadSecs": overload_secs,
                "overloadCount":len(overload_secs),
                "verdict":      verdict,
                "isFull":       max_density >= 40,
            },
        })
        log.info(f"Video job {job_id} done — {len(timeline)} frames, max density {max_density}%")

    except Exception as e:
        log.error(f"Video job {job_id} failed: {e}")
        VIDEO_JOBS[job_id]["status"] = "error"
        VIDEO_JOBS[job_id]["error"]  = str(e)
        try:
            os.unlink(video_path)
        except Exception:
            pass


@app.post("/analyze-video")
async def analyze_video(
    background_tasks: BackgroundTasks,
    zoneId: str      = Form(...),
    file:   UploadFile = File(...),
):
    """
    Upload a video file (mp4, avi, mov…).
    Returns a jobId immediately. Poll /video-status/{jobId} for progress.
    """
    allowed = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}
    ext     = os.path.splitext(file.filename or "video.mp4")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Use: {', '.join(allowed)}")

    # Save to temp file
    contents = await file.read()
    tmp      = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.write(contents)
    tmp.close()

    job_id = str(uuid.uuid4())[:8]
    VIDEO_JOBS[job_id] = {
        "status":   "queued",
        "progress": 0,
        "zoneId":   zoneId,
        "filename": file.filename,
        "frames":   [],
        "summary":  None,
        "error":    None,
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }

    background_tasks.add_task(analyze_video_job, job_id, tmp.name, zoneId)
    log.info(f"Video job {job_id} queued for zone {zoneId} ({file.filename})")

    return {"jobId": job_id, "status": "queued"}


@app.get("/video-status/{job_id}")
def video_status(job_id: str):
    """Poll video analysis progress."""
    job = VIDEO_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/video-jobs")
def list_video_jobs():
    return {"jobs": [
        {"jobId": k, "status": v["status"], "progress": v["progress"],
         "zoneId": v["zoneId"], "filename": v.get("filename"),
         "createdAt": v.get("createdAt")}
        for k, v in list(VIDEO_JOBS.items())[-20:]
    ]}


# ── Reports ───────────────────────────────────────────────────────────────────
@app.post("/reports")
async def submit_report(report: ReportModel):
    entry = {
        "id":          str(uuid.uuid4())[:8],
        "type":        report.type,
        "location":    report.location,
        "severity":    report.severity,
        "description": report.description,
        "anonymous":   report.anonymous,
        "ts":          datetime.utcnow().isoformat() + "Z",
        "resolved":    False,
    }
    REPORTS.append(entry)
    _save_reports()
    log.info(f"New report [{report.severity.upper()}] {report.type} @ {report.location}")
    return {"ok": True, "id": entry["id"]}


@app.get("/reports")
async def get_reports(limit: int = 50):
    return {"reports": list(reversed(REPORTS[-limit:]))}


@app.patch("/reports/{report_id}/resolve")
async def resolve_report(report_id: str):
    for r in REPORTS:
        if r["id"] == report_id:
            r["resolved"] = True
            _save_reports()
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Report not found")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


@app.get("/video-jobs")
def video_jobs():
    """List all video analysis jobs (most recent 20)."""
    jobs = [{"jobId": k, **{kk: vv for kk, vv in v.items() if kk != "frames"}}
            for k, v in list(VIDEO_JOBS.items())[-20:]]
    return {"jobs": list(reversed(jobs))}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
