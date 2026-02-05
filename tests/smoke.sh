#!/bin/bash
# Smoke tests for local development
# Tests that worker and Next.js can authenticate with each other

set -e

echo "=== Epstein Search: Local Smoke Tests ==="
echo ""

# Configuration
WORKER_URL="http://localhost:10000"
NEXTJS_URL="http://localhost:3000"
WORKER_SECRET="test-secret-key-123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local expected_status=$5

  echo -n "Testing: $name... "
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (Expected $expected_status, got $http_code)"
    echo "Response: $body"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Check if services are running
echo "Checking service availability..."
echo ""

# Check worker
if ! timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/10000" 2>/dev/null; then
  echo -e "${RED}✗ Worker not running on http://localhost:10000${NC}"
  echo "  Start with: cd worker && npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Worker running on http://localhost:10000${NC}"

# Check Next.js
if ! timeout 2 bash -c "cat < /dev/null > /dev/tcp/localhost/3000" 2>/dev/null; then
  echo -e "${RED}✗ Next.js not running on http://localhost:3000${NC}"
  echo "  Start with: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Next.js running on http://localhost:3000${NC}"
echo ""

# Test worker health
echo "=== Worker Health Tests ==="
test_endpoint "Worker health check" "GET" "$WORKER_URL/health" "" "200"
echo ""

# Test Next.js API routes
echo "=== Next.js API Route Tests ==="

# Test search with valid query
test_endpoint "Search GET with valid query" "GET" \
  "$NEXTJS_URL/api/search?q=epstein&from=0&size=10" "" "200"

test_endpoint "Search POST with valid query" "POST" \
  "$NEXTJS_URL/api/search" \
  '{"query":"epstein","from":0,"size":10}' "200"

# Test validation
test_endpoint "Search rejects empty query" "GET" \
  "$NEXTJS_URL/api/search?q=&from=0&size=10" "" "400"

test_endpoint "Search rejects invalid characters" "POST" \
  "$NEXTJS_URL/api/search" \
  '{"query":"<script>alert(1)</script>","from":0,"size":10}' "400"

test_endpoint "Search rejects oversized query" "POST" \
  "$NEXTJS_URL/api/search" \
  "{\"query\":\"$(printf 'a%.0s' {1..501})\",\"from\":0,\"size\":10}" "400"

echo ""

# Test analyze endpoint
echo "=== Analysis Endpoint Tests ==="

# Valid justice.gov URL (will fail at proxy, but should pass validation)
test_endpoint "Analyze accepts justice.gov HTTPS URL" "POST" \
  "$NEXTJS_URL/api/deep-analyze" \
  '{"fileUri":"https://www.justice.gov/files/test.pdf","fileName":"test.pdf"}' \
  "202"

# Invalid domain
test_endpoint "Analyze rejects non-justice.gov URLs" "POST" \
  "$NEXTJS_URL/api/deep-analyze" \
  '{"fileUri":"https://example.com/file.pdf","fileName":"file.pdf"}' "400"

# HTTP instead of HTTPS
test_endpoint "Analyze rejects HTTP URLs" "POST" \
  "$NEXTJS_URL/api/deep-analyze" \
  '{"fileUri":"http://www.justice.gov/file.pdf","fileName":"file.pdf"}' "400"

echo ""
echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All smoke tests passed! ✓${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Check logs above.${NC}"
  exit 1
fi
