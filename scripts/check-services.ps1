# TrafficEase - Local Service Health Checks
# Read-only HTTP checks for local development services.

$services = @(
    @{
        Name = "React Frontend"
        Url = "http://127.0.0.1:5173/"
        ExpectedService = $null
    },
    @{
        Name = "Spring Boot Backend"
        Url = "http://127.0.0.1:8080/api/health"
        ExpectedService = "trafficease-backend"
    },
    @{
        Name = "Python FastAPI"
        Url = "http://127.0.0.1:8000/health"
        ExpectedService = "trafficease-ai"
    }
)

$passed = 0
$failed = 0

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest `
            -Uri $service.Url `
            -Method Get `
            -UseBasicParsing `
            -TimeoutSec 5 `
            -ErrorAction Stop

        if ($response.StatusCode -ne 200) {
            throw "Unexpected HTTP status: $($response.StatusCode)"
        }

        if ($null -ne $service.ExpectedService) {
            $body = $response.Content | ConvertFrom-Json

            if ($body.status -ne "ok" -or
                $body.service -ne $service.ExpectedService) {
                throw "Unexpected health response"
            }
        }

        Write-Host "[PASS] $($service.Name)" -ForegroundColor Green
        $passed++
    }
    catch {
        Write-Host "[FAIL] $($service.Name): $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "TrafficEase Health Check Summary"
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"

if ($failed -gt 0) {
    exit 1
}

exit 0
