"""
SaaS Mix - Main FastAPI Application
This is the entry point for our backend API server.
"""

import os
from pathlib import Path

# Toujours charger .env (service Windows / NSSM ne le fait pas)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import json
import logging
import re
import shutil
import subprocess as _subprocess
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime
import numpy as np
from scipy.signal import resample as scipy_resample
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from typing import Optional, List
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter, get_rate_limit_key
from presets import list_presets
from mixing_service import MixingService
from test_hise_direct import master_only as hise_master_only, get_vst_status
from mix_chain_b import render_chain_b
from test_hise_direct import read_wav, write_wav
from database import engine, Base, DATABASE_URL, get_db
from models import Project, User, PLAN_LIMITS, TokenPurchaseProcessed  # noqa: F401 - tables enregistrées avec Base
from routers.auth import router as auth_router
from routers.projects import router as projects_router
from routers.billing import router as billing_router, _plan_from_price_id
from dependencies import get_current_user, get_current_user_row, get_current_user_row_optional

# Create the FastAPI app
app = FastAPI(
    title="SaaS Mix API",
    description="Automatic vocal mixing platform API",
    version="0.1.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Enable CORS (Cross-Origin Resource Sharing) so frontend can talk to backend
# allow_origin_regex covers Netlify deploy previews (staging and prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://siberiamix.netlify.app",
        "https://stagingsiberiamix.netlify.app",
        "https://siberiamix.com",
        "https://www.siberiamix.com",
    ],
    allow_origin_regex=r"https://[a-z0-9-]+--(?:stagingsiberiamix|siberiamix)\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Créer les tables (users, projects, etc.) au démarrage
Base.metadata.create_all(bind=engine)


