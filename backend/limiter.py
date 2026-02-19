"""
Rate limiter for the API. Authenticated users are limited per user_id, others per IP.
Protects expensive and auth endpoints; avoids sharing a single IP limit across multiple users.
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from jwt_utils import decode_access_token


def get_rate_limit_key(request: Request) -> str:
    """Clé de rate limit : user:id si token JWT valide, sinon IP (robustesse multi-utilisateurs)."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and str(auth).strip().lower().startswith("bearer "):
        token = str(auth).strip()[7:].strip()
        if token:
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                return f"user:{payload['sub']}"
    return get_remote_address(request)


# Par user/IP : ~120 req/min par mix (polling status 500ms) → 720/min permet 6 mixes en parallèle + reste de l'API
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["720/minute"],
)
