/**
 * VeriFace AI — Operational Mode Configurations
 *
 * Each mode defines:
 *   - template: normalized (0–1) bounding-box regions expected on the document
 *     (used by the forensics heuristic in Layer 2)
 *   - dbFieldsExpected: which Supabase `people` fields must match
 *   - weights: scoring weights for forensics / OCR / DB in the trust-score formula
 */

export const MODES = {
  campus: {
    id: 'campus',
    label: 'Campus',
    icon: '🎓',
    description: 'Verify student/staff ID cards against institutional records',
    template: {
      // Normalized bounding boxes: { x, y, w, h } in 0–1 range
      photoBox:  { x: 0.05, y: 0.15, w: 0.30, h: 0.50 },
      textBlock: { x: 0.38, y: 0.10, w: 0.58, h: 0.55 },
      logoArea:  { x: 0.35, y: 0.02, w: 0.30, h: 0.12 },
      barcode:   { x: 0.10, y: 0.75, w: 0.80, h: 0.15 },
    },
    expectedAspectRatio: 1.586, // standard CR-80 card ≈ 85.6 × 54 mm
    aspectRatioTolerance: 0.25,
    dbFieldsExpected: ['id_number', 'full_name', 'dob'],
    weights: { forensics: 0.15, ocr: 0.25, db: 0.60 },
  },

  tollgate: {
    id: 'tollgate',
    label: 'Toll Gate',
    icon: '🚗',
    description: 'Rapid vehicle pass / driving license verification at toll booths',
    template: {
      photoBox:  { x: 0.02, y: 0.20, w: 0.28, h: 0.55 },
      textBlock: { x: 0.32, y: 0.08, w: 0.65, h: 0.60 },
      logoArea:  { x: 0.02, y: 0.02, w: 0.25, h: 0.15 },
      barcode:   { x: 0.05, y: 0.78, w: 0.90, h: 0.18 },
    },
    expectedAspectRatio: 1.586,
    aspectRatioTolerance: 0.30,
    dbFieldsExpected: ['id_number', 'full_name', 'dob'],
    weights: { forensics: 0.10, ocr: 0.30, db: 0.60 },
  },

  standard: {
    id: 'standard',
    label: 'Standard',
    icon: '🛡️',
    description: 'General-purpose identity document verification (Aadhaar, PAN, Passport)',
    template: {
      photoBox:  { x: 0.03, y: 0.20, w: 0.30, h: 0.50 },
      textBlock: { x: 0.35, y: 0.10, w: 0.62, h: 0.55 },
      logoArea:  { x: 0.30, y: 0.01, w: 0.40, h: 0.12 },
      barcode:   { x: 0.05, y: 0.72, w: 0.90, h: 0.20 },
    },
    expectedAspectRatio: 1.586,
    aspectRatioTolerance: 0.25,
    dbFieldsExpected: ['id_number', 'full_name', 'dob'],
    weights: { forensics: 0.20, ocr: 0.30, db: 0.50 },
  },

  aiDocument: {
    id: 'aiDocument',
    label: 'AI Document Check',
    icon: '🧠',
    description: 'Classify a document image as human-captured or AI-generated without registry lookup or audit-chain writes',
    databaseFree: true,
  },
}

/** Helper: get mode config by id */
export function getMode(modeId) {
  return MODES[modeId] || MODES.standard
}

/** Array of all modes for iteration (e.g. mode selector UI) */
export const MODE_LIST = Object.values(MODES)
