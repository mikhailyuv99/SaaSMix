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
# Price IDs Stripe par formule (créer les produits/prix dans le dashboard Stripe)
STRIPE_PRICE_STARTER = os.environ.get("STRIPE_PRICE_STARTER", "").strip()
STRIPE_PRICE_ARTISTE = os.environ.get("STRIPE_PRICE_ARTISTE", "").strip()
STRIPE_PRICE_PRO = os.environ.get("STRIPE_PRICE_PRO", "").strip()
STRIPE_PRICE_PRO_ANNUAL = os.environ.get("STRIPE_PRICE_PRO_ANNUAL", "").strip()
# Rétrocompat: ancien nom d'env
STRIPE_PRICE_ANNUAL = os.environ.get("STRIPE_PRICE_ANNUAL", "").strip() or STRIPE_PRICE_PRO_ANNUAL


@router.get("/plans")
def get_plans():
    """
    Liste des formules avec price_id Stripe (public, pour affichage et checkout).
    Seuls les plans avec price_id configuré sont retournés.
    """
    plans_monthly = []
    if STRIPE_PRICE_STARTER:
        plans_monthly.append({"id": "starter", "name": "Starter", "priceDisplay": "9,99 €", "interval": "month", "priceId": STRIPE_PRICE_STARTER})
    if STRIPE_PRICE_ARTISTE:
        plans_monthly.append({"id": "artiste", "name": "Artiste", "priceDisplay": "19,99 €", "interval": "month", "priceId": STRIPE_PRICE_ARTISTE})
    if STRIPE_PRICE_PRO:
        plans_monthly.append({"id": "pro", "name": "Pro", "priceDisplay": "29,99 €", "interval": "month", "priceId": STRIPE_PRICE_PRO})
    plan_annual = None
    if STRIPE_PRICE_PRO_ANNUAL or STRIPE_PRICE_ANNUAL:
        pid = STRIPE_PRICE_PRO_ANNUAL or STRIPE_PRICE_ANNUAL
        plan_annual = {"id": "pro_annual", "name": "Pro annuel", "priceDisplay": "269 €", "interval": "year", "priceId": pid}
    return {"plansMonthly": plans_monthly, "planAnnual": plan_annual}

# Map price_id -> plan (user.plan)
# Tout price_id inconnu (ex: ancien abo Pro avant Starter/Artiste/Pro) → "pro" = accès illimité.
def _plan_from_price_id(price_id: str) -> str:
    if not price_id:
        return "pro"
    pid = (price_id or "").strip()
    if pid == STRIPE_PRICE_STARTER:
        return "starter"
    if pid == STRIPE_PRICE_ARTISTE:
        return "artiste"
    if pid == STRIPE_PRICE_PRO or pid == STRIPE_PRICE_PRO_ANNUAL or pid == STRIPE_PRICE_ANNUAL:
        return "pro"
    # Legacy / ancien Pro / price_id non configuré → pro (illimité)
    return "pro"


class CreateSubscriptionBody(BaseModel):
    price_id: str
    payment_method_id: str


class UpdatePaymentMethodBody(BaseModel):
    payment_method_id: str


class ChangePlanBody(BaseModel):
    price_id: str


