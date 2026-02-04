"""
Dépendances FastAPI : authentification (JWT) pour protéger les routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jwt_utils import decode_access_token

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
