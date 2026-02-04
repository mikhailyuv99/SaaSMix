"""
SaaS Mix - Main FastAPI Application
This is the entry point for our backend API server.
"""

import json
import os
import re
import tempfile
import uuid
import numpy as np
from scipy.signal import resample as scipy_resample
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import Optional, List
from presets import list_presets
from mixing_service import MixingService
from test_hise_direct import render as hise_render, master_only as hise_master_only
from test_hise_direct import read_wav, write_wav
from database import engine, Base
from models import Project  # noqa: F401 - enregistre la table projects avec Base
from routers.auth import router as auth_router
from routers.projects import router as projects_router
from dependencies import get_current_user

# Create the FastAPI app
app = FastAPI(
    title="SaaS Mix API",
    description="Automatic vocal mixing platform API",
    version="0.1.0"
)

# Enable CORS (Cross-Origin Resource Sharing) so frontend can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],  # Frontend URL(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Créer les tables (users, projects, etc.) au démarrage
Base.metadata.create_all(bind=engine)
app.include_router(auth_router)
app.include_router(projects_router)

# Initialize mixing service
mixing_service = MixingService()

# Dossier pour les pistes mixées (téléchargement par ID, pas par path)
MIXED_TRACKS_DIR = os.path.join(tempfile.gettempdir(), "saas_mix_mixed")
# Dossier pour le mix complet et le master (render)
RENDER_DIR = os.path.join(tempfile.gettempdir(), "saas_mix_render")
TARGET_SR = 44100


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


@app.post("/api/track/mix")
async def track_mix(
    file: UploadFile = File(..., description="WAV de la piste vocale"),
    # Paramètres optionnels (défauts = comme le CLI)
    deesser: bool = Form(True, description="Activer le de-esser"),
    noise_gate: bool = Form(True, description="Activer le noise gate"),
    delay: bool = Form(False, description="Activer le delay ping-pong"),
    bpm: float = Form(120.0, description="BPM (pour le delay)"),
    delay_division: str = Form("1/4", description="Division du delay: 1/4, 1/2, 1/8"),
    tone_low: int = Form(2, ge=1, le=3, description="Tone low 1|2|3"),
    tone_mid: int = Form(2, ge=1, le=3, description="Tone mid 1|2|3"),
    tone_high: int = Form(2, ge=1, le=3, description="Tone high 1|2|3"),
    air: str = Form("false", description="Air (shelf +2dB from 12.5kHz)"),
    reverb: bool = Form(False, description="Activer le reverb"),
    reverb_mode: int = Form(2, ge=1, le=3, description="Reverb 1=leger, 2=moyen, 3=large"),
    phone_fx: str = Form("false", description="FX téléphone (bandpass)"),
    robot: str = Form("false", description="FX robot (ring mod)"),
    doubler: str = Form("false", description="Doubler (élargissement)"),
):
    """
    Mixe une piste vocale avec la chaîne HISE (gate, VST3, de-esser, tone, delay, reverb).
    Retourne l'URL pour écouter ou télécharger la piste mixée.
    """
    if not file.filename or not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un WAV")

    os.makedirs(MIXED_TRACKS_DIR, exist_ok=True)
    mixed_id = str(uuid.uuid4())
    input_path = os.path.join(tempfile.gettempdir(), f"mix_input_{os.getpid()}_{mixed_id[:8]}.wav")
    output_path = os.path.join(MIXED_TRACKS_DIR, f"{mixed_id}.wav")

    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)

        ok = hise_render(
            input_path,
            output_path,
            deesser=deesser,
            noise_gate=noise_gate,
            delay=delay,
            bpm=bpm,
            delay_division=delay_division,
            tone_low=tone_low,
            tone_mid=tone_mid,
            tone_high=tone_high,
            air=_parse_bool_form(air),
            reverb=reverb,
            reverb_mode=reverb_mode,
            phone_fx=_parse_bool_form(phone_fx),
            robot=_parse_bool_form(robot),
            doubler=_parse_bool_form(doubler),
        )

        if not ok:
            raise HTTPException(status_code=500, detail="Le mix a échoué (chaîne HISE)")

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Fichier mixé non créé")

        return {
            "status": "success",
            "mixedTrackUrl": f"/api/download/mixed-track?id={mixed_id}",
            "message": "Piste mixée avec succès.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors du mix: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except OSError:
                pass


@app.get("/api/download/mixed-track")
async def download_mixed_track(id: str):
    """Télécharge ou lit la piste mixée (pour le player)."""
    if not re.match(r"^[a-f0-9\-]{36}$", id):
        raise HTTPException(status_code=400, detail="ID invalide")
    path = os.path.join(MIXED_TRACKS_DIR, f"{id}.wav")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Piste mixée introuvable ou expirée")
    return FileResponse(
        path,
        media_type="audio/wav",
        filename="mixed_track.wav",
    )


# --- Render mix (toutes les pistes assemblées) et Master ---

async def _build_track_paths_and_gains(track_specs: list, files: List[UploadFile]) -> tuple:
    """
    track_specs: [ { "category", "gain", "mixedTrackId"?: string }, ... ]
    files: liste de fichiers pour les pistes sans mixedTrackId (même ordre).
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


@app.post("/api/render/mix")
async def render_mix(
    current_user: dict = Depends(get_current_user),
    track_specs: str = Form(..., description="JSON array of { category, gain, mixedTrackId? }"),
    files: List[UploadFile] = File(default=[], description="WAV files for tracks without mixedTrackId"),
):
    """
    Assemble toutes les pistes (gains + vocaux mixés ou brut) en un seul WAV.
    Retourne l'URL de téléchargement du mix.
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
async def master_render(
    current_user: dict = Depends(get_current_user),
    track_specs: str = Form(..., description="JSON array of { category, gain, mixedTrackId? }"),
    files: List[UploadFile] = File(default=[], description="WAV files for tracks without mixedTrackId"),
):
    """
    Assemble les pistes en mix, applique master.vst3 (--master-only), retourne mixUrl et masterUrl.
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
async def download_render(id: str, type: str = "mix"):
    """Télécharge le mix ou le master (type=mix|master)."""
    if not re.match(r"^[a-f0-9\-]{36}$", id):
        raise HTTPException(status_code=400, detail="ID invalide")
    if type not in ("mix", "master"):
        raise HTTPException(status_code=400, detail="type doit être mix ou master")
    path = os.path.join(RENDER_DIR, f"{type}_{id}.wav")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fichier introuvable ou expiré")
    return FileResponse(
        path,
        media_type="audio/wav",
        filename=f"{type}_render.wav",
    )
