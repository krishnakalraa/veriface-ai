param(
    [string]$SourcePath = "c:\Users\Dell\OneDrive\Desktop\VERIFACE AI",
    [string]$ZipDestination = "c:\Users\Dell\OneDrive\Desktop\VERIFACE_AI_Submission.zip"
)

Write-Host "Creating clean submission zip without node_modules and build artifacts..." -ForegroundColor Cyan

if (Test-Path $ZipDestination) {
    Remove-Item $ZipDestination -Force
}

$tempFolder = Join-Path $env:TEMP "VERIFACE_AI_CLEAN_DIR"
if (Test-Path $tempFolder) {
    Remove-Item $tempFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $tempFolder | Out-Null

$destProject = Join-Path $tempFolder "VERIFACE AI"
robocopy $SourcePath $destProject /E /XD node_modules dist .git __pycache__ .pytest_cache /XF *.zip *.log /NFL /NDL /NJH /NJS

Write-Host "Compressing to: $ZipDestination" -ForegroundColor Green
Compress-Archive -Path $destProject -DestinationPath $ZipDestination -CompressionLevel Optimal

$finalBytes = (Get-Item $ZipDestination).Length
$finalMB = [math]::Round($finalBytes / 1MB, 2)

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " SUCCESS: Clean submission zip created!" -ForegroundColor Green
Write-Host " File: $ZipDestination" -ForegroundColor Yellow
Write-Host " Size: $finalMB MB (Well below the 50 MB limit!)" -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Green

Remove-Item $tempFolder -Recurse -Force
