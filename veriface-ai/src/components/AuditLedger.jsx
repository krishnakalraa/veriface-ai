import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getChain, verifyChainIntegrity, tamperBlock, clearChain } from '../lib/hashChain'
import { buildMerkleTree } from '../lib/merkle'
import { getStoredToken } from '../lib/auth'

const blockVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.08, type: 'spring', damping: 20 },
  }),
}

function AuditLedger({ onBack }) {
  const [chain, setChain] = useState([])
  const [integrityResult, setIntegrityResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [merkleRoot, setMerkleRoot] = useState(null)
  const [tamperMode, setTamperMode] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [tamperField, setTamperField] = useState('trustScore')
  const [tamperValue, setTamperValue] = useState('')

  const refreshChain = useCallback(() => {
    const currentChain = getChain()
    setChain(currentChain)
    setIntegrityResult(null)

    // Compute Merkle root
    if (currentChain.length > 0) {
      buildMerkleTree(currentChain).then(tree => {
        setMerkleRoot(tree.root)
      })
    } else {
      setMerkleRoot(null)
    }
  }, [])

  useEffect(() => {
    refreshChain()
  }, [refreshChain])

  const handleVerifyIntegrity = async () => {
    setVerifying(true)
    // Small delay for dramatic effect in demo
    await new Promise(r => setTimeout(r, 600))
    const result = await verifyChainIntegrity()

    // Try verifying via FastAPI backend with JWT Bearer token
    let backendVerified = false
    try {
      const token = getStoredToken()
      const res = await fetch('http://localhost:8000/api/hash-chain/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ blocks: chain }),
      })
      if (res.ok) {
        const data = await res.json()
        backendVerified = data.is_valid
      }
    } catch {
      // Backend offline, client-side cryptographic verification succeeded
    }

    setIntegrityResult({ ...result, backendVerified })
    setVerifying(false)
  }

  const handleTamper = () => {
    if (selectedBlock === null || !tamperValue) return
    tamperBlock(selectedBlock, tamperField, tamperField === 'trustScore' ? parseInt(tamperValue) : tamperValue)
    refreshChain()
    setTamperMode(false)
    setSelectedBlock(null)
    setTamperValue('')
  }

  const handleClearChain = () => {
    if (window.confirm('Clear the entire audit chain? This cannot be undone.')) {
      clearChain()
      refreshChain()
    }
  }

  const handleExportLedger = () => {
    const payload = {
      title: 'VeriFace AI Cryptographic Audit Ledger Export',
      exportedAt: new Date().toISOString(),
      blockCount: chain.length,
      merkleRoot: merkleRoot || 'N/A',
      chain,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `veriface_audit_ledger_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="text-2xl font-bold text-white mb-1">🔗 Audit Ledger</h2>
        <p className="text-slate-400 text-sm">
          Blockchain-anchored verification history ({chain.length} blocks)
        </p>
      </motion.div>

      {/* Action Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-2 mb-6 justify-center"
      >
        <button
          onClick={handleVerifyIntegrity}
          disabled={verifying || chain.length === 0}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-1.5"
        >
          {verifying ? (
            <>
              <span className="animate-spin-slow">⚡</span>
              Verifying...
            </>
          ) : (
            <>🛡️ Verify Chain Integrity</>
          )}
        </button>

        <button
          onClick={handleExportLedger}
          disabled={chain.length === 0}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
        >
          <span>📥</span> Export Ledger (JSON)
        </button>

        <button
          onClick={() => setTamperMode(!tamperMode)}
          disabled={chain.length === 0}
          className="bg-red-600/20 hover:bg-red-600/30 disabled:bg-slate-700 disabled:cursor-not-allowed text-red-400 text-sm font-medium py-2 px-4 rounded-lg transition-all border border-red-500/30"
        >
          🔓 Tamper Demo
        </button>

        <button
          onClick={handleClearChain}
          disabled={chain.length === 0}
          className="bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed text-slate-300 text-sm font-medium py-2 px-4 rounded-lg transition-all"
        >
          🗑️ Clear
        </button>

        <button
          onClick={onBack}
          className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-2 px-4 rounded-lg transition-all"
        >
          ← Back
        </button>
      </motion.div>

      {/* Tamper Panel */}
      <AnimatePresence>
        {tamperMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 mb-6 border-red-500/30"
          >
            <h3 className="text-sm font-bold text-red-400 mb-3">
              ⚠️ Tamper Demo — Modify a past block
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              This simulates a malicious edit. After tampering, click &quot;Verify Chain Integrity&quot;
              to see the chain detect the modification.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Block #</label>
                <select
                  value={selectedBlock ?? ''}
                  onChange={(e) => setSelectedBlock(parseInt(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
                >
                  <option value="">Select...</option>
                  {chain.map((_, i) => (
                    <option key={i} value={i}>Block #{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Field</label>
                <select
                  value={tamperField}
                  onChange={(e) => setTamperField(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
                >
                  <option value="trustScore">trustScore</option>
                  <option value="decision">decision</option>
                  <option value="name">name</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">New Value</label>
                <input
                  type="text"
                  value={tamperValue}
                  onChange={(e) => setTamperValue(e.target.value)}
                  placeholder="e.g. 100 or AUTHENTIC"
                  className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 w-40"
                />
              </div>
              <button
                onClick={handleTamper}
                disabled={selectedBlock === null || !tamperValue}
                className="bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-all"
              >
                Tamper!
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integrity Result */}
      <AnimatePresence>
        {integrityResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`glass-card p-4 mb-6 ${
              integrityResult.valid
                ? 'border-green-500/30'
                : 'border-red-500/30'
            }`}
          >
            <h3 className={`text-sm font-bold mb-2 ${
              integrityResult.valid ? 'text-green-400' : 'text-red-400'
            }`}>
              {integrityResult.valid
                ? '✅ Chain integrity verified — no tampering detected'
                : `❌ Chain integrity broken at Block #${integrityResult.brokenAtIndex}`
              }
            </h3>
            <div className="max-h-40 overflow-y-auto">
              {integrityResult.details.map((detail, i) => (
                <p key={i} className="text-xs text-slate-400 mb-1">{detail}</p>
              ))}
            </div>
            {integrityResult.backendVerified && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/40 text-[0.7rem] text-emerald-300 font-mono">
                <span>🔒 Double-Verified by Python + FastAPI Backend</span>
                <span className="text-emerald-500">•</span>
                <span>JWT Bearer Authorized</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {chain.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="text-5xl mb-4 opacity-30">🔗</div>
          <p className="text-slate-500 text-sm">No verification records yet.</p>
          <p className="text-slate-600 text-xs mt-1">Complete a verification to see blocks here.</p>
        </motion.div>
      )}

      {/* Block Chain */}
      <div className="space-y-0">
        {chain.map((block, index) => {
          const isBroken = integrityResult && !integrityResult.valid && integrityResult.brokenAtIndex === index
          const isVerified = integrityResult && integrityResult.valid

          return (
            <div key={index}>
              {/* Connector (except before first block) */}
              {index > 0 && (
                <div className={`block-connector ${isBroken ? 'broken' : ''}`} />
              )}

              <motion.div
                custom={index}
                variants={blockVariant}
                initial="hidden"
                animate="visible"
                className={`block-card ${isBroken ? 'tampered' : isVerified ? 'verified' : ''}`}
              >
                {/* Block header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                      Block #{block.index}
                    </span>
                    <span className={`decision-badge text-[0.6rem] py-0.5 px-2 ${
                      block.data.decision === 'AUTHENTIC' ? 'authentic' :
                      block.data.decision === 'SUSPICIOUS' ? 'suspicious' : 'fake'
                    }`}>
                      {block.data.decision}
                    </span>
                  </div>
                  <span className="text-[0.6rem] text-slate-500">
                    {new Date(block.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Block data */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div>
                    <span className="text-slate-500">ID: </span>
                    <span className="text-slate-300">{block.data.idNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Name: </span>
                    <span className="text-slate-300">{block.data.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Trust: </span>
                    <span className={
                      block.data.trustScore >= 85 ? 'text-green-400' :
                      block.data.trustScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }>
                      {block.data.trustScore}/100
                    </span>
                  </div>
                </div>

                {/* Hash */}
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <div className="hash-display">
                    <span className="text-slate-500 text-[0.6rem]">Hash: </span>
                    {block.hash.slice(0, 32)}...
                  </div>
                  <div className="hash-display mt-0.5">
                    <span className="text-slate-500 text-[0.6rem]">Prev: </span>
                    {block.prevHash.slice(0, 32)}...
                  </div>
                </div>

                {/* Broken indicator */}
                {isBroken && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    <p className="text-xs text-red-400 font-medium">
                      ⚠️ TAMPERED — data hash does not match stored hash
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* Merkle Root */}
      {merkleRoot && chain.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-4 mt-6"
        >
          <h3 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-1.5">
            🌳 Merkle Root
          </h3>
          <p className="text-xs text-slate-400 mb-2">
            This hash represents the entire batch of {chain.length} verification{chain.length === 1 ? '' : 's'}.
            At production scale, this single hash would be anchored on a public blockchain.
          </p>
          <div className="hash-display bg-slate-800/50 rounded-lg p-2 text-[0.65rem]">
            {merkleRoot}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default AuditLedger