def _migrate_users_billing_columns():
    """Ajoute les colonnes billing à la table users si elles n'existent pas (SQLite)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        if "sqlite" in DATABASE_URL:
            r = conn.execute(text("PRAGMA table_info(users)"))
            names = [row[1] for row in r]
            if "plan" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR(32) NOT NULL DEFAULT 'free'"))
            if "stripe_customer_id" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"))
            if "stripe_subscription_id" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)"))
            if "usage_month" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN usage_month VARCHAR(7)"))
            if "mix_downloads_count" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN mix_downloads_count INTEGER NOT NULL DEFAULT 0"))
            if "master_downloads_count" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN master_downloads_count INTEGER NOT NULL DEFAULT 0"))
            if "mix_tokens_purchased" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN mix_tokens_purchased INTEGER NOT NULL DEFAULT 0"))
            if "master_tokens_purchased" not in names:
                conn.execute(text("ALTER TABLE users ADD COLUMN master_tokens_purchased INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
        else:
            for col in ("mix_tokens_purchased", "master_tokens_purchased"):
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} INTEGER NOT NULL DEFAULT 0"))
                    conn.commit()
                except Exception:
                    conn.rollback()


_migrate_users_billing_columns()

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(billing_router)

# Initialize mixing service
mixing_service = MixingService()


def _set_backend_process_priority_high():
    """Windows: priorité Haute pour tout le process backend (mixes stables ~35s, pas 1m35 au hasard)."""
    if sys.platform != "win32":
        return
    try:
        kernel32 = __import__("ctypes").windll.kernel32
        h = kernel32.GetCurrentProcess()
        if h:
            kernel32.SetPriorityClass(h, 0x80)  # HIGH_PRIORITY_CLASS
    except Exception:
        pass


@app.on_event("startup")
def startup_sync_r2():
    """En production (Linux), télécharge les binaires HISE depuis R2 au démarrage."""
    _set_backend_process_priority_high()
    if sys.platform == "linux" and os.environ.get("R2_BUCKET_NAME"):
        try:
            from r2_assets import ensure_r2_assets
            if ensure_r2_assets():
                print("[R2] Binaires VST Linux prêts.")
            else:
                print("[R2] Sync R2 non effectuée (config manquante ou erreur).")
        except Exception as e:
            print("[R2] Startup sync:", e)
    # Nettoyage périodique : éviction des jobs expirés + fichiers audio (robustesse multi-utilisateurs)
    cleanup_thread = threading.Thread(target=_run_periodic_cleanup, daemon=True)
    cleanup_thread.start()

# Dossier pour les pistes mixées (téléchargement par ID, pas par path)
MIXED_TRACKS_DIR = os.path.join(tempfile.gettempdir(), "saas_mix_mixed")
# Dossier pour le mix complet et le master (render)
RENDER_DIR = os.path.join(tempfile.gettempdir(), "saas_mix_render")
# Dossier pour les pré-uploads (fichiers envoyés avant le clic MIXER)
PREUPLOAD_DIR = os.path.join(tempfile.gettempdir(), "saas_mix_preupload")
TARGET_SR = 44100

# --- MP3 conversion (préécoute légère) ---
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")
_mp3_log = logging.getLogger("mp3")


def _wav_to_mp3(wav_path: str, bitrate: str = "192k") -> Optional[str]:
    """Convertit un WAV en MP3 (cache à côté du WAV). Retourne le chemin MP3 ou None."""
    mp3_path = wav_path.rsplit(".", 1)[0] + ".mp3"
    if os.path.exists(mp3_path):
        return mp3_path
    try:
        _subprocess.run(
            [FFMPEG_PATH, "-y", "-i", wav_path, "-b:a", bitrate, "-loglevel", "error", mp3_path],
            check=True, capture_output=True, timeout=30,
        )
        return mp3_path if os.path.exists(mp3_path) else None
    except Exception as exc:
        _mp3_log.warning("MP3 conversion failed for %s: %s", wav_path, exc)
        return None


# Jobs de mix (progression réelle) : job_id -> { status, percent, step, mixedTrackUrl?, error?, created_at }
_mix_jobs: dict = {}
_mix_jobs_lock = threading.Lock()
# TTL : jobs et fichiers audio expirés après 24h (évite saturation mémoire/disque multi-utilisateurs)
MIX_JOB_TTL_SECONDS = 24 * 3600
AUDIO_FILE_MAX_AGE_SECONDS = 24 * 3600
_CLEANUP_INTERVAL_SECONDS = 15 * 60  # 15 min

# File d'attente mix : max 4 jobs simultanés, max 2 par user/IP (queue non affichée à l'utilisateur)
MAX_CONCURRENT_MIX_JOBS = int(os.environ.get("MAX_CONCURRENT_MIX_JOBS", "4"))
MAX_CONCURRENT_MIX_JOBS_PER_OWNER = 2
_mix_running_count = 0
_mix_pending_queue: List[dict] = []


def _evict_old_mix_jobs() -> None:
    """Supprime les jobs de mix plus vieux que MIX_JOB_TTL_SECONDS."""
    now = time.time()
    with _mix_jobs_lock:
        to_remove = [jid for jid, j in _mix_jobs.items() if (j.get("created_at") or 0) < now - MIX_JOB_TTL_SECONDS]
        for jid in to_remove:
            del _mix_jobs[jid]


def _cleanup_old_audio_dirs() -> None:
    """Supprime les WAV/MP3 dans MIXED_TRACKS_DIR et RENDER_DIR plus vieux que AUDIO_FILE_MAX_AGE_SECONDS."""
    now = time.time()
    cutoff = now - AUDIO_FILE_MAX_AGE_SECONDS
    for dir_path in (MIXED_TRACKS_DIR, RENDER_DIR, PREUPLOAD_DIR):
        if not os.path.isdir(dir_path):
            continue
        try:
            for name in os.listdir(dir_path):
                if not (name.endswith(".wav") or name.endswith(".mp3")):
                    continue
                path = os.path.join(dir_path, name)
                try:
                    if os.path.getmtime(path) < cutoff:
                        os.remove(path)
                except OSError:
                    pass
        except OSError:
            pass


def _run_periodic_cleanup() -> None:
    """Boucle en arrière-plan : éviction des jobs expirés + nettoyage des fichiers audio."""
    while True:
        time.sleep(_CLEANUP_INTERVAL_SECONDS)
        try:
            _evict_old_mix_jobs()
            _cleanup_old_audio_dirs()
        except Exception:
            pass


def _count_running_for_owner(owner: str) -> int:
    """Compte les jobs en status 'running' pour cet owner. À appeler avec _mix_jobs_lock tenu."""
    return sum(1 for j in _mix_jobs.values() if j.get("status") == "running" and j.get("owner") == owner)


def _assemble_tracks(track_paths_gains: List[tuple], output_path: str) -> bool:
    """
    Assemble plusieurs pistes (path, gain) en un seul WAV.
    gain en 0-200 (pourcentage). Résample à TARGET_SR, même longueur (pad), somme.
    """
    if not track_paths_gains:
        return False
    try:
        streams = []
        max_samples = 0
        for path, gain in track_paths_gains:
            if not os.path.exists(path):
                continue
            audio, sr = read_wav(path)
            # mono -> stereo
            if audio.ndim == 1:
                audio = np.column_stack([audio, audio])
            elif audio.shape[1] == 1:
                audio = np.column_stack([audio[:, 0], audio[:, 0]])
            # resample to TARGET_SR
            if sr != TARGET_SR:
                n = int(audio.shape[0] * TARGET_SR / sr)
                audio = scipy_resample(audio, n, axis=0).astype(np.float32)
            # gain (0-200 %)
            audio = audio * (gain / 100.0)
            streams.append(audio)
            max_samples = max(max_samples, audio.shape[0])

        if not streams:
            return False
        # pad to same length
        mixed = np.zeros((max_samples, 2), dtype=np.float32)
        for s in streams:
            mixed[: s.shape[0], :] += s
        np.clip(mixed, -1.0, 1.0, out=mixed)
        write_wav(output_path, mixed, TARGET_SR)
        return True
    except Exception:
        return False


@app.get("/")
async def root():
    """Health check endpoint - tells us the API is running"""
    return {
        "message": "SaaS Mix API is running!",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "saas-mix-api"
    }


@app.get("/api/debug/vst-status")
async def debug_vst_status():
    """Diagnostic : chemins host + VST3 (GlobalMix/Project1). Pour vérifier le déploiement sans lancer de mix."""
    return get_vst_status()


@app.get("/api/debug/token-prices")
async def debug_token_prices():
    """Indique si les 4 variables d'env des prix tokens sont lues par le backend (sans afficher les valeurs)."""
    return {
        "STRIPE_PRICE_MIX_1": bool(os.environ.get("STRIPE_PRICE_MIX_1", "").strip()),
        "STRIPE_PRICE_MIX_5": bool(os.environ.get("STRIPE_PRICE_MIX_5", "").strip()),
        "STRIPE_PRICE_MASTER_1": bool(os.environ.get("STRIPE_PRICE_MASTER_1", "").strip()),
        "STRIPE_PRICE_MASTER_5": bool(os.environ.get("STRIPE_PRICE_MASTER_5", "").strip()),
    }


