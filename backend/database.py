"""
Configuration base de données SQLAlchemy.
Supporte PostgreSQL (DATABASE_URL) ou SQLite par défaut pour le dev.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_default_sqlite = "sqlite:///./saas_mix.db"
_env_url = os.getenv("DATABASE_URL", "").strip()
if _env_url:
    DATABASE_URL = _env_url
else:
    # Chemin absolu pour que le fichier soit toujours dans le dossier backend
    _here = os.path.dirname(os.path.abspath(__file__))
    _db_path = os.path.join(_here, "saas_mix.db").replace("\\", "/")
    DATABASE_URL = f"sqlite:///{_db_path}"

# SQLite a besoin de connect_args pour permettre le multithread
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dépendance FastAPI : session DB à fermer après la requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
