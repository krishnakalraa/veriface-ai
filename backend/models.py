"""
VeriFace AI — Pydantic Schemas & Data Models
"""

from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SECURITY_OFFICER = "SECURITY_OFFICER"
    AUDITOR = "AUDITOR"


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    full_name: str
    permissions: List[str]
    expires_in: int


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: UserRole
    permissions: List[str]


class VerifyRequest(BaseModel):
    mode: str = "campus"  # campus | toll | checkpoint
    id_number: Optional[str] = None
    full_name: Optional[str] = None
    dob: Optional[str] = None
    face_match: bool = False
    face_distance: float = 0.45
    liveness_passed: bool = True
    forensics_score: float = 90.0
    ocr_passed: bool = True
    db_found: bool = True


class VerifyResponse(BaseModel):
    decision: str  # AUTHENTIC | SUSPICIOUS | FAKE
    trust_score: float
    reasons: List[str]
    gate_override: bool
    override_reason: Optional[str] = None
    block_hash: str
    timestamp: str


class BlockData(BaseModel):
    trustScore: float
    decision: str
    idNumber: Optional[str] = None
    name: Optional[str] = None
    recordId: Optional[str] = None
    mismatchedFields: List[str] = []


class BlockModel(BaseModel):
    index: int
    timestamp: str
    data: Dict[str, Any]
    prevHash: str
    hash: Optional[str] = None


class HashChainVerifyRequest(BaseModel):
    blocks: List[BlockModel]


class HashChainVerifyResponse(BaseModel):
    is_valid: bool
    total_blocks: int
    broken_index: Optional[int] = None
    message: str


class MerkleVerifyRequest(BaseModel):
    leaves: List[str]
    expected_root: Optional[str] = None


class MerkleVerifyResponse(BaseModel):
    is_valid: bool
    root: str
    leaves_count: int
    message: str
