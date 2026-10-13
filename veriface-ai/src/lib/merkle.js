/**
 * VeriFace AI — Layer 6b: Blockchain Anchor — Merkle Tree
 *
 * Builds a Merkle tree over a batch of verification records and computes the
 * root hash. At production scale, this root hash would be anchored on a public
 * blockchain (e.g., Ethereum, Polygon) as a single transaction — proving the
 * integrity of an entire batch of verifications with one on-chain anchor.
 *
 * For the prototype, we compute and display the Merkle root to demonstrate
 * the concept. Uses SHA-256 via the Web Crypto API, consistent with hashChain.js.
 */

import { computeSHA256 } from './hashChain'

/**
 * Build a Merkle tree from an array of hash-chain blocks.
 *
 * @param {Array<{ hash: string }>} blocks — array of blocks from the hash chain
 * @returns {Promise<{
 *   root: string,
 *   levels: string[][],
 *   leaves: string[],
 *   blockCount: number
 * }>}
 */
export async function buildMerkleTree(blocks) {
  if (!blocks || blocks.length === 0) {
    return {
      root: '0'.repeat(64),
      levels: [],
      leaves: [],
      blockCount: 0,
    }
  }

  // Leaf hashes are the block hashes themselves
  const leaves = blocks.map(b => b.hash)

  // If odd number of leaves, duplicate the last one (standard Merkle padding)
  const paddedLeaves = [...leaves]
  if (paddedLeaves.length % 2 !== 0) {
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1])
  }

  const levels = [paddedLeaves]

  // Build tree bottom-up
  let currentLevel = paddedLeaves

  while (currentLevel.length > 1) {
    const nextLevel = []

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]
      const right = currentLevel[i + 1] || left // handle odd case
      const parentHash = await computeSHA256(left + right)
      nextLevel.push(parentHash)
    }

    levels.push(nextLevel)
    currentLevel = nextLevel
  }

  return {
    root: currentLevel[0],
    levels,
    leaves,
    blockCount: blocks.length,
  }
}

/**
 * Get the Merkle proof (authentication path) for a specific leaf.
 * This proof allows verification that a single record is part of the batch
 * without revealing the other records.
 *
 * @param {number} leafIndex — index of the leaf to prove
 * @param {{ levels: string[][] }} tree — the Merkle tree from buildMerkleTree()
 * @returns {{ proof: Array<{ hash: string, direction: 'left'|'right' }>, leafHash: string }}
 */
export function getMerkleProof(leafIndex, tree) {
  if (!tree || !tree.levels || tree.levels.length === 0) {
    return { proof: [], leafHash: '' }
  }

  const proof = []
  let index = leafIndex

  for (let level = 0; level < tree.levels.length - 1; level++) {
    const currentLevel = tree.levels[level]
    const isRight = index % 2 === 1
    const siblingIndex = isRight ? index - 1 : index + 1

    if (siblingIndex < currentLevel.length) {
      proof.push({
        hash: currentLevel[siblingIndex],
        direction: isRight ? 'left' : 'right',
      })
    }

    index = Math.floor(index / 2)
  }

  return {
    proof,
    leafHash: tree.levels[0][leafIndex] || '',
  }
}

/**
 * Verify a Merkle proof — confirm that a leaf hash is part of the tree
 * with the given root.
 *
 * @param {string} leafHash — the hash of the leaf to verify
 * @param {Array<{ hash: string, direction: 'left'|'right' }>} proof — the proof path
 * @param {string} expectedRoot — the Merkle root to verify against
 * @returns {Promise<boolean>}
 */
export async function verifyMerkleProof(leafHash, proof, expectedRoot) {
  let current = leafHash

  for (const step of proof) {
    if (step.direction === 'left') {
      current = await computeSHA256(step.hash + current)
    } else {
      current = await computeSHA256(current + step.hash)
    }
  }

  return current === expectedRoot
}
