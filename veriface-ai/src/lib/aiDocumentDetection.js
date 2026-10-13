const DEFAULT_DETECTOR_URL = 'http://127.0.0.1:8000/api/v1/detect'
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function detectDocumentImage(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('The selected document image is invalid. Capture or upload it again.')
  }

  const imageResponse = await fetch(dataUrl)
  const imageBlob = await imageResponse.blob()
  if (!ACCEPTED_IMAGE_TYPES.has(imageBlob.type)) {
    throw new Error('Use a JPEG, PNG, or WebP document image.')
  }

  const extension = imageBlob.type === 'image/jpeg' ? 'jpg' : imageBlob.type.split('/')[1]
  const formData = new FormData()
  formData.append('file', imageBlob, `document.${extension}`)

  let response
  try {
    response = await fetch(import.meta.env.VITE_DOCUMENT_AI_API_URL || DEFAULT_DETECTOR_URL, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(90000),
    })
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Document analysis timed out. Check that the backend server is running.')
    }
    throw new Error('Cannot reach the backend server. Run "python run.py" inside the backend/ folder and try again.', { cause: error })
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : `Backend returned HTTP ${response.status}.`
    throw new Error(detail)
  }
  if (!['AI-Generated', 'Human-Captured'].includes(payload.verdict)) {
    throw new Error('The backend returned an unsupported verdict.')
  }

  return payload
}
