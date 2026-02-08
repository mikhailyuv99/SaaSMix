"""
Dépendances FastAPI : authentification (JWT) pour protéger les routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from jwt_utils import decode_access_token
from models import User

# Le client doit envoyer: Authorization: Bearer <token>
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Vérifie le JWT et retourne les infos utilisateur (user_id, email).
    Utiliser comme dépendance sur les routes qui nécessitent d'être connecté.
    """
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise. Connectez-vous.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré. Reconnectez-vous.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "user_id": payload["sub"],
        "email": payload.get("email", ""),
    }


def get_current_user_row(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> User:
    """Retourne l'utilisateur en base (pour accéder à plan, stripe_*)."""
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    return user
