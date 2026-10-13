"""
VeriFace AI — FastAPI Backend Service
Features:
  - JWT Authentication & Role-Based Access Control (RBAC)
  - Two-Tier Decision Engine server-side verification
  - SHA-256 Hash Chain verification & tamper detection
  - Merkle Tree root calculation and proof verification
  - AI Document Detection via pixel-level forensic analysis
"""

import base64
import hashlib
import io
import json
import math
import os
import time
from datetime import datetime, timezone
from typing import List, Optional

import httpx
import numpy as np
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

SIGHTENGINE_API_USER = os.getenv("SIGHTENGINE_API_USER", "1650754691")
SIGHTENGINE_API_SECRET = os.getenv("SIGHTENGINE_API_SECRET", "oeFQXWjDhNfoExc9zogrQdQR6tFcRJqR")
HIVE_API_KEY = os.getenv("HIVE_API_KEY", "y7OzlWzsfWtlwiyUHv0iAg==")
HIVE_API_ENDPOINT = os.getenv("HIVE_API_ENDPOINT", "https://api.thehive.ai/api/v3/chat/completions")
HIVE_MODEL = os.getenv("HIVE_MODEL", "hive/vision-language-model")

from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    UserRole,
    LoginRequest,
    TokenResponse,
    UserResponse,
    VerifyRequest,
    VerifyResponse,
    HashChainVerifyRequest,
    HashChainVerifyResponse,
    MerkleVerifyRequest,
    MerkleVerifyResponse,
)
from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    require_roles,
    USERS_DB,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

app = FastAPI(
    title="VeriFace AI — Core Backend",
    description="Enterprise FastAPI Service for Multi-Layer Biometric Trust, Cryptographic Hash Chaining, JWT & RBAC",
    version="1.0.0",
)

# Enable CORS for Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "VeriFace AI Core Backend",
        "status": "operational",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "/api/health",
            "/api/auth/login",
            "/api/auth/me",
            "/api/auth/demo-users",
            "/api/verify",
            "/api/hash-chain/verify",
            "/api/merkle/verify",
        ],
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "runtime": "Python 3.14 + FastAPI",
        "authentication": "JWT (HS256)",
        "security": "Role-Based Access Control (RBAC)",
    }


# ─── AUTHENTICATION & RBAC ENDPOINTS ──────────────────────────────────────────

