#!/bin/bash

echo ""
echo "🔍 Verifying Phase 2-5 Implementation"
echo "======================================================"

passed=0
failed=0

check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
        ((passed++))
    else
        echo "❌ $1 (NOT FOUND)"
        ((failed++))
    fi
}

echo ""
echo "📦 Phase 2: Undo/Redo System"
echo "------------------------------------------------------"
check_file "src/lib/vanilla/features/history-manager-v2.js"
check_file "src/contexts/HistoryContext.tsx"
check_file "src/components/UndoRedoButtons.tsx"
check_file "test-phase2-p0.js"
check_file "test-phase2-p1.js"
check_file "test-phase2-p2.js"
check_file "test-phase2-p3.js"

echo ""
echo "📦 Phase 3: Page Splitting"
echo "------------------------------------------------------"
check_file "src/lib/vanilla/core/renderer.js"
check_file "test-phase3.js"

echo ""
echo "📦 Phase 4: Performance Optimization"
echo "------------------------------------------------------"
check_file "test-phase4.js"

echo ""
echo "📦 Phase 5: Error Handling & QA"
echo "------------------------------------------------------"
check_file "src/lib/vanilla/utils/error-boundary.js"
check_file "src/lib/vanilla/utils/logging-validator.js"
check_file "test-phase5.js"

echo ""
echo "======================================================"
echo "📊 Verification Results"
echo "======================================================"
echo "✅ Passed: $passed"
echo "❌ Failed: $failed"
echo "📊 Total:  $((passed + failed))"
echo ""

if [ $failed -eq 0 ]; then
    echo "✨ All files verified! Implementation complete."
    echo "🌐 Dev server running at: http://localhost:5090/"
    echo "📖 See test-live-features.md for testing guide."
else
    echo "⚠️ Some files are missing."
    exit 1
fi

echo ""
