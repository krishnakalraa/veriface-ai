/**
 * VeriFace AI — Layer 6a: Decision Engine
 *
 * Implements the two-tier decision logic:
 *
 * Tier 1 — Hard-Override Gates (checked first):
 *   1. IF dbCheck.found === false → FAKE ("ID number not found in database")
 *   2. IF any live/document/database face pair mismatches or liveness fails → FAKE
 *
 * Tier 2 — Weighted Trust Score (if no hard-override triggered):
 *   trustScore = forensicsScore × W_f + ocrConfidence × W_o + fieldMatchScore × W_d
 *   ≥ 85 → AUTHENTIC
 *   60–84 → SUSPICIOUS
 *   < 60 → FAKE
 *
 * Also generates a human-readable reasons array (key pitch differentiator:
 * transparent decisioning) and writes the result to Supabase verification_logs.
 */

import { supabase } from './supabase'
import { FACE_MATCH_THRESHOLD } from './faceMatch'

/**
 * Compute the final verification decision.
 *
 * @param {object} forensicsResult — { forensicsScore, issues[] }
 * @param {object} ocrResult       — { ocrConfidence, name, dob, idNumber, ... }
 * @param {object} dbResult        — { found, matchedRecord, mismatchedFields[], fieldMatchScore }
 * @param {object} faceResult      — { threeWayMatch, faceMatch, comparisons, distance, livenessPass, details }
 * @param {object} modeConfig      — active mode config from modes.js
 * @returns {Promise<{
 *   trustScore: number,
 *   decision: 'AUTHENTIC'|'SUSPICIOUS'|'FAKE',
 *   reasons: string[],
 *   mismatchedFields: string[],
 *   verificationLog: object
 * }>}
 */
