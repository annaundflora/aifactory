#!/bin/bash
set -euo pipefail

# =============================================================================
# build.sh - Autonomous Feature Pipeline (Bash-Level Orchestration)
#
# Solves: Context exhaustion and 3-level nesting limitation of /build command.
# Each phase runs in its own `claude -p` session with 100% fresh context.
# State is passed between phases via files (.planner-state.json, .orchestrator-state.json).
#
# Usage:
#   .claude/scripts/build.sh specs/2026-03-02-feature-name
#   .claude/scripts/build.sh specs/feature-a specs/feature-b
# =============================================================================

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Config ---
PLANNER_PROMPT_FILE=".claude/commands/planner.md"
ORCHESTRATE_PROMPT_FILE=".claude/commands/orchestrate.md"
MAX_TURNS=200

# --- Argument Parsing ---
if [ $# -eq 0 ]; then
  echo -e "${RED}STOP: Mindestens ein Spec-Pfad erforderlich.${NC}"
  echo ""
  echo "Aufruf:"
  echo "  .claude/scripts/build.sh {spec_path}                  - Ein Feature"
  echo "  .claude/scripts/build.sh {spec_path_1} {spec_path_2}  - Mehrere Features"
  echo ""
  echo "Beispiel:"
  echo "  .claude/scripts/build.sh specs/phase-0/2026-03-02-e2e-generate-persist"
  exit 1
fi

SPECS=("$@")

# --- Summary Tracking ---
completed_features=()
failed_features=()

# =============================================================================
# Functions
# =============================================================================

log_phase() {
  echo ""
  echo -e "${CYAN}${BOLD}=== Phase $1: $2 ===${NC}"
  echo ""
}

log_ok() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
}

# --- Phase 1: Validate Spec ---
validate_spec() {
  local spec_path="$1"

  if [ ! -f "${spec_path}/discovery.md" ]; then
    log_fail "discovery.md fehlt in ${spec_path}"
    return 1
  fi

  if [ ! -f "${spec_path}/architecture.md" ]; then
    log_fail "architecture.md fehlt in ${spec_path}"
    return 1
  fi

  log_ok "Spec validiert: ${spec_path}"
  return 0
}

# --- Phase 2: Git Branch Setup ---
setup_branch() {
  local spec_path="$1"
  local feature_name
  feature_name=$(basename "$spec_path")
  local branch_name="feat/${feature_name}"

  # Check if we're already on the correct branch
  local current_branch
  current_branch=$(git branch --show-current)
  if [ "$current_branch" = "$branch_name" ]; then
    log_ok "Bereits auf Branch ${branch_name}"
    echo "$branch_name"
    return 0
  fi

  # Stash any uncommitted changes
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    log_warn "Uncommitted changes detected, stashing..."
    git stash push -m "build.sh auto-stash before branch switch"
  fi

  # Switch to main and pull
  git checkout main 2>/dev/null || git checkout master 2>/dev/null || {
    log_fail "Konnte nicht auf main/master wechseln"
    return 1
  }
  git pull origin "$(git branch --show-current)" 2>/dev/null || true

  # Check if branch already exists (resume case)
  if git branch --list "$branch_name" | grep -q "$branch_name"; then
    git checkout "$branch_name"
    log_ok "Bestehender Branch ${branch_name} ausgecheckt (Resume)"
  elif git ls-remote --heads origin "$branch_name" 2>/dev/null | grep -q "$branch_name"; then
    git checkout -b "$branch_name" "origin/${branch_name}"
    log_ok "Remote Branch ${branch_name} ausgecheckt (Resume)"
  else
    git checkout -b "$branch_name"
    log_ok "Neuer Branch ${branch_name} erstellt"
  fi

  echo "$branch_name"
}

