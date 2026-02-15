"""
Modèles SQLAlchemy pour SaaS Mix.
"""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.sql import func
from database import Base


# Limites par plan : (mix par mois, master par mois). None = illimité.
PLAN_LIMITS = {
    "starter": (10, 3),
    "artiste": (30, 15),
    "pro": (None, None),
}

# Limite de projets sauvegardés par plan. None = illimité.
PLAN_PROJECT_LIMIT = {"starter": 5, "artiste": 15, "pro": None}


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # SQLite gère mal timezone=True, on utilise DateTime simple
    created_at = Column(DateTime(), server_default=func.now())
    # Billing: plan = free | starter | artiste | pro (lié au compte)
    plan = Column(String(32), nullable=False, default="free")
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    # Usage mensuel pour limites téléchargements (remis à zéro chaque mois)
    usage_month = Column(String(7), nullable=True)  # "YYYY-MM"
    mix_downloads_count = Column(Integer, nullable=False, default=0)
    master_downloads_count = Column(Integer, nullable=False, default=0)


class Project(Base):
    """Projet utilisateur : nom + données des pistes (JSON). Les fichiers WAV sont stockés sur disque."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    data = Column(Text, nullable=False)  # JSON: array of track metadata (id, category, gain, mixParams, mixedAudioUrl, rawFileName)
    created_at = Column(DateTime(), server_default=func.now())