@app.get("/api/presets")
async def get_presets():
    """Get list of available presets"""
    return {
        "presets": list_presets()
    }


@app.post("/api/process")
async def process_mix(
    vocal: UploadFile = File(..., description="Raw vocal WAV file"),
    instrumental: Optional[UploadFile] = File(None, description="Instrumental WAV file (optional)"),
    preset_id: str = Form("modern_clean", description="Preset ID"),
    reverb_intensity: float = Form(0.3, ge=0.0, le=1.0, description="Reverb intensity (0.0 to 1.0)"),
    delay_tempo: Optional[float] = Form(None, description="Delay tempo in BPM (None for auto-detect)"),
    delay_intensity: float = Form(0.25, ge=0.0, le=1.0, description="Delay intensity (0.0 to 1.0)"),
    manual_bpm: Optional[float] = Form(None, description="Manual BPM override")
):
    """
    Process vocal and optionally create mix with instrumental
    
    Returns processed vocal stem (always) and full mix (only if instrumental provided)
    """
    # Validate vocal file type
    if not vocal.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Vocal file must be WAV format")
    
    # Validate instrumental file type if provided
    if instrumental and not instrumental.filename.endswith('.wav'):
        raise HTTPException(status_code=400, detail="Instrumental file must be WAV format")
    
    # Save uploaded files temporarily
    temp_dir = tempfile.gettempdir()
    vocal_path = os.path.join(temp_dir, f"vocal_{os.getpid()}.wav")
    instrumental_path = None
    
    try:
        # Save vocal file
        with open(vocal_path, "wb") as f:
            content = await vocal.read()
            f.write(content)
        
        # Save instrumental file if provided
        if instrumental:
            instrumental_path = os.path.join(temp_dir, f"instrumental_{os.getpid()}.wav")
            with open(instrumental_path, "wb") as f:
                content = await instrumental.read()
                f.write(content)
        
        # Process the mix
        processed_vocal_path, full_mix_path = mixing_service.process_mix(
            vocal_path=vocal_path,
            instrumental_path=instrumental_path,
            preset_id=preset_id,
            reverb_intensity=reverb_intensity,
            delay_tempo=delay_tempo,
            delay_intensity=delay_intensity,
            manual_bpm=manual_bpm
        )
        
        # Build response
        response = {
            "status": "success",
            "processed_vocal_url": f"/api/download/processed_vocal?path={processed_vocal_path}",
            "message": "Processing complete!"
        }
        
        # Add full mix URL only if instrumental was provided
        if full_mix_path:
            response["full_mix_url"] = f"/api/download/full_mix?path={full_mix_path}"
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Clean up uploaded files
        if os.path.exists(vocal_path):
            os.remove(vocal_path)
        if instrumental_path and os.path.exists(instrumental_path):
            os.remove(instrumental_path)


@app.get("/api/download/processed_vocal")
async def download_processed_vocal(path: str):
    """Download processed vocal stem"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path,
        media_type="audio/wav",
        filename="processed_vocal.wav"
    )


@app.get("/api/download/full_mix")
async def download_full_mix(path: str):
    """Download full mix"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path,
        media_type="audio/wav",
        filename="full_mix.wav"
    )


# --- Étape 1 : Mix d'une piste vocale (chaîne HISE) ---

def _parse_bool_form(value: str) -> bool:
    return value.strip().lower() in ("true", "1", "yes", "on")


