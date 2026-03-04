#!/usr/bin/env python3
"""
build.py - Autonomous Feature Pipeline (cross-platform)

Replaces build.sh. Uses subprocess for Windows/Mac/Linux compatibility.
Output from claude -p streams live to terminal via stream-json parsing.

Usage:
  python .claude/scripts/build.py specs/phase-0/2026-03-02-feature-name
  python .claude/scripts/build.py specs/feature-a specs/feature-b
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# --- Colors ---
RED    = '\033[0;31m'
GREEN  = '\033[0;32m'
YELLOW = '\033[1;33m'
CYAN   = '\033[0;36m'
BOLD   = '\033[1m'
NC     = '\033[0m'

# --- Config ---
PLANNER_PROMPT_FILE    = ".claude/commands/planner.md"
ORCHESTRATE_PROMPT_FILE = ".claude/commands/orchestrate.md"
MAX_TURNS = 200


# =============================================================================
# Helpers
# =============================================================================

def log_phase(num, text): print(f"\n{CYAN}{BOLD}=== Phase {num}: {text} ==={NC}\n")
def log_ok(text):         print(f"{GREEN}[OK]{NC} {text}")
def log_warn(text):       print(f"{YELLOW}[WARN]{NC} {text}")
def log_fail(text):       print(f"{RED}[FAIL]{NC} {text}")


def find_claude():
    """Find claude CLI binary on any OS."""
    found = shutil.which('claude')
    if found:
        return found
    home = Path.home()
    candidates = [
        home / '.local' / 'bin' / 'claude',
        home / '.local' / 'bin' / 'claude.exe',
        home / '.npm-global' / 'bin' / 'claude',
        Path('/usr/local/bin/claude'),
        Path('/opt/homebrew/bin/claude'),
        home / 'AppData' / 'Roaming' / 'npm' / 'claude.cmd',
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def git(args, capture=True):
    """Run git command. Returns CompletedProcess."""
    return subprocess.run(['git'] + args, capture_output=capture, text=True)


def read_state(path):
    """Read JSON state file, return dict or {}."""
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception:
        return {}


class StreamParser:
    """Parses claude --output-format stream-json events and displays them live."""

    def __init__(self):
        self._text_buf = ''
        self._tool_json_buf = ''
        self._current_tool = None
        self._block_index_to_tool = {}

    def feed(self, raw_line):
        """Process one line of stream-json output."""
        try:
            wrapper = json.loads(raw_line)
        except json.JSONDecodeError:
            return

        # stream-json wraps API events: {"type":"stream_event","event":{...}}
        if wrapper.get('type') == 'stream_event':
            event = wrapper.get('event', {})
        else:
            event = wrapper

        etype = event.get('type', '')

        # --- Content block start: tool_use or text ---
        if etype == 'content_block_start':
            block = event.get('content_block', {})
            idx = event.get('index', 0)
            if block.get('type') == 'tool_use':
                self._flush_text()
                name = block.get('name', '?')
                self._current_tool = name
                self._tool_json_buf = ''
                self._block_index_to_tool[idx] = name

        # --- Content block delta: text or tool input ---
        elif etype == 'content_block_delta':
            delta = event.get('delta', {})
            dtype = delta.get('type', '')
            if dtype == 'text_delta':
                self._text_buf += delta.get('text', '')
            elif dtype == 'input_json_delta':
                self._tool_json_buf += delta.get('partial_json', '')

        # --- Content block stop: flush accumulated content ---
        elif etype == 'content_block_stop':
            idx = event.get('index', 0)
            if idx in self._block_index_to_tool:
                self._display_tool_call(self._block_index_to_tool.pop(idx))
                self._current_tool = None
                self._tool_json_buf = ''
            else:
                self._flush_text()

        # --- Message stop ---
        elif etype == 'message_stop':
            self._flush_text()

        # --- Result (final output from CLI) ---
        elif etype == 'result':
            self._flush_text()
            print(f"\n{BOLD}{'='*50}{NC}")
            print(f"{GREEN}●{NC} Claude session completed")
            sys.stdout.flush()

        # --- Error ---
        elif etype == 'error':
            err = event.get('error', {})
            msg = err.get('message', str(err)) if isinstance(err, dict) else str(err)
            print(f"\n{RED}● Error: {msg}{NC}")
            sys.stdout.flush()

    def _flush_text(self):
        """Print accumulated assistant text."""
        text = self._text_buf.strip()
        if text:
            for line in text.split('\n'):
                print(f"\n{CYAN}●{NC} {line}")
            sys.stdout.flush()
        self._text_buf = ''

    def _display_tool_call(self, tool_name):
        """Display a tool call with parsed input."""
        try:
            inp = json.loads(self._tool_json_buf) if self._tool_json_buf else {}
        except json.JSONDecodeError:
            inp = {}

        label = self._format_tool(tool_name, inp)
        print(f"\n{CYAN}●{NC} {label}")
        sys.stdout.flush()

    def _format_tool(self, tool, inp):
        """Create a short display string for a tool call."""
        if tool in ('Write', 'Edit', 'Read'):
            return f"{tool}({_short_path(inp.get('file_path', ''))})"
        if tool == 'Bash':
            desc = inp.get('description', inp.get('command', '')[:80])
            return f"Bash({desc})"
        if tool == 'Glob':
            return f"Glob({inp.get('pattern', '')})"
        if tool == 'Grep':
            return f"Grep({inp.get('pattern', '')})"
        if tool == 'Agent':
            return f"Agent({inp.get('subagent_type', '')}: {inp.get('description', '')})"
        if tool == 'Skill':
            return f"Skill({inp.get('skill', '')})"
        if tool == 'TaskCreate':
            return f"TaskCreate({inp.get('subject', '')[:60]})"
        if tool == 'TaskUpdate':
            return f"TaskUpdate({inp.get('taskId', '')} -> {inp.get('status', '')})"
        return f"{tool}()"


def run_claude_streaming(claude_bin, prompt, system_prompt_file):
    """Run claude -p with stream-json and display live output."""
    # Remove CLAUDECODE env var so nested claude sessions can start
    env = {k: v for k, v in os.environ.items() if k != 'CLAUDECODE'}

    proc = subprocess.Popen(
        [
            claude_bin, '-p', prompt,
            '--system-prompt-file', system_prompt_file,
            '--dangerously-skip-permissions',
            '--max-turns', str(MAX_TURNS),
            '--output-format', 'stream-json',
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1,
        env=env,
    )

    parser = StreamParser()
    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            parser.feed(line)

        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        proc.wait()
        raise

    # Show stderr if there was any (errors, warnings)
    stderr_out = proc.stderr.read() if proc.stderr else ''
    if stderr_out.strip():
        print(f"\n{YELLOW}[stderr]{NC} {stderr_out.strip()}")

    return proc.returncode


def _short_path(path):
    """Shorten path for display."""
    parts = Path(path).parts
    if len(parts) > 3:
        return str(Path(*parts[-3:]))
    return path


# =============================================================================
# Phases
# =============================================================================

def validate_spec(spec_path):
    """Phase 1: Check required files exist."""
    p = Path(spec_path)
    for f in ['discovery.md', 'architecture.md']:
        if not (p / f).exists():
            log_fail(f"{f} fehlt in {spec_path}")
            return False
    log_ok(f"Spec validiert: {spec_path}")
    return True


def setup_branch(spec_path):
    """Phase 2: Create or checkout feature branch."""
    branch = f"feat/{Path(spec_path).name}"

    if git(['branch', '--show-current']).stdout.strip() == branch:
        log_ok(f"Bereits auf Branch {branch}")
        return branch

    # Stash if dirty
    if git(['diff', '--quiet']).returncode != 0 or git(['diff', '--cached', '--quiet']).returncode != 0:
        log_warn("Uncommitted changes detected, stashing...")
        git(['stash', 'push', '-m', 'build.py auto-stash'], capture=False)

    # Switch to main/master
    if git(['checkout', 'main']).returncode != 0:
        if git(['checkout', 'master']).returncode != 0:
            log_fail("Konnte nicht auf main/master wechseln")
            return None

    git(['pull', 'origin', git(['branch', '--show-current']).stdout.strip()])

    # Checkout or create branch
    if branch in git(['branch', '--list', branch]).stdout:
        git(['checkout', branch], capture=False)
        log_ok(f"Bestehender Branch {branch} ausgecheckt (Resume)")
    elif branch in git(['ls-remote', '--heads', 'origin', branch]).stdout:
        git(['checkout', '-b', branch, f'origin/{branch}'], capture=False)
        log_ok(f"Remote Branch {branch} ausgecheckt (Resume)")
    else:
        git(['checkout', '-b', branch], capture=False)
        log_ok(f"Neuer Branch {branch} erstellt")

    return branch


def run_planner(spec_path, claude_bin):
    """Phase 3: Run planner via claude -p (live output)."""
    state_file = Path(spec_path) / '.planner-state.json'

    state = read_state(state_file)
    if state.get('status') == 'completed' and state.get('phase') == 'completed':
        log_ok("Planning bereits abgeschlossen, ueberspringe")
        return True

    log_phase("3", "Planning (claude -p)")

    prompt = f"""Fuehre das vollstaendige Slice-Planning aus fuer: {spec_path}

