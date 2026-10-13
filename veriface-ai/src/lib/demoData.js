/**
 * VeriFace AI — Demo Scenarios & Synthetic Asset Generator
 *
 * Provides 1-click test cases for verification testing:
 * 1. Clean Match (Authentic) — IIT-D Campus ID matching Supabase record
 * 2. DOB Mismatch (Suspicious) — Valid Aadhaar with DOB transposition
 * 3. Face Mismatch (Fake) — Impersonation attempt with non-matching selfie
 * 4. Unregistered ID (Fake) — Counterfeit card not present in Supabase
 */

// Generate high-resolution canvas data URLs for realistic document cards
export function generateDemoCardImage({ idNumber, fullName, dob, docType, institution, photoColor = '#3b82f6' }) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 400
  const ctx = canvas.getContext('2d')

  // Card Background with gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 640, 400)
  if (docType === 'campus_id') {
    bgGrad.addColorStop(0, '#0f172a')
    bgGrad.addColorStop(1, '#1e1b4b')
  } else if (docType === 'aadhaar') {
    bgGrad.addColorStop(0, '#111827')
    bgGrad.addColorStop(1, '#064e3b')
  } else {
    bgGrad.addColorStop(0, '#1e293b')
    bgGrad.addColorStop(1, '#334155')
  }
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 640, 400)

  // Subtle card border
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 4
  ctx.strokeRect(8, 8, 624, 384)

  // Card Header Banner
  ctx.fillStyle = '#4f46e5'
  ctx.fillRect(12, 12, 616, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Inter, sans-serif'
  const headerTitle = docType === 'campus_id' 
    ? `${institution || 'UNIVERSITY'} IDENTITY CARD`
    : docType === 'aadhaar' ? 'UNIQUE IDENTIFICATION AUTHORITY' : 'GOVERNMENT IDENTITY PASS'
  ctx.fillText(headerTitle, 30, 50)

  // Photo Box
  ctx.fillStyle = photoColor
  ctx.fillRect(35, 100, 160, 200)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.strokeRect(35, 100, 160, 200)

  // Draw avatar icon inside photo box
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(115, 170, 45, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(115, 270, 65, Math.PI, 0, false)
  ctx.fill()

  // Watermark / Seal
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(480, 230, 80, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Text details (clean typography for OCR)
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 15px monospace'
  ctx.fillText('NAME:', 220, 125)
  ctx.font = 'bold 22px Inter, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(fullName.toUpperCase(), 220, 155)

  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('ID NUMBER:', 220, 195)
  ctx.font = 'bold 24px monospace'
  ctx.fillStyle = '#38bdf8'
  ctx.fillText(idNumber, 220, 225)

  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('DATE OF BIRTH:', 220, 265)
  ctx.font = 'bold 18px Inter, sans-serif'
  ctx.fillStyle = '#f1f5f9'
  ctx.fillText(dob, 220, 290)

  // Bottom Security / Barcode Strip
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(12, 320, 616, 68)

  // Simulated barcode lines
  ctx.fillStyle = '#ffffff'
  let x = 30
  while (x < 360) {
    const w = (x % 7 === 0 || x % 5 === 0) ? 4 : 2
    ctx.fillRect(x, 335, w, 40)
    x += w + 3
  }

  // Security chip & holographic badge text
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(400, 338, 45, 34)
  ctx.fillStyle = '#000000'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('CHIP', 410, 358)

  ctx.fillStyle = '#a855f7'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('VERIFACE SECURE', 470, 358)

  return canvas.toDataURL('image/png')
}

// Generate realistic selfie data URL
export function generateDemoSelfieImage({ label = 'Subject Live Selfie', color = '#3b82f6', isMatching = true }) {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')

  // Background
  const grad = ctx.createRadialGradient(200, 200, 50, 200, 200, 220)
  grad.addColorStop(0, '#1e293b')
  grad.addColorStop(1, '#0f172a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 400, 400)

  // Subtle webcam grid overlay
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(60, 60, 280, 280)

  // Face oval
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(200, 190, 80, 105, 0, 0, Math.PI * 2)
  ctx.fill()

  // Eyes
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(170, 170, 12, 0, Math.PI * 2)
  ctx.arc(230, 170, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(170, 170, 6, 0, Math.PI * 2)
  ctx.arc(230, 170, 6, 0, Math.PI * 2)
  ctx.fill()

  // Smile
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(200, 225, 30, 0.2, Math.PI - 0.2, false)
  ctx.stroke()

  // Top banner badge
  ctx.fillStyle = isMatching ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)'
  ctx.fillRect(40, 20, 320, 32)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 13px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, 200, 42)

  // Corner targeting brackets
  ctx.strokeStyle = '#a855f7'
  ctx.lineWidth = 3
  // Top-left
  ctx.beginPath()
  ctx.moveTo(50, 80); ctx.lineTo(50, 50); ctx.lineTo(80, 50); ctx.stroke()
  // Top-right
  ctx.beginPath()
  ctx.moveTo(350, 80); ctx.lineTo(350, 50); ctx.lineTo(320, 50); ctx.stroke()
  // Bottom-left
  ctx.beginPath()
  ctx.moveTo(50, 320); ctx.lineTo(50, 350); ctx.lineTo(80, 350); ctx.stroke()
  // Bottom-right
  ctx.beginPath()
  ctx.moveTo(350, 320); ctx.lineTo(350, 350); ctx.lineTo(320, 350); ctx.stroke()

  return canvas.toDataURL('image/png')
}

// Curated Evaluation Demo Scenarios
export const DEMO_SCENARIOS = [
  {
    id: 'harshit_cgc',
    title: '🎓 Harshit Kanwal (CGC Landran)',
    badge: 'Score ~95 • AUTHENTIC',
    mode: 'campus',
    description: 'Harshit Kanwal (CGC Landran) — Campus ID: 8708479484, DOB: 4-8-2008. Live cross-check against Supabase.',
    expectedOutcome: 'AUTHENTIC (Score ≥ 85)',
    record: {
      idNumber: '8708479484',
      fullName: 'Harshit Kanwal',
      dob: '2008-04-08',
      docType: 'campus_id',
      institution: 'CGC Landran',
      photoColor: '#0284c7',
    },
    selfieLabel: 'Live Selfie (Harshit Kanwal)',
    selfieColor: '#0284c7',
    isMatching: true,
  },
  {
    id: 'clean_authentic',
    title: '🟢 1. Clean Match (IIT-D)',
    badge: 'Score ~95 • AUTHENTIC',
    mode: 'campus',
    description: 'Aarav Sharma (IIT-D) — Card valid, exact ID & Name in Supabase, matching live face.',
    expectedOutcome: 'AUTHENTIC (Score ≥ 85)',
    record: {
      idNumber: '234567890123',
      fullName: 'Aarav Sharma',
      dob: '2001-03-15',
      docType: 'campus_id',
      institution: 'IIT-D',
      photoColor: '#2563eb',
    },
    selfieLabel: 'Live Selfie (Matching: Aarav Sharma)',
    selfieColor: '#2563eb',
    isMatching: true,
  },
  {
    id: 'dob_suspicious',
    title: '🟡 2. DOB Mismatch (Suspicious)',
    badge: 'Score ~70 • SUSPICIOUS',
    mode: 'standard',
    description: 'Amit Kumar (Aadhaar) — Card matches ID & Name, but card DOB shows 1998-05-12 while DB has 1997-05-21.',
    expectedOutcome: 'SUSPICIOUS (Score 60–84)',
    record: {
      idNumber: '411445566778',
      fullName: 'Amit Kumar',
      dob: '1998-05-12', // Document shows 1998-05-12, Supabase has 1997-05-21
      docType: 'aadhaar',
      institution: null,
      photoColor: '#059669',
    },
    selfieLabel: 'Live Selfie (Matching: Amit Kumar)',
    selfieColor: '#059669',
    isMatching: true,
  },
  {
    id: 'face_impersonation',
    title: '🔴 3. Impersonator (Hard FAKE)',
    badge: 'Gate 2 • FAKE',
    mode: 'campus',
    description: 'Ravi Shankar card presented by an impostor. Stored photo flag triggers face mismatch Euclidean > 0.5.',
    expectedOutcome: 'FAKE (Impersonation Detected)',
    record: {
      idNumber: '744778899001',
      fullName: 'Ravi Shankar',
      dob: '2001-04-10',
      docType: 'campus_id',
      institution: 'IIT-D',
      photoColor: '#7c3aed',
    },
    selfieLabel: 'Impostor Live Selfie (Mismatched)',
    selfieColor: '#dc2626', // different color = impersonator
    isMatching: false,
  },
  {
    id: 'unregistered_counterfeit',
    title: '⛔ 4. Counterfeit Card (Hard FAKE)',
    badge: 'Gate 1 • FAKE',
    mode: 'tollgate',
    description: 'Forged Toll Pass `999888777666` not registered in Supabase master database.',
    expectedOutcome: 'FAKE (Record Not Found)',
    record: {
      idNumber: '999888777666',
      fullName: 'Vikramaditya Roy',
      dob: '1996-08-19',
      docType: 'driving_license',
      institution: null,
      photoColor: '#ea580c',
    },
    selfieLabel: 'Driver Live Selfie',
    selfieColor: '#ea580c',
    isMatching: true,
  },
]
