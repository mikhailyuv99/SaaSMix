"""
Modèles SQLAlchemy pour SaaS Mix.
"""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # SQLite gère mal timezone=True, on utilise DateTime simple
    created_at = Column(DateTime(), server_default=func.now())


class Project(Base):
    """Projet utilisateur : nom + données des pistes (JSON). Les fichiers WAV sont stockés sur disque."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    data = Column(Text, nullable=False)  # JSON: array of track metadata (id, category, gain, mixParams, mixedAudioUrl, rawFileName)
    created_at = Column(DateTime(), server_default=func.now())