# --- Phase 3: Run Planner ---
run_planner() {
  local spec_path="$1"
  local state_file="${spec_path}/.planner-state.json"

  # Resume check: skip if already completed
  if [ -f "$state_file" ]; then
    local status
    status=$(jq -r '.status // empty' "$state_file" 2>/dev/null || echo "")
    local phase
    phase=$(jq -r '.phase // empty' "$state_file" 2>/dev/null || echo "")

    if [ "$status" = "completed" ] && [ "$phase" = "completed" ]; then
      log_ok "Planning bereits abgeschlossen, ueberspringe"
      return 0
    fi
  fi

  log_phase "3" "Planning (claude -p)"

  local prompt="Fuehre das vollstaendige Slice-Planning aus fuer: ${spec_path}

Lies den Spec-Ordner und fuehre alle Phasen des Planner-Commands aus:
1. Input-Validierung
2. State Management (Resume falls .planner-state.json existiert)
3. Slice Planning Loop (slice-writer + slice-compliance pro Slice)
4. Gate 3 Integration Validation (integration-map)

Der spec_path ist: ${spec_path}
Arbeite vollstaendig autonom ohne Rueckfragen."

  claude -p "$prompt" \
    --system-prompt-file "$PLANNER_PROMPT_FILE" \
    --dangerously-skip-permissions \
    --max-turns "$MAX_TURNS" \
    --output-format text \
    2>&1 | tail -50

  # Verify planner completed successfully
  if [ ! -f "$state_file" ]; then
    log_fail "Planner hat keine State-Datei erzeugt: ${state_file}"
    return 1
  fi

  local final_status
  final_status=$(jq -r '.status // empty' "$state_file" 2>/dev/null || echo "")
  local final_phase
  final_phase=$(jq -r '.phase // empty' "$state_file" 2>/dev/null || echo "")

  if [ "$final_status" = "completed" ] && [ "$final_phase" = "completed" ]; then
    log_ok "Planning abgeschlossen"
    return 0
  elif [ "$final_status" = "failed" ]; then
    local error
    error=$(jq -r '.last_action // "unknown"' "$state_file" 2>/dev/null || echo "unknown")
    log_fail "Planning fehlgeschlagen: ${error}"
    return 1
  else
    log_fail "Planning nicht abgeschlossen (status: ${final_status}, phase: ${final_phase})"
    return 1
  fi
}

# --- Phase 4: Run Orchestrate ---
run_orchestrate() {
  local spec_path="$1"
  local state_file="${spec_path}/.orchestrator-state.json"

  # Resume check: skip if already completed
  if [ -f "$state_file" ]; then
    local status
    status=$(jq -r '.status // empty' "$state_file" 2>/dev/null || echo "")
    local current_state
    current_state=$(jq -r '.current_state // empty' "$state_file" 2>/dev/null || echo "")

    if [ "$status" = "completed" ] || [ "$current_state" = "feature_complete" ]; then
      log_ok "Implementation bereits abgeschlossen, ueberspringe"
      return 0
    fi
  fi

  log_phase "4" "Implementation (claude -p)"

  local prompt="Orchestriere die vollstaendige Implementation fuer: ${spec_path}

Lies den Spec-Ordner und fuehre alle Phasen des Orchestrate-Commands aus:
1. Input-Validierung & Pre-Impl Sanity Check
2. Setup & State Management (Resume falls .orchestrator-state.json existiert)
3. Stack Detection
4. Wave-Based Implementation (6-Step Pipeline pro Slice)
5. Final Validation
6. Completion

Der spec_path ist: ${spec_path}
Arbeite vollstaendig autonom ohne Rueckfragen."

  claude -p "$prompt" \
    --system-prompt-file "$ORCHESTRATE_PROMPT_FILE" \
    --dangerously-skip-permissions \
    --max-turns "$MAX_TURNS" \
    --output-format text \
    2>&1 | tail -50

  # Verify orchestrate completed successfully
  if [ ! -f "$state_file" ]; then
    log_fail "Orchestrator hat keine State-Datei erzeugt: ${state_file}"
    return 1
  fi

  local final_status
  final_status=$(jq -r '.status // empty' "$state_file" 2>/dev/null || echo "")
  local final_state
  final_state=$(jq -r '.current_state // empty' "$state_file" 2>/dev/null || echo "")

  if [ "$final_status" = "completed" ] || [ "$final_state" = "feature_complete" ]; then
    log_ok "Implementation abgeschlossen"
    return 0
  elif [ "$final_status" = "failed" ]; then
    local error
    error=$(jq -r '.last_action // .error // "unknown"' "$state_file" 2>/dev/null || echo "unknown")
    log_fail "Implementation fehlgeschlagen: ${error}"
    return 1
  else
    log_fail "Implementation nicht abgeschlossen (status: ${final_status}, state: ${final_state})"
    return 1
  fi
}

