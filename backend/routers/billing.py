"""
Routes billing : abonnement Pro (Stripe), plan utilisateur, liaison au compte.
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import stripe
from database import get_db
from models import User
from dependencies import get_current_user_row

router = APIRouter(prefix="/api/billing", tags=["billing"])

STRIPE_SECRET = os.environ.get("STRIPE_SECRET_KEY", "").strip()
# Price ID annuel : essai 3 jours uniquement pour l'annuel
STRIPE_PRICE_ANNUAL = os.environ.get("STRIPE_PRICE_ANNUAL", "").strip()


class CreateSubscriptionBody(BaseModel):
    price_id: str
    payment_method_id: str


class UpdatePaymentMethodBody(BaseModel):
    payment_method_id: str


@router.get("/me")
def billing_me(user: User = Depends(get_current_user_row)):
    """
    Retourne le plan de l'utilisateur connecté.
    Utilisé au chargement et après souscription pour mettre à jour l'UI sans refresh.
    """
    return {
        "plan": user.plan or "free",
        "isPro": (user.plan or "free") == "pro",
    }


@router.get("/subscription")
def get_subscription(user: User = Depends(get_current_user_row)):
    """
    Détails de l'abonnement Stripe (pour la page "Gérer mon abonnement").
    Retourne current_period_end, cancel_at_period_end, interval (month|year).
    """
    if not user.stripe_subscription_id or not STRIPE_SECRET:
        return {"subscription": None}
    stripe.api_key = STRIPE_SECRET
    try:
        sub = stripe.Subscription.retrieve(
            user.stripe_subscription_id,
            expand=["items.data.price"],
        )
        if sub.status not in ("active", "trialing"):
            return {"subscription": None}
        item = sub.items.data[0] if sub.items.data else None
        price = item.price if item and getattr(item, "price", None) else None
        interval = "year" if price and getattr(price, "recurring", None) and getattr(price.recurring, "interval", None) == "year" else "month"
        return {
            "subscription": {
                "current_period_end": sub.current_period_end,
                "cancel_at_period_end": sub.cancel_at_period_end,
                "interval": interval,
            }
        }
    except stripe.StripeError:
        return {"subscription": None}


@router.post("/cancel-subscription")
def cancel_subscription(
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """Annule l'abonnement à la fin de la période en cours (accès conservé jusqu'à cette date)."""
    if not user.stripe_subscription_id or not STRIPE_SECRET:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif.")
    stripe.api_key = STRIPE_SECRET
    try:
        stripe.Subscription.modify(user.stripe_subscription_id, cancel_at_period_end=True)
        return {"status": "ok", "message": "Abonnement annulé. Accès conservé jusqu'à la fin de la période."}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(getattr(e, "user_message", e)))


@router.post("/update-payment-method")
def update_payment_method(
    body: UpdatePaymentMethodBody,
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """Met à jour le moyen de paiement par défaut (carte) pour l'abonnement."""
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="Stripe non configuré.")
    stripe.api_key = STRIPE_SECRET
    customer_id = user.stripe_customer_id
    if not customer_id:
        raise HTTPException(status_code=400, detail="Aucun compte de facturation.")
    try:
        stripe.PaymentMethod.attach(body.payment_method_id, customer=customer_id)
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": body.payment_method_id},
        )
        if user.stripe_subscription_id:
            stripe.Subscription.modify(
                user.stripe_subscription_id,
                default_payment_method=body.payment_method_id,
            )
        return {"status": "ok"}
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Carte refusée.")
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(getattr(e, "user_message", e)))


@router.post("/create-subscription")
def create_subscription(
    body: CreateSubscriptionBody,
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """
    Crée un abonnement Stripe (mensuel ou annuel) pour l'utilisateur connecté.
    Le front envoie le payment_method_id (Stripe Elements) et le price_id (mensuel ou annuel).
    L'abonnement est lié au compte (stripe_customer_id, stripe_subscription_id, plan) et sera rappelé à chaque connexion.
    """
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="Stripe non configuré (STRIPE_SECRET_KEY)")
    stripe.api_key = STRIPE_SECRET

    try:
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                metadata={"saas_mix_user_id": user.id},
            )
            customer_id = customer.id
            user.stripe_customer_id = customer_id
            db.commit()

        stripe.PaymentMethod.attach(
            body.payment_method_id,
            customer=customer_id,
        )
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": body.payment_method_id},
        )

        kwargs = {
            "customer": customer_id,
            "items": [{"price": body.price_id}],
            "default_payment_method": body.payment_method_id,
            "expand": ["latest_invoice.payment_intent"],
            "metadata": {"saas_mix_user_id": user.id},
        }
        if STRIPE_PRICE_ANNUAL and body.price_id == STRIPE_PRICE_ANNUAL:
            kwargs["trial_period_days"] = 3
        subscription = stripe.Subscription.create(**kwargs)

        user.stripe_subscription_id = subscription.id
        if subscription.status in ("active", "trialing"):
            user.plan = "pro"
        db.commit()
        db.refresh(user)

        if subscription.status == "incomplete" and subscription.latest_invoice:
            payment_intent = subscription.latest_invoice.payment_intent
            if isinstance(payment_intent, dict):
                client_secret = payment_intent.get("client_secret")
                status_pi = payment_intent.get("status")
            else:
                client_secret = getattr(payment_intent, "client_secret", None)
                status_pi = getattr(payment_intent, "status", None)
            if status_pi == "requires_action" and client_secret:
                return {"status": "requires_action", "client_secret": client_secret}

        return {"status": "success", "isPro": user.plan == "pro"}
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Carte refusée.")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message) if getattr(e, "user_message", None) else "Erreur Stripe.")
