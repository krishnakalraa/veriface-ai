import { motion } from 'framer-motion'

function DefenseGuide() {
  const FAQS = [
    {
      q: 'Why is the Blockchain component not a separate 7th or 8th layer?',
      a: 'The 6-layer pipeline is modular and standardized. Layer 6 (Decision) computes the trust score, renders the decision, and writes a blockchain-anchored (hash-chained + Merkle-rooted) entry to the audit log. The blockchain mechanism makes that audit trail cryptographically tamper-evident, extending Layer 6 rather than adding an unneeded layer.',
      badge: 'Pipeline Design',
      color: 'purple',
    },
    {
      q: 'Why do we only store SHA-256 hashes on the blockchain and not raw documents or photos?',
      a: 'Storing high-resolution biometric images or identity scans on any blockchain creates severe storage bloat, latency bottlenecks, and major data privacy (GDPR / Indian DPDP Act) non-compliance. Our architecture splits responsibilities: Supabase PostgreSQL provides scalable, relational query storage, while the SHA-256 hash-chain provides mathematical, non-repudiable proof of data integrity.',
      badge: 'Architecture',
      color: 'cyan',
    },
    {
      q: 'Why use Two-Tier Decisioning with Hard Overrides instead of just a weighted average?',
      a: 'A simple weighted average allows a critical security failure (e.g., face mismatch = 0%, or unregistered ID = 0%) to be masked by high scores in OCR (100%) and Forensics (95%), yielding an average of ~65% (which would falsely pass as "Suspicious" instead of "Fake"). Our Hard-Override Gates guarantee that if an ID is missing from the database or the face fails the strict 0.5 distance threshold, the system immediately issues a hard "FAKE" verdict.',
      badge: 'Cyber Security',
      color: 'emerald',
    },
    {
      q: 'What real-world security challenges does VeriFace AI address?',
      a: 'VeriFace AI targets automated, tamper-proof identity trust systems under a unified Blockchain & Cyber Security framework. It replaces slow, vulnerable manual ID checks with a multi-layered biometric and cryptographic engine capable of operating across Campus security, High-speed Toll Gates, and Standard Citizen ID checkpoints.',
      badge: 'Security Scope',
      color: 'amber',
    },
  ]

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">🛡️ System Defense & Architecture</h2>
          <span className="bg-purple-900/60 text-purple-300 border border-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
            Blockchain & Cyber Security
          </span>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Security briefing sheet, threat model, and architectural justifications for VeriFace AI.
        </p>
      </div>

      {/* 6-Layer Architecture Pipeline Diagram */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-5 border border-slate-700 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📐</span> Official 6-Layer Verification Pipeline Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          {[
            { num: 1, name: 'Capture', desc: 'Doc image + live selfie' },
            { num: 2, name: 'Forensics', desc: 'Template & font heuristic' },
            { num: 3, name: 'OCR/QR/MRZ', desc: 'Field & barcode extract' },
            { num: 4, name: 'Database', desc: 'Supabase lookup + fuzzy' },
            { num: 5, name: 'Live Face', desc: 'Descriptor match (<0.5)' },
            { num: 6, name: 'Decision', desc: 'Trust Score + Blockchain Anchor' },
          ].map((item, idx) => (
            <div
              key={item.num}
              className={`p-3 rounded-lg border relative flex flex-col justify-between ${
                item.num === 6
                  ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300'
              }`}
            >
              <div>
                <span className="text-[0.65rem] font-bold text-slate-500 uppercase block mb-1">
                  Layer {item.num}
                </span>
                <span className="font-bold text-white block mb-1">{item.name}</span>
                <span className="text-[0.68rem] text-slate-400 block leading-tight">{item.desc}</span>
              </div>
              {item.num === 6 && (
                <div className="mt-2 pt-1.5 border-t border-purple-800/80 text-[0.62rem] text-purple-300 font-semibold">
                  ⛓️ Hash-Chain + Merkle
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Defense FAQs & Key Talking Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAQS.map((faq, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-800/80 backdrop-blur-md rounded-xl p-5 border border-slate-700/80 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Defense Item #{i + 1}
                </span>
                <span
                  className={`text-[0.65rem] font-bold px-2 py-0.5 rounded uppercase ${
                    faq.color === 'purple'
                      ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                      : faq.color === 'cyan'
                      ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700'
                      : faq.color === 'emerald'
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                      : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                  }`}
                >
                  {faq.badge}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-2 leading-snug">{faq.q}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{faq.a}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Threat Model Matrix */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-5 border border-slate-700 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>⚡</span> Threat Model & Mitigation Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 text-[0.7rem] uppercase border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Attack Vector</th>
                <th className="py-2.5 px-3">Pipeline Defense Layer</th>
                <th className="py-2.5 px-3">Mechanism</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-red-300">Printed Card Forgery / Fake ID</td>
                <td className="py-2.5 px-3 text-purple-400">Layer 4: Database Gate</td>
                <td className="py-2.5 px-3 text-slate-400">Exact ID match against Supabase PostgreSQL</td>
                <td className="py-2.5 px-3 font-bold text-red-400">Instant FAKE (Gate 1)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-red-300">Biometric Impersonation / Buddy Punching</td>
                <td className="py-2.5 px-3 text-purple-400">Layer 5: Face Match Gate</td>
                <td className="py-2.5 px-3 text-slate-400">Euclidean distance &gt; 0.50 cutoff</td>
                <td className="py-2.5 px-3 font-bold text-red-400">Instant FAKE (Gate 2)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-red-300">Photo-on-Screen Spoofing</td>
                <td className="py-2.5 px-3 text-purple-400">Layer 5: Liveness Check</td>
                <td className="py-2.5 px-3 text-slate-400">Facial landmark EAR & micro-expression detection</td>
                <td className="py-2.5 px-3 font-bold text-red-400">Liveness Failure</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-red-300">Insider DB Tampering / Bribery</td>
                <td className="py-2.5 px-3 text-purple-400">Layer 6: Blockchain Hash Chain</td>
                <td className="py-2.5 px-3 text-slate-400">SHA-256 block hash & Merkle tree verification</td>
                <td className="py-2.5 px-3 font-bold text-red-400">Chain Break Detected</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DefenseGuide