def _run_mix_job(
    job_id: str,
    input_path: str,
    output_path: str,
    mixed_id: str,
    deesser: bool,
    deesser_mode: int,
    noise_gate: bool,
    noise_gate_mode: int,
    delay: bool,
    delay_intensity: int,
    bpm: float,
    delay_division: str,
    tone_low: int,
    tone_mid: int,
    tone_high: int,
    air: bool,
    reverb: bool,
    reverb_mode: int,
    phone_fx: bool,
    robot: bool,
    doubler: bool,
):
    def progress_callback(percent: int, step: str):
        with _mix_jobs_lock:
            if job_id in _mix_jobs:
                _mix_jobs[job_id]["percent"] = percent
                _mix_jobs[job_id]["step"] = step

    kwargs = dict(
        deesser=deesser,
        deesser_mode=deesser_mode,
        noise_gate=noise_gate,
        noise_gate_mode=noise_gate_mode,
        delay=delay,
        delay_intensity=delay_intensity,
        bpm=bpm,
        delay_division=delay_division,
        tone_low=tone_low,
        tone_mid=tone_mid,
        tone_high=tone_high,
        air=air,
        reverb=reverb,
        reverb_mode=reverb_mode,
        phone_fx=phone_fx,
        robot=robot,
        doubler=doubler,
        core_override=os.environ.get("MAIN_CHAIN_CORE"),
    )
    try:
        try:
            ok, err_msg = render_chain_b(input_path, output_path, progress_callback=progress_callback, **kwargs)
        except TypeError:
            ok, err_msg = render_chain_b(input_path, output_path, **kwargs)
        with _mix_jobs_lock:
            if job_id not in _mix_jobs:
                return
            if not ok:
                _mix_jobs[job_id]["status"] = "error"
                _mix_jobs[job_id]["error"] = err_msg or "Le mix a échoué (chaîne HISE)"
                return
            if not os.path.exists(output_path):
                _mix_jobs[job_id]["status"] = "error"
                _mix_jobs[job_id]["error"] = "Fichier mixé non créé"
                return
            _mix_jobs[job_id]["status"] = "done"
            _mix_jobs[job_id]["percent"] = 100
            _mix_jobs[job_id]["step"] = "Terminé"
            _mix_jobs[job_id]["mixedTrackUrl"] = f"/api/download/mixed-track?id={mixed_id}"
    except Exception as e:
        with _mix_jobs_lock:
            if job_id in _mix_jobs:
                _mix_jobs[job_id]["status"] = "error"
                _mix_jobs[job_id]["error"] = str(e)
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except OSError:
                pass
        # Libérer un slot et démarrer le prochain job en file d'attente
        with _mix_jobs_lock:
            global _mix_running_count
            _mix_running_count = max(0, _mix_running_count - 1)
            if _mix_pending_queue:
                next_job = _mix_pending_queue.pop(0)
                jid = next_job["job_id"]
                if jid in _mix_jobs:
                    _mix_jobs[jid]["status"] = "running"
                _mix_running_count += 1
                t = threading.Thread(target=_run_mix_job, kwargs=next_job, daemon=True)
                t.start()


# Taille max du fichier vocal pour /api/track/mix (évite OOM et timeouts)
MAX_MIX_FILE_SIZE_BYTES = int(os.environ.get("MAX_MIX_FILE_SIZE_BYTES", "104857600"))  # 100 MiB par défaut


