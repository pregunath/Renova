#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=================================="
echo "       RENOVA TEST RUNNER"
echo "=================================="

# ── FRONTEND ──────────────────────────
echo ""
echo "[ FRONTEND TESTS ]"
echo "------------------"
cd "$ROOT/frontend"
npx jest --watchAll=false --verbose 2>&1
FRONTEND_EXIT=$?

# ── BACKEND ───────────────────────────
echo ""
echo "[ BACKEND TESTS ]"
echo "-----------------"
cd "$ROOT/backend"
npx jest --watchAll=false --verbose 2>&1
BACKEND_EXIT=$?

# ── SUMMARY ───────────────────────────
echo ""
echo "=================================="
echo "           SUMMARY"
echo "=================================="
if [ $FRONTEND_EXIT -eq 0 ]; then
  echo "  Frontend: PASSED"
else
  echo "  Frontend: FAILED (exit $FRONTEND_EXIT)"
fi

if [ $BACKEND_EXIT -eq 0 ]; then
  echo "  Backend:  PASSED"
else
  echo "  Backend:  FAILED (exit $BACKEND_EXIT)"
fi
echo "=================================="
echo ""

# Exit non-zero if either failed
[ $FRONTEND_EXIT -eq 0 ] && [ $BACKEND_EXIT -eq 0 ]
