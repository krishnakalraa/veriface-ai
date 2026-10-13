/**
 * VeriFace AI — Layer 3: OCR / QR / MRZ
 *
 * Uses Tesseract.js for text extraction and @zxing/browser for QR/barcode decoding.
 * Includes a simple TD1/TD3 MRZ parser with check-digit validation.
 *
 * Returns a normalized result object with extracted fields, confidence, and
 * bounding boxes (for downstream forensics refinement).
 */

import Tesseract from 'tesseract.js'

/**
 * Run OCR + QR/barcode + MRZ extraction on a document image.
 *
 * @param {string} imageDataUrl — base64 data URL of the document image
 * @returns {Promise<{
 *   name: string|null,
 *   dob: string|null,
 *   idNumber: string|null,
 *   rawText: string,
 *   qrData: string|null,
 *   mrzData: object|null,
 *   ocrConfidence: number,
 *   bboxes: Array<{x:number, y:number, w:number, h:number, text:string}>
 * }>}
 */
export async function runOCR(imageDataUrl) {
  // Run OCR and QR decoding in parallel
  const [ocrResult, qrData] = await Promise.all([
    performOCR(imageDataUrl),
    decodeQR(imageDataUrl),
  ])

  const { rawText, confidence, bboxes } = ocrResult

  // Try to parse MRZ from the raw OCR text
  const mrzData = parseMRZ(rawText)

  // Debug: log raw OCR text to browser console so we can inspect what Tesseract read
  console.log('📄 OCR Raw Text:\n', rawText)
  console.log('📊 OCR Confidence:', confidence)

  // Extract fields from OCR text (or override with MRZ data if available)
  let name = mrzData?.name || extractName(rawText)
  let dob = mrzData?.dob || extractDOB(rawText)
  let idNumber = mrzData?.documentNumber || extractIdNumber(rawText)

  if (!idNumber) {
    idNumber = await extractAadhaarNumberFromLowerBand(imageDataUrl)
  }

  // If QR data contains structured info, try to extract fields from it
  if (qrData && !idNumber) {
    const qrFields = parseQRData(qrData)
    name = name || qrFields.name
    dob = dob || qrFields.dob
    idNumber = idNumber || qrFields.idNumber
  }

  if (/^\d{12}$/.test(String(idNumber || '')) || /aadhaar|uidai/i.test(rawText)) {
    name = await extractAadhaarNameFromNameBand(imageDataUrl) || name
  }

  const safeIdLabel = idNumber ? `••••••••${idNumber.slice(-4)}` : '(not extracted)'
  console.log('🔍 OCR Extracted → ID:', safeIdLabel, '| Name:', name, '| DOB:', dob)

  // Compute normalized OCR confidence based on key identity field extraction completeness
  const fieldsExtracted = [name, dob, idNumber].filter(Boolean).length
  const completenessScore = Math.round((fieldsExtracted / 3) * 100)

  // 70% weight on successful parsing of required identity fields, 30% on raw character clarity
  const normalizedOcrConfidence = Math.min(
    100,
    Math.round(completenessScore * 0.70 + (confidence || 0) * 0.30)
  )

  return {
    name,
    dob,
    idNumber,
    rawText,
    qrData,
    mrzData,
    ocrConfidence: normalizedOcrConfidence,
    bboxes,
  }
}

