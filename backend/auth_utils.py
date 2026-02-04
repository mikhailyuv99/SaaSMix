"""
Utilitaires d'authentification : hachage et vérification des mots de passe.
pbkdf2_sha256 : pas de limite de longueur, pas de dépendance à bcrypt.
"""

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
