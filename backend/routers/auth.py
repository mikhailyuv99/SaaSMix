"""
Routes d'authentification : inscription et connexion.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas_auth import UserCreate, UserLogin, UserResponse, TokenResponse
from auth_utils import hash_password, verify_password
from jwt_utils import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """
    Création d'un compte utilisateur.
    Email unique, mot de passe haché en bcrypt.
    """
    try:
        existing = db.query(User).filter(User.email == data.email.lower()).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Un compte existe déjà avec cette adresse e-mail."
            )
        if len(data.password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Le mot de passe doit contenir au moins 8 caractères."
            )
        user = User(
            id=str(uuid.uuid4()),
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la création du compte : {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """
    Connexion : email + mot de passe. Retourne un token JWT et les infos utilisateur.
    """
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="E-mail ou mot de passe incorrect."
        )
    token = create_access_token(data={"sub": user.id, "email": user.email})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