async function extractAadhaarNameFromNameBand(imageDataUrl) {
  try {
    const image = await loadImage(imageDataUrl)
    const imageWidth = image.naturalWidth || image.width
    const imageHeight = image.naturalHeight || image.height
    if (!imageWidth || !imageHeight) return null

    // Aadhaar front layout: English holder name is directly below its Hindi line
    // and above the DOB row. Keep this crop on that English-only row.
    const sourceX = Math.floor(imageWidth * 0.32)
    const sourceY = Math.floor(imageHeight * 0.235)
    const sourceWidth = Math.floor(imageWidth * 0.34)
    const sourceHeight = Math.floor(imageHeight * 0.065)
    const scale = 8
    const canvas = document.createElement('canvas')
    canvas.width = sourceWidth * scale
    canvas.height = sourceHeight * scale
    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )

    const sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const variants = [canvas]
    for (const threshold of [150, 190]) {
      const variant = document.createElement('canvas')
      variant.width = canvas.width
      variant.height = canvas.height
      const variantContext = variant.getContext('2d')
      if (!variantContext) continue

      const pixels = new ImageData(
        new Uint8ClampedArray(sourcePixels.data),
        sourcePixels.width,
        sourcePixels.height
      )
      for (let index = 0; index < pixels.data.length; index += 4) {
        const luminance = 0.299 * pixels.data[index] +
          0.587 * pixels.data[index + 1] +
          0.114 * pixels.data[index + 2]
        const value = luminance < threshold ? 0 : 255
        pixels.data[index] = value
        pixels.data[index + 1] = value
        pixels.data[index + 2] = value
      }
      variantContext.putImageData(pixels, 0, 0)
      variants.push(variant)
    }

    const recognizedNames = []

    for (const variant of variants) {
      const result = await Tesseract.recognize(variant, 'eng', {
        logger: () => {},
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
        tessedit_pageseg_mode: '7',
      })
      const nameCandidate = cleanExtractedName(result.data.text || '')
      const tokens = nameCandidate?.split(' ') || []
      if (
        (result.data.confidence || 0) >= 45 &&
        tokens.length >= 2 && tokens.length <= 4 &&
        tokens.every(token => token.length >= 2) &&
        !/government|india|aadhaar|uidai|authority|dob|male|female/i.test(nameCandidate)
      ) {
        recognizedNames.push({ name: nameCandidate, confidence: result.data.confidence })
      }
    }

    if (!recognizedNames.length) {
      console.warn('No reliable English holder-name read found in Aadhaar name row')
      return null
    }

    const bestRead = recognizedNames.sort((a, b) => b.confidence - a.confidence)[0]
    console.log('Aadhaar English name row read:', bestRead.name, 'confidence:', bestRead.confidence)
    return bestRead.name
  } catch (err) {
    console.warn('Focused Aadhaar name OCR pass failed:', err)
    return null
  }
}

async function extractAadhaarNumberFromLowerBand(imageDataUrl) {
  try {
    const image = await loadImage(imageDataUrl)
    const imageWidth = image.naturalWidth || image.width
    const imageHeight = image.naturalHeight || image.height
    if (!imageWidth || !imageHeight) return null

    // Aadhaar's 12-digit identifier is printed in a broad strip near the card's bottom.
    const sourceX = Math.floor(imageWidth * 0.18)
    const sourceY = Math.floor(imageHeight * 0.72)
    const sourceWidth = Math.floor(imageWidth * 0.80)
    const sourceHeight = Math.floor(imageHeight * 0.14)
    const scale = 4
    const canvas = document.createElement('canvas')
    canvas.width = sourceWidth * scale
    canvas.height = sourceHeight * scale

    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )

    const sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const variants = [canvas]

    for (const threshold of [145, 190]) {
      const variant = document.createElement('canvas')
      variant.width = canvas.width
      variant.height = canvas.height
      const variantContext = variant.getContext('2d')
      if (!variantContext) continue

      const pixels = new ImageData(
        new Uint8ClampedArray(sourcePixels.data),
        sourcePixels.width,
        sourcePixels.height
      )
      for (let index = 0; index < pixels.data.length; index += 4) {
        const luminance = 0.299 * pixels.data[index] +
          0.587 * pixels.data[index + 1] +
          0.114 * pixels.data[index + 2]
        const value = luminance < threshold ? 0 : 255
        pixels.data[index] = value
        pixels.data[index + 1] = value
        pixels.data[index + 2] = value
      }
      variantContext.putImageData(pixels, 0, 0)
      variants.push(variant)
    }

    const candidates = []
    for (const variant of variants) {
      const result = await Tesseract.recognize(variant, 'eng', {
        logger: () => {},
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7',
      })
      const digits = (result.data.text || '').replace(/\D/g, '')
      if (/^\d{12}$/.test(digits)) candidates.push(digits)
    }

    const counts = new Map()
    candidates.forEach(candidate => counts.set(candidate, (counts.get(candidate) || 0) + 1))
    const [bestCandidate, voteCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || []
    const hasUnambiguousConsensus = voteCount >= 2 &&
      [...counts.values()].filter(count => count === voteCount).length === 1

    if (hasUnambiguousConsensus) {
      console.log('Aadhaar number confirmed by independent focused scans')
      return bestCandidate
    }

    if (candidates.length) {
      console.warn('Aadhaar number OCR reads disagreed; rejecting uncertain ID candidate')
    }
    return null
  } catch (err) {
    console.warn('Focused Aadhaar-number OCR pass failed:', err)
    return null
  }
}

