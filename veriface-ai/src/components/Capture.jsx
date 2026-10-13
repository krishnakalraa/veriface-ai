import { useRef, useState, useCallback, useEffect } from 'react'

function Capture({ onCapture, label = 'Capture Document', accept = 'image/*' }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const fileInputRef = useRef(null)

    const [mode, setMode] = useState('idle') // idle | camera | preview
    const [imageSrc, setImageSrc] = useState(null)
    const [cameraReady, setCameraReady] = useState(false)
    const [devices, setDevices] = useState([])
    const [selectedDeviceId, setSelectedDeviceId] = useState('')
    const [errorMsg, setErrorMsg] = useState(null)

    // Stop webcam helper
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        setCameraReady(false)
    }, [])

    // Clean up stream on unmount
    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [stopCamera])

    // Enumerate video devices
    const loadDevices = useCallback(async () => {
        try {
            if (!navigator.mediaDevices?.enumerateDevices) return
            const allDevices = await navigator.mediaDevices.enumerateDevices()
            const videoDevs = allDevices.filter((d) => d.kind === 'videoinput')
            setDevices(videoDevs)

            // If no device currently selected, pick the best RGB camera (skip IR / infrared)
            if (!selectedDeviceId && videoDevs.length > 0) {
                const rgbCam = videoDevs.find(
                    (d) => !/ir|infrared|virtual/i.test(d.label || '')
                )
                setSelectedDeviceId(rgbCam ? rgbCam.deviceId : videoDevs[0].deviceId)
            }
        } catch (e) {
            console.warn('Device enumeration error:', e)
        }
    }, [selectedDeviceId])

    // Attach stream to video element whenever video element or stream is available
    const attachStreamToVideo = useCallback((videoEl) => {
        if (!videoEl || !streamRef.current) return
        if (videoEl.srcObject !== streamRef.current) {
            videoEl.srcObject = streamRef.current
        }
        videoEl.muted = true
        videoEl.setAttribute('playsinline', 'true')
        videoEl.play().catch((err) => {
            console.warn('Video auto-play warning:', err)
        })
    }, [])

    // Start webcam with intelligent constraints & fallbacks
    const startCamera = useCallback(async (deviceIdToUse) => {
        stopCamera()
        setErrorMsg(null)
        setCameraReady(false)
        setMode('camera')

        try {
            let stream = null
            const targetDeviceId = deviceIdToUse || selectedDeviceId

            // Try with specific deviceId if selected
            if (targetDeviceId) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: { exact: targetDeviceId },
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    })
                } catch (e) {
                    console.warn('Exact deviceId constraint failed, falling back:', e)
                }
            }

            // Fallback 1: Preferred facing mode ('user' for webcams / selfie)
            if (!stream) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'user',
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    })
                } catch (e) {
                    console.warn('facingMode constraint failed, falling back:', e)
                }
            }

            // Fallback 2: Basic generic video constraint
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                })
            }

            streamRef.current = stream

            // Update device list now that permissions are granted (gives real labels)
            await loadDevices()

            // If the video element is already mounted, attach immediately
            if (videoRef.current) {
                attachStreamToVideo(videoRef.current)
            }
        } catch (err) {
            console.error('Camera access error:', err)
            setErrorMsg(err.message || 'Unable to access camera')
            setMode('idle')
        }
    }, [selectedDeviceId, stopCamera, loadDevices, attachStreamToVideo])

    // Switch camera device
    const handleDeviceChange = (newDeviceId) => {
        setSelectedDeviceId(newDeviceId)
        startCamera(newDeviceId)
    }

    // Called when the video element has real dimensions and is playing
    const handleVideoReady = useCallback(() => {
        const video = videoRef.current
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
            setCameraReady(true)
        }
    }, [])

    // Take a photo from the live video feed
    const takePhoto = useCallback(() => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        if (!video.videoWidth || !video.videoHeight) {
            alert('Camera is still loading — wait a moment and try again.')
            return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const dataUrl = canvas.toDataURL('image/png')
        setImageSrc(dataUrl)
        setMode('preview')
        stopCamera()
    }, [stopCamera])

    // Handle file upload fallback
    const handleFileUpload = useCallback((e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => {
            setImageSrc(event.target.result)
            setMode('preview')
        }
        reader.readAsDataURL(file)
    }, [])

    // Retake / reset
    const reset = useCallback(() => {
        setImageSrc(null)
        setMode('idle')
    }, [])

    // Cancel camera view
    const cancelCamera = useCallback(() => {
        stopCamera()
        setMode('idle')
    }, [stopCamera])

    // Confirm and pass image up to parent
    const confirmCapture = useCallback(() => {
        if (imageSrc && onCapture) {
            onCapture(imageSrc)
        }
    }, [imageSrc, onCapture])

    return (
        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-auto shadow-xl border border-slate-700">
            <h2 className="text-lg font-semibold text-purple-300 mb-4">{label}</h2>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
                    ⚠️ {errorMsg}
                </div>
            )}

            {mode === 'idle' && (
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => startCamera()}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-md flex items-center justify-center gap-2"
                    >
                        <span>📷</span> Use Camera
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-md flex items-center justify-center gap-2"
                    >
                        <span>📁</span> Upload Image
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={accept}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            )}

            {mode === 'camera' && (
                <div className="flex flex-col gap-3">
                    <div className="relative rounded-lg overflow-hidden bg-black min-h-[220px] flex items-center justify-center border border-slate-700">
                        <video
                            ref={(node) => {
                                videoRef.current = node
                                if (node) {
                                    attachStreamToVideo(node)
                                }
                            }}
                            autoPlay
                            playsInline
                            muted
                            onLoadedMetadata={handleVideoReady}
                            onLoadedData={handleVideoReady}
                            onCanPlay={handleVideoReady}
                            onPlaying={handleVideoReady}
                            className="w-full h-auto max-h-[360px] object-cover"
                        />
                        {!cameraReady && (
                            <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center gap-2">
                                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs text-slate-300 font-medium">Starting camera…</p>
                            </div>
                        )}
                    </div>

                    {/* Camera device selection if multiple cameras exist */}
                    {devices.length > 1 && (
                        <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                            <span className="text-slate-400">Camera:</span>
                            <select
                                value={selectedDeviceId}
                                onChange={(e) => handleDeviceChange(e.target.value)}
                                className="bg-transparent text-slate-200 text-xs focus:outline-none flex-1 truncate"
                            >
                                {devices.map((device, idx) => (
                                    <option key={device.deviceId} value={device.deviceId} className="bg-slate-800 text-slate-200">
                                        {device.label || `Camera ${idx + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={takePhoto}
                        disabled={!cameraReady}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition shadow-md flex items-center justify-center gap-2"
                    >
                        <span>📸</span> Take Photo
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium py-2 px-3 rounded-lg text-xs transition"
                        >
                            📁 Or Upload Image
                        </button>
                        <button
                            onClick={cancelCamera}
                            className="flex-1 bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium py-2 px-3 rounded-lg text-xs transition"
                        >
                            Cancel
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={accept}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>
            )}

            {mode === 'preview' && imageSrc && (
                <div className="flex flex-col gap-3">
                    <img
                        src={imageSrc}
                        alt="Captured"
                        className="w-full rounded-lg border border-slate-600 max-h-[360px] object-contain bg-black"
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={reset}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition"
                        >
                            🔄 Retake
                        </button>
                        <button
                            onClick={confirmCapture}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition"
                        >
                            ✅ Confirm
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden canvas used for capturing frames */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    )
}

export default Capture