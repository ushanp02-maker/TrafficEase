# TrafficEase - API Response Validation
# Run from project root.

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:8080"

try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health"

    if ($health.status -ne "ok") {
        throw "Invalid backend status."
    }

    if ($health.service -ne "trafficease-backend") {
        throw "Invalid backend service name."
    }

    Write-Host "[PASS] Backend API response"

    $catalog = Invoke-RestMethod -Uri "$baseUrl/api/route-forecasts/catalog"

    if ($null -eq $catalog.journeys -or
        @($catalog.journeys).Count -eq 0) {
        throw "Journey catalog is empty."
    }

    Write-Host "[PASS] Journey catalog response"

    if ($catalog.model.modelStatus -ne "ready") {
        throw "AI model is not ready."
    }

    Write-Host "[PASS] AI model status"

    if ($catalog.model.experimental -ne $true -or
        $catalog.model.dataSource -ne "SYNTHETIC") {
        throw "AI model labels are incorrect."
    }

    Write-Host "[PASS] Synthetic AI metadata"

    Write-Host "API response validation completed successfully."
    exit 0
}
catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
