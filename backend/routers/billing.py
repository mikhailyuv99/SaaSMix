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


def _subscription_interval(sub) -> str:
    """Déduit month/year depuis les items (price récurrent)."""
    try:
        if getattr(sub, "items", None) and getattr(sub.items, "data", None) and len(sub.items.data) > 0:
            item = sub.items.data[0]
            price = getattr(item, "price", None)
            if price is not None:
                recurring = getattr(price, "recurring", None)
                if recurring and getattr(recurring, "interval", None) == "year":
                    return "year"
    except (AttributeError, KeyError, TypeError, IndexError):
        pass
    return "month"


@router.get("/subscription")
def get_subscription(user: User = Depends(get_current_user_row)):
    """
    Détails de l'abonnement Stripe (pour la page "Gérer mon abonnement").
    Retourne current_period_end, cancel_at_period_end, interval (month|year).
    """
    if not user.stripe_subscription_id or not STRIPE_SECRET:
        return {"subscription": None}
    stripe.api_key = STRIPE_SECRET
    sub = None
    try:
        sub = stripe.Subscription.retrieve(
            user.stripe_subscription_id,
            expand=["items.data.price"],
        )
    except stripe.StripeError:
        try:
            sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
        except stripe.StripeError:
            return {"subscription": None}
    if not sub or getattr(sub, "status", None) not in ("active", "trialing"):
        return {"subscription": None}
    interval = _subscription_interval(sub)
    raw_end = getattr(sub, "current_period_end", None)
    if raw_end is None and hasattr(sub, "get"):
        raw_end = sub.get("current_period_end")
    try:
        current_period_end = int(raw_end) if raw_end is not None else None
    except (TypeError, ValueError):
        current_period_end = None
    if not current_period_end or current_period_end <= 0:
        current_period_end = None
    return {
        "subscription": {
            "current_period_end": current_period_end,
            "cancel_at_period_end": bool(getattr(sub, "cancel_at_period_end", False)),
            "interval": interval,
        }
    }


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
            "expand": ["latest_invoice.confirmation_secret"],
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
            client_secret = None
            inv = subscription.latest_invoice
            # Nouvelle API Stripe (2025+) : invoice.confirmation_secret.client_secret
            try:
                confirmation_secret = getattr(inv, "confirmation_secret", None) if inv else None
                if confirmation_secret:
                    client_secret = getattr(confirmation_secret, "client_secret", None) or (confirmation_secret.get("client_secret") if isinstance(confirmation_secret, dict) else None)
            except (KeyError, AttributeError, TypeError):
                pass
            # Fallback : invoice.payments.data[0].payment.payment_intent (ancienne structure ou expand)
            if not client_secret and getattr(inv, "payments", None) and getattr(inv.payments, "data", None) and len(inv.payments.data) > 0:
                first_payment = inv.payments.data[0]
                payment = getattr(first_payment, "payment", None) if first_payment else None
                if payment:
                    pi = getattr(payment, "payment_intent", None) or (payment.get("payment_intent") if isinstance(payment, dict) else None)
                    if pi:
                        client_secret = getattr(pi, "client_secret", None) or (pi.get("client_secret") if isinstance(pi, dict) else None)
            if client_secret:
                return {"status": "requires_action", "client_secret": client_secret}

        return {"status": "success", "isPro": user.plan == "pro"}
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Carte refusée.")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message) if getattr(e, "user_message", None) else "Erreur Stripe.")