@app.post("/api/track/preupload")
@limiter.limit("30/minute")
async def track_preupload(
    request: Request,
    file: UploadFile = File(..., description="WAV ou MP3 à pré-uploader"),
):
    """Pré-upload d'un WAV ou MP3 avant le clic MIXER. Retourne un preupload_id réutilisable dans POST /api/track/mix."""
    fname = (file.filename or "").lower()
    is_mp3 = fname.endswith(".mp3")
    is_wav = fname.endswith(".wav")
    if not is_mp3 and not is_wav:
        raise HTTPException(status_code=400, detail="Le fichier doit être un WAV ou MP3")
    content = await file.read()
    if len(content) > MAX_MIX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux (max {MAX_MIX_FILE_SIZE_BYTES // (1024 * 1024)} Mo).",
        )
    os.makedirs(PREUPLOAD_DIR, exist_ok=True)
    preupload_id = str(uuid.uuid4())
    wav_path = os.path.join(PREUPLOAD_DIR, f"{preupload_id}.wav")
    if is_mp3:
        mp3_path = os.path.join(PREUPLOAD_DIR, f"{preupload_id}.mp3")
        with open(mp3_path, "wb") as f:
            f.write(content)
        try:
            _subprocess.run(
                [FFMPEG_PATH, "-y", "-i", mp3_path, "-ar", "44100", "-ac", "2", "-sample_fmt", "s16", "-loglevel", "error", wav_path],
                check=True, capture_output=True, timeout=30,
            )
        except Exception as exc:
            if os.path.exists(mp3_path):
                os.remove(mp3_path)
            raise HTTPException(status_code=500, detail=f"Conversion MP3→WAV échouée: {exc}")
    else:
        with open(wav_path, "wb") as f:
            f.write(content)
    return {"preupload_id": preupload_id}


@app.get("/api/track/mix")
@app.get("/api/track/mix/")
async def track_mix_get():
    """GET reçu au lieu de POST : souvent une redirection HTTP→HTTPS (301/302) a converti le POST en GET."""
    raise HTTPException(
        status_code=405,
        detail="Use POST to start a mix. If you see this, the app may be calling the API over HTTP; set NEXT_PUBLIC_API_URL to https://api-staging.siberiamix.com (with https) in Netlify.",
    )


@app.post("/api/track/mix")
@app.post("/api/track/mix/")  # évite redirect 307 → Method Not Allowed si le client envoie avec slash
@limiter.limit("30/minute")
async def track_mix(
    request: Request,
    file: UploadFile = File(None, description="WAV de la piste vocale"),
    preupload_id: Optional[str] = Form(None, description="ID retourné par /api/track/preupload"),
    deesser: bool = Form(True, description="Activer le de-esser"),
    deesser_mode: int = Form(2, ge=1, le=3, description="De-esser: 1=leger, 2=moyen, 3=fort"),
    noise_gate: bool = Form(True, description="Activer le noise gate"),
    noise_gate_mode: int = Form(2, ge=1, le=4, description="Gate VST3: 1=Léger, 2=Moyen, 3=GATE2.5, 4=Extrême"),
    delay: bool = Form(False, description="Activer le delay ping-pong"),
    delay_intensity: int = Form(2, ge=1, le=3, description="Delay: 1=discret, 2=moyen, 3=fort"),
    bpm: float = Form(120.0, description="BPM (pour le delay)"),
    delay_division: str = Form("1/4", description="Division du delay: 1/4, 1/2, 1/8"),
    tone_low: int = Form(3, ge=1, le=5, description="Basses: 1-5 (3=neutre)"),
    tone_mid: int = Form(3, ge=1, le=5, description="Mids: 1-5 (3=neutre)"),
    tone_high: int = Form(3, ge=1, le=5, description="Aigus: 1-5 (3=neutre)"),
    air: str = Form("false", description="Air (shelf +2.5dB from 12.5kHz)"),
    reverb: bool = Form(False, description="Activer le reverb"),
    reverb_mode: int = Form(2, ge=1, le=3, description="Reverb 1=leger, 2=moyen, 3=large"),
    phone_fx: str = Form("false", description="FX téléphone (bandpass)"),
    robot: str = Form("false", description="FX robot (ring mod)"),
    doubler: str = Form("false", description="Doubler (élargissement)"),
):
    """
    Démarre le mix d'une piste vocale (chaîne HISE). Retourne immédiatement un jobId.
    Accepte soit un fichier WAV, soit un preupload_id obtenu via POST /api/track/preupload.
    Suivre la progression via GET /api/track/mix/status?job_id=...
    """
    input_path = None
    normalized_path = None
    try:
        os.makedirs(MIXED_TRACKS_DIR, exist_ok=True)
        mixed_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())
        input_path = os.path.join(tempfile.gettempdir(), f"mix_input_{os.getpid()}_{mixed_id[:8]}.wav")
        output_path = os.path.join(MIXED_TRACKS_DIR, f"{mixed_id}.wav")

        if preupload_id and re.match(r"^[a-f0-9\-]{36}$", preupload_id):
            preupload_path = os.path.join(PREUPLOAD_DIR, f"{preupload_id}.wav")
            if not os.path.exists(preupload_path):
                raise HTTPException(status_code=404, detail="Fichier pré-uploadé introuvable ou expiré")
            shutil.copy2(preupload_path, input_path)
        elif file and file.filename and file.filename.lower().endswith(".wav"):
            content = await file.read()
            if len(content) > MAX_MIX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Fichier trop volumineux (max {MAX_MIX_FILE_SIZE_BYTES // (1024 * 1024)} Mo). Réduisez la durée ou la résolution.",
                )
            with open(input_path, "wb") as f:
                f.write(content)
        else:
            raise HTTPException(status_code=400, detail="Fournissez un fichier WAV ou un preupload_id valide")

        # Normaliser en PCM 16-bit (format 65534 / float non supporté par hise_vst3_host)
        normalized_path = os.path.join(tempfile.gettempdir(), f"mix_norm_{os.getpid()}_{mixed_id[:8]}.wav")
        try:
            audio, sr = read_wav(input_path)
            write_wav(normalized_path, audio, sr)
        except Exception as e:
            if os.path.exists(input_path):
                try:
                    os.remove(input_path)
                except OSError:
                    pass
            raise HTTPException(status_code=400, detail=f"Fichier WAV invalide ou format non supporté: {e}")
        try:
            os.remove(input_path)
        except OSError:
            pass
        input_path = normalized_path

        owner = get_rate_limit_key(request)
        job_kwargs = {
            "job_id": job_id,
            "input_path": input_path,
            "output_path": output_path,
            "mixed_id": mixed_id,
            "deesser": deesser,
            "deesser_mode": deesser_mode,
            "noise_gate": noise_gate,
            "noise_gate_mode": noise_gate_mode,
            "delay": delay,
            "delay_intensity": delay_intensity,
            "bpm": bpm,
            "delay_division": delay_division,
            "tone_low": tone_low,
            "tone_mid": tone_mid,
            "tone_high": tone_high,
            "air": _parse_bool_form(air),
            "reverb": reverb,
            "reverb_mode": reverb_mode,
            "phone_fx": _parse_bool_form(phone_fx),
            "robot": _parse_bool_form(robot),
            "doubler": _parse_bool_form(doubler),
        }
        with _mix_jobs_lock:
            global _mix_running_count
            _mix_jobs[job_id] = {
                "status": "running",
                "percent": 0,
                "step": "",
                "mixedTrackUrl": None,
                "error": None,
                "created_at": time.time(),
                "owner": owner,
            }
            running_for_owner = _count_running_for_owner(owner)
            over_global = _mix_running_count >= MAX_CONCURRENT_MIX_JOBS
            over_per_owner = running_for_owner >= MAX_CONCURRENT_MIX_JOBS_PER_OWNER
            if over_global or over_per_owner:
                _mix_jobs[job_id]["status"] = "queued"
                _mix_pending_queue.append(job_kwargs)
            else:
                _mix_running_count += 1
                thread = threading.Thread(target=_run_mix_job, kwargs=job_kwargs, daemon=True)
                thread.start()

        return {
            "jobId": job_id,
            "status": "running",
            "message": "Mix démarré. Utilisez GET /api/track/mix/status?job_id=... pour la progression.",
        }
    except HTTPException:
        raise
    except Exception as e:
        for p in (input_path, normalized_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
        import traceback
        traceback.print_exc()
        err_msg = str(e)
        if os.environ.get("STAGING") or os.environ.get("DEBUG"):
            err_msg = err_msg + " | " + traceback.format_exc()
        raise HTTPException(status_code=500, detail=err_msg)


@app.get("/api/track/mix/status")
async def track_mix_status(job_id: str):
    """Retourne la progression du mix : status (running|done|error), percent, step, mixedTrackUrl (si done), error (si error)."""
    _evict_old_mix_jobs()
    with _mix_jobs_lock:
        job = _mix_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job inconnu ou expiré")
    return {
        "status": job["status"],
        "percent": job["percent"],
        "step": job["step"],
        "mixedTrackUrl": job.get("mixedTrackUrl"),
        "error": job.get("error"),
    }


@app.get("/api/download/mixed-track")
async def download_mixed_track(request: Request, id: str, format: Optional[str] = None):
    """Télécharge ou lit la piste mixée. ?format=mp3 pour préécoute légère. Supporte Range."""
    if not re.match(r"^[a-f0-9\-]{36}$", id):
        raise HTTPException(status_code=400, detail="ID invalide")
    wav_path = os.path.join(MIXED_TRACKS_DIR, f"{id}.wav")
    if not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="Piste mixée introuvable ou expirée")

    if format == "mp3":
        mp3_path = _wav_to_mp3(wav_path)
        if mp3_path:
            return FileResponse(mp3_path, media_type="audio/mpeg", filename="mixed_track.mp3")
        # Fallback WAV si conversion échoue

    path = wav_path
    size = os.path.getsize(path)
    range_header = request.headers.get("range")
    if not range_header or not range_header.strip().lower().startswith("bytes="):
        return FileResponse(
            path,
            media_type="audio/wav",
            filename="mixed_track.wav",
            headers={"Accept-Ranges": "bytes"},
        )
    try:
        parts = range_header.strip().split("=")[1].strip().split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else size - 1
        if start >= size or end >= size:
            end = size - 1
        if start > end:
            start, end = 0, size - 1
        length = end - start + 1
    except (ValueError, IndexError):
        return FileResponse(
            path,
            media_type="audio/wav",
            filename="mixed_track.wav",
            headers={"Accept-Ranges": "bytes"},
        )
    with open(path, "rb") as f:
        f.seek(start)
        body = f.read(length)
    return Response(
        content=body,
        status_code=206,
        media_type="audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(len(body)),
        },
    )


