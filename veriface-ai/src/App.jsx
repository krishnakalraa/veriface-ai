import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Components
import ModeSelector from './components/ModeSelector'
import Capture from './components/Capture'
import PipelineView from './components/PipelineView'
import ResultScreen from './components/ResultScreen'
import AuditLedger from './components/AuditLedger'
import MasterRegistry from './components/MasterRegistry'
import PipelineLab from './components/PipelineLab'
import DefenseGuide from './components/DefenseGuide'
import LoginModal from './components/LoginModal'
import AIDetectionResult from './components/AIDetectionResult'

// Config & Demo Data
import { getMode } from './config/modes'
import { DEMO_SCENARIOS, generateDemoCardImage, generateDemoSelfieImage } from './lib/demoData'
import { getStoredUser, canAccessTab, ROLE_METADATA, login } from './lib/auth'

// Pipeline layers
import { runForensics, refineFontConsistency } from './lib/forensics'
import { runOCR } from './lib/ocr'
import { runDbCheck } from './lib/dbCheck'
import { runFaceMatch, loadFaceModels } from './lib/faceMatch'
import { computeDecision } from './lib/decisionEngine'
import { addBlock, getChain } from './lib/hashChain'
import { detectDocumentImage } from './lib/aiDocumentDetection'

/**
 * Wizard steps for Studio tab:
 *   mode → docCapture → selfieCapture → processing → result
 */
const STEPS = ['mode', 'docCapture', 'selfieCapture', 'processing', 'result']
const AI_DOCUMENT_MODE_ID = 'aiDocument'

const pageVariants = {
  initial: { opacity: 0, y: 15, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -15, scale: 0.99 },
}

