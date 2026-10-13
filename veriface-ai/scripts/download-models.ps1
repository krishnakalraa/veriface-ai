# Download face-api.js model weights into public/models/
# Run from the project root: .\scripts\download-models.ps1

$modelsDir = Join-Path $PSScriptRoot "..\public\models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

Write-Host "Downloading face-api.js model files to $modelsDir ..." -ForegroundColor Cyan

foreach ($file in $files) {
    $url = "$baseUrl/$file"
    $dest = Join-Path $modelsDir $file

    if (Test-Path $dest) {
        Write-Host "  [SKIP] $file (already exists)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  [GET]  $file" -ForegroundColor Green
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Host "  [FAIL] $file : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Done! Models saved to: $modelsDir" -ForegroundColor Cyan
Write-Host "face-api.js will load these from /models/ at runtime." -ForegroundColor Gray
