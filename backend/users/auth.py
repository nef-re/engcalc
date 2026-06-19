import os
from datetime import datetime, timedelta, timezone

import jwt
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password
from django.http import HttpRequest
from ninja.errors import HttpError

User = get_user_model()

JWT_SECRET = os.getenv("JWT_SECRET", "engcalc-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72


def create_token(user) -> str:
    payload = {
        "user_id": user.id,
        "username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise HttpError(401, "Invalid or expired token") from e


def get_user_from_request(request: HttpRequest):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = decode_token(token)
        return User.objects.filter(pk=payload["user_id"], is_active=True).first()
    except HttpError:
        return None


def require_auth(request: HttpRequest):
    user = get_user_from_request(request)
    if not user:
        raise HttpError(401, "Authentication required")
    return user


def register_user(username: str, email: str, password: str):
    if User.objects.filter(username=username).exists():
        raise HttpError(400, "Username already taken")
    if email and User.objects.filter(email=email).exists():
        raise HttpError(400, "Email already registered")
    return User.objects.create(
        username=username,
        email=email,
        password=make_password(password),
    )


def login_user(username: str, password: str):
    user = authenticate(username=username, password=password)
    if not user:
        raise HttpError(401, "Invalid credentials")
    return user