export async function computeDecision(forensicsResult, ocrResult, dbResult, faceResult, modeConfig) {
  const reasons = []
  const mismatchedFields = []

  // ─── Tier 1: Hard-Override Gates ────────────────────────────────────────

  // Gate 1: Database record not found
  if (!dbResult.found) {
    reasons.push(`❌ ID number "${ocrResult.idNumber || '(not extracted)'}" not found in database`)
    mismatchedFields.push('id_number (not in database)')

    const result = {
      trustScore: 0,
      decision: 'FAKE',
      reasons,
      mismatchedFields,
    }

    const log = await writeVerificationLog(result, dbResult)
    return { ...result, verificationLog: log }
  }

  // Gate 2: Independently require actual passing distances for all three face pairs.
  const requiredPairs = ['liveToDocument', 'liveToDatabase', 'documentToDatabase']
  const comparisons = faceResult.comparisons
  const failedPairs = requiredPairs.filter(pair =>
    !comparisons ||
    typeof comparisons[pair] !== 'number' ||
    !Number.isFinite(comparisons[pair]) ||
    comparisons[pair] >= FACE_MATCH_THRESHOLD
  )
  const hasVerifiedThreeWayMatch =
    faceResult.simulated !== true &&
    faceResult.threeWayMatch === true &&
    faceResult.faceMatch === true &&
    failedPairs.length === 0

  if (!hasVerifiedThreeWayMatch) {
    const pairFailure = failedPairs.length
      ? `Failed or missing pairs: ${failedPairs.join(', ')}.`
      : 'Face result was simulated or did not confirm all three comparisons.'
    reasons.push(`❌ Three-way face verification failed: ${pairFailure} ${faceResult.details || ''}`.trim())
    mismatchedFields.push(...failedPairs.map(pair => `face mismatch: ${pair}`))
    if (!failedPairs.length) mismatchedFields.push('three_way_face_match')
    const result = {
      trustScore: 0,
      decision: 'FAKE',
      reasons,
      mismatchedFields: [...mismatchedFields, ...(dbResult.mismatchedFields || [])],
    }
    const log = await writeVerificationLog(result, dbResult)
    return { ...result, verificationLog: log }
  }

  if (!faceResult.livenessPass) {
    reasons.push(
      `❌ Liveness check failed: ${faceResult.livenessDetails}`
    )
    mismatchedFields.push('liveness')

    const result = {
      trustScore: 0,
      decision: 'FAKE',
      reasons,
      mismatchedFields: [...mismatchedFields, ...(dbResult.mismatchedFields || [])],
    }
    const log = await writeVerificationLog(result, dbResult)
    return { ...result, verificationLog: log }
  }

  // ─── Tier 2: Weighted Trust Score ───────────────────────────────────────

  const weights = modeConfig.weights || { forensics: 0.20, ocr: 0.30, db: 0.50 }

  const forensicsScore = forensicsResult.forensicsScore || 0
  const ocrConfidence = ocrResult.ocrConfidence || 0
  const fieldMatchScore = dbResult.fieldMatchScore || 0

  let baseTrustScore = Math.round(
    forensicsScore * weights.forensics +
    ocrConfidence * weights.ocr +
    fieldMatchScore * weights.db
  )

  // Biometric fidelity bonus: high-confidence biometric match (distance < 0.35) with verified liveness
  let biometricBonus = 0
  if (
    faceResult.faceMatch &&
    faceResult.livenessPass &&
    typeof faceResult.distance === 'number' &&
    faceResult.distance < 0.35
  ) {
    biometricBonus = 5
  }

  const trustScore = Math.min(100, baseTrustScore + biometricBonus)

  // Add component breakdown to reasons
  reasons.push(
    `📊 Forensics score: ${forensicsScore}/100 (weight: ${(weights.forensics * 100).toFixed(0)}%)`
  )
  reasons.push(
    `📊 OCR confidence: ${ocrConfidence}/100 (weight: ${(weights.ocr * 100).toFixed(0)}%)`
  )
  reasons.push(
    `📊 Field match score: ${fieldMatchScore}/100 (weight: ${(weights.db * 100).toFixed(0)}%)`
  )

  // Add forensics issues
  if (forensicsResult.issues && forensicsResult.issues.length > 0) {
    forensicsResult.issues.forEach(issue => {
      reasons.push(`⚠️ Forensics: ${issue}`)
    })
  }

  // Add field mismatches
  if (dbResult.mismatchedFields && dbResult.mismatchedFields.length > 0) {
    dbResult.mismatchedFields.forEach(m => {
      reasons.push(`⚠️ ${m}`)
      mismatchedFields.push(m)
    })
  }

  // Add face match details
  if (faceResult.faceMatch) {
    const pairDetails = Object.entries(faceResult.comparisons || {})
      .map(([pair, distance]) => `${pair}: ${distance.toFixed(3)}`)
      .join(', ')
    reasons.push(`✅ All three face pairs matched (threshold: ${FACE_MATCH_THRESHOLD}; ${pairDetails})`)
  }
  if (faceResult.livenessPass) {
    reasons.push(`✅ Liveness: ${faceResult.livenessDetails}`)
  }
  if (faceResult.simulated) {
    reasons.push(`ℹ️ Note: Face analysis was simulated — download models for real comparison`)
  }

  // Determine decision
  let decision
  if (trustScore >= 85) {
    decision = 'AUTHENTIC'
    reasons.unshift(`✅ Document verified as AUTHENTIC (trust score: ${trustScore}/100)`)
  } else if (trustScore >= 60) {
    decision = 'SUSPICIOUS'
    reasons.unshift(`⚠️ Document flagged as SUSPICIOUS (trust score: ${trustScore}/100)`)
  } else {
    decision = 'FAKE'
    reasons.unshift(`❌ Document flagged as FAKE (trust score: ${trustScore}/100)`)
  }

  const result = { trustScore, decision, reasons, mismatchedFields }
  const log = await writeVerificationLog(result, dbResult)

  return { ...result, verificationLog: log }
}

// ─── Write to Supabase verification_logs ────────────────────────────────────

async function writeVerificationLog(result, dbResult) {
  const logEntry = {
    record_id: dbResult.matchedRecord?.id || null,
    trust_score: result.trustScore,
    decision: result.decision,
    mismatched_fields: result.mismatchedFields,
    record_hash: '', // Will be set by hashChain after this function
    blockchain_anchor_tx: null,
    timestamp: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('verification_logs')
      .insert(logEntry)
      .select()
      .single()

    if (error) {
      console.error('Failed to write verification log:', error)
      return { ...logEntry, id: null, _writeError: error.message }
    }

    return data
  } catch (err) {
    console.error('Verification log write exception:', err)
    return { ...logEntry, id: null, _writeError: err.message }
  }
}