// ─── OCR via Tesseract.js ───────────────────────────────────────────────────

async function performOCR(imageDataUrl) {
  try {
    const result = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: () => {}, // suppress verbose logging
    })

    const rawText = result.data.text || ''
    const confidence = result.data.confidence || 0

    // Extract word-level bounding boxes for forensics
    const bboxes = (result.data.words || []).map(w => ({
      x: w.bbox.x0,
      y: w.bbox.y0,
      w: w.bbox.x1 - w.bbox.x0,
      h: w.bbox.y1 - w.bbox.y0,
      text: w.text,
    }))

    return { rawText, confidence, bboxes }
  } catch (err) {
    console.error('OCR failed:', err)
    return { rawText: '', confidence: 0, bboxes: [] }
  }
}

// ─── QR / Barcode Decoding ──────────────────────────────────────────────────

async function decodeQR(imageDataUrl) {
  try {
    // Dynamically import to avoid issues if the library has loading problems
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    const reader = new BrowserMultiFormatReader()

    // Create an image element for the decoder
    const img = await loadImage(imageDataUrl)
    const result = await reader.decodeFromImageElement(img)
    return result?.getText() || null
  } catch {
    // No QR/barcode found — this is normal for many documents
    return null
  }
}

// ─── MRZ Parser ─────────────────────────────────────────────────────────────

/**
 * Parse Machine Readable Zone (MRZ) from OCR text.
 * Supports TD1 (3 lines × 30 chars) and TD3 (2 lines × 44 chars).
 */
function parseMRZ(text) {
  if (!text) return null

  const lines = text.split('\n').map(l => l.trim().replace(/\s/g, ''))

  // Real MRZ lines ALWAYS contain '<' filler characters (e.g. P<IND..., I<IND..., <<<<<<).
  // Standard document text / marksheets NEVER contain '<'.
  // Require at least 2 '<' fillers per line and minimum length 28.
  const mrzLines = lines.filter(l => /^[A-Z0-9<]{28,}$/.test(l) && (l.match(/</g) || []).length >= 2)

  if (mrzLines.length >= 2) {
    // Try TD3 (passport): 2 lines of ~44 chars, line 1 starts with P
    if (mrzLines[0].length >= 42 && mrzLines[1].length >= 42 && /^P[A-Z0-9<]/.test(mrzLines[0])) {
      const td3 = parseTD3(mrzLines[0], mrzLines[1])
      if (td3 && td3.checkDigitValid) return td3
    }
  }

  if (mrzLines.length >= 3) {
    // Try TD1 (ID card): 3 lines of ~30 chars, line 1 starts with I, A, or C
    if (mrzLines[0].length >= 28 && mrzLines[0].length <= 32 && /^[IAC]/.test(mrzLines[0])) {
      const td1 = parseTD1(mrzLines[0], mrzLines[1], mrzLines[2])
      if (td1 && td1.checkDigitValid) return td1
    }
  }

  return null
}

