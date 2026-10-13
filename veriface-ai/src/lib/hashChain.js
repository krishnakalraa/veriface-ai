/**
 * VeriFace AI — Layer 6b: Blockchain Anchor — Hash Chain
 *
 * Implements a local hash-chain (array of blocks, each referencing the prior
 * block's SHA-256 hash) to make the audit trail tamper-evident.
 *
 * This is NOT a full blockchain — it's the cryptographic core that makes the
 * audit trail verifiable. At production scale, the Merkle root computed from
 * merkle.js would be anchored on a public chain.
 *
 * Architecture decision: only hashes are stored in the chain, never bulk data
 * (documents, photos). Supabase/PostgreSQL handles storage at scale; the
 * hash-chain handles tamper-evidence.
 *
 * Persisted in localStorage for the prototype.
 */

const CHAIN_STORAGE_KEY = 'veriface_hash_chain'

/**
 * Add a new block to the hash chain for a verification record.
 *
 * @param {object} verificationRecord — the verification result + log entry
 * @returns {Promise<object>} the new block added to the chain
 */
export async function addBlock(verificationRecord) {
  const chain = getChain()

  const prevHash = chain.length > 0
    ? chain[chain.length - 1].hash
    : '0'.repeat(64) // Genesis block reference

  const blockData = {
    index: chain.length,
    timestamp: new Date().toISOString(),
    data: {
      trustScore: verificationRecord.trustScore,
      decision: verificationRecord.decision,
      idNumber: verificationRecord.idNumber || 'N/A',
      name: verificationRecord.name || 'N/A',
      recordId: verificationRecord.verificationLog?.id || null,
      mismatchedFields: verificationRecord.mismatchedFields || [],
    },
    prevHash,
  }

  // Compute SHA-256 hash of this block's content
  const hash = await computeSHA256(JSON.stringify(blockData))
  const block = { ...blockData, hash }

  chain.push(block)
  saveChain(chain)

  return block
}

/**
 * Get the full hash chain from localStorage.
 * @returns {Array<object>} the chain of blocks
 */
export function getChain() {
  try {
    const stored = localStorage.getItem(CHAIN_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Verify the integrity of the entire hash chain.
 * Walks each block and re-computes its hash, checking:
 *   1. The block's hash matches its content
 *   2. The block's prevHash matches the previous block's hash
 *
 * @returns {Promise<{
 *   valid: boolean,
 *   brokenAtIndex: number|null,
 *   details: string[],
 *   totalBlocks: number
 * }>}
 */
export async function verifyChainIntegrity() {
  const chain = getChain()
  const details = []

  if (chain.length === 0) {
    return { valid: true, brokenAtIndex: null, details: ['Chain is empty'], totalBlocks: 0 }
  }

  for (let i = 0; i < chain.length; i++) {
    const block = chain[i]

    // Re-compute the hash from the block data (without the stored hash)
    const { hash: storedHash, ...blockData } = block
    const recomputedHash = await computeSHA256(JSON.stringify(blockData))

    // Check 1: Does the stored hash match the recomputed hash?
    if (storedHash !== recomputedHash) {
      details.push(
        `❌ Block #${i}: Hash mismatch! Stored: ${storedHash.slice(0, 16)}... ` +
        `Recomputed: ${recomputedHash.slice(0, 16)}... — DATA HAS BEEN TAMPERED WITH`
      )
      return {
        valid: false,
        brokenAtIndex: i,
        details,
        totalBlocks: chain.length,
      }
    }

    // Check 2: Does prevHash match the previous block's hash?
    if (i > 0) {
      const expectedPrevHash = chain[i - 1].hash
      if (block.prevHash !== expectedPrevHash) {
        details.push(
          `❌ Block #${i}: prevHash mismatch! Points to: ${block.prevHash.slice(0, 16)}... ` +
          `but Block #${i - 1} hash is: ${expectedPrevHash.slice(0, 16)}... — CHAIN LINK BROKEN`
        )
        return {
          valid: false,
          brokenAtIndex: i,
          details,
          totalBlocks: chain.length,
        }
      }
    } else {
      // Genesis block should reference all zeros
      if (block.prevHash !== '0'.repeat(64)) {
        details.push(`⚠️ Block #0 (genesis): Unexpected prevHash (non-zero)`)
      }
    }

    details.push(`✅ Block #${i}: Integrity verified`)
  }

  return {
    valid: true,
    brokenAtIndex: null,
    details,
    totalBlocks: chain.length,
  }
}

/**
 * Intentionally tamper with a block — FOR DEMO PURPOSES ONLY.
 * Modifies a field in a past block to demonstrate that the integrity
 * check detects the tampering.
 *
 * @param {number} blockIndex — which block to tamper with
 * @param {string} field      — which data field to modify (e.g., 'trustScore', 'decision')
 * @param {*}      newValue   — the tampered value
 * @returns {boolean} true if tampering was applied
 */
export function tamperBlock(blockIndex, field, newValue) {
  const chain = getChain()

  if (blockIndex < 0 || blockIndex >= chain.length) {
    console.error(`Block index ${blockIndex} out of range`)
    return false
  }

  // Modify the data WITHOUT recomputing the hash — this is what makes it detectable
  if (chain[blockIndex].data && field in chain[blockIndex].data) {
    chain[blockIndex].data[field] = newValue
  } else {
    chain[blockIndex].data[field] = newValue
  }

  saveChain(chain)
  console.warn(`🔶 Block #${blockIndex} has been tampered with: ${field} → ${newValue}`)
  return true
}

/**
 * Clear the entire hash chain (reset for demos).
 */
export function clearChain() {
  localStorage.removeItem(CHAIN_STORAGE_KEY)
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function saveChain(chain) {
  localStorage.setItem(CHAIN_STORAGE_KEY, JSON.stringify(chain))
}

/**
 * Compute SHA-256 hash using the Web Crypto API (no external library).
 * @param {string} message — the string to hash
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export async function computeSHA256(message) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