Lies den Spec-Ordner und fuehre alle Phasen des Planner-Commands aus:
1. Input-Validierung
2. State Management (Resume falls .planner-state.json existiert)
3. Slice Planning Loop (slice-writer + slice-compliance pro Slice)
4. Gate 3 Integration Validation (integration-map)

Der spec_path ist: {spec_path}
Arbeite vollstaendig autonom ohne Rueckfragen."""

    run_claude_streaming(claude_bin, prompt, PLANNER_PROMPT_FILE)

    state = read_state(state_file)
    if not state_file.exists():
        log_fail(f"Planner hat keine State-Datei erzeugt: {state_file}")
        return False
    if state.get('status') == 'completed' and state.get('phase') == 'completed':
        log_ok("Planning abgeschlossen")
        return True
    elif state.get('status') == 'failed':
        log_fail(f"Planning fehlgeschlagen: {state.get('last_action', 'unknown')}")
        return False
    else:
        log_fail(f"Planning nicht abgeschlossen (status: {state.get('status')}, phase: {state.get('phase')})")
        return False


def run_orchestrate(spec_path, claude_bin):
    """Phase 4: Run orchestrate via claude -p (live output)."""
    state_file = Path(spec_path) / '.orchestrator-state.json'

    state = read_state(state_file)
    if state.get('status') == 'completed' or state.get('current_state') == 'feature_complete':
        log_ok("Implementation bereits abgeschlossen, ueberspringe")
        return True

    log_phase("4", "Implementation (claude -p)")

    prompt = f"""Orchestriere die vollstaendige Implementation fuer: {spec_path}

