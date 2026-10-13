/**
 * VeriFace AI — Add Person CLI Script
 *
 * Usage:
 *   node scripts/add-person.js <id_number> <full_name> <dob> <document_type> <institution_id> <photo_path>
 *
 * Examples:
 *   node scripts/add-person.js "987654321098" "Abhishek Sharma" "2001-05-14" "aadhaar" "" "./photos/abhishek.jpg"
 *   node scripts/add-person.js "IITD2024001" "Priya Nair" "2002-09-20" "campus_id" "IIT-D" "./photos/priya.png"
 *
 * If no arguments are passed, it runs interactively.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
        vars[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim()
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

function createPhotoReference(photoPath) {
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
  const mimeType = mimeTypes[extname(photoPath).toLowerCase()]
  if (!mimeType) throw new Error('Photo must be a JPG, PNG, or WEBP image.')
  return `data:${mimeType};base64,${readFileSync(resolve(photoPath)).toString('base64')}`
}

async function insertPerson(record) {
  if (!record.photo_reference?.startsWith('data:image/')) {
    console.error('❌ A reference face image is required.')
    return
  }
  console.log('\n⏳ Checking if ID already exists...')
  const { data: existing } = await supabase
    .from('people')
    .select('id, full_name')
    .eq('id_number', record.id_number)
    .limit(1)
    .single()

  if (existing) {
    console.log(`⚠️ Record with ID ${record.id_number} already exists (${existing.full_name}). Updating record...`)
    const { error: updateError } = await supabase
      .from('people')
      .update(record)
      .eq('id_number', record.id_number)

    if (updateError) {
      console.error('❌ Failed to update:', updateError.message)
    } else {
      console.log('✅ Successfully updated record in Supabase!')
    }
    return
  }

  const { error } = await supabase.from('people').insert(record)
  if (error) {
    console.error('❌ Failed to insert into Supabase:', error.message)
  } else {
    console.log(`✅ Successfully added ${record.full_name} (${record.id_number}) to Supabase!`)
    console.log(`You can now verify documents with this ID in the VeriFace AI web app.`)
  }
}

const args = process.argv.slice(2)

if (args.length >= 3) {
  const [id_number, full_name, dob, document_type = 'campus_id', institution_id = '', photoPath] = args
  if (!photoPath) {
    console.error('A reference face photo path is required. See the usage examples at the top of this script.')
    process.exit(1)
  }
  insertPerson({
    id_number: id_number.trim(),
    full_name: full_name.trim(),
    dob: dob.trim(),
    document_type: document_type.trim(),
    institution_id: institution_id ? institution_id.trim() : null,
    photo_reference: createPhotoReference(photoPath),
  })
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('==============================================')
  console.log('  VeriFace AI — Add Person to Supabase')
  console.log('==============================================\n')

  rl.question('Enter ID Number (e.g. 12-digit Aadhaar, Student ID, or DL number): ', (id_number) => {
    if (!id_number.trim()) {
      console.log('ID number is required.')
      rl.close()
      return
    }

    rl.question('Enter Full Name (as printed on document): ', (full_name) => {
      rl.question('Enter Date of Birth (YYYY-MM-DD): ', (dob) => {
        rl.question('Enter Document Type (campus_id, aadhaar, driving_license, pan) [campus_id]: ', (docType) => {
          rl.question('Enter Institution / Issuer (optional, e.g. IIT-D): ', (inst) => {
            rl.question('Reference face photo path (JPG, PNG, or WEBP, required): ', (photoPath) => {
              rl.close()
              try {
                insertPerson({
                  id_number: id_number.trim(),
                  full_name: full_name.trim(),
                  dob: dob.trim() || '2001-01-01',
                  document_type: docType.trim() || 'campus_id',
                  institution_id: inst.trim() || null,
                photo_reference: createPhotoReference(photoPath.trim()),
                })
              } catch (err) {
                console.error('❌ Unable to load reference photo:', err.message)
              }
            })
          })
        })
      })
    })
  })
}
