import { motion, AnimatePresence } from 'framer-motion'

/**
 * Pipeline steps matching the 6-layer architecture.
 * Layer 6 (Decision) includes a sub-step for the blockchain audit trail
 * to make it visible in the demo without being a 7th step.
 */
const PIPELINE_STEPS = [
  { id: 'capture',   layer: 1, label: 'Capture',           icon: '📷', description: 'Document & selfie captured' },
  { id: 'forensics', layer: 2, label: 'Forensics',         icon: '🔬', description: 'Template & print consistency check' },
  { id: 'ocr',       layer: 3, label: 'OCR / QR / MRZ',    icon: '📝', description: 'Extract machine-readable data' },
  { id: 'database',  layer: 4, label: 'Database',          icon: '🗃️', description: 'Cross-check against records' },
  { id: 'face',      layer: 5, label: 'Live Face',         icon: '👤', description: 'Face match & liveness check' },
  { id: 'decision',  layer: 6, label: 'Decision',          icon: '⚖️', description: 'Trust score & verdict',
    subStep: { id: 'blockchain', label: 'Writing to audit chain', icon: '🔗' }
  },
]

function getStatusEmoji(status) {
  switch (status) {
    case 'running':  return '⚡'
    case 'pass':     return '✅'
    case 'fail':     return '❌'
    default:         return '⏳'
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'running':  return 'running'
    case 'pass':     return 'pass'
    case 'fail':     return 'fail'
    default:         return ''
  }
}

const stepVariant = {
  hidden: { opacity: 0, x: -30 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, type: 'spring', damping: 20 },
  }),
}

/**
 * @param {{ stepStatuses: Record<string, 'pending'|'running'|'pass'|'fail'> }} props
 * stepStatuses keys match the PIPELINE_STEPS id values.
 * Also supports 'blockchain' as a sub-step key under 'decision'.
 */
function PipelineView({ stepStatuses = {} }) {
  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="text-xl font-bold text-white mb-1">Verification Pipeline</h2>
        <p className="text-slate-400 text-sm">Processing your document through 6 security layers</p>
      </motion.div>

      <div className="space-y-1">
        {PIPELINE_STEPS.map((step, index) => {
          const status = stepStatuses[step.id] || 'pending'
          const statusEmoji = getStatusEmoji(status)
          const statusClass = getStatusClass(status)
          const subStatus = step.subStep ? (stepStatuses[step.subStep.id] || 'pending') : null

          return (
            <motion.div
              key={step.id}
              custom={index}
              variants={stepVariant}
              initial="hidden"
              animate="visible"
              className="pipeline-step pb-4"
            >
              {/* Step icon */}
              <div className={`pipeline-step-icon ${statusClass}`}>
                {status === 'running' ? (
                  <span className="animate-spin-slow">{step.icon}</span>
                ) : (
                  statusEmoji
                )}
              </div>

              {/* Step content */}
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.65rem] font-bold text-purple-400/70 uppercase tracking-wider">
                    Layer {step.layer}
                  </span>
                  <AnimatePresence>
                    {status === 'running' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[0.6rem] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-medium"
                      >
                        Processing...
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <h3 className={`font-semibold text-sm ${
                  status === 'pass' ? 'text-green-400' :
                  status === 'fail' ? 'text-red-400' :
                  status === 'running' ? 'text-purple-300' :
                  'text-slate-300'
                }`}>
                  {step.label}
                </h3>

                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>

                {/* Sub-step for blockchain (inside Layer 6) */}
                {step.subStep && subStatus && subStatus !== 'pending' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 ml-2 pl-3 border-l-2 border-purple-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{step.subStep.icon}</span>
                      <span className={`text-xs font-medium ${
                        subStatus === 'pass' ? 'text-green-400' :
                        subStatus === 'fail' ? 'text-red-400' :
                        subStatus === 'running' ? 'text-purple-300' :
                        'text-slate-400'
                      }`}>
                        {step.subStep.label}
                      </span>
                      <span className="text-xs">{getStatusEmoji(subStatus)}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default PipelineView