Lies den Spec-Ordner und fuehre alle Phasen des Orchestrate-Commands aus:
1. Input-Validierung & Pre-Impl Sanity Check
2. Setup & State Management (Resume falls .orchestrator-state.json existiert)
3. Stack Detection
4. Wave-Based Implementation (6-Step Pipeline pro Slice)
5. Final Validation
6. Completion

Der spec_path ist: {spec_path}
Arbeite vollstaendig autonom ohne Rueckfragen."""

    run_claude_streaming(claude_bin, prompt, ORCHESTRATE_PROMPT_FILE)

    state = read_state(state_file)
    if not state_file.exists():
        log_fail(f"Orchestrator hat keine State-Datei erzeugt: {state_file}")
        return False
    if state.get('status') == 'completed' or state.get('current_state') == 'feature_complete':
        log_ok("Implementation abgeschlossen")
        return True
    elif state.get('status') == 'failed':
        log_fail(f"Implementation fehlgeschlagen: {state.get('last_action', state.get('error', 'unknown'))}")
        return False
    else:
        log_fail(f"Implementation nicht abgeschlossen (status: {state.get('status')}, state: {state.get('current_state')})")
        return False


def push_and_pr(spec_path, branch):
    """Phase 5: Git push + create PR."""
    log_phase("5", "Git Push + PR")
    feature_name = Path(spec_path).name

    slices_dir = Path(spec_path) / 'slices'
    slice_count = len(list(slices_dir.glob('slice-*.md'))) if slices_dir.exists() else 0

    result = subprocess.run(['git', 'push', '-u', 'origin', branch], capture_output=True, text=True)
    if result.returncode != 0:
        log_fail(f"Git push fehlgeschlagen: {result.stderr.strip()}")
        return None
    log_ok(f"Branch gepusht: {branch}")

    # Existing PR?
    existing = subprocess.run(
        ['gh', 'pr', 'list', '--head', branch, '--json', 'number', '--jq', '.[0].number'],
        capture_output=True, text=True
    ).stdout.strip()
    if existing:
        log_ok(f"PR existiert bereits: #{existing}")
        return existing

    body = f"""## Feature: {feature_name}

Slices: {slice_count}

