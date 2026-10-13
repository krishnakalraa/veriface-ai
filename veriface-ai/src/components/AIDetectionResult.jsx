import { motion } from 'framer-motion'

function AIDetectionResult({ result, image, onNewVerification }) {
  const error = result?.error
  const isAi = result?.verdict === 'AI-Generated'
  const syntheticScore = result?.details?.cloud?.synthetic_score ?? result?.details?.synthetic_score
  const fftScore = result?.details?.fft_score
  const isLocalFallback = result?.details?.note?.includes('locally')

  if (error) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-5 rounded-2xl border border-amber-500/30 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Document AI Check</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Analysis unavailable</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{error}</p>
        </div>
        <p className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-400">
          This mode does not query Supabase or write to the VeriFace audit chain. The image is sent to the separately configured document-detector API; that service may forward ambiguous images to its configured AI-detection provider.
        </p>
        <button onClick={onNewVerification} className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500">
          Back to operational modes
        </button>
      </section>
    )
  }

  const verdictColor = isAi ? 'text-rose-300' : 'text-emerald-300'
  const borderColor = isAi ? 'border-rose-500/30' : 'border-emerald-500/30'
  const verdictBg = isAi ? 'bg-rose-950/40 border-rose-700/40' : 'bg-emerald-950/40 border-emerald-700/40'
  const verdictIcon = isAi ? '🤖' : '📷'

  return (
    <section className={`mx-auto w-full max-w-3xl space-y-5 rounded-2xl border ${borderColor} bg-slate-900/80 p-5 shadow-2xl sm:p-8`}>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Database-free document analysis</p>
          {isLocalFallback && (
            <span className="text-[0.65rem] font-bold uppercase tracking-wider bg-amber-900/50 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full">
              ⚡ Offline Mode
            </span>
          )}
        </div>
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border ${verdictBg} mx-auto`}>
          <span className="text-3xl">{verdictIcon}</span>
          <h2 className={`text-3xl font-black sm:text-4xl ${verdictColor}`}>{result.verdict}</h2>
        </div>
        <p className="text-sm text-slate-400">
          Model confidence: <strong className="text-white font-mono">{Math.round(result.overall_confidence * 100)}%</strong>
        </p>
      </div>

      {/* Image + Stats */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.65fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-black/40">
          <img src={image} alt="Analyzed document" className="max-h-[360px] w-full object-contain" />
        </div>

        <div className="space-y-2.5 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 mb-3">Analysis Details</p>

          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Analysis path</span>
            <span className="text-right text-slate-100 text-xs">{result.tier_triggered}</span>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Latency</span>
            <span className="font-mono text-slate-100">{Math.round(result.execution_time_ms)} ms</span>
          </div>

          {syntheticScore != null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">AI likelihood</span>
              <span className={`font-mono font-bold ${syntheticScore > 0.5 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {Math.round(syntheticScore * 100)}%
              </span>
            </div>
          )}

          {fftScore != null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Noise variance</span>
              <span className="font-mono text-slate-100">{Math.round(fftScore * 100)}%</span>
            </div>
          )}

          {result.details?.entropy_mean != null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Pixel entropy</span>
              <span className="font-mono text-slate-100">{result.details.entropy_mean.toFixed(2)} bits</span>
            </div>
          )}

          {result.details?.edge_density != null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Edge density</span>
              <span className="font-mono text-slate-100">{(result.details.edge_density * 100).toFixed(1)}%</span>
            </div>
          )}

          {result.details?.chromatic_aberration != null && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Lens aberration</span>
              <span className="font-mono text-slate-100">{result.details.chromatic_aberration.toFixed(2)}</span>
            </div>
          )}

          {result.details?.cloud?.attribution && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Generator</span>
              <span className="text-right text-slate-100">{String(result.details.cloud.attribution)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Human-Captured</span>
          <span>AI-Generated</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round((syntheticScore ?? (isAi ? 0.72 : 0.28)) * 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${isAi ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-500'}`}
          />
        </div>
        <p className="text-center text-[0.65rem] text-slate-500">
          Synthetic probability: {Math.round((syntheticScore ?? (isAi ? 0.72 : 0.28)) * 100)}%
        </p>
      </div>

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-400 space-y-1"
      >
        {isLocalFallback ? (
          <p>
            <span className="text-amber-400 font-semibold">⚡ Offline analysis:</span> The FastAPI detector service was unreachable, so analysis ran locally in-browser using pixel-level forensic heuristics (Shannon entropy, Laplacian noise, chromatic aberration, edge density). For highest accuracy, start the FastAPI backend.
          </p>
        ) : (
          <p>
            This mode does not query Supabase or write to the VeriFace audit chain. The image is sent to the separately configured document-detector API; ambiguous images may be forwarded by that service to its cloud provider. A score-based label is not proof of provenance.
          </p>
        )}
      </motion.div>

      <button onClick={onNewVerification} className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500">
        Back to operational modes
      </button>
    </section>
  )
}

export default AIDetectionResult