# --- Phase 5: Git Push + PR ---
push_and_pr() {
  local spec_path="$1"
  local branch_name="$2"
  local feature_name
  feature_name=$(basename "$spec_path")

  log_phase "5" "Git Push + PR"

  # Count slices for PR body
  local slice_count
  slice_count=$(find "${spec_path}/slices" -name "slice-*.md" -not -name "compliance-*" 2>/dev/null | wc -l || echo "0")
  slice_count=$(echo "$slice_count" | tr -d ' ')

  # Push
  git push -u origin "$branch_name" 2>&1 || {
    log_fail "Git push fehlgeschlagen"
    return 1
  }
  log_ok "Branch gepusht: ${branch_name}"

  # Check if PR already exists
  local existing_pr
  existing_pr=$(gh pr list --head "$branch_name" --json number --jq '.[0].number' 2>/dev/null || echo "")

  if [ -n "$existing_pr" ]; then
    log_ok "PR existiert bereits: #${existing_pr}"
    echo "$existing_pr"
    return 0
  fi

  # Create PR
  local pr_url
  pr_url=$(gh pr create \
    --title "feat: ${feature_name}" \
    --body "$(cat <<EOF
## Feature: ${feature_name}

Slices: ${slice_count}

Autonomously built with \`build.sh\` pipeline.

### Pipeline
- Planning: \`claude -p\` with \`planner.md\` system prompt
- Implementation: \`claude -p\` with \`orchestrate.md\` system prompt
- Each phase ran in its own session with fresh context
EOF
)" 2>&1) || {
    log_fail "PR-Erstellung fehlgeschlagen"
    return 1
  }

  log_ok "PR erstellt: ${pr_url}"
  echo "$pr_url"
}

# =============================================================================
# Main Loop
# =============================================================================

echo ""
echo -e "${BOLD}=============================================${NC}"
echo -e "${BOLD}=== build.sh - Autonomous Feature Pipeline ===${NC}"
echo -e "${BOLD}=============================================${NC}"
echo -e "Specs: ${#SPECS[@]}"
echo ""

for i in "${!SPECS[@]}"; do
  spec="${SPECS[$i]}"
  feature_name=$(basename "$spec")
  idx=$((i + 1))
  total=${#SPECS[@]}

  echo ""
  echo -e "${BOLD}=============================================${NC}"
  echo -e "${BOLD}=== Feature ${idx}/${total}: ${feature_name} ===${NC}"
  echo -e "${BOLD}=============================================${NC}"

  # --- Phase 1: Validate ---
  log_phase "1" "Validierung"
  if ! validate_spec "$spec"; then
    failed_features+=("${spec}|Validierung fehlgeschlagen")
    log_fail "Feature uebersprungen: ${feature_name}"
    continue
  fi

  # --- Phase 2: Branch ---
  log_phase "2" "Git Branch"
  branch_name=$(setup_branch "$spec") || {
    failed_features+=("${spec}|Branch-Setup fehlgeschlagen")
    log_fail "Feature uebersprungen: ${feature_name}"
    continue
  }

  # --- Phase 3: Planner ---
  if ! run_planner "$spec"; then
    failed_features+=("${spec}|Planning fehlgeschlagen")
    log_fail "Feature fehlgeschlagen: ${feature_name}"
    echo "Resume: .claude/scripts/build.sh ${spec}"
    continue
  fi

  # --- Phase 4: Orchestrate ---
  if ! run_orchestrate "$spec"; then
    failed_features+=("${spec}|Implementation fehlgeschlagen")
    log_fail "Feature fehlgeschlagen: ${feature_name}"
    echo "Resume: .claude/scripts/build.sh ${spec}"
    continue
  fi

  # --- Phase 5: Push + PR ---
  pr_result=$(push_and_pr "$spec" "$branch_name") || {
    failed_features+=("${spec}|Push/PR fehlgeschlagen")
    log_fail "Feature fehlgeschlagen: ${feature_name}"
    echo "Resume: .claude/scripts/build.sh ${spec}"
    continue
  }

  completed_features+=("${spec}|${pr_result}")
  echo ""
  log_ok "Feature ${feature_name} abgeschlossen! PR: ${pr_result}"

done

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}=============================================${NC}"
echo -e "${BOLD}=== build.sh Zusammenfassung ===${NC}"
echo -e "${BOLD}=============================================${NC}"
echo ""
echo "Gesamt:         ${#SPECS[@]} Features"
echo "Erfolgreich:    ${#completed_features[@]}"
echo "Fehlgeschlagen: ${#failed_features[@]}"
echo ""

if [ ${#completed_features[@]} -gt 0 ]; then
  echo "Erfolgreiche Features:"
  for entry in "${completed_features[@]}"; do
    spec="${entry%%|*}"
    pr="${entry#*|}"
    echo -e "  ${GREEN}[OK]${NC} ${spec} -> ${pr}"
  done
fi

if [ ${#failed_features[@]} -gt 0 ]; then
  echo ""
  echo "Fehlgeschlagene Features:"
  for entry in "${failed_features[@]}"; do
    spec="${entry%%|*}"
    error="${entry#*|}"
    echo -e "  ${RED}[FAIL]${NC} ${spec}"
    echo "         Fehler: ${error}"
    echo "         Resume: .claude/scripts/build.sh ${spec}"
  done
fi

echo ""

if [ ${#failed_features[@]} -eq 0 ]; then
  echo -e "${GREEN}Alle Features erfolgreich abgeschlossen!${NC}"
  exit 0
else
  echo "Fehlgeschlagene Features koennen einzeln resumed werden."
  exit 1
fi
