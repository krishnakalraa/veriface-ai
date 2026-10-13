/**
 * VeriFace AI — Layer 2: Template & Forensics
 *
 * SIMULATED / HEURISTIC-BASED
 * This module performs a lightweight forensic analysis of the document image.
 * In a production system, this would use computer-vision alignment, edge detection,
 * and print-pattern analysis. For this prototype, we use simplified heuristics
 * as described in the pitch deck.
 *
 * Two sub-checks:
 *   1. Layout check — validate document aspect ratio against the mode's template
 *   2. Font/print consistency — derive from OCR bounding-box uniformity
 *      (character height/spacing variance)
 */

/**
 * Run the forensics check on a captured document image.
 *
 * @param {string} imageDataUrl  — base64 data URL of the document image
 * @param {object} modeConfig    — the active mode config from modes.js
 * @returns {Promise<{ forensicsScore: number, issues: string[] }>}
 */
export async function runForensics(imageDataUrl, modeConfig) {
  const issues = []
  let layoutScore = 100
  let fontScore = 100

  // --- Sub-check 1: Aspect Ratio / Layout ---
  try {
    const dimensions = await getImageDimensions(imageDataUrl)
    const actualRatio = dimensions.width / dimensions.height
    const cardRatio = modeConfig.expectedAspectRatio || 1.586
    const a4Ratio = 0.707 // A4 portrait certificate / marksheet format
    const isPortrait = actualRatio < 1.0

    const targetRatio = isPortrait ? a4Ratio : cardRatio
    const tolerance = isPortrait ? 0.22 : (modeConfig.aspectRatioTolerance || 0.25)

    const ratioDiff = Math.abs(actualRatio - targetRatio) / targetRatio

    if (ratioDiff > tolerance) {
      layoutScore -= Math.min(30, Math.round(ratioDiff * 80))
      issues.push(
        `Document aspect ratio (${actualRatio.toFixed(2)}) deviates significantly ` +
        `from expected (${targetRatio.toFixed(2)}) — possible wrong document type or crop`
      )
    } else if (ratioDiff > tolerance * 0.5) {
      layoutScore -= Math.min(10, Math.round(ratioDiff * 30))
      issues.push(
        `Minor aspect ratio deviation detected — document may be slightly tilted or cropped`
      )
    }
  } catch {
    layoutScore -= 20
    issues.push('Could not analyze document dimensions')
  }

  // --- Sub-check 2: Font/Print Consistency (placeholder) ---
  // This will be refined when OCR bounding boxes are available via refineFontConsistency()
  // For now, assign a baseline score.
  fontScore = 85 // Neutral-positive baseline; refined after OCR

  // --- Combine ---
  const forensicsScore = Math.round(layoutScore * 0.6 + fontScore * 0.4)

  return {
    forensicsScore: Math.max(0, Math.min(100, forensicsScore)),
    issues,
  }
}

/**
 * Refine the font/print consistency score using OCR bounding-box data.
 * Called after Layer 3 (OCR) completes, feeding bounding boxes back into Layer 2.
 *
 * @param {object} forensicsResult — the result from runForensics()
 * @param {Array}  bboxes          — array of { x, y, w, h, text } from OCR
 * @returns {{ forensicsScore: number, issues: string[] }}
 */
export function refineFontConsistency(forensicsResult, bboxes) {
  const issues = [...forensicsResult.issues]
  let fontScore = 85

  if (!bboxes || bboxes.length < 3) {
    // Not enough OCR regions to analyze — keep baseline
    return forensicsResult
  }

  // Compute variance in character heights (simulated heuristic):
  // Uniform heights suggest machine-printed text (good);
  // high variance suggests hand-written alterations or tampering (suspicious).
  const heights = bboxes.map(b => b.h).filter(h => h > 0)
  if (heights.length > 2) {
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length
    const variance = heights.reduce((a, h) => a + Math.pow(h - mean, 2), 0) / heights.length
    const cv = Math.sqrt(variance) / mean // coefficient of variation

    if (cv > 0.5) {
      fontScore -= 25
      issues.push(
        'High variation in text region sizes detected — possible mixed print methods or tampering'
      )
    } else if (cv > 0.3) {
      fontScore -= 10
      issues.push('Moderate variation in text region sizes — possibly normal for this document type')
    }
  }

  // Recompute combined score
  // Original layoutScore can be back-derived: forensicsScore = layout*0.6 + oldFont*0.4
  // oldFont was 85, so layout = (forensicsResult.forensicsScore - 85*0.4) / 0.6
  const layoutScore = (forensicsResult.forensicsScore - 85 * 0.4) / 0.6
  const newScore = Math.round(layoutScore * 0.6 + fontScore * 0.4)

  return {
    forensicsScore: Math.max(0, Math.min(100, newScore)),
    issues,
  }
}

// --- Helpers ---

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}
