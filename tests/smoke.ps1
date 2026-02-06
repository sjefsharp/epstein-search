# Smoke tests for local development (PowerShell)
# Tests that worker and Next.js can authenticate with each other

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Epstein Search: Local Smoke Tests ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$WORKER_URL = "http://localhost:10000"
$NEXTJS_URL = "http://localhost:3000"
$WORKER_SECRET = "test-secret-key-123"

# Test results
$TestsPassed = 0
$TestsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [string]$Data = $null,
        [int]$ExpectedStatus
    )

    Write-Host -NoNewline "Testing: $Name... "

    try {
        $headers = @{
            "Content-Type" = "application/json"
        }

        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $headers
            TimeoutSec = 10
            UseBasicParsing = $true
        }

        if ($Data) {
            $params.Body = $Data
        }

        $response = Invoke-WebRequest @params -ErrorAction Stop
        $statusCode = $response.StatusCode

        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "PASS" -ForegroundColor Green -NoNewline
            Write-Host " (HTTP $statusCode)"
            $script:TestsPassed++
            return $true
        } else {
            Write-Host "FAIL" -ForegroundColor Red -NoNewline
            Write-Host " (Expected $ExpectedStatus, got $statusCode)"
            if ($Verbose) {
                Write-Host "Response: $($response.Content)"
            }
            $script:TestsFailed++
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "PASS" -ForegroundColor Green -NoNewline
            Write-Host " (HTTP $statusCode)"
            $script:TestsPassed++
            return $true
        } else {
            Write-Host "FAIL" -ForegroundColor Red -NoNewline
            Write-Host " (Expected $ExpectedStatus, got $statusCode)"
            if ($Verbose) {
                Write-Host "Error: $($_.Exception.Message)"
            }
            $script:TestsFailed++
            return $false
        }
    }
}

function Test-Port {
    param(
        [string]$Host,
        [int]$Port
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect($Host, $Port)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

# Check if services are running
Write-Host "Checking service availability..." -ForegroundColor Yellow
Write-Host ""

# Check worker
if (-not (Test-Port "localhost" 10000)) {
    Write-Host "✗ Worker not running on http://localhost:10000" -ForegroundColor Red
    Write-Host "  Start with: cd worker ; npm run dev"
    exit 1
}
Write-Host "✓ Worker running on http://localhost:10000" -ForegroundColor Green

# Check Next.js
if (-not (Test-Port "localhost" 3000)) {
    Write-Host "✗ Next.js not running on http://localhost:3000" -ForegroundColor Red
    Write-Host "  Start with: npm run dev"
    exit 1
}
Write-Host "✓ Next.js running on http://localhost:3000" -ForegroundColor Green
Write-Host ""

# Test worker health
Write-Host "=== Worker Health Tests ===" -ForegroundColor Cyan
Test-Endpoint -Name "Worker health check" -Method "GET" -Url "$WORKER_URL/health" -ExpectedStatus 200
Write-Host ""

# Test Next.js API routes
Write-Host "=== Next.js API Route Tests ===" -ForegroundColor Cyan

# Test search with valid query
Test-Endpoint -Name "Search GET with valid query" `
    -Method "GET" `
    -Url "$NEXTJS_URL/api/search?q=epstein&from=0&size=10" `
    -ExpectedStatus 200

Test-Endpoint -Name "Search POST with valid query" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/search" `
    -Data '{"query":"epstein","from":0,"size":10}' `
    -ExpectedStatus 200

# Test validation
Test-Endpoint -Name "Search rejects empty query" `
    -Method "GET" `
    -Url "$NEXTJS_URL/api/search?q=&from=0&size=10" `
    -ExpectedStatus 400

Test-Endpoint -Name "Search rejects invalid characters" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/search" `
    -Data '{"query":"<script>alert(1)</script>","from":0,"size":10}' `
    -ExpectedStatus 400

$longQuery = "a" * 501
Test-Endpoint -Name "Search rejects oversized query" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/search" `
    -Data "{`"query`":`"$longQuery`",`"from`":0,`"size`":10}" `
    -ExpectedStatus 400

Write-Host ""

# Test analyze endpoint
Write-Host "=== Analysis Endpoint Tests ===" -ForegroundColor Cyan

# Valid justice.gov URL (may fail at proxy, but should pass validation)
Test-Endpoint -Name "Analyze accepts justice.gov HTTPS URL" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/deep-analyze" `
    -Data '{"fileUri":"https://www.justice.gov/files/test.pdf","fileName":"test.pdf"}' `
    -ExpectedStatus 202

# Invalid domain
Test-Endpoint -Name "Analyze rejects non-justice.gov URLs" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/deep-analyze" `
    -Data '{"fileUri":"https://example.com/file.pdf","fileName":"file.pdf"}' `
    -ExpectedStatus 400

# HTTP instead of HTTPS
Test-Endpoint -Name "Analyze rejects HTTP URLs" `
    -Method "POST" `
    -Url "$NEXTJS_URL/api/deep-analyze" `
    -Data '{"fileUri":"http://www.justice.gov/file.pdf","fileName":"file.pdf"}' `
    -ExpectedStatus 400

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $TestsPassed" -ForegroundColor Green
Write-Host "Failed: $TestsFailed" -ForegroundColor Red

if ($TestsFailed -eq 0) {
    Write-Host "All smoke tests passed! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Check logs above." -ForegroundColor Red
    exit 1
}
