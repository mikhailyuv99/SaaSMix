"""
Téléchargement des binaires HISE (host + VST3 Linux) depuis Cloudflare R2.
Utilisé en production (Render/Linux) pour avoir la même chaîne qu’en local.
"""
import os
import sys
import zipfile
import tempfile
from pathlib import Path

# Préfixe des objets dans le bucket R2 (ex: vst_linux/)
R2_VST_PREFIX = os.environ.get("R2_VST_PREFIX", "vst_linux").strip("/")
if R2_VST_PREFIX:
    R2_VST_PREFIX = R2_VST_PREFIX + "/"

# Objets à télécharger : binaire host + archives .zip des VST3 (décompressées en .vst3/)
# Tu peux surcharger via R2_VST_OBJECTS (séparés par des virgules) si besoin.
_DEFAULT_OBJECTS = [
    "hise_vst3_host",
    "GlobalMix.vst3.zip",
    "Project1.vst3.zip",
    "eq1.vst3.zip",
    "eq2.vst3.zip",
    "eq3.vst3.zip",
    "eq4.vst3.zip",
    "eq5.vst3.zip",
    "eq6.vst3.zip",
    "eq7.vst3.zip",
    "eq8.vst3.zip",
    "eq9.vst3.zip",
    "master.vst3.zip",
    "reverb1.vst3.zip",
    "reverb2.vst3.zip",
    "reverb3new.vst3.zip",
    "doubler.vst3.zip",
    "robot.vst3.zip",
]


def _get_objects_to_download():
    raw = os.environ.get("R2_VST_OBJECTS")
    if raw:
        return [k.strip() for k in raw.split(",") if k.strip()]
    return _DEFAULT_OBJECTS


def _r2_client():
    """Client boto3 S3-compatible pour Cloudflare R2."""
    import boto3
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account_id and access_key and secret_key):
        return None
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def _base_dir():
    """Dossier local où sont extraits les binaires Linux (côté Render)."""
    default = Path(tempfile.gettempdir()) / "saas_mix_vst_linux"
    return Path(os.environ.get("VST_LINUX_DIR", str(default)))


def _ensure_base_dir():
    d = _base_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _download_asset(client, bucket: str, key: str, dest_path: Path) -> bool:
    try:
        client.download_file(bucket, key, str(dest_path))
        return True
    except Exception as e:
        print(f"[R2] Erreur téléchargement {key}: {e}")
        return False


def ensure_r2_assets() -> bool:
    """
    Télécharge depuis R2 les binaires Linux (host + VST3) et les extrait.
    À appeler au démarrage en production (Linux) si R2 est configuré.
    Retourne True si tout est prêt, False sinon (pas d’erreur fatale si R2 non configuré).
    """
    if sys.platform != "linux":
        return False
    client = _r2_client()
    bucket = os.environ.get("R2_BUCKET_NAME")
    if not client or not bucket:
        return False
    base = _ensure_base_dir()
    objects = _get_objects_to_download()
    for name in objects:
        key = R2_VST_PREFIX + name
        dest = base / name
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not _download_asset(client, bucket, key, dest):
            return False
        if name.endswith(".zip"):
            extract_dir = base / name.replace(".zip", "")
            if not extract_dir.exists():
                with zipfile.ZipFile(dest, "r") as zf:
                    zf.extractall(base)
            # optionnel : supprimer le zip après extraction pour gagner de la place
        elif name == "hise_vst3_host":
            dest.chmod(0o755)
    return True


def get_vst_linux_base() -> Path | None:
    """
    Retourne le dossier de base des VST Linux (après téléchargement R2)
    ou None si on n’est pas sur Linux ou R2 non utilisé.
    """
    if sys.platform != "linux":
        return None
    if not os.environ.get("R2_ACCOUNT_ID") or not os.environ.get("R2_BUCKET_NAME"):
        return None
    base = _base_dir()
    host = base / "hise_vst3_host"
    if not host.exists():
        return None
    return base


def get_linux_host_path() -> Path | None:
    """Chemin vers l’exécutable hise_vst3_host sur Linux (après sync R2)."""
    base = get_vst_linux_base()
    if not base:
        return None
    exe = base / "hise_vst3_host"
    return exe if exe.exists() else None


def get_linux_vst_path(plugin_name: str) -> Path | None:
    """
    Chemin vers un VST3 Linux (dossier .vst3 ou fichier).
    plugin_name: ex. "Project1", "master", "reverb1", "reverb2", "reverb3new", "doubler", "robot"
    """
    base = get_vst_linux_base()
    if not base:
        return None
    # Noms possibles : Project1.vst3, master.vst3, reverb3new.vst3, etc.
    folder = base / f"{plugin_name}.vst3"
    if folder.exists():
        return folder
    return None
