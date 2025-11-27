#!/bin/bash

# Performance Comparison Script for Onyx Prototypes
# This script runs performance tests for all 4 prototypes and generates comparison reports

set -e

echo "======================================"
echo "Onyx Prototypes Performance Comparison"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prototypes to test
PROTOTYPES=("KeyBased" "StoreBased" "ProxyBased" "ObserverBased")

# Create comparison directory if it doesn't exist
COMPARISON_DIR=".reassure/comparisons"
mkdir -p "$COMPARISON_DIR"

# Function to run tests for a prototype
run_prototype_test() {
    local prototype=$1
    local baseline=$2

    echo ""
    echo -e "${BLUE}Testing: $prototype${NC}"
    echo "========================================"

    if [ "$baseline" = true ]; then
        echo -e "${YELLOW}Running baseline tests...${NC}"
        PROTOTYPE=$prototype npx reassure --testMatch="**/prototypes.perf-test.[jt]s" --baseline
    else
        echo -e "${YELLOW}Running current tests...${NC}"
        PROTOTYPE=$prototype npx reassure --testMatch="**/prototypes.perf-test.[jt]s"
    fi

    # Copy the results to a prototype-specific file
    if [ "$baseline" = true ]; then
        cp .reassure/baseline.perf "$COMPARISON_DIR/${prototype}_baseline.perf" 2>/dev/null || true
    else
        cp .reassure/current.perf "$COMPARISON_DIR/${prototype}_current.perf" 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ $prototype tests completed${NC}"
}

# Check if we should run baseline or current or both
MODE=${1:-"both"}

if [ "$MODE" = "baseline" ] || [ "$MODE" = "both" ]; then
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}PHASE 1: Running Baseline Tests${NC}"
    echo -e "${BLUE}========================================${NC}"

    for prototype in "${PROTOTYPES[@]}"; do
        run_prototype_test "$prototype" true
    done
fi

if [ "$MODE" = "current" ] || [ "$MODE" = "both" ]; then
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}PHASE 2: Running Current Tests${NC}"
    echo -e "${BLUE}========================================${NC}"

    for prototype in "${PROTOTYPES[@]}"; do
        run_prototype_test "$prototype" false
    done
fi

# Generate comparison reports
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Generating Comparison Reports${NC}"
echo -e "${BLUE}========================================${NC}"

# Run a comparison analysis script (we'll create this next)
node prototypes/analyze-results.js

echo ""
echo -e "${GREEN}======================================"
echo -e "✓ Performance comparison complete!"
echo -e "======================================${NC}"
echo ""
echo "Results saved in: $COMPARISON_DIR"
echo "Main comparison report: prototypes/PERFORMANCE_COMPARISON.md"
echo ""
