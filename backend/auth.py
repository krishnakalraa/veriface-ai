"""
VeriFace AI — JWT Authentication & Role-Based Access Control (RBAC)
"""

import os
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import jwt
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models import UserRole, UserResponse

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "veriface-ai-secret-key-blockchain-cybersecurity-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security = HTTPBearer(auto_error=False)

# Seed Users with Role-Based Access Control (RBAC)
USERS_DB = {
    "admin": {
        "id": "usr_adm_001",
        "username": "admin",
        "password": "admin123",
        "full_name": "System Administrator",
        "role": UserRole.ADMIN,
        "permissions": ["all", "manage_registry", "verify", "view_ledger", "tamper_lab", "export"],
    },
    "officer": {
        "id": "usr_off_002",
        "username": "officer",
        "password": "guard123",
        "full_name": "Chief Inspector Sharma",
        "role": UserRole.SECURITY_OFFICER,
        "permissions": ["verify", "live_capture", "view_lab"],
    },
    "auditor": {
        "id": "usr_aud_003",
        "username": "auditor",
        "password": "audit123",
        "full_name": "Forensic Compliance Auditor",
        "role": UserRole.AUDITOR,
        "permissions": ["view_ledger", "verify_merkle", "audit_read_only", "export"],
    },
}


def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = USERS_DB.get(username.lower())
    if not user:
        return None
    if user["password"] != password:
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "veriface-ai-auth",
    })
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], issuer="veriface-ai-auth")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT token has expired. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid JWT token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> UserResponse:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing. JWT token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username or username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User identity in JWT token not found in registry.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = USERS_DB[username]
    return UserResponse(
        id=user["id"],
        username=user["username"],
        full_name=user["full_name"],
        role=user["role"],
        permissions=user["permissions"],
    )


def require_roles(allowed_roles: List[UserRole]):
    """
    Role-Based Access Control (RBAC) Dependency Factory.
    Enforces that the authenticated user possesses one of the allowed roles.
    """
    async def role_checker(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of {[r.value for r in allowed_roles]}. Current role: {current_user.role.value}",
            )
        return current_user
    return role_checker