@router.get("/me")
def billing_me(
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """
    Retourne le plan. Si la BDD dit free mais Stripe a un abo actif (DB réinit, webhook raté),
    on restaure plan + ids depuis Stripe pour que l'abonnement soit toujours reconnu.
    """
    plan = (user.plan or "free").lower()
    if plan == "free" and STRIPE_SECRET:
        stripe.api_key = STRIPE_SECRET
        try:
            if user.stripe_subscription_id:
                sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
                if sub and sub.get("status") in ("active", "trialing"):
                    # Restaurer le plan depuis le price_id de l'abonnement
                    try:
                        items = sub.get("items") or {}
                        data = (items.get("data") or []) if hasattr(items, "get") else []
                        if data:
                            price = (data[0].get("price") or {}) if hasattr(data[0], "get") else {}
                            price_id = price.get("id") if hasattr(price, "get") else None
                            user.plan = _plan_from_price_id(price_id or "")
                    except (AttributeError, KeyError, TypeError, IndexError):
                        user.plan = "pro"
                    db.commit()
                    db.refresh(user)
                    plan = (user.plan or "pro").lower()
            if plan == "free" and user.stripe_customer_id:
                for status_filter in ("active", "trialing"):
                    subs = stripe.Subscription.list(
                        customer=user.stripe_customer_id, status=status_filter, limit=1
                    )
                    if subs.get("data"):
                        sub = subs["data"][0]
                        user.stripe_subscription_id = sub.get("id")
                        try:
                            items = sub.get("items") or {}
                            data = (items.get("data") or []) if hasattr(items, "get") else []
                            if data:
                                price = (data[0].get("price") or {}) if hasattr(data[0], "get") else {}
                                price_id = price.get("id") if hasattr(price, "get") else None
                                user.plan = _plan_from_price_id(price_id or "")
                            else:
                                user.plan = "pro"
                        except (AttributeError, KeyError, TypeError, IndexError):
                            user.plan = "pro"
                        db.commit()
                        db.refresh(user)
                        plan = (user.plan or "pro").lower()
                        break
            if plan == "free" and user.email:
                email = (user.email or "").strip().lower()
                if email:
                    customers = stripe.Customer.list(email=email, limit=5)
                    for cust in (customers.get("data") or []):
                        cid = cust.get("id")
                        for status_filter in ("active", "trialing"):
                            subs = stripe.Subscription.list(
                                customer=cid, status=status_filter, limit=1
                            )
                            if subs.get("data"):
                                sub = subs["data"][0]
                                user.stripe_customer_id = cid
                                user.stripe_subscription_id = sub.get("id")
                                try:
                                    items = sub.get("items") or {}
                                    data = (items.get("data") or []) if hasattr(items, "get") else []
                                    if data:
                                        price = (data[0].get("price") or {}) if hasattr(data[0], "get") else {}
                                        price_id = price.get("id") if hasattr(price, "get") else None
                                        user.plan = _plan_from_price_id(price_id or "")
                                    else:
                                        user.plan = "pro"
                                except (AttributeError, KeyError, TypeError, IndexError):
                                    user.plan = "pro"
                                db.commit()
                                db.refresh(user)
                                plan = (user.plan or "pro").lower()
                                break
                        if plan != "free":
                            break
        except stripe.StripeError:
            pass
    is_pro = plan in ("starter", "artiste", "pro")
    return {"plan": plan, "isPro": is_pro}


def _subscription_interval(sub) -> str:
    """DÃ©duit month/year depuis les items (price rÃ©current). Utiliser .get(), pas getattr, car StripeObject est dict-like et sub.items serait la mÃ©thode dict."""
    try:
        items_obj = sub.get("items") if sub else None
        if items_obj is not None:
            data = items_obj.get("data") if hasattr(items_obj, "get") else None
            if data and len(data) > 0:
                item = data[0]
                price = item.get("price") if hasattr(item, "get") else None
                if price is not None and hasattr(price, "get"):
                    recurring = price.get("recurring")
                    if recurring and (recurring.get("interval") if hasattr(recurring, "get") else None) == "year":
                        return "year"
    except (AttributeError, KeyError, TypeError, IndexError):
        pass
    return "month"


@router.get("/subscription")
def get_subscription(user: User = Depends(get_current_user_row)):
    """
    DÃ©tails de l'abonnement Stripe (pour la page "GÃ©rer mon abonnement").
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
    if not sub or sub.get("status") not in ("active", "trialing"):
        return {"subscription": None}
    interval = _subscription_interval(sub)

    # StripeObject est dict-like : utiliser .get() uniquement (getattr(sub, "items") renverrait dict.items())
    raw_end = sub.get("current_period_end")
    try:
        current_period_end = int(raw_end) if raw_end is not None else None
    except (TypeError, ValueError):
        current_period_end = None
    if not current_period_end or current_period_end <= 0:
        items_obj = sub.get("items")
        if items_obj is not None:
            data = items_obj.get("data") if hasattr(items_obj, "get") else None
            if data and len(data) > 0:
                raw_end = data[0].get("current_period_end") if hasattr(data[0], "get") else None
                try:
                    if raw_end is not None:
                        current_period_end = int(raw_end)
                except (TypeError, ValueError):
                    pass
    if not current_period_end or current_period_end <= 0:
        current_period_end = None

    # Plan actuel (starter, artiste, pro, pro_annual) pour affichage et changement
    current_plan_id = "pro"
    try:
        items_obj = sub.get("items")
        data = (items_obj.get("data") or []) if hasattr(items_obj, "get") else []
        if data:
            price = (data[0].get("price") or {}) if hasattr(data[0], "get") else {}
            price_id = price.get("id") if hasattr(price, "get") else None
            if interval == "year":
                current_plan_id = "pro_annual"
            else:
                current_plan_id = _plan_from_price_id(price_id or "")
    except (AttributeError, KeyError, TypeError, IndexError):
        pass

    return {
        "subscription": {
            "current_period_end": current_period_end,
            "cancel_at_period_end": bool(sub.get("cancel_at_period_end", False)),
            "interval": interval,
            "current_plan_id": current_plan_id,
        }
    }


@router.post("/change-plan")
def change_plan(
    body: ChangePlanBody,
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """
    Change l'abonnement vers un autre plan (upgrade/downgrade).
    Stripe prorata automatiquement. Plans acceptés : starter, artiste, pro (mensuel), pro annuel.
    """
    if not user.stripe_subscription_id or not STRIPE_SECRET:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif.")
    price_id = (body.price_id or "").strip()
    if not price_id:
        raise HTTPException(status_code=400, detail="price_id requis.")
    allowed = [p for p in (STRIPE_PRICE_STARTER, STRIPE_PRICE_ARTISTE, STRIPE_PRICE_PRO, STRIPE_PRICE_PRO_ANNUAL or STRIPE_PRICE_ANNUAL) if p]
    if not allowed or price_id not in allowed:
        raise HTTPException(status_code=400, detail="Plan non autorisé pour un changement.")
    stripe.api_key = STRIPE_SECRET
    try:
        sub = stripe.Subscription.retrieve(
            user.stripe_subscription_id,
            expand=["items.data.price"],
        )
        if not sub or sub.get("status") not in ("active", "trialing"):
            raise HTTPException(status_code=400, detail="Abonnement inactif.")
        items_data = (sub.get("items") or {}).get("data") or []
        if not items_data:
            raise HTTPException(status_code=400, detail="Aucun item d'abonnement.")
        item_id = items_data[0].get("id") if hasattr(items_data[0], "get") else None
        if not item_id:
            raise HTTPException(status_code=400, detail="Item d'abonnement invalide.")
        stripe.Subscription.modify(
            user.stripe_subscription_id,
            items=[{"id": item_id, "price": price_id}],
            proration_behavior="create_prorations",
        )
        user.plan = _plan_from_price_id(price_id)
        db.commit()
        return {"status": "ok", "plan": user.plan}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=getattr(e, "user_message", None) or str(e))


@router.post("/cancel-subscription")
def cancel_subscription(
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """Annule l'abonnement Ã  la fin de la pÃ©riode en cours (accÃ¨s conservÃ© jusqu'Ã  cette date)."""
    if not user.stripe_subscription_id or not STRIPE_SECRET:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif.")
    stripe.api_key = STRIPE_SECRET
    try:
        stripe.Subscription.modify(user.stripe_subscription_id, cancel_at_period_end=True)
        return {"status": "ok", "message": "Abonnement annulÃ©. AccÃ¨s conservÃ© jusqu'Ã  la fin de la pÃ©riode."}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(getattr(e, "user_message", e)))


@router.post("/update-payment-method")
def update_payment_method(
    body: UpdatePaymentMethodBody,
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """Met Ã  jour le moyen de paiement par dÃ©faut (carte) pour l'abonnement."""
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="Stripe non configurÃ©.")
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
        raise HTTPException(status_code=400, detail=e.user_message or "Carte refusÃ©e.")
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(getattr(e, "user_message", e)))