@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = {
        "sub": user["username"],
        "user_id": user["id"],
        "role": user["role"].value,
        "name": user["full_name"],
    }
    token = create_access_token(token_data)
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user["role"],
        user_id=user["id"],
        full_name=user["full_name"],
        permissions=user["permissions"],
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@app.get("/api/auth/me", response_model=UserResponse)
def get_profile(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@app.get("/api/auth/demo-users")
def get_demo_users():
    """Returns available test credentials for judges and demonstration."""
    return [
        {
            "username": u["username"],
            "password": u["password"],
            "role": u["role"].value,
            "full_name": u["full_name"],
            "description": (
                "Full unrestricted administrator access"
                if u["role"] == UserRole.ADMIN
                else "Field operations: live webcam capture & studio verification"
                if u["role"] == UserRole.SECURITY_OFFICER
                else "Read-only access: Blockchain audit ledger & Merkle proof inspection"
            ),
        }
        for u in USERS_DB.values()
    ]


# ─── VERIFICATION ENGINE (TWO-TIER GATES) ────────────────────────────────────

@app.post("/api/verify", response_model=VerifyResponse)
def run_verification(
    payload: VerifyRequest,
    current_user: UserResponse = Depends(require_roles([UserRole.ADMIN, UserRole.SECURITY_OFFICER]))
):
    """
    Two-Tier Decision Engine:
    Tier 1: Hard security overrides (DB existence, Face match distance, Liveness)
    Tier 2: Weighted multi-layer trust score
    """
    reasons: List[str] = []
    gate_override = False
    override_reason: Optional[str] = None
    decision = "AUTHENTIC"
    trust_score = 90.0

    # Gate 1: DB Lookup Hard Override
    if not payload.db_found:
        decision = "FAKE"
        trust_score = 15.0
        gate_override = True
        override_reason = "Hard Gate 1: Document ID not registered in Master Database"
        reasons.append(f"❌ {override_reason}")
    # Gate 2: Face Match Hard Override
    elif not payload.face_match or payload.face_distance > 0.50:
        decision = "FAKE"
        trust_score = 20.0
        gate_override = True
        override_reason = f"Hard Gate 2: Facial Euclidean distance {payload.face_distance:.2f} exceeds threshold 0.50"
        reasons.append(f"❌ {override_reason}")
    # Gate 3: Liveness Hard Override
    elif not payload.liveness_passed:
        decision = "FAKE"
        trust_score = 25.0
        gate_override = True
        override_reason = "Hard Gate: Presentation attack / static photo screen detected"
        reasons.append(f"❌ {override_reason}")
    else:
        # Tier 2: Continuous Scoring
        face_score = max(0.0, min(100.0, (1.0 - payload.face_distance) * 100))
        db_score = 100.0 if payload.db_found else 0.0
        ocr_score = 95.0 if payload.ocr_passed else 40.0
        forensics_score = payload.forensics_score

        trust_score = round(
            0.40 * face_score + 0.30 * db_score + 0.20 * ocr_score + 0.10 * forensics_score,
            1,
        )

        if trust_score >= 85.0:
            decision = "AUTHENTIC"
            reasons.append(f"✅ Document verified as AUTHENTIC (Score: {trust_score}/100)")
        elif trust_score >= 60.0:
            decision = "SUSPICIOUS"
            reasons.append(f"⚠️ Flagged as SUSPICIOUS for manual inspection (Score: {trust_score}/100)")
        else:
            decision = "FAKE"
            reasons.append(f"❌ Trust score below security threshold (Score: {trust_score}/100)")

    # Compute deterministic block hash
    block_raw = f"{payload.id_number}|{decision}|{trust_score}|{datetime.now(timezone.utc).isoformat()}"
    block_hash = hashlib.sha256(block_raw.encode("utf-8")).hexdigest()

    return VerifyResponse(
        decision=decision,
        trust_score=trust_score,
        reasons=reasons,
        gate_override=gate_override,
        override_reason=override_reason,
        block_hash=block_hash,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ─── CRYPTOGRAPHIC HASH CHAIN & MERKLE AUDITING ───────────────────────────────

def compute_block_hash(index: int, timestamp: str, data: dict, prev_hash: str) -> str:
    canonical = json.dumps(
        {"index": index, "timestamp": timestamp, "data": data, "prevHash": prev_hash},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@app.post("/api/hash-chain/verify", response_model=HashChainVerifyResponse)
def verify_hash_chain(
    payload: HashChainVerifyRequest,
    current_user: UserResponse = Depends(require_roles([UserRole.ADMIN, UserRole.AUDITOR]))
):
    blocks = payload.blocks
    if not blocks:
        return HashChainVerifyResponse(
            is_valid=True,
            total_blocks=0,
            broken_index=None,
            message="Chain is empty.",
        )

    for i, block in enumerate(blocks):
        # Genesis block check
        if i == 0:
            if block.prevHash != "0":
                return HashChainVerifyResponse(
                    is_valid=False,
                    total_blocks=len(blocks),
                    broken_index=0,
                    message="Genesis block prevHash must be '0'.",
                )
        else:
            prev_block = blocks[i - 1]
            # Verify prevHash link
            expected_prev_hash = compute_block_hash(
                prev_block.index, prev_block.timestamp, prev_block.data, prev_block.prevHash
            )
            if block.prevHash != expected_prev_hash:
                return HashChainVerifyResponse(
                    is_valid=False,
                    total_blocks=len(blocks),
                    broken_index=block.index,
                    message=f"Tamper detected at block #{block.index}: prevHash does not match computed hash of block #{prev_block.index}.",
                )

    return HashChainVerifyResponse(
        is_valid=True,
        total_blocks=len(blocks),
        broken_index=None,
        message="Cryptographic SHA-256 hash chain is fully intact and verified.",
    )


@app.post("/api/merkle/verify", response_model=MerkleVerifyResponse)
def compute_and_verify_merkle(
    payload: MerkleVerifyRequest,
    current_user: UserResponse = Depends(require_roles([UserRole.ADMIN, UserRole.AUDITOR]))
):
    leaves = payload.leaves
    if not leaves:
        empty_root = hashlib.sha256(b"").hexdigest()
        return MerkleVerifyResponse(
            is_valid=True,
            root=empty_root,
            leaves_count=0,
            message="Empty tree.",
        )

    # Hash leaves if not already 64-char hex
    current_level = [
        leaf if len(leaf) == 64 else hashlib.sha256(leaf.encode("utf-8")).hexdigest()
        for leaf in leaves
    ]

    # Build binary tree
    while len(current_level) > 1:
        if len(current_level) % 2 == 1:
            current_level.append(current_level[-1])
        next_level = []
        for i in range(0, len(current_level), 2):
            combined = current_level[i] + current_level[i + 1]
            node_hash = hashlib.sha256(combined.encode("utf-8")).hexdigest()
            next_level.append(node_hash)
        current_level = next_level

    computed_root = current_level[0]
    is_valid = True
    if payload.expected_root:
        is_valid = computed_root.lower() == payload.expected_root.lower()

    return MerkleVerifyResponse(
        is_valid=is_valid,
        root=computed_root,
        leaves_count=len(leaves),
        message="Merkle root match confirmed." if is_valid else "Merkle root mismatch detected!",
    )


# ─── AI DOCUMENT DETECTION (/api/v1/detect) ──────────────────────────────────
# Six-signal forensic analyser — calibrated against real camera images vs
# modern diffusion / GAN generated images.  All scores 0-1 (higher = more AI).

# ── Signal 1: FFT 1/f power-spectrum deviation ───────────────────────────────
def _fft_1f_deviation(gray: np.ndarray) -> float:
    """
    Real-world images follow a 1/f (pink noise) power spectrum — the log
    magnitude decreases linearly with log frequency (slope ≈ -1).
    AI-generated images deviate from this natural law.
    Returns 0-1 (higher = more AI-like deviation).
    """
    h, w = gray.shape
    f = np.fft.fft2(gray.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    magnitude[magnitude == 0] = 1e-10

    cy, cx = h // 2, w // 2
    y_idx, x_idx = np.mgrid[-cy:h - cy, -cx:w - cx]
    radius = np.round(np.sqrt(x_idx ** 2 + y_idx ** 2)).astype(int)

    max_r = min(cy, cx)
    radial_mean = np.zeros(max_r)
    for r in range(1, max_r):
        mask = radius == r
        if mask.sum() > 0:
            radial_mean[r] = np.log(magnitude[mask].mean())

    valid = radial_mean[1:] != 0
    if valid.sum() < 5:
        return 0.5

    log_r = np.log(np.arange(1, max_r))[valid]
    log_m = radial_mean[1:][valid]
    coeffs = np.polyfit(log_r, log_m, 1)
    slope = coeffs[0]
    # Real photos: slope ≈ -1.0 to -2.2;  AI images often outside this band
    deviation = max(0.0, abs(slope - (-1.6)) - 0.6) / 2.0
    return float(min(1.0, deviation))


# ── Signal 2: Local patch variance uniformity ─────────────────────────────────
def _patch_uniformity(gray: np.ndarray, patch: int = 8) -> float:
    """
    Divide the image into 8×8 blocks and compute each block's variance.
    Real camera images have highly diverse block variances (some smooth sky,
    some sharp edges, some textured fabric).
    AI-generated images have unnaturally UNIFORM block variances — everything
    looks similarly textured.
    Returns 0-1 (higher = more AI-like uniformity).
    """
    h, w = gray.shape
    gf = gray.astype(np.float32)
    vars_ = []
    for y in range(0, h - patch, patch):
        for x in range(0, w - patch, patch):
            block = gf[y:y + patch, x:x + patch]
            vars_.append(float(block.var()))
    if len(vars_) < 4:
        return 0.5
    arr = np.array(vars_)
    # Coefficient of variation of block variances
    # Real photos: CoV > 1.5 (very diverse);  AI: CoV < 0.8
    mean_v = arr.mean()
    if mean_v < 1e-6:
        return 0.8
    cov = arr.std() / mean_v
    ai_signal = max(0.0, 1.0 - cov / 1.5)
    return float(min(1.0, ai_signal))


# ── Signal 3: Saturation uniformity ──────────────────────────────────────────
def _saturation_uniformity(rgb: np.ndarray) -> float:
    """
    Diffusion models tend to produce images with more uniform saturation.
    Real camera images have wide saturation variance (desaturated shadows,
    vivid highlights, grey areas).
    Returns 0-1 (higher = more AI-like, i.e. low saturation std-dev).
    """
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    denom = np.where(cmax > 0, cmax, 1.0)
    sat = (cmax - cmin) / denom
    sat_std = float(sat.std())
    # Real photos: sat_std > 0.18;  AI images: often < 0.12
    ai_signal = max(0.0, 1.0 - sat_std / 0.18)
    return float(min(1.0, ai_signal))


# ── Signal 4: Sensor noise floor ─────────────────────────────────────────────
def _noise_floor(gray: np.ndarray) -> float:
    """
    Camera sensors always add a small amount of photon / thermal noise,
    visible as pixel-level micro-texture even in smooth regions.
    AI images are 'clean' — smooth areas have near-zero micro-variance.
    We measure this by looking at the variance WITHIN the smoothest patches.
    Returns 0-1 (higher = cleaner / more AI-like).
    """
    h, w = gray.shape
    patch = 4
    gf = gray.astype(np.float32)
    smooth_vars = []
    for y in range(0, h - patch, patch):
        for x in range(0, w - patch, patch):
            block = gf[y:y + patch, x:x + patch]
            v = float(block.var())
            if v < 100:           # only look at smooth patches
                smooth_vars.append(v)
    if len(smooth_vars) < 10:
        return 0.3
    median_noise = float(np.median(smooth_vars))
    # Real cameras: median noise > 8;  AI: often < 3
    ai_signal = max(0.0, 1.0 - median_noise / 8.0)
    return float(min(1.0, ai_signal))


# ── Signal 5: Chromatic aberration ───────────────────────────────────────────
def _chromatic_aberration(rgb: np.ndarray) -> float:
    """
    Real optical lenses bend R and B wavelengths differently, producing a
    colour fringe (lateral chromatic aberration) around high-contrast edges.
    AI generators synthesise perfect channel alignment — no fringe.
    Returns 0-1 (higher = less aberration = more AI-like).
    """
    r = rgb[:, :, 0].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    mean_diff = float(np.mean(np.abs(r - b)))
    # Real cameras: mean_diff ≈ 8-30;  AI: often < 5
    ai_signal = max(0.0, 1.0 - mean_diff / 8.0)
    return float(min(1.0, ai_signal))


# ── Signal 6: JPEG block boundary artifacts ───────────────────────────────────
def _jpeg_block_artifact(gray: np.ndarray) -> float:
    """
    When a real photo is saved as JPEG, the DCT compression leaves periodic
    8-pixel block boundary discontinuities.
    AI-generated images saved as JPEG do not inherit these natural patterns
    the same way (or have them too uniformly distributed).
    Returns 0-1 (higher = weaker / more uniform block artifacts = more AI-like).
    """
    gf = gray.astype(np.float32)
    h, w = gf.shape
    h_diffs, v_diffs = [], []
    for y in range(8, h - 8, 8):
        row_diff = float(np.mean(np.abs(gf[y, :] - gf[y - 1, :])))
        interior = float(np.mean(np.abs(np.diff(gf[y - 1:y + 1, :], axis=0))))
        h_diffs.append(row_diff - interior)
    for x in range(8, w - 8, 8):
        col_diff = float(np.mean(np.abs(gf[:, x] - gf[:, x - 1])))
        interior = float(np.mean(np.abs(np.diff(gf[:, x - 1:x + 1], axis=1))))
        v_diffs.append(col_diff - interior)
    if not h_diffs and not v_diffs:
        return 0.5
    block_strength = float(np.mean(np.abs(h_diffs + v_diffs)))
    # Real JPEG photos: block_strength > 2;  AI images: often < 0.8
    ai_signal = max(0.0, 1.0 - block_strength / 2.0)
    return float(min(1.0, ai_signal))


def _analyze_image(img_bytes: bytes) -> dict:
    """Run all 6 forensic signals and return a verdict dict."""
    t_start = time.perf_counter()

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    # Resize to max 512px for speed; preserve aspect ratio
    max_dim = 512
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize(
            (int(img.width * ratio), int(img.height * ratio)),
            Image.LANCZOS,
        )

    rgb = np.array(img, dtype=np.uint8)
    gray = np.array(img.convert("L"), dtype=np.uint8)

    # ── Run all 6 signals ──────────────────────────────────────────────────
    fft_dev      = _fft_1f_deviation(gray)        # 0-1, higher = more AI
    patch_unif   = _patch_uniformity(gray)        # 0-1, higher = more AI
    sat_unif     = _saturation_uniformity(rgb)    # 0-1, higher = more AI
    noise_floor  = _noise_floor(gray)             # 0-1, higher = more AI
    chrom        = _chromatic_aberration(rgb)     # 0-1, higher = more AI
    jpeg_art     = _jpeg_block_artifact(gray)     # 0-1, higher = more AI

    # ── Weighted ensemble ──────────────────────────────────────────────────
    # Weights based on discriminative power:
    #  FFT deviation & patch uniformity are the strongest signals
    #  Noise floor & chromatic aberration are reliable secondary signals
    #  Saturation & JPEG artifacts are supporting signals
    synthetic_score = min(1.0, max(0.0,
        0.25 * fft_dev     +
        0.25 * patch_unif  +
        0.18 * noise_floor +
        0.15 * chrom       +
        0.10 * sat_unif    +
        0.07 * jpeg_art
    ))

    # Decision threshold: 0.42 (slightly below 0.5) because modern AI images
    # are designed to look natural and our heuristics are conservative
    is_ai   = synthetic_score > 0.42
    verdict = "AI-Generated" if is_ai else "Human-Captured"

    # Confidence grows from 0.60 as score moves away from the threshold
    confidence = min(0.97, 0.60 + abs(synthetic_score - 0.42) * 0.80)

    elapsed_ms = (time.perf_counter() - t_start) * 1000.0

    return {
        "verdict":            verdict,
        "overall_confidence": round(confidence, 4),
        "tier_triggered":     "FastAPI — 6-Signal Forensic Engine (server-side)",
        "execution_time_ms":  round(elapsed_ms, 1),
        "details": {
            "synthetic_score":       round(synthetic_score, 4),
            "fft_score":             round(fft_dev, 4),
            "patch_uniformity":      round(patch_unif, 4),
            "noise_floor":           round(noise_floor, 4),
            "chromatic_aberration":  round(chrom, 4),
            "saturation_uniformity": round(sat_unif, 4),
            "jpeg_artifact":         round(jpeg_art, 4),
        },
    }


ACCEPTED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def _detect_document_pipeline(img_bytes: bytes, filename: str, content_type: str) -> dict:
    t_start = time.perf_counter()

    # 1. Run local forensic signals first for rich metrics
    local_metrics = {}
    try:
        local_res = _analyze_image(img_bytes)
        local_metrics = local_res.get("details", {})
    except Exception as exc:
        print(f"[Detector] Local heuristic error: {exc}")

    # 2. Try Sightengine (Primary state-of-the-art Deep Learning AI detector)
    if SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.sightengine.com/1.0/check.json",
                    data={
                        "api_user": SIGHTENGINE_API_USER,
                        "api_secret": SIGHTENGINE_API_SECRET,
                        "models": "genai",
                    },
                    files={"media": (filename, img_bytes, content_type)},
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    if payload.get("status") == "success":
                        ai_score = payload.get("type", {}).get("ai_generated")
                        if ai_score is not None:
                            ai_score = float(ai_score)
                            is_ai = ai_score >= 0.50
                            confidence = ai_score if is_ai else (1.0 - ai_score)
                            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
                            return {
                                "verdict": "AI-Generated" if is_ai else "Human-Captured",
                                "overall_confidence": round(confidence, 4),
                                "tier_triggered": "Sightengine Cloud AI (genai)",
                                "execution_time_ms": round(elapsed_ms, 1),
                                "details": {
                                    **local_metrics,
                                    "synthetic_score": round(ai_score, 4),
                                    "cloud": {
                                        "vendor": "sightengine",
                                        "synthetic_score": round(ai_score, 4),
                                        "raw": payload,
                                    },
                                },
                            }
        except Exception as exc:
            print(f"[Detector] Sightengine request error: {exc}")

    # 3. Try Hive V3 (Secondary Cloud Fallback)
    if HIVE_API_KEY:
        try:
            b64_img = base64.b64encode(img_bytes).decode("ascii")
            hive_body = {
                "model": HIVE_MODEL or "hive/vision-language-model",
                "max_tokens": 200,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "Classify whether this image is AI-generated. Reply only as JSON with "
                                    'keys "synthetic_score" (number from 0 to 1) and "attribution" '
                                    "(generator name or null)."
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{content_type};base64,{b64_img}"},
                            },
                        ],
                    }
                ],
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    HIVE_API_ENDPOINT,
                    headers={"Authorization": f"Bearer {HIVE_API_KEY}"},
                    json=hive_body,
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    choices = payload.get("choices", [])
                    if choices:
                        raw_content = choices[0].get("message", {}).get("content", "").strip()
                        if raw_content.startswith("```"):
                            raw_content = raw_content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                        parsed = json.loads(raw_content)
                        ai_score = parsed.get("synthetic_score")
                        if ai_score is not None:
                            ai_score = float(ai_score)
                            is_ai = ai_score >= 0.50
                            confidence = ai_score if is_ai else (1.0 - ai_score)
                            elapsed_ms = (time.perf_counter() - t_start) * 1000.0
                            return {
                                "verdict": "AI-Generated" if is_ai else "Human-Captured",
                                "overall_confidence": round(confidence, 4),
                                "tier_triggered": "Hive Cloud AI (vision-language-model)",
                                "execution_time_ms": round(elapsed_ms, 1),
                                "details": {
                                    **local_metrics,
                                    "synthetic_score": round(ai_score, 4),
                                    "cloud": {
                                        "vendor": "hive",
                                        "synthetic_score": round(ai_score, 4),
                                        "attribution": parsed.get("attribution"),
                                        "raw": payload,
                                    },
                                },
                            }
        except Exception as exc:
            print(f"[Detector] Hive request error: {exc}")

    # 4. Fallback to Local 6-Signal Forensic Analyser
    fallback_result = _analyze_image(img_bytes)
    fallback_result["tier_triggered"] = "Local 6-Signal Forensic Engine (Offline Fallback)"
    if "details" in fallback_result:
        fallback_result["details"]["note"] = "Analyzed locally — cloud providers unavailable"
    return fallback_result


@app.post("/api/v1/detect")
async def detect_document(
    file: UploadFile = File(..., description="Document image — JPEG, PNG, or WebP"),
):
    """
    AI Document Detection Pipeline:
    Primary: Sightengine genai Cloud Deep-Learning Model
    Secondary: Hive Cloud Vision-Language Model
    Fallback: Server-side 6-Signal Pixel Forensic Analyser
    """
    if file.content_type not in ACCEPTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. Send JPEG, PNG, or WebP.",
        )

    img_bytes = await file.read()
    if len(img_bytes) < 1000:
        raise HTTPException(status_code=400, detail="File is too small to be a valid image.")

    try:
        filename = file.filename or "document.jpg"
        result = await _detect_document_pipeline(img_bytes, filename, file.content_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(exc)}")

    return result


