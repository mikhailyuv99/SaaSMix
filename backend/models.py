"""
Modèles SQLAlchemy pour SaaS Mix.
"""

from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # SQLite gère mal timezone=True, on utilise DateTime simple
    created_at = Column(DateTime(), server_default=func.now())
