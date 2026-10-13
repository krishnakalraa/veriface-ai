import { motion } from 'framer-motion'
import { MODE_LIST } from '../config/modes'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
}

const cardVariant = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 20 } },
}

function ModeSelector({ selectedMode, onSelect }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl font-bold text-white mb-2">Select Operational Mode</h2>
        <p className="text-slate-400 text-sm">
          Choose how VeriFace AI should verify the document
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {MODE_LIST.map((mode) => {
          const isSelected = selectedMode === mode.id
          return (
            <motion.button
              key={mode.id}
              variants={cardVariant}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(mode.id)}
              className={`
                glass-card mode-card p-6 text-left transition-all duration-300
                ${isSelected ? 'selected glow-purple' : 'glass-card-hover'}
              `}
            >
              <div className="text-4xl mb-3">{mode.icon}</div>
              <h3 className={`text-lg font-bold mb-1 ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                {mode.label}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {mode.description}
              </p>

              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-center gap-1.5 text-purple-400 text-xs font-medium"
                >
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  Selected
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

export default ModeSelector
