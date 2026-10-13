/**
 * VeriFace AI — Demo Seed Data Script
 *
 * Inserts sample records that include actual reference face image data URLs.
 * Run once: node scripts/seed.js
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 *
 * Records without a real photo_reference data URL are skipped. Includes:
 *   - 20 clean records with realistic Indian names, 12-digit Aadhaar-style IDs, DOBs
 *   - 3 records with deliberately mismatched DOBs (for "Suspicious" demos)
 *   - 2 records with photo_reference = 'MISMATCH_DEMO' (for face-mismatch "Fake" demos)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env manually (Node.js doesn't support import.meta.env)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '..', '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const vars = {}
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        const value = trimmed.slice(eqIndex + 1).trim()
        vars[key] = value
      }
    }
    return vars
  } catch (err) {
    console.error('Failed to read .env file:', err.message)
    process.exit(1)
  }
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const seedData = [
  // ── 20 Clean Records ──────────────────────────────────────────────────
  { id_number: '234567890123', full_name: 'Aarav Sharma',       dob: '2001-03-15', document_type: 'campus_id',   institution_id: 'IIT-D' },
  { id_number: '345678901234', full_name: 'Priya Patel',        dob: '2000-07-22', document_type: 'campus_id',   institution_id: 'IIT-D' },
  { id_number: '456789012345', full_name: 'Rohan Gupta',        dob: '1999-11-08', document_type: 'aadhaar',     institution_id: null },
  { id_number: '567890123456', full_name: 'Ananya Singh',       dob: '2002-01-30', document_type: 'campus_id',   institution_id: 'NIT-W' },
  { id_number: '678901234567', full_name: 'Vikram Reddy',       dob: '1998-05-12', document_type: 'driving_license', institution_id: null },
  { id_number: '789012345678', full_name: 'Sneha Nair',         dob: '2001-09-03', document_type: 'campus_id',   institution_id: 'BITS-P' },
  { id_number: '890123456789', full_name: 'Arjun Mehta',        dob: '2000-12-25', document_type: 'pan',         institution_id: null },
  { id_number: '901234567890', full_name: 'Kavya Iyer',         dob: '1999-04-17', document_type: 'campus_id',   institution_id: 'IIT-B' },
  { id_number: '112233445566', full_name: 'Rahul Verma',        dob: '2001-06-28', document_type: 'aadhaar',     institution_id: null },
  { id_number: '223344556677', full_name: 'Diya Kapoor',        dob: '2000-02-14', document_type: 'campus_id',   institution_id: 'IIT-D' },
  { id_number: '334455667788', full_name: 'Siddharth Joshi',    dob: '1998-08-09', document_type: 'driving_license', institution_id: null },
  { id_number: '445566778899', full_name: 'Meera Krishnan',     dob: '2002-10-01', document_type: 'campus_id',   institution_id: 'NIT-T' },
  { id_number: '556677889900', full_name: 'Aditya Rao',         dob: '1999-07-19', document_type: 'aadhaar',     institution_id: null },
  { id_number: '667788990011', full_name: 'Ishita Banerjee',    dob: '2001-11-11', document_type: 'campus_id',   institution_id: 'IIIT-H' },
  { id_number: '778899001122', full_name: 'Karthik Sundaram',   dob: '2000-03-05', document_type: 'pan',         institution_id: null },
  { id_number: '889900112233', full_name: 'Nisha Agarwal',      dob: '1999-01-27', document_type: 'campus_id',   institution_id: 'IIT-M' },
  { id_number: '990011223344', full_name: 'Manish Tiwari',      dob: '2001-08-14', document_type: 'driving_license', institution_id: null },
  { id_number: '100112233445', full_name: 'Pooja Deshmukh',     dob: '2000-04-23', document_type: 'aadhaar',     institution_id: null },
  { id_number: '200223344556', full_name: 'Raj Malhotra',       dob: '1998-12-31', document_type: 'campus_id',   institution_id: 'BITS-G' },
  { id_number: '300334455667', full_name: 'Simran Kaur',        dob: '2002-06-06', document_type: 'campus_id',   institution_id: 'PEC' },

  // ── 3 Records with Deliberately Mismatched DOBs (Suspicious demos) ────
  // These have DOBs that differ by 1-2 digits from what a test document might show
  { id_number: '411445566778', full_name: 'Amit Kumar',         dob: '1997-05-21', document_type: 'aadhaar',     institution_id: null },
  // ^ Test doc might show DOB as 1998-05-12 → triggers "Suspicious" due to mismatch
  { id_number: '522556677889', full_name: 'Deepika Chauhan',    dob: '2000-09-30', document_type: 'campus_id',   institution_id: 'IIT-K' },
  // ^ Test doc might show DOB as 2000-09-03 → day transposition
  { id_number: '633667788990', full_name: 'Nikhil Saxena',      dob: '1999-02-28', document_type: 'pan',         institution_id: null },
  // ^ Test doc might show DOB as 1999-12-28 → month difference

  // ── 2 Records for Face-Mismatch Demos ─────────────────────────────────
  { id_number: '744778899001', full_name: 'Ravi Shankar',       dob: '2001-04-10', document_type: 'campus_id',   institution_id: 'IIT-D', photo_reference: 'MISMATCH_DEMO' },
  { id_number: '855889900112', full_name: 'Lata Mangeshkar',    dob: '2000-11-15', document_type: 'aadhaar',     institution_id: null,     photo_reference: 'MISMATCH_DEMO' },
]

async function seed() {
  console.log(`\n🌱 Seeding ${seedData.length} records into Supabase 'people' table...\n`)

  let inserted = 0
  let skipped = 0
  let skippedMissingPhoto = 0
  let failed = 0

  for (const record of seedData) {
    if (!record.photo_reference?.startsWith('data:image/')) {
      console.log(`  [SKIP] ${record.id_number} — ${record.full_name} (reference face photo required)`)
      skippedMissingPhoto++
      continue
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('people')
      .select('id')
      .eq('id_number', record.id_number)
      .limit(1)
      .single()

    if (existing) {
      console.log(`  [SKIP] ${record.id_number} — ${record.full_name} (already exists)`)
      skipped++
      continue
    }

    const { error } = await supabase
      .from('people')
      .insert(record)

    if (error) {
      console.error(`  [FAIL] ${record.id_number} — ${record.full_name}: ${error.message}`)
      failed++
    } else {
      console.log(`  [OK]   ${record.id_number} — ${record.full_name}`)
      inserted++
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted}, Already existed: ${skipped}, Missing photos: ${skippedMissingPhoto}, Failed: ${failed}\n`)
}

seed().catch(err => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
