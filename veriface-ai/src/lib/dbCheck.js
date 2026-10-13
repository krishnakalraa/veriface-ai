/**
 * VeriFace AI — Layer 4: Database Cross-Check
 *
 * Queries the Supabase `people` table by exact `id_number` match from OCR output.
 * If found, performs field-level comparison:
 *   - id_number: exact (guaranteed by lookup)
 *   - full_name: fuzzy match via Levenshtein distance, threshold ~85% similarity
 *   - dob: tolerant match allowing common OCR digit misreads (0↔O, 1↔I, 5↔S)
 */

import { supabase } from './supabase'
import localDataset from '../../data/sample_dataset.json'

/**
 * Run database cross-check against extracted OCR fields.
 *
 * @param {{ name: string|null, dob: string|null, idNumber: string|null }} extractedFields
 * @param {object} modeConfig — the active mode config
 * @returns {Promise<{
 *   found: boolean,
 *   matchedRecord: object|null,
 *   mismatchedFields: string[],
 *   fieldMatchScore: number
 * }>}
 */
export async function runDbCheck(extractedFields, modeConfig) {
  const { idNumber, name, dob } = extractedFields

  if (!idNumber) {
    return {
      found: false,
      matchedRecord: null,
      mismatchedFields: ['id_number (not extracted from document)'],
      fieldMatchScore: 0,
    }
  }

  // Query Supabase by exact id_number
  let data = null
  try {
    const { data: remoteData, error } = await supabase
      .from('people')
      .select('*')
      .eq('id_number', idNumber)
      .limit(1)
      .single()
    if (!error && remoteData) {
      data = remoteData
    }
  } catch (err) {
    console.warn('Supabase query error, checking local fallback:', err)
  }

  // Fallback to local dataset if not found in Supabase
  if (!data) {
    const localMatch = localDataset.find(
      p => String(p.id_number).trim().toLowerCase() === String(idNumber).trim().toLowerCase()
    )
    if (localMatch) {
      data = localMatch
    }
  }

  let idNumberCorrected = false
  if (!data && name && dob) {
    const correctionMatch = await findSingleDigitIdCorrection(idNumber, name, dob)
    if (correctionMatch) {
      data = correctionMatch
      idNumberCorrected = true
    }
  }

  if (!data) {
    return {
      found: false,
      matchedRecord: null,
      mismatchedFields: [`id_number "${idNumber}" not found in database`],
      fieldMatchScore: 0,
    }
  }

  // Record found — compare fields
  const mismatchedFields = []
  const fieldScores = []
  const expectedFields = data.document_type === 'kisan_card'
    ? ['id_number', 'full_name']
    : modeConfig.dbFieldsExpected || ['id_number', 'full_name', 'dob']

  // id_number: exact match (guaranteed by lookup)
  if (expectedFields.includes('id_number')) {
    fieldScores.push(idNumberCorrected ? 85 : 100)
    if (idNumberCorrected) {
      mismatchedFields.push('ID number OCR correction applied after matching the registry name and DOB')
    }
  }

  // full_name: fuzzy match
  if (expectedFields.includes('full_name') && name) {
    const nameSimilarity = computeNameSimilarity(name, data.full_name)
    fieldScores.push(nameSimilarity)

    if (nameSimilarity < 85) {
      mismatchedFields.push(
        `Name mismatch: document shows "${name}", record shows "${data.full_name}" ` +
        `(${nameSimilarity}% similarity)`
      )
    }
  } else if (expectedFields.includes('full_name') && !name) {
    fieldScores.push(50) // OCR couldn't extract name — penalize but don't hard-fail
    mismatchedFields.push('Name could not be extracted from document for comparison')
  }

  // dob: tolerant match
  if (expectedFields.includes('dob') && dob) {
    const dobMatch = compareDOB(dob, data.dob)
    fieldScores.push(dobMatch.score)

    if (dobMatch.score < 100) {
      mismatchedFields.push(
        `DOB mismatch: document shows "${dob}", record shows "${data.dob}"` +
        (dobMatch.reason ? ` (${dobMatch.reason})` : '')
      )
    }
  } else if (expectedFields.includes('dob') && !dob) {
    fieldScores.push(50)
    mismatchedFields.push('DOB could not be extracted from document for comparison')
  }

  const fieldMatchScore = fieldScores.length > 0
    ? Math.round(fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length)
    : 0

  return {
    found: true,
    matchedRecord: data,
    mismatchedFields,
    fieldMatchScore,
    correctedIdNumber: idNumberCorrected ? String(data.id_number) : null,
  }
}

async function findSingleDigitIdCorrection(scannedId, name, dob) {
  const scannedDigits = String(scannedId).replace(/\D/g, '')
  if (!/^\d{12}$/.test(scannedDigits)) return null

  const candidatesById = new Map()
  try {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('dob', dob)
      .limit(200)
    if (!error && data) {
      data.forEach(record => candidatesById.set(String(record.id_number), record))
    }
  } catch (err) {
    console.warn('Registry lookup by DOB failed during ID OCR recovery:', err)
  }

  localDataset
    .filter(record => compareDOB(dob, record.dob).score === 100)
    .forEach(record => candidatesById.set(String(record.id_number), record))

  const matches = [...candidatesById.values()].filter(record => {
    const registeredDigits = String(record.id_number).replace(/\D/g, '')
    if (!/^\d{12}$/.test(registeredDigits)) return false

    let differingDigits = 0
    for (let index = 0; index < 12; index++) {
      if (scannedDigits[index] !== registeredDigits[index]) differingDigits++
      if (differingDigits > 1) return false
    }

    return differingDigits === 1 && computeNameSimilarity(name, record.full_name) >= 95
  })

  return matches.length === 1 ? matches[0] : null
}

