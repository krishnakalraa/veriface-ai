import { useState } from 'react'
import { motion } from 'framer-motion'
import { computeNameSimilarity } from '../lib/dbCheck'
import { computeSHA256 } from '../lib/hashChain'
import { buildMerkleTree } from '../lib/merkle'

function PipelineLab() {
  const [activeLayer, setActiveLayer] = useState(1)

  // Interactive Layer 4 tester
  const [dbStr1, setDbStr1] = useState('Aarav Sharma')
  const [dbStr2, setDbStr2] = useState('Aarav Sharm')
  const levScore = computeNameSimilarity(dbStr1, dbStr2)

  // Interactive Layer 6 Decision Engine Weight Simulator
  const [forensicsWeight, setForensicsWeight] = useState(25)
  const [ocrWeight, setOcrWeight] = useState(35)
  const [dbWeight, setDbWeight] = useState(40)
  const [simForensics, setSimForensics] = useState(85)
  const [simOcr, setSimOcr] = useState(90)
  const [simDbMatch, setSimDbMatch] = useState(95)
  const [simDbFound, setSimDbFound] = useState(true)
  const [simFaceMatch, setSimFaceMatch] = useState(true)

  // Interactive Hash & Merkle calculator
  const [hashInput, setHashInput] = useState('VeriFace-Record-Block-101')
  const [computedHash, setComputedHash] = useState('')
  const [merkleLeaves, setMerkleLeaves] = useState('DocHash1, DocHash2, DocHash3, DocHash4')
  const [merkleRootResult, setMerkleRootResult] = useState('')

  const handleComputeHash = async () => {
    const h = await computeSHA256(hashInput)
    setComputedHash(h)
  }

  const handleComputeMerkle = async () => {
    const leaves = merkleLeaves.split(',').map((s) => s.trim()).filter(Boolean)
    const mockBlocks = leaves.map((leaf, idx) => ({
      index: idx,
      hash: leaf,
      data: { id: leaf },
    }))
    const tree = await buildMerkleTree(mockBlocks)
    setMerkleRootResult(tree.root)
  }

  // Calculate simulated trust score & decision
  const totalWeight = forensicsWeight + ocrWeight + dbWeight
  const normalizedWeightedScore = Math.round(
    (simForensics * forensicsWeight + simOcr * ocrWeight + simDbMatch * dbWeight) / (totalWeight || 1)
  )

  let simDecision = 'AUTHENTIC'
  let simReason = 'All gates cleared & score ≥ 85'
  if (!simDbFound) {
    simDecision = 'FAKE'
    simReason = 'Hard-Override Gate 1: ID number not found in Supabase master database'
  } else if (!simFaceMatch) {
    simDecision = 'FAKE'
    simReason = 'Hard-Override Gate 2: Face descriptor distance ≥ 0.5 (Impersonation detected)'
  } else if (normalizedWeightedScore < 60) {
    simDecision = 'FAKE'
    simReason = 'Weighted trust score below minimum threshold (< 60)'
  } else if (normalizedWeightedScore < 85) {
    simDecision = 'SUSPICIOUS'
    simReason = 'Minor discrepancy detected; trust score in review tier (60–84)'
  }

  const LAYERS = [
    { num: 1, name: 'Capture', icon: '📷', sub: 'Dual Document & Live Selfie Ingestion' },
    { num: 2, name: 'Forensics', icon: '🔍', sub: 'Template Bounds & Font Consistency Heuristic' },
    { num: 3, name: 'OCR / QR / MRZ', icon: '🔤', sub: 'Tesseract.js + ZXing + MRZ TD1/TD3 Parser' },
    { num: 4, name: 'Database', icon: '🗄️', sub: 'Supabase PostgreSQL + Levenshtein Fuzzy Matching' },
    { num: 5, name: 'Live Face', icon: '👤', sub: 'TinyFaceDetector + Euclidean Distance (<0.5)' },
    { num: 6, name: 'Decision & Blockchain', icon: '⚖️', sub: 'Two-Tier Hard Overrides + SHA-256 Merkle Chain' },
  ]

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>🔬</span> 6-Layer Architecture & Forensics Lab
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Interactive deep dive into the 6 verified layers of the VeriFace AI architecture.
        </p>
      </div>

      {/* Layer selector tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {LAYERS.map((layer) => (
          <button
            key={layer.num}
            onClick={() => setActiveLayer(layer.num)}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeLayer === layer.num
                ? 'bg-purple-900/60 border-purple-500 shadow-lg shadow-purple-500/10'
                : 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{layer.icon}</span>
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-purple-400">
                Layer {layer.num}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-100 truncate">{layer.name}</div>
          </button>
        ))}
      </div>

      {/* Active Layer Details */}
      <motion.div
        key={activeLayer}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/90 backdrop-blur-md rounded-xl p-6 border border-slate-700 shadow-xl"
      >
        {activeLayer === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📷</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 1: Capture</h3>
                <p className="text-xs text-purple-300">Dual Ingestion: Document Image + Live Selfie</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Handles raw frame acquisition through standard HTML5 <code className="text-cyan-400">getUserMedia</code> or high-res file upload. Automatically accommodates single-camera laptops (RGB webcam) and dual-camera mobile devices (environment + front facing), avoiding Windows Hello IR sensor traps.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-purple-400 font-bold mb-1">Stream Attach</div>
                <div className="text-[0.72rem] text-slate-400">Direct ref-callback binding ensures frame data ready before capture triggers.</div>
              </div>
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-purple-400 font-bold mb-1">Resolution Guard</div>
                <div className="text-[0.72rem] text-slate-400">Auto-checks <code>videoWidth &gt; 0</code> and <code>videoHeight &gt; 0</code> to guarantee non-blank frame buffers.</div>
              </div>
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-purple-400 font-bold mb-1">Modes Supported</div>
                <div className="text-[0.72rem] text-slate-400">Adapts aspect ratio and bounding guide overlays based on selected operational mode (Campus / Toll / Standard).</div>
              </div>
            </div>
          </div>
        )}

        {activeLayer === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔍</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 2: Forensics</h3>
                <p className="text-xs text-purple-300">Template / Layout Check + Font Consistency Heuristic</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              As described in the pitch deck, Layer 2 executes lightweight, browser-side heuristic verification: comparing detected card element bounding zones (photo box, text fields, security chip) against normalized template coordinates (0–1 range) for the selected mode, plus OCR bounding-box variance for font uniformity.
            </p>
            <div className="bg-slate-900/70 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">Active Operational Mode Templates:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="font-bold text-purple-300 block mb-1">🎓 Campus Mode</span>
                  <span className="text-[0.7rem] text-slate-400 block">Photo: Left [0.05, 0.25]</span>
                  <span className="text-[0.7rem] text-slate-400 block">Text: Right [0.35, 0.90]</span>
                  <span className="text-[0.7rem] text-slate-400 block">Logo: Top Banner</span>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="font-bold text-purple-300 block mb-1">🚗 Toll Gate Mode</span>
                  <span className="text-[0.7rem] text-slate-400 block">Photo: Center/Right [0.60, 0.90]</span>
                  <span className="text-[0.7rem] text-slate-400 block">Text: Left [0.10, 0.55]</span>
                  <span className="text-[0.7rem] text-slate-400 block">Barcode: Bottom strip</span>
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded border border-slate-700">
                  <span className="font-bold text-purple-300 block mb-1">🌐 Standard Mode</span>
                  <span className="text-[0.7rem] text-slate-400 block">Universal Aadhaar / National ID</span>
                  <span className="text-[0.7rem] text-slate-400 block">Strict 12-digit number check</span>
                  <span className="text-[0.7rem] text-slate-400 block">Emblem verification</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeLayer === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔤</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 3: OCR / QR / MRZ</h3>
                <p className="text-xs text-purple-300">Multi-Modal Optical Character & Machine-Readable Ingestion</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Extracts text and barcodes in parallel. Uses <strong>Tesseract.js</strong> for text field extraction (Name, DOB, ID number) and <strong>@zxing/browser</strong> for QR/barcodes. If an ICAO 9303 MRZ block is present, it validates check digits across TD1 and TD3 formats.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-xs">
                <div className="font-bold text-cyan-400 mb-1">Regex Extraction Patterns</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[0.72rem]">
                  <li>Aadhaar: <code>{`\\b\\d{4}\\s?\\d{4}\\s?\\d{4}\\b`}</code></li>
                  <li>DOB: <code>{`\\b(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})\\b`}</code></li>
                  <li>Indian Driving License: <code>{`\\b[A-Z]{2}[0-9]{2,3}[0-9]{7,11}\\b`}</code></li>
                </ul>
              </div>
              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-xs">
                <div className="font-bold text-cyan-400 mb-1">Barcode & MRZ Decoding</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[0.72rem]">
                  <li>ZXing multi-format reader (QR, Code128, EAN)</li>
                  <li>TD1 (3 lines × 30 chars) checksum validation</li>
                  <li>TD3 (2 lines × 44 chars) passport MRZ validator</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeLayer === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🗄️</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 4: Database Cross-Check</h3>
                <p className="text-xs text-purple-300">Exact ID Query + Levenshtein String Similarity (85% Threshold)</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cross-checks extracted document details against the central Supabase PostgreSQL ledger. First looks up exact <code>id_number</code>. If found, evaluates Levenshtein distance on Name and tolerant matching on Date of Birth.
            </p>

            {/* Interactive Levenshtein Simulator */}
            <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-purple-300">🧪 Interactive Levenshtein Distance Calculator:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.7rem] text-slate-400 block mb-1">Extracted OCR Name</label>
                  <input
                    type="text"
                    value={dbStr1}
                    onChange={(e) => setDbStr1(e.target.value)}
                    className="w-full bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded border border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[0.7rem] text-slate-400 block mb-1">Database Master Record Name</label>
                  <input
                    type="text"
                    value={dbStr2}
                    onChange={(e) => setDbStr2(e.target.value)}
                    className="w-full bg-slate-800 text-slate-100 text-xs px-2.5 py-1.5 rounded border border-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">Calculated Similarity Score:</span>
                <span
                  className={`font-bold font-mono px-2.5 py-0.5 rounded ${
                    levScore >= 85
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  {levScore}% {levScore >= 85 ? '(PASS ≥ 85%)' : '(MISMATCH < 85%)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeLayer === 5 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👤</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 5: Live Face Match & Liveness</h3>
                <p className="text-xs text-purple-300">TinyFaceDetector + 68-Point Landmarks + Conservative 0.5 Threshold</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Extracts 128-dimensional biometric facial embedding vectors from the live selfie and the registered reference photo using <strong>face-api.js</strong>.
            </p>
            <div className="bg-amber-950/40 border border-amber-800/80 p-3 rounded-lg text-xs text-amber-200">
              <span className="font-bold">⚠️ Security Architectural Decision (Deliberately Strict Threshold):</span> Euclidean distance threshold is set to <strong>&lt; 0.50</strong> (industry standard for security checkpoints), because a false positive (letting an impersonator through) is far more hazardous than asking a legitimate user to re-align.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-xs">
                <div className="font-bold text-purple-400 mb-1">Euclidean Distance Metric</div>
                <div className="text-[0.72rem] text-slate-400">
                  <code className="text-cyan-300">d = sqrt(sum((v1[i] - v2[i])^2))</code>
                  <br />• 0.00 – 0.35: Identical subject
                  <br />• 0.36 – 0.49: Confident match
                  <br />• ≥ 0.50: Impersonation / Non-match
                </div>
              </div>
              <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-xs">
                <div className="font-bold text-purple-400 mb-1">Liveness Safeguard</div>
                <div className="text-[0.72rem] text-slate-400">
                  Calculates Eye Aspect Ratio (EAR) across 6 landmark coordinates per eye to detect blink and natural micro-movements, neutralizing printed photo spoofing attacks.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeLayer === 6 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚖️</span>
              <div>
                <h3 className="text-lg font-bold text-white">Layer 6: Decision Engine & Blockchain Anchor</h3>
                <p className="text-xs text-purple-300">Two-Tier Hard Override Gates + SHA-256 Hash Chain + Merkle Root</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Produces the final authoritative verdict (Authentic / Suspicious / Fake) and guarantees tamper-evidence by computing a local SHA-256 hash-chain and Merkle root.
            </p>

            {/* Interactive Decision Simulator */}
            <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-purple-300">🧪 Interactive Two-Tier Decision Simulator:</div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simDbFound}
                    onChange={(e) => setSimDbFound(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Gate 1: Record Exists in Supabase</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simFaceMatch}
                    onChange={(e) => setSimFaceMatch(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Gate 2: Face Matches (&lt;0.5 distance)</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs pt-2">
                <div>
                  <label className="text-[0.7rem] text-slate-400 block mb-1">Forensics ({simForensics}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simForensics}
                    onChange={(e) => setSimForensics(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[0.7rem] text-slate-400 block mb-1">OCR ({simOcr}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simOcr}
                    onChange={(e) => setSimOcr(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[0.7rem] text-slate-400 block mb-1">DB Match ({simDbMatch}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={simDbMatch}
                    onChange={(e) => setSimDbMatch(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 gap-2">
                <div>
                  <span className="text-xs text-slate-400">Computed Verdict: </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      simDecision === 'AUTHENTIC'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : simDecision === 'SUSPICIOUS'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {simDecision} (Score: {normalizedWeightedScore})
                  </span>
                </div>
                <div className="text-[0.7rem] text-slate-400 italic text-right truncate max-w-sm">
                  {simReason}
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 and Merkle Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-cyan-400">WebCrypto SHA-256 Generator</div>
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  className="w-full bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700"
                />
                <button
                  onClick={handleComputeHash}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white font-medium py-1 px-2.5 rounded text-[0.7rem]"
                >
                  Calculate Hash
                </button>
                {computedHash && (
                  <p className="text-[0.65rem] font-mono text-cyan-300 break-all bg-slate-950 p-1.5 rounded border border-cyan-900">
                    {computedHash}
                  </p>
                )}
              </div>

              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-purple-400">Merkle Tree Batch Root</div>
                <input
                  type="text"
                  value={merkleLeaves}
                  onChange={(e) => setMerkleLeaves(e.target.value)}
                  className="w-full bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700"
                  placeholder="Comma-separated leaf records"
                />
                <button
                  onClick={handleComputeMerkle}
                  className="bg-purple-700 hover:bg-purple-600 text-white font-medium py-1 px-2.5 rounded text-[0.7rem]"
                >
                  Generate Merkle Root
                </button>
                {merkleRootResult && (
                  <p className="text-[0.65rem] font-mono text-purple-300 break-all bg-slate-950 p-1.5 rounded border border-purple-900">
                    Root: {merkleRootResult}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default PipelineLab
