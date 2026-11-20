# TrafficEase - Frontend to Backend Integration Check
# Verifies the real Vite proxy and Spring Boot health endpoint.

$backendUrl = "http://127.0.0.1:8080/api/health"
$frontendUrl = "http://127.0.0.1:5173/api/health"

try {
    $backend = Invoke-RestMethod -Uri $backendUrl -TimeoutSec 5 -ErrorAction Stop
    $frontend = Invoke-RestMethod -Uri $frontendUrl -TimeoutSec 5 -ErrorAction Stop

    if ($backend.status -ne "ok" -or
        $backend.service -ne "trafficease-backend") {
        throw "Backend returned an unexpected health response."
    }

    if ($frontend.status -ne $backend.status -or
        $frontend.service -ne $backend.service -or
        $frontend.scope -ne $backend.scope) {
        throw "Vite proxy response does not match backend health response."
    }

    Write-Host "[PASS] Backend health endpoint" -ForegroundColor Green
    Write-Host "[PASS] Frontend to Backend Vite proxy" -ForegroundColor Green
    Write-Host "Integration check completed successfully."
    exit 0
}
catch {
    Write-Host "[FAIL] Integration check: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
