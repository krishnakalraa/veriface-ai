import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ROLES,
  ROLE_METADATA,
  DEMO_PRESETS,
  login,
  logout,
  getStoredToken,
  parseJwt,
  checkBackendHealth,
} from '../lib/auth'

export default function LoginModal({ isOpen, onClose, currentUser, onUserChange }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState({ online: false, checking: true })
  const [showTokenDetails, setShowTokenDetails] = useState(false)

  const activeToken = getStoredToken()
  const decodedPayload = activeToken ? parseJwt(activeToken) : null

  useEffect(() => {
    if (isOpen) {
      setError('')
      checkBackendHealth().then((status) => {
        setBackendStatus({ online: status.online, checking: false, data: status.data })
      })
    }
  }, [isOpen])

  const handleLoginSubmit = async (e) => {
    e?.preventDefault()
    if (!username || !password) {
      setError('Please provide both username and password')
      return
    }
    setLoading(true)
    setError('')
    const res = await login(username, password)
    setLoading(false)
    if (res.success) {
      onUserChange(res.user)
      onClose()
    } else {
      setError(res.error || 'Invalid credentials')
    }
  }

  const handleQuickLogin = async (preset) => {
    setLoading(true)
    setError('')
    const res = await login(preset.username, preset.password)
    setLoading(false)
    if (res.success) {
      onUserChange(res.user)
      onClose()
    } else {
      setError('Failed to log in with preset')
    }
  }

  const handleLogout = () => {
    logout()
    // Revert to officer or guest
    const res = login('officer', 'guard123')
    res.then((r) => {
      onUserChange(r.user)
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-slate-900/95 border border-purple-500/30 rounded-2xl p-6 shadow-2xl shadow-purple-950/50 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Security Identity & RBAC Clearance
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              JSON Web Token (JWT) + Role-Based Access Control Architecture
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Backend Status Banner */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                backendStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-mono">
              {backendStatus.checking
                ? 'Testing FastAPI Python connection...'
                : backendStatus.online
                ? 'Python + FastAPI Server: ACTIVE (http://localhost:8000)'
                : 'Python Backend: Offline (Autonomous Edge JWT Fallback Active)'}
            </span>
          </div>
          <span className="text-[0.65rem] px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono">
            HS256 SHA-256
          </span>
        </div>

        {/* Current User Pill */}
        {currentUser && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-600/40 flex items-center justify-center text-lg">
                {ROLE_METADATA[currentUser.role]?.badge.split(' ')[0] || '👤'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{currentUser.fullName}</span>
                  <span
                    className={`text-[0.65rem] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                      ROLE_METADATA[currentUser.role]?.bgColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {ROLE_METADATA[currentUser.role]?.badge || currentUser.role}
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400 font-mono mt-0.5">
                  ID: {currentUser.id} • Auth: {currentUser.backendType || 'JWT Bearer'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              Reset Session
            </button>
          </div>
        )}

        {/* 1-Click Role Switcher Presets for Evaluators */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span>
            <span>Instant Role Presets (1-Click Switch):</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DEMO_PRESETS.map((preset) => {
              const isCurrent = currentUser?.role === preset.role
              const meta = ROLE_METADATA[preset.role]
              return (
                <button
                  key={preset.username}
                  onClick={() => handleQuickLogin(preset)}
                  disabled={loading}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                    isCurrent
                      ? `${meta.borderColor} bg-purple-950/40 shadow-md shadow-purple-950/50`
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{preset.icon}</span>
                    {isCurrent && (
                      <span className="text-[0.6rem] bg-purple-600 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                    {meta.label}
                  </div>
                  <div className="text-[0.65rem] text-slate-400 mt-0.5 truncate">
                    {preset.fullName}
                  </div>
                  <div className="text-[0.62rem] text-slate-500 font-mono mt-1">
                    User: {preset.username}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Live Cryptographic JWT Inspector */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 font-mono flex items-center gap-1.5">
              <span>🔍</span>
              <span>Live JWT Token Inspector</span>
            </span>
            <button
              onClick={() => setShowTokenDetails(!showTokenDetails)}
              className="text-[0.65rem] text-purple-400 hover:text-purple-300 underline font-mono"
            >
              {showTokenDetails ? 'Collapse Claims' : 'Inspect Claims & Signature'}
            </button>
          </div>

          <div className="font-mono text-[0.68rem] bg-black/60 p-2.5 rounded-lg border border-slate-900 text-slate-400 overflow-x-auto break-all">
            <span className="text-rose-400">
              {activeToken ? activeToken.split('.')[0] : 'eyJhbGciOiJIUzI1Ni...'}
            </span>
            <span className="text-slate-600">.</span>
            <span className="text-purple-400">
              {activeToken ? activeToken.split('.')[1] : 'eyJzdWIiOiJhZG1pbi...'}
            </span>
            <span className="text-slate-600">.</span>
            <span className="text-cyan-400">
              {activeToken ? activeToken.split('.')[2] : 'signature_hash_bytes'}
            </span>
          </div>

          <AnimatePresence>
            {showTokenDetails && decodedPayload && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 border-t border-slate-800/80 font-mono text-[0.68rem] space-y-1.5"
              >
                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded">
                  <div>
                    <span className="text-slate-500">Subject (sub): </span>
                    <span className="text-purple-300">{decodedPayload.sub}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Role claim: </span>
                    <span className="text-cyan-300">{decodedPayload.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Issuer (iss): </span>
                    <span className="text-slate-300">{decodedPayload.iss}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Algorithm: </span>
                    <span className="text-emerald-300">HS256 (HMAC SHA-256)</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-3 pt-2 border-t border-slate-800">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Custom Account Credentials:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Username (e.g. admin)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-purple-500 px-3 py-2 rounded-lg text-xs text-white outline-none font-mono"
            />
            <input
              type="password"
              placeholder="Password (e.g. admin123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-purple-500 px-3 py-2 rounded-lg text-xs text-white outline-none font-mono"
            />
          </div>

          {error && <p className="text-xs text-rose-400 font-mono">⚠️ {error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition shadow-md shadow-purple-600/30"
            >
              {loading ? 'Authenticating...' : 'Sign In with JWT →'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
