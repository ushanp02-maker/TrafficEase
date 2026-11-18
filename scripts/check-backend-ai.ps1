# TrafficEase - Backend to AI Integration Check
# Run from project root:
# powershell -ExecutionPolicy Bypass -File .\scripts\check-backend-ai.ps1

$ErrorActionPreference = "Stop"
$backend = "http://127.0.0.1:8080"

try {
    $health = Invoke-RestMethod "$backend/api/health"

    if ($health.status -ne "ok" -or $health.service -ne "trafficease-backend") {
        throw "Backend health check failed."
    }

    Write-Host "[PASS] Spring Boot Backend health"

    $catalog = Invoke-RestMethod "$backend/api/route-forecasts/catalog"

    if ($catalog.model.modelStatus -ne "ready") {
        throw "AI model is not ready through Backend."
    }

    if ($catalog.model.dataSource -ne "SYNTHETIC" -or
        $catalog.model.experimental -ne $true) {
        throw "AI model metadata labels are incorrect."
    }

    Write-Host "[PASS] Backend to FastAPI model metadata"

    $body = @{
        journeyId     = "pettah--piliyandala"
        mode          = "LEAVE_NOW"
        weatherMode   = "MANUAL_SIMULATION"
        manualWeather = "CLEAR"
    } | ConvertTo-Json

    $response = Invoke-RestMethod `
        -Uri "$backend/api/route-forecasts" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    if ($response.forecast.status -ne "AVAILABLE") {
        throw "AI prediction is unavailable."
    }

    if ($response.experimental -ne $true -or
        $response.dataSource -ne "SYNTHETIC") {
        throw "Forecast response labels are incorrect."
    }

    if ($response.forecast.result.experimental -ne $true -or
        $response.forecast.result.dataSource -ne "SYNTHETIC") {
        throw "AI prediction labels are incorrect."
    }

    $predictions = @($response.forecast.result.routePredictions)

    if ($predictions.Count -lt 1) {
        throw "No route predictions were returned."
    }

    Write-Host "[PASS] Backend to FastAPI prediction"
    Write-Host "[PASS] Experimental synthetic data labels"
    Write-Host "Backend-AI integration check completed successfully."
    exit 0
}
catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