function parseTD3(line1, line2) {
  try {
    const surname = line1.substring(5, 44).split('<<')[0].replace(/</g, ' ').trim()
    const givenNames = (line1.substring(5, 44).split('<<')[1] || '').replace(/</g, ' ').trim()
    const name = `${givenNames} ${surname}`.trim()

    const documentNumber = line2.substring(0, 9).replace(/</g, '').trim()
    const dobRaw = line2.substring(13, 19) // YYMMDD
    const dob = parseMRZDate(dobRaw)

    // Check digit validation for document number
    const docCheckDigit = parseInt(line2[9])
    const computedCheck = mrzCheckDigit(line2.substring(0, 9))

    return {
      name,
      documentNumber,
      dob,
      checkDigitValid: docCheckDigit === computedCheck,
      raw: [line1, line2],
    }
  } catch {
    return null
  }
}

function parseTD1(line1, line2, line3) {
  try {
    const documentNumber = line1.substring(5, 14).replace(/</g, '').trim()
    const docCheckDigit = parseInt(line1[14])
    const computedDocCheck = mrzCheckDigit(line1.substring(5, 14))

    const dobRaw = line2.substring(0, 6) // YYMMDD
    const dob = parseMRZDate(dobRaw)

    const checkDigitValid = !isNaN(docCheckDigit) && docCheckDigit === computedDocCheck

    const surname = line3.split('<<')[0].replace(/</g, ' ').trim()
    const givenNames = (line3.split('<<')[1] || '').replace(/</g, ' ').trim()
    const name = `${givenNames} ${surname}`.trim()

    return {
      name,
      documentNumber,
      dob,
      checkDigitValid,
      raw: [line1, line2, line3],
    }
  } catch {
    return null
  }
}

/** Convert YYMMDD to YYYY-MM-DD */
function parseMRZDate(raw) {
  if (!raw || raw.length < 6) return null
  const yy = parseInt(raw.substring(0, 2))
  const mm = raw.substring(2, 4)
  const dd = raw.substring(4, 6)
  const year = yy > 50 ? 1900 + yy : 2000 + yy
  return `${year}-${mm}-${dd}`
}

/** MRZ check digit algorithm (ICAO 9303) */
function mrzCheckDigit(input) {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    let value
    if (char === '<') value = 0
    else if (char >= '0' && char <= '9') value = parseInt(char)
    else value = char.charCodeAt(0) - 55 // A=10, B=11, ...
    sum += value * weights[i % 3]
  }
  return sum % 10
}

// ─── Field Extraction from Raw OCR Text ─────────────────────────────────────

function cleanExtractedName(raw) {
  if (!raw) return null
  let name = raw.replace(/\s+/g, ' ').trim()

  // Split into tokens
  let tokens = name.split(' ').filter(Boolean)

  // Filter out OCR noise:
  // 1. Repeated identical characters (e.g., "EEE", "XXX", "OOO", "==")
  // 2. Tokens that are not alphabetic
  tokens = tokens.filter(t => {
    if (/^(.)\1{1,}$/i.test(t)) return false // e.g. EEE, eee, xx, AAA
    if (!/^[A-Za-z.]+$/.test(t)) return false
    return true
  })

  // If last token is a single letter (often OCR artifact), drop if name already has >= 2 words
  if (tokens.length > 2 && tokens[tokens.length - 1].length === 1) {
    tokens.pop()
  }

  const cleaned = tokens.join(' ').trim()
  return cleaned.length > 2 ? cleaned : null
}