# --- Render mix (toutes les pistes assemblées) et Master ---

async def _build_track_paths_and_gains(track_specs: list, files: List[UploadFile]) -> tuple:
    """
    track_specs: [ { "category", "gain", "mixedTrackId"?: string, "preuploadId"?: string }, ... ]
    files: liste de fichiers pour les pistes sans mixedTrackId ni preuploadId (même ordre).
    Retourne ( [ (path, gain), ... ], temp_paths ).
    """
    os.makedirs(MIXED_TRACKS_DIR, exist_ok=True)
    temp_paths = []
    paths_gains = []
    file_index = 0
    for spec in track_specs:
        gain = max(0, min(200, int(spec.get("gain", 100))))
        mixed_id = spec.get("mixedTrackId")
        if mixed_id and re.match(r"^[a-f0-9\-]{36}$", mixed_id):
            path = os.path.join(MIXED_TRACKS_DIR, f"{mixed_id}.wav")
            if os.path.exists(path):
                paths_gains.append((path, gain))
                continue
        preupload_id = spec.get("preuploadId")
        if preupload_id and re.match(r"^[a-f0-9\-]{36}$", preupload_id):
            path = os.path.join(PREUPLOAD_DIR, f"{preupload_id}.wav")
            if os.path.exists(path):
                paths_gains.append((path, gain))
                continue
        if file_index < len(files):
            f = files[file_index]
            file_index += 1
            if f and f.filename and f.filename.lower().endswith(".wav"):
                tmp = os.path.join(tempfile.gettempdir(), f"render_track_{os.getpid()}_{len(temp_paths)}.wav")
                content = await f.read()
                with open(tmp, "wb") as out:
                    out.write(content)
                temp_paths.append(tmp)
                paths_gains.append((tmp, gain))
    return paths_gains, temp_paths


