# Testing Guide

This directory contains comprehensive tests for the Epstein Search application.

## Test Structure

```
tests/
├── setup.ts                 # Global test setup (env vars)
├── lib/
│   ├── security.test.ts     # Security utilities tests (16 tests)
│   └── validation.test.ts   # Input validation tests (15 tests)
├── worker/
│   └── auth.test.ts         # Worker auth logic tests (11 tests)
├── smoke.sh                 # Smoke tests (Bash)
└── smoke.ps1                # Smoke tests (PowerShell)
```

## Unit Tests

### Run Once

```bash
npm test
# or
npm run test:run
```

### Watch Mode

```bash
npm run test:ui
```

### Coverage Report

```bash
npm run test:coverage
```

### Test Categories

1. **Security Tests** (`tests/lib/security.test.ts`)
   - HMAC signature generation consistency
   - Signature verification with valid/invalid inputs
   - Environment variable validation
   - HTTPS enforcement
   - Error sanitization (dev vs production)

2. **Validation Tests** (`tests/lib/validation.test.ts`)
   - Search query validation (regex, length, defaults)
   - SSRF protection (domain whitelisting)
   - HTTPS-only URL enforcement
   - Input sanitization edge cases

3. **Worker Auth Tests** (`tests/worker/auth.test.ts`)
   - HMAC signature algorithm correctness
   - Bearer token extraction
   - Header priority (X-Worker-Signature > Authorization)
   - Timing-safe signature comparison

## Smoke Tests (Local Integration)

Smoke tests verify that the Next.js frontend and Worker service can authenticate with each other locally.

### Prerequisites

1. **Worker running:**

   ```bash
   cd worker
   npm run dev
   # Starts on http://localhost:10000
   ```

2. **Next.js running:**

   ```bash
   npm run dev
   # Starts on http://localhost:3000
   ```

3. **Environment configured:**
   - `.env.local` must have `WORKER_SHARED_SECRET` (same as in `tests/setup.ts`)
   - Worker must have `WORKER_SHARED_SECRET` env var set

### Running Smoke Tests

**PowerShell (Windows):**

```powershell
.\tests\smoke.ps1

# Verbose mode (shows full error responses)
.\tests\smoke.ps1 -Verbose
```

**Bash (Linux/macOS):**

```bash
bash tests/smoke.sh
```

### What Smoke Tests Check

1. **Service Availability**
   - Worker health endpoint responding
   - Next.js dev server running

2. **Search Endpoint**
   - GET requests with valid queries
   - POST requests with valid queries
   - Validation rejection (empty query, invalid chars, oversized input)

3. **Analysis Endpoint**
   - Accepts HTTPS justice.gov URLs
   - Rejects non-justice.gov domains
   - Rejects HTTP URLs (HTTPS required)

4. **Authentication**
   - Worker successfully verifies signatures from Next.js
   - No 401 Unauthorized errors

### Expected Output

```
=== Epstein Search: Local Smoke Tests ===

Checking service availability...
✓ Worker running on http://localhost:10000
✓ Next.js running on http://localhost:3000

=== Worker Health Tests ===
Testing: Worker health check... PASS (HTTP 200)

=== Next.js API Route Tests ===
Testing: Search GET with valid query... PASS (HTTP 200)
Testing: Search POST with valid query... PASS (HTTP 200)
Testing: Search rejects empty query... PASS (HTTP 400)
Testing: Search rejects invalid characters... PASS (HTTP 400)
Testing: Search rejects oversized query... PASS (HTTP 400)

=== Analysis Endpoint Tests ===
Testing: Analyze accepts justice.gov HTTPS URL... PASS (HTTP 202)
Testing: Analyze rejects non-justice.gov URLs... PASS (HTTP 400)
Testing: Analyze rejects HTTP URLs... PASS (HTTP 400)

=== Test Summary ===
Passed: 9
Failed: 0
All smoke tests passed! ✓
```

## Troubleshooting

### Unit Tests Fail

1. **Check environment setup:**

   ```bash
   cat tests/setup.ts
   # Verify WORKER_SHARED_SECRET is set
   ```

2. **Clear cache:**
   ```bash
   rm -rf node_modules/.vite
   npm test
   ```

### Smoke Tests Fail with 401 Unauthorized

1. **Verify `.env.local` has WORKER_SHARED_SECRET:**

   ```bash
   grep WORKER_SHARED_SECRET .env.local
   # Should output: WORKER_SHARED_SECRET=test-secret-key-123
   ```

2. **Check Worker environment:**

   ```bash
   cd worker
   echo $WORKER_SHARED_SECRET  # Bash
   echo $env:WORKER_SHARED_SECRET  # PowerShell
   # Should output: test-secret-key-123
   ```

3. **Set Worker secret manually:**

   ```bash
   # Bash
   export WORKER_SHARED_SECRET=test-secret-key-123
   npm run dev

   # PowerShell
   $env:WORKER_SHARED_SECRET = "test-secret-key-123"
   npm run dev
   ```

### Smoke Tests Fail with Connection Refused

1. **Start services:**

   ```bash
   # Terminal 1
   cd worker
   npm run dev

   # Terminal 2
   npm run dev
   ```

2. **Verify ports:**

   ```bash
   # Bash
   lsof -i :3000  # Next.js
   lsof -i :10000 # Worker

   # PowerShell
   Get-NetTCPConnection -LocalPort 3000
   Get-NetTCPConnection -LocalPort 10000
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run smoke tests
        run: |
          npm run dev &
          cd worker && npm run dev &
          sleep 10
          bash tests/smoke.sh
```

## Test Coverage Goals

- **Unit tests:** 90%+ coverage for `src/lib/` utilities
- **Integration tests:** Cover all API routes with mocked Worker responses
- **Smoke tests:** Verify end-to-end authentication locally
- **E2E tests:** (Future) Browser automation for UI flows

## Development Workflow

1. **Write failing test** (TDD)

   ```bash
   npm run test:ui
   # Add test case to appropriate file
   ```

2. **Implement feature**

   ```typescript
   // Add code to src/lib/...
   ```

3. **Verify test passes**

   ```bash
   npm test
   ```

4. **Run smoke tests before pushing**

   ```bash
   # Start services, then:
   .\tests\smoke.ps1
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add X with tests"
   git push
   ```