// ─── Fuzzy Name Matching ────────────────────────────────────────────────────

export function computeNameSimilarity(ocrName, dbName) {
  if (!ocrName || !dbName) return 0

  const a = normalizeNameForComparison(ocrName)
  const b = normalizeNameForComparison(dbName)

  if (a === b) return 100

  // Filter out OCR noise tokens (e.g., repeated letters like 'eee', 'xxx')
  const filterNoise = (str) =>
    str
      .split(' ')
      .filter(t => t.length > 0 && !/^(.)\1+$/.test(t))
      .join(' ')

  const cleanA = filterNoise(a)
  const cleanB = filterNoise(b)

  if (cleanA === cleanB && cleanA.length > 0) return 100

  // Check token containment (e.g. registered name words are all present in OCR name)
  const aTokens = cleanA.split(' ').filter(Boolean)
  const bTokens = cleanB.split(' ').filter(Boolean)

  const bInA = bTokens.length > 0 && bTokens.every(t => aTokens.includes(t))
  const aInB = aTokens.length > 0 && aTokens.every(t => bTokens.includes(t))

  if (bInA || aInB) {
    const minLen = Math.min(aTokens.length, bTokens.length)
    const maxLen = Math.max(aTokens.length, bTokens.length)
    const extraOcrTokens = bInA ? aTokens.filter(token => !bTokens.includes(token)) : []
    const onlyShortOcrFragments = extraOcrTokens.length > 0 &&
      extraOcrTokens.every(token => token.length <= 2)

    if (
      minLen >= 2 &&
      (maxLen <= minLen + 1 || (bInA && onlyShortOcrFragments))
    ) {
      return 95 // Core name tokens matched completely
    }
  }

  const distance = levenshteinDistance(cleanA, cleanB)
  const maxLen = Math.max(cleanA.length, cleanB.length)
  const similarity = Math.round(((maxLen - distance) / maxLen) * 100)

  return Math.max(0, similarity)
}

function normalizeNameForComparison(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // remove non-alpha
    .replace(/\s+/g, ' ')      // normalize whitespace
    .trim()
}

/**
 * Levenshtein distance — inline implementation (no external dependency).
 * O(m×n) dynamic programming approach.
 */
function levenshteinDistance(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

// ─── DOB Tolerant Matching ──────────────────────────────────────────────────

/**
 * Compare two dates with tolerance for common OCR misreads.
 * Returns { score: 0-100, reason: string }
 */
function compareDOB(ocrDob, dbDob) {
  if (!ocrDob || !dbDob) return { score: 0, reason: 'missing date' }

  // Normalize both to YYYY-MM-DD
  const ocrNorm = normalizeDateString(ocrDob)
  const dbNorm = normalizeDateString(String(dbDob))

  if (!ocrNorm || !dbNorm) return { score: 50, reason: 'could not parse date format' }

  if (ocrNorm === dbNorm) return { score: 100, reason: '' }

  // Check for day/month transposition (e.g. DD-MM-YYYY vs MM-DD-YYYY)
  const ocrParts = ocrNorm.split('-')
  const dbParts = dbNorm.split('-')
  if (
    ocrParts.length === 3 &&
    dbParts.length === 3 &&
    ocrParts[0] === dbParts[0] &&
    ocrParts[1] === dbParts[2] &&
    ocrParts[2] === dbParts[1]
  ) {
    return { score: 98, reason: 'DD/MM vs MM/DD date format variation' }
  }

  // Check for common OCR digit misreads
  const ocrDigits = ocrNorm.replace(/-/g, '')
  const dbDigits = dbNorm.replace(/-/g, '')

  let diffCount = 0
  let ocrMisreadLikely = true

  for (let i = 0; i < Math.min(ocrDigits.length, dbDigits.length); i++) {
    if (ocrDigits[i] !== dbDigits[i]) {
      diffCount++
      // Check if this is a common OCR misread
      if (!isLikelyOCRMisread(ocrDigits[i], dbDigits[i])) {
        ocrMisreadLikely = false
      }
    }
  }

  if (diffCount === 0) return { score: 100, reason: '' }
  if (diffCount === 1 && ocrMisreadLikely) {
    return { score: 85, reason: 'likely OCR digit misread (1 digit difference)' }
  }
  if (diffCount === 1) {
    return { score: 70, reason: '1 digit mismatch' }
  }
  if (diffCount === 2 && ocrMisreadLikely) {
    return { score: 60, reason: 'possible OCR misreads (2 digit differences)' }
  }

  return { score: 30, reason: `${diffCount} digit differences — significant mismatch` }
}

/** Common OCR misread pairs */
function isLikelyOCRMisread(a, b) {
  const pairs = [
    ['0', 'O'], ['0', 'o'], ['0', 'Q'],
    ['1', 'I'], ['1', 'l'], ['1', '7'],
    ['5', 'S'], ['5', 's'],
    ['8', 'B'],
    ['2', 'Z'],
    ['6', 'G'],
  ]
  return pairs.some(([x, y]) =>
    (a === x && b === y) || (a === y && b === x)
  )
}

/** Normalize various date formats to YYYY-MM-DD */
function normalizeDateString(dateStr) {
  if (!dateStr) return null

  // Already YYYY-MM-DD
  let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  match = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/)
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  }

  // DD/MM/YY or DD-MM-YY or DD.MM.YY (2-digit year e.g. 10.09.08)
  match = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/)
  if (match) {
    const yy = parseInt(match[3], 10)
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy
    return `${yyyy}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  }

  // ISO date from Supabase (may include time)
  match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  return null
}