def _ensure_usage_month(user: User, db: Session) -> None:
    """Remet à zéro les compteurs si on est dans un nouveau mois."""
    now = datetime.utcnow()
    current_month = now.strftime("%Y-%m")
    if (user.usage_month or "") != current_month:
        user.usage_month = current_month
        user.mix_downloads_count = 0
        user.master_downloads_count = 0
        db.commit()
        db.refresh(user)


@app.post("/api/render/mix")
@limiter.limit("30/minute")
async def render_mix(
    request: Request,
    current_user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
    track_specs: str = Form(..., description="JSON array of { category, gain, mixedTrackId? }"),
    files: List[UploadFile] = File(default=[], description="WAV files for tracks without mixedTrackId"),
):
    """
    Assemble toutes les pistes en un seul WAV. Accessible à tous les utilisateurs connectés (free peut mixer ; tokens consommés au téléchargement).
    """
    try:
        specs = json.loads(track_specs)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="track_specs JSON invalide")
    if not specs:
        raise HTTPException(status_code=400, detail="Aucune piste")
    paths_gains, temp_paths = await _build_track_paths_and_gains(specs, files)
    if not paths_gains:
        for p in temp_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        raise HTTPException(status_code=400, detail="Aucune piste valide (mixedTrackId ou fichier WAV)")
    os.makedirs(RENDER_DIR, exist_ok=True)
    mix_id = str(uuid.uuid4())
    mix_path = os.path.join(RENDER_DIR, f"mix_{mix_id}.wav")
    try:
        ok = _assemble_tracks(paths_gains, mix_path)
        for p in temp_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        if not ok or not os.path.exists(mix_path):
            raise HTTPException(status_code=500, detail="Assemblage du mix échoué")
        # Tokens are consumed only on download, not on MIXER.
        db.commit()
        return {
            "status": "success",
            "mixUrl": f"/api/download/render?id={mix_id}&type=mix",
            "message": "Mix prêt.",
        }
    except HTTPException:
        raise
    except Exception as e:
        for p in temp_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/master")
@limiter.limit("30/minute")
async def master_render(
    request: Request,
    current_user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
    track_specs: str = Form(..., description="JSON array of { category, gain, mixedTrackId? }"),
    files: List[UploadFile] = File(default=[], description="WAV files for tracks without mixedTrackId"),
):
    """
    Assemble les pistes en mix + master. Tokens consommés au téléchargement : 1 mix par download mix, 1 master par download master.
    """
    try:
        specs = json.loads(track_specs)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="track_specs JSON invalide")
    if not specs:
        raise HTTPException(status_code=400, detail="Aucune piste")
    paths_gains, temp_paths = await _build_track_paths_and_gains(specs, files)
    if not paths_gains:
        raise HTTPException(status_code=400, detail="Aucune piste valide")
    os.makedirs(RENDER_DIR, exist_ok=True)
    job_id = str(uuid.uuid4())
    mix_path = os.path.join(RENDER_DIR, f"mix_{job_id}.wav")
    master_path = os.path.join(RENDER_DIR, f"master_{job_id}.wav")
    try:
        ok = _assemble_tracks(paths_gains, mix_path)
        for p in temp_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        if not ok or not os.path.exists(mix_path):
            raise HTTPException(status_code=500, detail="Assemblage du mix échoué")
        if not hise_master_only(mix_path, master_path):
            raise HTTPException(status_code=500, detail="Master (master.vst3) a échoué")
        if not os.path.exists(master_path):
            raise HTTPException(status_code=500, detail="Fichier master non créé")
        db.commit()
        return {
            "status": "success",
            "mixUrl": f"/api/download/render?id={job_id}&type=mix",
            "masterUrl": f"/api/download/render?id={job_id}&type=master",
            "message": "Master prêt.",
        }
    except HTTPException:
        raise
    except Exception as e:
        for p in temp_paths:
            try:
                os.remove(p)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/render")