function extractName(text) {
  if (!text) return null

  // ── CBSE / Board marksheet: "certify that NAME" ──
  const certifyMatch = text.match(/certif(?:y|ied)\s+that\s+([A-Z][A-Za-z\s.]{2,40}?)(?:\n|$|\s{2,})/i)
  if (certifyMatch) {
    const cleaned = cleanExtractedName(certifyMatch[1])
    if (cleaned && cleaned.split(' ').length <= 5) return cleaned
  }

  // Common patterns on Indian ID cards
  const patterns = [
    /(?:name|naam)\s*[:\-]?\s*([A-Za-z.]+(?:[ \t]+[A-Za-z.]+){0,4})/i,
    /(?:holder|bearer)\s*[:\-]?\s*([A-Za-z.]+(?:[ \t]+[A-Za-z.]+){0,4})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1].trim().length > 3) {
      // Skip if it matches mother's / father's name label
      const val = match[1].trim().replace(/\s+/g, ' ')
      if (/mother|father|guardian|mata|pita/i.test(val)) continue
      const cleaned = cleanExtractedName(val)
      if (cleaned) return cleaned
    }
  }

  // Fallback: find the longest all-alpha line that looks like a name
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Za-z\s.]/g, '').trim()
    if (
      cleaned.length > 5 &&
      cleaned.split(' ').length >= 2 &&
      cleaned.split(' ').length <= 5 &&
      !/(?:board|school|education|secondary|examination|certificate|statement|marks|government|india|aadhaar|uidai|authority|citizenship|proof|male|female)/i.test(cleaned)
    ) {
      const sanitized = cleanExtractedName(cleaned)
      if (sanitized) return sanitized
    }
  }

  return null
}

function extractDOB(text) {
  if (!text) return null

  // 1. Explicit DOB label (e.g. D.O.B, DOB, D.O.B., Date of Birth, Birth Date, Born)
  // Supports DD.MM.YYYY, DD.MM.YY, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY with optional newlines or colons
  const labeledPatterns = [
    /(?:d\.?\s*o\.?\s*b\.?|date\s*of\s*birth|birth\s*date|born)[^\d\n]{0,15}[\s\n]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
    /(?:d\.?\s*o\.?\s*b\.?|date\s*of\s*birth|birth\s*date|born)[^\d\n]{0,15}[\s\n]*(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/i,
  ]

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern)
    if (match) {
      if (match[1].length === 4) {
        // YYYY-MM-DD
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
      } else {
        // DD-MM-YYYY or DD-MM-YY (e.g. 10.09.08 -> 2008-09-10)
        let year = match[3]
        if (year.length === 2) {
          const yy = parseInt(year, 10)
          year = yy > 50 ? String(1900 + yy) : String(2000 + yy)
        }
        return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
      }
    }
  }

  // 2. Standalone date patterns (4-digit year first, then plausible 2-digit year)
  const standalonePatterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
    /\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{2})\b/,
  ]

  for (const pattern of standalonePatterns) {
    const match = text.match(pattern)
    if (match) {
      if (match[1].length === 4) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
      } else {
        let year = match[3]
        if (year.length === 2) {
          const day = parseInt(match[1], 10)
          const month = parseInt(match[2], 10)
          // Validate day (1-31) and month (1-12) to avoid false phone/id number matches
          if (day < 1 || day > 31 || month < 1 || month > 12) continue
          const yy = parseInt(year, 10)
          year = yy > 50 ? String(1900 + yy) : String(2000 + yy)
        }
        return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
      }
    }
  }

  return null
}

