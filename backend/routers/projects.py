"""
Routes CRUD pour les projets utilisateur.
Les fichiers WAV des pistes sont stockés de façon persistante sur le disque.
"""

import json
import os
import re
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Stockage persistant : dans le dossier backend, pas dans temp
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_STORAGE = os.path.join(_BASE_DIR, "projects_storage")


def _project_dir(user_id: str, project_id: str) -> str:
    return os.path.join(PROJECTS_STORAGE, user_id, project_id)


def _track_file_path(user_id: str, project_id: str, track_id: str) -> str:
    # track_id peut contenir des caractères alphanumériques uniquement pour éviter path traversal
    safe_id = re.sub(r"[^a-zA-Z0-9\-_]", "", track_id) or "track"
    return os.path.join(_project_dir(user_id, project_id), f"{safe_id}.wav")


@router.post("")
async def create_project(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    name: str = Form(..., min_length=1, max_length=255),
    data: str = Form(..., description="JSON array des pistes (id, category, gain, mixParams, mixedAudioUrl, rawFileName)"),
    files: list[UploadFile] = File(default=[], description="Fichiers WAV dans le même ordre que les pistes ayant un fichier"),
):
    """
    Crée un projet : métadonnées en base + fichiers WAV sur disque.
    Les fichiers sont envoyés dans le même ordre que les pistes (dans data) qui ont un fichier (rawFileName non vide).
    """
    try:
        tracks_data = json.loads(data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON data invalide")
    if not isinstance(tracks_data, list):
        raise HTTPException(status_code=400, detail="data doit être un tableau de pistes")

    user_id = current_user["user_id"]
    project_id = str(uuid.uuid4())
    project_dir = _project_dir(user_id, project_id)
    os.makedirs(project_dir, exist_ok=True)

    file_index = 0
    for t in tracks_data:
        if not isinstance(t, dict) or "id" not in t:
            continue
        raw_file_name = (t.get("rawFileName") or "").strip()
        if not raw_file_name:
            continue
        if file_index >= len(files):
            break
        upload = files[file_index]
        if upload.filename and upload.filename.lower().endswith(".wav"):
            path = _track_file_path(user_id, project_id, t["id"])
            try:
                content = await upload.read()
                with open(path, "wb") as f:
                    f.write(content)
                t["hasStoredFile"] = True
            except OSError:
                pass
        file_index += 1

    # Sauvegarder les métadonnées (sans exposer de chemins serveur)
    project = Project(
        id=project_id,
        user_id=user_id,
        name=name.strip(),
        data=json.dumps(tracks_data),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {
        "id": project.id,
        "name": project.name,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "message": "Projet sauvegardé avec les fichiers.",
    }


def _project_with_file_urls(project: Project) -> dict:
    """Enrichit les pistes du projet avec rawFileUrl pour celles qui ont un fichier stocké."""
    try:
        tracks = json.loads(project.data)
    except (json.JSONDecodeError, TypeError):
        tracks = []
    if not isinstance(tracks, list):
        tracks = []
    for t in tracks:
        if isinstance(t, dict) and t.get("hasStoredFile"):
            t["rawFileUrl"] = f"/api/projects/{project.id}/files/{t.get('id', '')}"
    return {
        "id": project.id,
        "name": project.name,
        "data": tracks,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    name: str | None = Form(None, description="Nom du projet (optionnel, garde l’actuel si absent)"),
    data: str = Form(..., description="JSON array des pistes"),
    files: list[UploadFile] = File(default=[], description="Fichiers WAV dans l’ordre des pistes avec fichier"),
):
    """Met à jour un projet existant : data + fichiers. Si name fourni, renomme le projet."""
    if not re.match(r"^[a-f0-9\-]{36}$", project_id):
        raise HTTPException(status_code=400, detail="ID projet invalide")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user["user_id"],
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    try:
        tracks_data = json.loads(data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON data invalide")
    if not isinstance(tracks_data, list):
        raise HTTPException(status_code=400, detail="data doit être un tableau de pistes")

    user_id = current_user["user_id"]
    project_dir = _project_dir(user_id, project_id)
    if os.path.isdir(project_dir):
        try:
            for name_file in os.listdir(project_dir):
                p = os.path.join(project_dir, name_file)
                if os.path.isfile(p):
                    os.remove(p)
        except OSError:
            pass
    else:
        os.makedirs(project_dir, exist_ok=True)

    file_index = 0
    for t in tracks_data:
        if not isinstance(t, dict) or "id" not in t:
            continue
        raw_file_name = (t.get("rawFileName") or "").strip()
        if not raw_file_name:
            continue
        if file_index >= len(files):
            break
        upload = files[file_index]
        if upload.filename and upload.filename.lower().endswith(".wav"):
            path = _track_file_path(user_id, project_id, t["id"])
            try:
                content = await upload.read()
                with open(path, "wb") as f:
                    f.write(content)
                t["hasStoredFile"] = True
            except OSError:
                pass
        file_index += 1

    if name is not None and name.strip():
        project.name = name.strip()
    project.data = json.dumps(tracks_data)
    db.commit()
    db.refresh(project)
    return {
        "id": project.id,
        "name": project.name,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "message": "Projet mis à jour.",
    }


@router.get("")
def list_projects(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste les projets de l'utilisateur (sans les données détaillées)."""
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user["user_id"])
        .order_by(Project.created_at.desc())
        .all()
    )
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ],
    }


@router.get("/{project_id}")
def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Récupère un projet avec ses pistes et les URLs pour télécharger les fichiers WAV."""
    if not re.match(r"^[a-f0-9\-]{36}$", project_id):
        raise HTTPException(status_code=400, detail="ID projet invalide")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user["user_id"],
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return _project_with_file_urls(project)


@router.get("/{project_id}/files/{track_id}")
def get_project_track_file(
    project_id: str,
    track_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sert le fichier WAV d'une piste du projet (vérifie que le projet appartient à l'utilisateur)."""
    if not re.match(r"^[a-f0-9\-]{36}$", project_id):
        raise HTTPException(status_code=400, detail="ID projet invalide")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user["user_id"],
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    path = _track_file_path(current_user["user_id"], project_id, track_id)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Fichier piste introuvable")
    return FileResponse(
        path,
        media_type="audio/wav",
        filename=os.path.basename(path),
    )


@router.patch("/{project_id}")
async def rename_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    name: str = Form(..., min_length=1, max_length=255, description="Nouveau nom du projet"),
):
    """Renomme un projet (met à jour uniquement le nom)."""
    if not re.match(r"^[a-f0-9\-]{36}$", project_id):
        raise HTTPException(status_code=400, detail="ID projet invalide")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user["user_id"],
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    project.name = name.strip()
    db.commit()
    db.refresh(project)
    return {
        "id": project.id,
        "name": project.name,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "message": "Projet renommé.",
    }


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Supprime le projet et tous les fichiers WAV associés."""
    if not re.match(r"^[a-f0-9\-]{36}$", project_id):
        raise HTTPException(status_code=400, detail="ID projet invalide")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user["user_id"],
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    project_dir = _project_dir(current_user["user_id"], project_id)
    if os.path.isdir(project_dir):
        try:
            for name in os.listdir(project_dir):
                p = os.path.join(project_dir, name)
                if os.path.isfile(p):
                    os.remove(p)
            os.rmdir(project_dir)
        except OSError:
            pass
    db.delete(project)
    db.commit()
    return {"message": "Projet supprimé."}