async def download_render(
    request: Request,
    id: str,
    type: str = "mix",
    download: Optional[str] = None,
    consume_only: Optional[str] = None,
    format: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_row_optional),
):
    """Stream ou téléchargement. ?format=mp3 pour préécoute. ?download=1 consomme 1 token. ?consume_only=1 consomme le token sans envoyer le fichier."""
    if not re.match(r"^[a-f0-9\-]{36}$", id):
        raise HTTPException(status_code=400, detail="ID invalide")
    if type not in ("mix", "master"):
        raise HTTPException(status_code=400, detail="type doit être mix ou master")
    wav_path = os.path.join(RENDER_DIR, f"{type}_{id}.wav")
    if not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable ou expiré")

    consume_tokens = download == "1" or consume_only == "1"
    if type in ("mix", "master"):
        if not current_user:
            raise HTTPException(status_code=401, detail="Connexion requise pour accéder au fichier.")
        plan = (current_user.plan or "free").lower()
        if consume_tokens:
            _ensure_usage_month(current_user, db)
            mix_limit, master_limit = PLAN_LIMITS.get(plan, (None, None))
            if plan == "pro":
                pass
            else:
                included_mix = max(0, (mix_limit or 0) - (current_user.mix_downloads_count or 0))
                included_master = max(0, (master_limit or 0) - (current_user.master_downloads_count or 0))
                available_mix = included_mix + (current_user.mix_tokens_purchased or 0)
                available_master = included_master + (current_user.master_tokens_purchased or 0)
                no_tokens_msg = "NO_TOKENS: Besoin de plus ? Achetez des tokens pour télécharger."
                if type == "mix":
                    if available_mix < 1:
                        raise HTTPException(status_code=402, detail=no_tokens_msg)
                else:
                    if available_master < 1:
                        raise HTTPException(status_code=402, detail=no_tokens_msg)
                if type == "mix":
                    if mix_limit is not None and (current_user.mix_downloads_count or 0) < mix_limit:
                        current_user.mix_downloads_count = (current_user.mix_downloads_count or 0) + 1
                    else:
                        current_user.mix_tokens_purchased = max(0, (current_user.mix_tokens_purchased or 0) - 1)
                else:
                    if master_limit is not None and (current_user.master_downloads_count or 0) < master_limit:
                        current_user.master_downloads_count = (current_user.master_downloads_count or 0) + 1
                    else:
                        current_user.master_tokens_purchased = max(0, (current_user.master_tokens_purchased or 0) - 1)
            db.commit()

    if consume_only == "1":
        return Response(status_code=204)

    if format == "mp3":
        mp3_path = _wav_to_mp3(wav_path)
        if mp3_path:
            return FileResponse(mp3_path, media_type="audio/mpeg", filename=f"{type}_render.mp3")

    path = wav_path
    size = os.path.getsize(path)
    range_header = request.headers.get("range")
    if not range_header or not range_header.strip().lower().startswith("bytes="):
        return FileResponse(
            path,
            media_type="audio/wav",
            filename=f"{type}_render.wav",
            headers={"Accept-Ranges": "bytes"},
        )
    try:
        parts = range_header.strip().split("=")[1].strip().split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else size - 1
        if start >= size or end >= size:
            end = size - 1
        if start > end:
            start, end = 0, size - 1
        length = end - start + 1
    except (ValueError, IndexError):
        return FileResponse(
            path,
            media_type="audio/wav",
            filename=f"{type}_render.wav",
            headers={"Accept-Ranges": "bytes"},
        )
    with open(path, "rb") as f:
        f.seek(start)
        body = f.read(length)
    return Response(
        content=body,
        status_code=206,
        media_type="audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(len(body)),
        },
    )


# --- Webhook Stripe : met à jour le plan utilisateur (abo actif / annulé) ---
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Reçoit les événements Stripe (subscription created/updated/deleted) pour garder plan en sync."""
    import stripe
    from database import SessionLocal

    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET manquant")
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Body invalide")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature Stripe invalide")

    db = SessionLocal()
    try:
        if event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
            sub = event["data"]["object"]
            customer_id = sub.get("customer")
            status = sub.get("status")
            sub_id = sub.get("id")
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.stripe_subscription_id = sub_id
                if status in ("active", "trialing"):
                    price_id = None
                    try:
                        items = sub.get("items") or {}
                        data = (items.get("data") or []) if hasattr(items, "get") else []
                        if data:
                            price = (data[0].get("price") or {}) if hasattr(data[0], "get") else {}
                            price_id = price.get("id") if hasattr(price, "get") else None
                    except (AttributeError, KeyError, TypeError, IndexError):
                        pass
                    user.plan = _plan_from_price_id(price_id or "")
                else:
                    user.plan = "free"
                db.commit()
        elif event["type"] == "customer.subscription.deleted":
            sub = event["data"]["object"]
            customer_id = sub.get("customer")
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.stripe_subscription_id = None
                user.plan = "free"
                db.commit()
        elif event["type"] == "payment_intent.succeeded":
            pi = event["data"]["object"]
            meta = pi.get("metadata") or {}
            if meta.get("saas_mix_user_id") and meta.get("saas_mix_token_type"):
                pi_id = pi.get("id")
                if pi_id and not db.query(TokenPurchaseProcessed).filter(TokenPurchaseProcessed.payment_intent_id == pi_id).first():
                    user = db.query(User).filter(User.id == meta["saas_mix_user_id"]).first()
                    if user:
                        try:
                            qty = int(meta.get("saas_mix_token_quantity") or "1")
                        except (TypeError, ValueError):
                            qty = 1
                        if meta["saas_mix_token_type"] == "mix":
                            user.mix_tokens_purchased = (user.mix_tokens_purchased or 0) + qty
                        else:
                            user.master_tokens_purchased = (user.master_tokens_purchased or 0) + qty
                        db.add(TokenPurchaseProcessed(payment_intent_id=pi_id))
                        db.commit()
    finally:
        db.close()

    return {"received": True}
