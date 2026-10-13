import { useState } from 'react'
import { motion } from 'framer-motion'

const GAUGE_RADIUS = 80
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS

function getDecisionColor(decision) {
  switch (decision) {
    case 'AUTHENTIC':  return { stroke: '#22c55e', text: 'text-green-400', glow: 'glow-green', badge: 'authentic' }
    case 'SUSPICIOUS': return { stroke: '#eab308', text: 'text-yellow-400', glow: 'glow-yellow', badge: 'suspicious' }
    case 'FAKE':       return { stroke: '#ef4444', text: 'text-red-400', glow: 'glow-red', badge: 'fake' }
    default:           return { stroke: '#64748b', text: 'text-slate-400', glow: '', badge: '' }
  }
}

function getDecisionEmoji(decision) {
  switch (decision) {
    case 'AUTHENTIC':  return '✅'
    case 'SUSPICIOUS': return '⚠️'
    case 'FAKE':       return '❌'
    default:           return '❓'
  }
}

/**
 * @param {{
 *   trustScore: number,
 *   decision: string,
 *   reasons: string[],
 *   mismatchedFields: string[],
 *   onViewLedger: () => void,
 *   onNewVerification: () => void
 * }} props
 */
function ResultScreen({
  trustScore = 0,
  decision = '',
  reasons = [],
  mismatchedFields = [],
  idNumber = '',
  name = '',
  blockHash = '',
  blockIndex = null,
  mode = '',
  onViewLedger,
  onNewVerification,
}) {
  const [showReasons, setShowReasons] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const colors = getDecisionColor(decision)

  // Gauge calculation
  const fillPercent = Math.min(100, Math.max(0, trustScore)) / 100
  const dashOffset = GAUGE_CIRCUMFERENCE * (1 - fillPercent)

  const handleCopyHash = () => {
    if (!blockHash) return
    navigator.clipboard.writeText(blockHash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleDownloadProof = () => {
    const proofPayload = {
      title: 'VeriFace AI Verification Certificate',
      timestamp: new Date().toISOString(),
      subject: {
        idNumber: idNumber || 'N/A',
        name: name || 'N/A',
      },
      evaluation: {
        trustScore,
        decision,
        mode: mode || 'standard',
        mismatchedFields,
        reasons,
      },
      cryptographicAnchor: {
        blockIndex: blockIndex ?? 'N/A',
        blockHash: blockHash || 'Pending Local Hash',
        algorithm: 'SHA-256',
        chainType: 'VeriFace Tamper-Evident Merkle Hash Chain',
      },
      engine: 'VeriFace AI v1.0 Enterprise Trust Engine',
    }

    const blob = new Blob([JSON.stringify(proofPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `veriface_proof_${idNumber ? idNumber.replace(/\s+/g, '_') : 'audit'}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="text-2xl font-bold text-white mb-1">Verification Result</h2>
        <p className="text-slate-400 text-xs sm:text-sm">6-layer pipeline analysis complete</p>
      </motion.div>

      {/* Trust Score Gauge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 15 }}
        className={`trust-gauge-container mb-6 ${colors.glow} rounded-full`}
      >
        <svg className="trust-gauge-svg" viewBox="0 0 200 200">
          <circle
            className="trust-gauge-bg"
            cx="100"
            cy="100"
            r={GAUGE_RADIUS}
          />
          <motion.circle
            className="trust-gauge-fill"
            cx="100"
            cy="100"
            r={GAUGE_RADIUS}
            stroke={colors.stroke}
            strokeDasharray={GAUGE_CIRCUMFERENCE}
            initial={{ strokeDashoffset: GAUGE_CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.5 }}
          />
        </svg>
        <motion.span
          className={`trust-gauge-score ${colors.text}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {trustScore}
        </motion.span>
        <span className="trust-gauge-label text-slate-400">Trust Score</span>
      </motion.div>

      {/* Decision Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center mb-5"
      >
        <span className={`decision-badge ${colors.badge} text-base px-6 py-1.5`}>
          {getDecisionEmoji(decision)} {decision}
        </span>
      </motion.div>

      {/* Cryptographic Hash Snippet Banner */}
      {blockHash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 mb-4 flex items-center justify-between gap-2"
        >
          <div className="overflow-hidden">
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-purple-400 block">
              ⛓️ Block #{blockIndex ?? '0'} Anchor (SHA-256)
            </span>
            <span className="font-mono text-[0.68rem] text-slate-300 truncate block">
              {blockHash}
            </span>
          </div>
          <button
            onClick={handleCopyHash}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 transition shrink-0"
            title="Copy SHA-256 hash"
          >
            {copiedHash ? '✓ Copied' : '📋 Copy'}
          </button>
        </motion.div>
      )}

      {/* Mismatched Fields Summary */}
      {mismatchedFields.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="glass-card p-4 mb-4 border-red-500/30"
        >
          <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            <span>⚠️</span> Issues Found ({mismatchedFields.length})
          </h3>
          <ul className="space-y-1">
            {mismatchedFields.map((field, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5">•</span>
                {field}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Expandable Reasons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <button
          onClick={() => setShowReasons(!showReasons)}
          className="w-full glass-card glass-card-hover p-3 text-left flex items-center justify-between mb-4 transition-all"
        >
          <span className="text-sm font-medium text-slate-300">
            📋 Detailed Analysis ({reasons.length} items)
          </span>
          <motion.span
            animate={{ rotate: showReasons ? 180 : 0 }}
            className="text-slate-400 text-sm"
          >
            ▼
          </motion.span>
        </button>

        {showReasons && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 mb-4 max-h-64 overflow-y-auto"
          >
            <ul className="space-y-2">
              {reasons.map((reason, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-xs text-slate-300 leading-relaxed border-b border-slate-700/50 pb-2 last:border-0"
                >
                  {reason}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>

      {/* Download Certificate & Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="space-y-2"
      >
        <button
          onClick={handleDownloadProof}
          className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl transition shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 text-xs sm:text-sm"
        >
          <span>📜</span> Download Verification Proof (JSON)
        </button>

        <div className="flex gap-2">
          <button
            onClick={onViewLedger}
            className="flex-1 glass-card glass-card-hover py-2.5 px-3 text-xs sm:text-sm font-medium text-purple-300 hover:text-purple-200 transition text-center"
          >
            🔗 Audit Ledger
          </button>
          <button
            onClick={onNewVerification}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-3 rounded-xl transition text-xs sm:text-sm text-center shadow-lg shadow-purple-600/20"
          >
            🔄 New Verification
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default ResultScreen
