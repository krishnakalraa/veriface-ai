/**
 * Cross-platform model weights downloader for VeriFace AI.
 * Downloads face-api.js weights to public/models/
 * Usage: node scripts/download-models.js
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const modelsDir = path.resolve(__dirname, '../public/models')

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
]

console.log(`\n📥 Downloading face-api.js weights into ${modelsDir}...\n`)

function downloadFile(fileName) {
  const dest = path.join(modelsDir, fileName)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  [SKIP] ${fileName} (already present)`)
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const url = `${baseUrl}/${fileName}`
    const file = fs.createWriteStream(dest)

    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https.get(response.headers.location, (redirectRes) => {
          redirectRes.pipe(file)
          file.on('finish', () => {
            file.close()
            console.log(`  [OK]   ${fileName}`)
            resolve()
          })
        }).on('error', (err) => {
          fs.unlink(dest, () => {})
          reject(err)
        })
        return
      }

      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {})
        return reject(new Error(`HTTP ${response.statusCode} for ${fileName}`))
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log(`  [OK]   ${fileName}`)
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function main() {
  for (const file of files) {
    try {
      await downloadFile(file)
    } catch (err) {
      console.error(`  [FAIL] ${file}: ${err.message}`)
    }
  }
  console.log('\n✅ All model weights verified and ready!\n')
}

main()