Autonomously built with `build.py` pipeline.

### Pipeline
- Planning: `claude -p` with `planner.md` system prompt
- Implementation: `claude -p` with `orchestrate.md` system prompt
- Each phase ran in its own session with fresh context
"""
    result = subprocess.run(
        ['gh', 'pr', 'create', '--title', f'feat: {feature_name}', '--body', body],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        log_fail(f"PR-Erstellung fehlgeschlagen: {result.stderr.strip()}")
        return None

    pr_url = result.stdout.strip()
    log_ok(f"PR erstellt: {pr_url}")
    return pr_url


# =============================================================================
# Main
# =============================================================================

def main():
    if len(sys.argv) < 2:
        print(f"{RED}STOP: Mindestens ein Spec-Pfad erforderlich.{NC}")
        print()
        print("Aufruf:")
        print("  python .claude/scripts/build.py {spec_path}")
        print("  python .claude/scripts/build.py {spec_path_1} {spec_path_2}")
        print()
        print("Beispiel:")
        print("  python .claude/scripts/build.py specs/phase-0/2026-03-02-e2e-generate-persist")
        sys.exit(1)

    specs = sys.argv[1:]

    claude_bin = find_claude()
    if not claude_bin:
        print(f"{RED}STOP: claude CLI nicht gefunden. Bitte installieren oder PATH setzen.{NC}")
        sys.exit(1)

    print()
    print(f"{BOLD}============================================={NC}")
    print(f"{BOLD}=== build.py - Autonomous Feature Pipeline ==={NC}")
    print(f"{BOLD}============================================={NC}")
    print(f"Specs:  {len(specs)}")
    print(f"Claude: {claude_bin}")
    print()

    completed, failed = [], []

    for i, spec in enumerate(specs):
        feature_name = Path(spec).name
        print()
        print(f"{BOLD}============================================={NC}")
        print(f"{BOLD}=== Feature {i+1}/{len(specs)}: {feature_name} ==={NC}")
        print(f"{BOLD}============================================={NC}")

        log_phase("1", "Validierung")
        if not validate_spec(spec):
            failed.append((spec, "Validierung fehlgeschlagen"))
            continue

        log_phase("2", "Git Branch")
        branch = setup_branch(spec)
        if not branch:
            failed.append((spec, "Branch-Setup fehlgeschlagen"))
            continue

        if not run_planner(spec, claude_bin):
            failed.append((spec, "Planning fehlgeschlagen"))
            log_fail(f"Feature fehlgeschlagen: {feature_name}")
            print(f"Resume: python .claude/scripts/build.py {spec}")
            continue

        if not run_orchestrate(spec, claude_bin):
            failed.append((spec, "Implementation fehlgeschlagen"))
            log_fail(f"Feature fehlgeschlagen: {feature_name}")
            print(f"Resume: python .claude/scripts/build.py {spec}")
            continue

        pr = push_and_pr(spec, branch)
        if not pr:
            failed.append((spec, "Push/PR fehlgeschlagen"))
            log_fail(f"Feature fehlgeschlagen: {feature_name}")
            print(f"Resume: python .claude/scripts/build.py {spec}")
            continue

        completed.append((spec, pr))
        print()
        log_ok(f"Feature {feature_name} abgeschlossen! PR: {pr}")

    # Summary
    print()
    print(f"{BOLD}============================================={NC}")
    print(f"{BOLD}=== build.py Zusammenfassung ==={NC}")
    print(f"{BOLD}============================================={NC}")
    print()
    print(f"Gesamt:         {len(specs)} Features")
    print(f"Erfolgreich:    {len(completed)}")
    print(f"Fehlgeschlagen: {len(failed)}")
    print()

    if completed:
        print("Erfolgreiche Features:")
        for spec, pr in completed:
            print(f"  {GREEN}[OK]{NC} {spec} -> {pr}")

    if failed:
        print()
        print("Fehlgeschlagene Features:")
        for spec, error in failed:
            print(f"  {RED}[FAIL]{NC} {spec}")
            print(f"         Fehler: {error}")
            print(f"         Resume: python .claude/scripts/build.py {spec}")

    print()
    if not failed:
        print(f"{GREEN}Alle Features erfolgreich abgeschlossen!{NC}")
        sys.exit(0)
    else:
        print("Fehlgeschlagene Features koennen einzeln resumed werden.")
        sys.exit(1)


if __name__ == '__main__':
    main()