@router.post("/create-subscription")
def create_subscription(
    body: CreateSubscriptionBody,
    user: User = Depends(get_current_user_row),
    db: Session = Depends(get_db),
):
    """
    CrÃ©e un abonnement Stripe (mensuel ou annuel) pour l'utilisateur connectÃ©.
    Le front envoie le payment_method_id (Stripe Elements) et le price_id (mensuel ou annuel).
    L'abonnement est liÃ© au compte (stripe_customer_id, stripe_subscription_id, plan) et sera rappelÃ© Ã  chaque connexion.
    """
    if not STRIPE_SECRET:
        raise HTTPException(status_code=500, detail="Stripe non configurÃ© (STRIPE_SECRET_KEY)")
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

        # Si l'utilisateur a déjà un abonnement actif (changement de plan depuis "Gérer mon abonnement")
        if user.stripe_subscription_id:
            try:
                sub = stripe.Subscription.retrieve(
                    user.stripe_subscription_id,
                    expand=["items.data.price"],
                )
                if sub and sub.get("status") in ("active", "trialing"):
                    items_data = (sub.get("items") or {}).get("data") or []
                    if items_data:
                        item_id = items_data[0].get("id") if hasattr(items_data[0], "get") else None
                        if item_id:
                            stripe.Subscription.modify(
                                user.stripe_subscription_id,
                                items=[{"id": item_id, "price": body.price_id}],
                                default_payment_method=body.payment_method_id,
                                proration_behavior="create_prorations",
                            )
                            user.plan = _plan_from_price_id(body.price_id)
                            db.commit()
                            db.refresh(user)
                            return {"status": "success", "isPro": (user.plan or "free") != "free"}
            except stripe.StripeError:
                pass  # fallback: créer un nouvel abonnement ci-dessous

        kwargs = {
            "customer": customer_id,
            "items": [{"price": body.price_id}],
            "default_payment_method": body.payment_method_id,
            "expand": ["latest_invoice.confirmation_secret"],
            "metadata": {"saas_mix_user_id": user.id},
        }
        subscription = stripe.Subscription.create(**kwargs)

        user.stripe_subscription_id = subscription.id
        if subscription.status in ("active", "trialing"):
            user.plan = _plan_from_price_id(body.price_id)
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
        raise HTTPException(status_code=400, detail=e.user_message or "Carte refusÃ©e.")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message) if getattr(e, "user_message", None) else "Erreur Stripe.")