function extractIdNumber(text) {
  if (!text) return null

  // 1. ── Labeled Roll Number: 5-12 digit number near "Roll No" or "Anukramank" ──
  const rollMatch = text.match(
    /(?:roll\s*no\.?|anukram[\w]*|roll\s*number)[^\d\n]{0,20}(\d{5,12})/im
  )
  if (rollMatch) {
    console.log('✅ OCR: Roll No pattern matched:', rollMatch[1])
    return rollMatch[1].trim()
  }

  // Kisan/union membership cards commonly use short identifiers such as "ID No. 1512".
  const memberIdMatch = text.match(/\b(?:member\s*)?id\s*no\.?\s*[:#\-]?\s*([A-Z0-9-]{3,20})/i)
  if (memberIdMatch) {
    console.log('✅ OCR: Membership ID matched')
    return memberIdMatch[1].trim()
  }

  // 2. ── Labeled Student ID / Reg No / Enrollment No ──
  const idMatch = text.match(
    /(?:student\s*id|registration\s*no|reg\s*no|enrollment\s*no|id\s*number|id\s*no)[^\w\n]{0,20}([A-Z0-9\-]{5,20})/i
  )
  if (idMatch) {
    console.log('✅ OCR: Student/Registration ID matched:', idMatch[1])
    return idMatch[1].trim()
  }

  // 3. ── Labeled Contact No / Mobile No (common primary ID on campus ID cards) ──
  const contactMatch = text.match(
    /(?:contact\s*no\.?|mobile\s*no\.?|phone\s*no\.?)[^\d\n]{0,20}(\d{10})/i
  )
  if (contactMatch) {
    console.log('✅ OCR: Contact/Mobile ID matched:', contactMatch[1])
    return contactMatch[1].trim()
  }

  // 4. ── Aadhaar: 12-digit number (often with spaces: XXXX XXXX XXXX) ──
  const aadhaarMatch = text.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/)
  if (aadhaarMatch) return aadhaarMatch[1].replace(/\s/g, '')

  // 5. ── PAN: 5 letters + 4 digits + 1 letter ──
  const panMatch = text.match(/\b([A-Z]{5}\d{4}[A-Z])\b/)
  if (panMatch) return panMatch[1]

  // 6. ── Cleaned numeric string (filtering out footers, website URLs, landlines, and toll-free numbers) ──
  const cleanLines = text
    .split('\n')
    .filter(line => !/(?:www|edu\.in|\.com|http|if found|please return|duplicate card|toll free|1800|payment)/i.test(line))
    .join('\n')

  const pureNumericMatches = (cleanLines.match(/(?<![A-Z0-9])\d{7,14}(?![A-Z0-9])/g) || [])
    .filter(num => !/^(1800|0172|9172|011|022)/.test(num))

  if (pureNumericMatches.length > 0) {
    const best = pureNumericMatches.reduce((a, b) => (a.length >= b.length ? a : b))
    console.log('✅ OCR: Pure numeric match:', best)
    return best
  }

  // 7. ── Last resort: alphanumeric token containing digits (excluding headers & toll-free/landline) ──
  const BLOCKLIST = /^(BOARD|CENTRAL|SECONDARY|EDUCATION|EXAMINATION|CERTIFICATE|STATEMENT|MARKS|ALBOARDOF|BOARDOF)$/i
  const alphanumMatches = (text.match(/\b[A-Z0-9]{8,20}\b/g) || [])
    .filter(t => /\d/.test(t) && !BLOCKLIST.test(t) && !/^(1800|0172|9172)/.test(t))
  if (alphanumMatches.length > 0) {
    return alphanumMatches.reduce((a, b) => (a.length >= b.length ? a : b))
  }

  return null
}

/** Parse structured QR data (e.g., JSON, key=value pairs, or XML from Aadhaar QR) */
function parseQRData(qrText) {
  const result = { name: null, dob: null, idNumber: null }
  if (!qrText) return result

  try {
    // Try JSON
    const json = JSON.parse(qrText)
    result.name = json.name || json.Name || json.full_name || null
    result.dob = json.dob || json.DOB || json.date_of_birth || null
    result.idNumber = json.id || json.uid || json.id_number || null
    return result
  } catch {
    // Not JSON — try XML-like (Aadhaar QR contains XML)
    const uidMatch = qrText.match(/uid="(\d+)"/)
    const nameMatch = qrText.match(/name="([^"]+)"/)
    const dobMatch = qrText.match(/dob="([^"]+)"/)

    if (uidMatch) result.idNumber = uidMatch[1]
    if (nameMatch) result.name = nameMatch[1]
    if (dobMatch) result.dob = dobMatch[1]
  }

  return result
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}