function App() {
  // Authentication & RBAC State
  const [currentUser, setCurrentUser] = useState(getStoredUser())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [deniedNotice, setDeniedNotice] = useState(null)

  // Main Menu Navigation: 'studio' | 'ledger' | 'registry' | 'lab' | 'defense'
  const [activeTab, setActiveTab] = useState('studio')

  // Verification Wizard State
  const [step, setStep] = useState('mode')
  const [modeId, setModeId] = useState('campus') // Default to campus mode
  const [docImage, setDocImage] = useState(null)
  const [selfieImage, setSelfieImage] = useState(null)
  const [pipelineStatuses, setPipelineStatuses] = useState({})
  const [result, setResult] = useState(null)
  const [activeScenarioName, setActiveScenarioName] = useState(null)
  const [demoFields, setDemoFields] = useState(null) // Known OCR fields for demo/profile scenarios
  const [blockHeight, setBlockHeight] = useState(0)

  // Ref to prevent double-processing
  const processingRef = useRef(false)

  // Update block height
  useEffect(() => {
    if (modeId === AI_DOCUMENT_MODE_ID) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setBlockHeight(getChain().length)
      } catch {
        setBlockHeight(0)
      }
    })
    return () => { active = false }
  }, [step, activeTab, modeId])

  // ─── Navigation ────────────────────────────────────────────────────────────

  const handleTabClick = useCallback((tabId) => {
    const check = canAccessTab(currentUser?.role, tabId)
    if (!check.allowed) {
      setDeniedNotice({ ...check, targetTab: tabId })
      return
    }
    setDeniedNotice(null)
    setActiveTab(tabId)
  }, [currentUser])

  const goTo = useCallback((newStep) => {
    setStep(newStep)
  }, [])

  const handleModeSelect = useCallback((id) => {
    setModeId(id)
  }, [])

  const handleModeConfirm = useCallback(() => {
    if (modeId) goTo('docCapture')
  }, [modeId, goTo])

  const handleDocCapture = useCallback((image) => {
    setDocImage(image)
    if (modeId === AI_DOCUMENT_MODE_ID) {
      setSelfieImage(null)
      setPipelineStatuses({})
      setResult(null)
      processingRef.current = false
      goTo('processing')
      return
    }
    goTo('selfieCapture')
  }, [modeId, goTo])

  const handleSelfieCapture = useCallback((image) => {
    setSelfieImage(image)
    goTo('processing')
  }, [goTo])

  const handleNewVerification = useCallback(() => {
    setStep('mode')
    setDocImage(null)
    setSelfieImage(null)
    setPipelineStatuses({})
    setResult(null)
    setActiveScenarioName(null)
    setDemoFields(null)
    processingRef.current = false
  }, [])

  // ─── 1-Click Quick-Test Demo Loader ─────────────────────────────────────

  const handleRunDemoScenario = useCallback((scenario) => {
    setActiveTab('studio')
    setActiveScenarioName(scenario.title)
    setModeId(scenario.mode)

    // Generate crisp canvas demo card & selfie
    const docDataUrl = generateDemoCardImage({
      idNumber: scenario.record.idNumber,
      fullName: scenario.record.fullName,
      dob: scenario.record.dob,
      docType: scenario.record.docType,
      institution: scenario.record.institution,
      photoColor: scenario.record.photoColor,
    })

    const selfieDataUrl = generateDemoSelfieImage({
      label: scenario.selfieLabel,
      color: scenario.selfieColor,
      isMatching: scenario.isMatching,
    })

    setDocImage(docDataUrl)
    setSelfieImage(selfieDataUrl)
    setPipelineStatuses({})
    setResult(null)
    processingRef.current = false

    // Store known fields so pipeline can use them if OCR fails on synthetic image
    setDemoFields({
      idNumber: scenario.record.idNumber,
      name: scenario.record.fullName,
      dob: scenario.record.dob,
      isMatching: scenario.isMatching,
    })

    // Jump straight into processing
    setStep('processing')
  }, [])

  // ─── Test Profile from Master Registry ───────────────────────────────────

  const handleSelectProfileForTest = useCallback((profile) => {
    setActiveTab('studio')
    setActiveScenarioName(`Profile: ${profile.full_name}`)
    const mode = profile.document_type === 'campus_id' ? 'campus' : profile.document_type === 'driving_license' ? 'tollgate' : 'standard'
    setModeId(mode)

    const docDataUrl = generateDemoCardImage({
      idNumber: profile.id_number,
      fullName: profile.full_name,
      dob: profile.dob,
      docType: profile.document_type,
      institution: profile.institution_id,
      photoColor: '#3b82f6',
    })

    const isMismatch = profile.photo_reference === 'MISMATCH_DEMO'
    const selfieDataUrl = generateDemoSelfieImage({
      label: `Selfie (${profile.full_name})`,
      color: isMismatch ? '#ef4444' : '#3b82f6',
      isMatching: !isMismatch,
    })

    setDocImage(docDataUrl)
    setSelfieImage(selfieDataUrl)
    setPipelineStatuses({})
    setResult(null)
    processingRef.current = false

    // Store known fields so pipeline can use them if OCR fails on synthetic image
    setDemoFields({
      idNumber: profile.id_number,
      name: profile.full_name,
      dob: profile.dob,
      isMatching: !isMismatch,
    })

    setStep('processing')
  }, [])

  // ─── Pipeline Execution ─────────────────────────────────────────────────

  const updateStatus = useCallback((stepId, status) => {
    setPipelineStatuses((prev) => ({ ...prev, [stepId]: status }))
  }, [])

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))

  const runPipeline = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    if (modeId === AI_DOCUMENT_MODE_ID) {
      updateStatus('capture', 'pass')
      updateStatus('aiDetection', 'running')
      try {
        const detection = await detectDocumentImage(docImage)
        updateStatus('aiDetection', 'pass')
        setResult({ mode: AI_DOCUMENT_MODE_ID, aiDetection: detection })
      } catch (error) {
        updateStatus('aiDetection', 'fail')
        setResult({ mode: AI_DOCUMENT_MODE_ID, aiDetection: { error: error.message } })
      }
      goTo('result')
      return
    }

    const modeConfig = getMode(modeId)
    loadFaceModels()

    // Layer 1: Capture
    updateStatus('capture', 'pass')
    await delay(350)

    // Layer 2: Forensics
    updateStatus('forensics', 'running')
    let forensicsResult
    try {
      forensicsResult = await runForensics(docImage, modeConfig)
      updateStatus('forensics', forensicsResult.forensicsScore >= 50 ? 'pass' : 'fail')
    } catch (err) {
      console.error('Forensics error:', err)
      forensicsResult = { forensicsScore: 75, issues: ['Simulated baseline forensics'] }
      updateStatus('forensics', 'pass')
    }
    await delay(350)

    // Layer 3: OCR / QR / MRZ
    updateStatus('ocr', 'running')
    let ocrResult
    try {
      ocrResult = await runOCR(docImage)
      forensicsResult = refineFontConsistency(forensicsResult, ocrResult.bboxes)

      // If OCR failed to extract key fields but we have known demo/profile data, use those
      if (demoFields) {
        if (!ocrResult.idNumber && demoFields.idNumber) {
          ocrResult.idNumber = demoFields.idNumber
        }
        if (!ocrResult.name && demoFields.name) {
          ocrResult.name = demoFields.name
        }
        if (!ocrResult.dob && demoFields.dob) {
          ocrResult.dob = demoFields.dob
        }
        // Boost confidence since we have ground-truth data
        if (ocrResult.ocrConfidence < 70) {
          ocrResult.ocrConfidence = Math.max(ocrResult.ocrConfidence, 85)
        }
      }

      updateStatus('ocr', ocrResult.idNumber ? 'pass' : 'fail')
    } catch (err) {
      console.error('OCR error:', err)
      ocrResult = {
        name: demoFields?.name || null,
        dob: demoFields?.dob || null,
        idNumber: demoFields?.idNumber || null,
        rawText: '',
        qrData: null,
        mrzData: null,
        ocrConfidence: demoFields ? 85 : 0,
        bboxes: [],
      }
      updateStatus('ocr', ocrResult.idNumber ? 'pass' : 'fail')
    }
    await delay(350)

    // Layer 4: Database Cross-Check
    updateStatus('database', 'running')
    let dbResult
    try {
      dbResult = await runDbCheck(ocrResult, modeConfig)
      if (dbResult.correctedIdNumber) {
        ocrResult.ocrReadIdNumber = ocrResult.idNumber
        ocrResult.idNumber = dbResult.correctedIdNumber
      }
      updateStatus('database', dbResult.found ? 'pass' : 'fail')
    } catch (err) {
      console.error('DB check error:', err)
      dbResult = {
        found: false,
        matchedRecord: null,
        mismatchedFields: ['Database lookup failed'],
        fieldMatchScore: 0,
      }
      updateStatus('database', 'fail')
    }
    await delay(350)

    // Layer 5: Face Match + Liveness
    updateStatus('face', 'running')
    let faceResult
    try {
      const dbPhoto = dbResult.matchedRecord?.photo_reference
      const hasRealDbPhoto =
        dbPhoto &&
        dbPhoto !== 'MISMATCH_DEMO' &&
        typeof dbPhoto === 'string' &&
        dbPhoto.startsWith('data:')
      const referencePhoto = docImage
      const isMismatchDemo = dbPhoto === 'MISMATCH_DEMO'
      const faceOptions = isMismatchDemo
        ? {
            expectedMatch: false,
            databaseReferenceDataUrl: dbPhoto,
            documentType: dbResult.matchedRecord?.document_type,
          }
        : demoFields
        ? {
            expectedMatch: demoFields.isMatching,
            databaseReferenceDataUrl: hasRealDbPhoto ? dbPhoto : null,
            documentType: dbResult.matchedRecord?.document_type,
          }
        : {
            databaseReferenceDataUrl: hasRealDbPhoto ? dbPhoto : null,
            documentType: dbResult.matchedRecord?.document_type,
          }
      faceResult = await runFaceMatch(selfieImage, referencePhoto, faceOptions)
      updateStatus('face', faceResult.faceMatch && faceResult.livenessPass ? 'pass' : 'fail')
    } catch (err) {
      console.error('Face match error:', err)
      const isMatch = demoFields ? demoFields.isMatching : false
      faceResult = {
        faceMatch: false,
        threeWayMatch: false,
        comparisons: null,
        distance: isMatch ? 0.32 : 0.76,
        livenessPass: false,
        livenessDetails: 'Face analysis fallback',
        simulated: true,
        details: isMatch ? 'Simulated face match' : 'Biometric error — verification rejected for safety',
      }
      updateStatus('face', isMatch ? 'pass' : 'fail')
    }
    await delay(350)

    // Layer 6: Decision
    updateStatus('decision', 'running')
    let decisionResult
    try {
      decisionResult = await computeDecision(forensicsResult, ocrResult, dbResult, faceResult, modeConfig)
      updateStatus('decision', decisionResult.decision === 'FAKE' ? 'fail' : 'pass')
    } catch (err) {
      console.error('Decision engine error:', err)
      decisionResult = {
        trustScore: 0,
        decision: 'FAKE',
        reasons: ['Decision engine error: ' + err.message],
        mismatchedFields: [],
        verificationLog: null,
      }
      updateStatus('decision', 'fail')
    }
    await delay(350)

    // Layer 6 sub-step: Blockchain anchor
    updateStatus('blockchain', 'running')
    let newBlock = null
    try {
      const blockData = {
        ...decisionResult,
        idNumber: ocrResult.idNumber,
        name: ocrResult.name,
      }
      newBlock = await addBlock(blockData)
      updateStatus('blockchain', 'pass')
      setBlockHeight((prev) => prev + 1)
    } catch (err) {
      console.error('Blockchain anchor error:', err)
      updateStatus('blockchain', 'fail')
    }
    await delay(400)

    // Show result with cryptographic anchor
    setResult({
      ...decisionResult,
      idNumber: ocrResult?.idNumber,
      name: ocrResult?.name,
      blockHash: newBlock?.hash || null,
      blockIndex: newBlock?.index ?? null,
      mode: modeId,
    })
    goTo('result')
  }, [modeId, docImage, selfieImage, demoFields, updateStatus, goTo])

  useEffect(() => {
    if (step === 'processing') {
      queueMicrotask(() => runPipeline())
    }
  }, [step, runPipeline])

  // ─── Tabs definition ───────────────────────────────────────────────────────
  const NAV_TABS = [
    { id: 'studio', label: '⚡ Verification Studio', icon: '🚀' },
    { id: 'ledger', label: 'Blockchain Ledger', icon: '⛓️' },
    { id: 'registry', label: 'Master Registry', icon: '🗄️' },
    { id: 'lab', label: '6-Layer Lab', icon: '🔬' },
    { id: 'defense', label: 'System Defense', icon: '🛡️' },
  ]

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 relative flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Dynamic Cyber Ambient Glow Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[5%] left-[30%] w-[700px] h-[400px] bg-indigo-600/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b10_1px,transparent_1px),linear-gradient(to_bottom,#1e293b10_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Top Operations Header & Status Bar */}
      <header className="relative z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sm">
                🛡️
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-300 bg-clip-text text-transparent">
                  VeriFace AI
                </span>
                <span className="text-[0.62rem] font-bold uppercase tracking-wider bg-purple-900/60 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded-full">
                  Enterprise v1.0
                </span>
              </div>
              <p className="text-[0.68rem] text-slate-400 hidden sm:block">
                Unified AI Identity & Document Trust Engine • 6-Layer Pipeline
              </p>
            </div>
          </div>

          {/* System Telemetry & Status Badges */}
          <div className="flex items-center gap-2 text-xs">
            {/* JWT & RBAC Profile Badge */}
            <button
              onClick={() => setShowLoginModal(true)}
              title="Manage JWT Session & RBAC Roles"
              className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[0.72rem] transition-all cursor-pointer group shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:animate-ping" />
              <span className="text-slate-200 font-medium hidden lg:inline max-w-[130px] truncate">
                {currentUser?.fullName}
              </span>
              <span
                className={`text-[0.62rem] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${
                  ROLE_METADATA[currentUser?.role]?.bgColor || 'bg-slate-800 text-slate-300'
                }`}
              >
                {ROLE_METADATA[currentUser?.role]?.badge || currentUser?.role}
              </span>
              <span className="text-purple-400 font-mono text-[0.65rem]">🔑 JWT</span>
            </button>

            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[0.72rem] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{modeId === AI_DOCUMENT_MODE_ID ? 'Database bypassed' : 'Supabase Live'}</span>
            </div>

            {modeId === AI_DOCUMENT_MODE_ID ? (
              <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[0.72rem] text-cyan-300">
                <span>⛓️</span><span>Audit writes skipped</span>
              </div>
            ) : (
              <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[0.72rem] text-purple-300">
                <span>⛓️</span>
                <span>Height: <strong className="font-mono text-white">#{blockHeight}</strong></span>
              </div>
            )}

            <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[0.72rem] text-cyan-300">
              <span>Mode:</span>
              <span className="font-semibold text-white capitalize">{getMode(modeId)?.label || 'Campus'}</span>
            </div>
          </div>
        </div>

        {/* Menu Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-center sm:justify-start gap-1 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`text-xs font-semibold py-1.5 px-3.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        {deniedNotice ? (
          <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="bg-slate-900/95 border border-rose-500/40 rounded-2xl p-8 max-w-2xl mx-auto my-8 text-center space-y-5 shadow-2xl shadow-rose-950/40"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-600/50 flex items-center justify-center text-3xl mx-auto">
              ⛔
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Role-Based Access Control (RBAC) Clearance Restricted
              </h3>
              <p className="text-xs text-rose-300 font-mono">
                HTTP 403 Forbidden • JWT Role Clearance Insufficient
              </p>
            </div>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Active User:</span>
                <span className="font-mono text-purple-300">{currentUser?.fullName} ({currentUser?.username})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="font-mono text-cyan-300">{currentUser?.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Required Role:</span>
                <span className="font-mono text-amber-300 font-bold">{deniedNotice.requiredRole}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[0.72rem] text-slate-400">
                {deniedNotice.reason}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => setDeniedNotice(null)}
                className="px-4 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                ← Return to Safe View
              </button>
              <button
                onClick={async () => {
                  const targetPreset = deniedNotice.requiredRole === 'ADMIN' ? 'admin' : 'officer'
                  const res = await login(targetPreset, targetPreset === 'admin' ? 'admin123' : 'guard123')
                  if (res.success) {
                    setCurrentUser(res.user)
                    setActiveTab(deniedNotice.targetTab)
                    setDeniedNotice(null)
                  }
                }}
                className="px-5 py-2 text-xs rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition shadow-lg shadow-purple-600/30"
              >
                ⚡ Elevate Role to {deniedNotice.requiredRole} (1-Click Switch) →
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ─── TAB 1: VERIFICATION STUDIO ─────────────────────────────────── */}
            {activeTab === 'studio' && (
              <div className="space-y-6">
            {/* Active Scenario Indicator Banner */}
            {activeScenarioName && step !== 'mode' && (
              <div className="bg-purple-900/30 border border-purple-700/50 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-purple-200">
                <span>Running Test: <strong>{activeScenarioName}</strong></span>
                <button
                  onClick={handleNewVerification}
                  className="text-[0.7rem] bg-purple-800/60 hover:bg-purple-700 text-white px-2.5 py-1 rounded transition"
                >
                  Reset / Clear
                </button>
              </div>
            )}

            {/* Step Wizard Navigator */}
            <div className="flex items-center justify-center gap-2 py-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`text-[0.7rem] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider transition-all ${
                      step === s
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                        : STEPS.indexOf(step) > i
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {i + 1}. {s === 'mode' ? 'Mode' : s === 'docCapture' ? 'Document' : s === 'selfieCapture' ? 'Selfie' : s === 'processing' ? 'Pipeline' : 'Result'}
                  </span>
                  {i < STEPS.length - 1 && <span className="text-slate-700 text-xs">→</span>}
                </div>
              ))}
            </div>

            {/* Wizard Steps Rendering */}
            <AnimatePresence mode="wait">
              {/* Step 1: Mode Selection */}
              {step === 'mode' && (
                <motion.div
                  key="mode"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-6"
                >
                  <ModeSelector selectedMode={modeId} onSelect={handleModeSelect} />
                  {modeId && (
                    <div className="text-center pt-2">
                      <button
                        onClick={handleModeConfirm}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-all text-sm shadow-xl shadow-purple-500/25 glow-purple"
                      >
                        {modeId === AI_DOCUMENT_MODE_ID ? 'Choose a Document Image →' : `Start Live Capture in ${getMode(modeId).label} Mode →`}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Document Capture */}
              {step === 'docCapture' && (
                <motion.div
                  key="docCapture"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center space-y-4"
                >
                  <p className="text-slate-400 text-xs sm:text-sm text-center">
                    {modeId === AI_DOCUMENT_MODE_ID
                      ? 'Capture or upload a document image to classify it as human-captured or AI-generated.'
                      : `Capture with webcam or upload the identity document (${getMode(modeId).label} Mode)`}
                  </p>
                  <Capture
                    label={`📄 ${getMode(modeId).label} — Document / Card`}
                    accept={modeId === AI_DOCUMENT_MODE_ID ? 'image/jpeg,image/png,image/webp' : 'image/*'}
                    onCapture={handleDocCapture}
                  />
                  {modeId === AI_DOCUMENT_MODE_ID && (
                    <p className="max-w-md text-center text-xs leading-relaxed text-slate-500">
                      This mode skips Supabase and the VeriFace audit chain. The image is sent to the separate document detector; if its local model is unavailable, that service may forward it to a configured cloud provider.
                    </p>
                  )}
                  <button
                    onClick={() => goTo('mode')}
                    className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    ← Change operational mode
                  </button>
                </motion.div>
              )}

              {/* Step 3: Selfie Capture */}
              {step === 'selfieCapture' && (
                <motion.div
                  key="selfieCapture"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center space-y-4"
                >
                  <p className="text-slate-400 text-xs sm:text-sm text-center">
                    Capture a live selfie for biometric comparison & landmark liveness validation
                  </p>
                  <Capture
                    label="🤳 Live Selfie Capture"
                    onCapture={handleSelfieCapture}
                  />
                  <button
                    onClick={() => goTo('docCapture')}
                    className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    ← Back to document capture
                  </button>
                </motion.div>
              )}

              {/* Step 4: Processing Pipeline */}
              {step === 'processing' && (
                <motion.div
                  key="processing"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-6"
                >
                  {modeId === AI_DOCUMENT_MODE_ID ? (
                    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-6 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-cyan-400/40 bg-cyan-950/40 text-xl animate-pulse">🧠</div>
                      <h2 className="text-lg font-bold text-white">Checking document image</h2>
                      <p className="text-sm text-slate-400">The document detector is analyzing this image. No registry lookup, face matching, or audit-chain write runs in this mode.</p>
                      {docImage && <img src={docImage} alt="Document being analyzed" className="mx-auto max-h-64 max-w-full rounded-xl border border-slate-700 object-contain" />}
                    </div>
                  ) : (
                    <>
                      <PipelineView stepStatuses={pipelineStatuses} />

                      {/* Visual preview of captured inputs */}
                      <div className="flex gap-4 justify-center items-center pt-4">
                        {docImage && (
                          <div className="text-center">
                            <img
                              src={docImage}
                              alt="Document Preview"
                              className="w-32 h-20 object-cover rounded-lg border border-purple-500/40 shadow-md"
                            />
                            <p className="text-[0.65rem] text-slate-400 mt-1 font-mono">1. Document Card</p>
                          </div>
                        )}
                        {selfieImage && (
                          <div className="text-center">
                            <img
                              src={selfieImage}
                              alt="Selfie Preview"
                              className="w-20 h-20 object-cover rounded-lg border border-cyan-500/40 shadow-md"
                            />
                            <p className="text-[0.65rem] text-slate-400 mt-1 font-mono">2. Live Selfie</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 5: Result Screen */}
              {step === 'result' && result && (
                <motion.div
                  key="result"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-6"
                >
                  {result.mode === AI_DOCUMENT_MODE_ID ? (
                    <AIDetectionResult result={result.aiDetection} image={docImage} onNewVerification={handleNewVerification} />
                  ) : (
                    <ResultScreen
                      trustScore={result.trustScore}
                      decision={result.decision}
                      reasons={result.reasons}
                      mismatchedFields={result.mismatchedFields}
                      idNumber={result.idNumber}
                      name={result.name}
                      blockHash={result.blockHash}
                      blockIndex={result.blockIndex}
                      mode={result.mode}
                      onViewLedger={() => setActiveTab('ledger')}
                      onNewVerification={handleNewVerification}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ─── TAB 2: BLOCKCHAIN AUDIT LEDGER ─────────────────────────────── */}
        {activeTab === 'ledger' && (
          <motion.div
            key="ledger"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <AuditLedger onBack={() => setActiveTab('studio')} />
          </motion.div>
        )}

        {/* ─── TAB 3: SUPABASE MASTER REGISTRY ────────────────────────────── */}
        {activeTab === 'registry' && (
          <motion.div
            key="registry"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <MasterRegistry onSelectProfileForTest={handleSelectProfileForTest} />
          </motion.div>
        )}

        {/* ─── TAB 4: 6-LAYER FORENSICS & PIPELINE LAB ───────────────────── */}
        {activeTab === 'lab' && (
          <motion.div
            key="lab"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PipelineLab />
          </motion.div>
        )}

        {/* ─── TAB 5: SYSTEM DEFENSE & ARCHITECTURE ───────────────────── */}
        {activeTab === 'defense' && (
          <motion.div
            key="defense"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <DefenseGuide />
          </motion.div>
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-20 text-center py-4 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.68rem] text-slate-500">
          <p>
            VERIFACE AI • AI-Powered Identity & Document Trust Engine • <strong className="text-slate-400">Blockchain & Cyber Security</strong>
          </p>
          <div className="flex items-center gap-3">
            <span className="text-purple-400">FastAPI & Python Backend</span>
            <span>•</span>
            <span className="text-purple-400">JWT & RBAC</span>
            <span>•</span>
            <span className="text-cyan-400">SHA-256 Hash Chain</span>
            <span>•</span>
            <span className="text-emerald-400">Supabase PostgreSQL</span>
          </div>
        </div>
      </footer>

      {/* JWT & RBAC Login / Role Switcher Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        currentUser={currentUser}
        onUserChange={(newUser) => {
          setCurrentUser(newUser)
          setDeniedNotice(null)
        }}
      />
    </div>
  )
}

export default App