#!/usr/bin/env python3
"""
JobFeed Scheduler — pipeline orchestrator.

Runs every 30 minutes (configurable):
    telegram_scraper.py  →  scripts/import_jobs.mjs

Usage:
    py scheduler.py
    python scheduler.py

Environment variables:
    JOBFEED_SCRAPE_INTERVAL_MINUTES=30   (default)
    JOBFEED_SCRAPE_INTERVAL_MINUTES=1    (for testing)

Lock file  : server/scheduler.lock  (prevents duplicate instances)
"""

import os
import sys
import time
import json as _json
import signal
import subprocess
import atexit
from pathlib import Path
from datetime import datetime, timedelta, timezone

# ── Project root: the directory this script lives in (server/) ─────────────
PROJECT_ROOT: Path = Path(__file__).resolve().parent

# ── Scripts ────────────────────────────────────────────────────────────────
SCRAPER_SCRIPT: Path = PROJECT_ROOT / "telegram_scraper.py"
IMPORTER_SCRIPT: Path = PROJECT_ROOT / "scripts" / "import_jobs.mjs"

# ── Config ─────────────────────────────────────────────────────────────────
INTERVAL_MINUTES: int = int(os.environ.get("JOBFEED_SCRAPE_INTERVAL_MINUTES", "30"))

# ── Lock file ──────────────────────────────────────────────────────────────
LOCK_FILE: Path = PROJECT_ROOT / "scheduler.lock"

# ── Last-sync state file (shared with Express API) ─────────────────────────
LAST_SYNC_FILE: Path = PROJECT_ROOT / ".last-sync.json"

# ── Global: active child process (so Ctrl+C can terminate it) ──────────────
_current_process: subprocess.Popen | None = None


# ═══════════════════════════════════════════════════════════════════════════
# Lock helpers — Windows compatible, no extra dependencies
# ═══════════════════════════════════════════════════════════════════════════

def _is_pid_running(pid: int) -> bool:
    """Return True if a process with `pid` is alive (Windows `tasklist` check)."""
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return str(pid) in result.stdout
    except Exception:
        # If tasklist fails for any reason, assume stale lock
        return False


def acquire_lock() -> bool:
    """
    Write our PID to the lock file.
    Returns False if another live scheduler instance already owns the lock.
    """
    if LOCK_FILE.exists():
        try:
            raw = LOCK_FILE.read_text().strip()
            if raw:
                other_pid = int(raw)
                if other_pid != os.getpid() and _is_pid_running(other_pid):
                    return False   # Another real instance is running
        except (ValueError, OSError):
            pass
        # Stale lock — remove it
        LOCK_FILE.unlink(missing_ok=True)

    LOCK_FILE.write_text(str(os.getpid()))
    return True


def release_lock() -> None:
    """Delete the lock file if it belongs to this process."""
    try:
        if LOCK_FILE.exists():
            raw = LOCK_FILE.read_text().strip()
            if raw and int(raw) == os.getpid():
                LOCK_FILE.unlink()
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════
# Logging
# ═══════════════════════════════════════════════════════════════════════════

def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    sys.stdout.write(f"[{_now()}] {msg}\n")
    sys.stdout.flush()


def sep(char: str = "-", width: int = 50) -> None:
    print(char * width, flush=True)


# ═════════════════════════════════════════════════════════════════════════
# Sync-state file — write after SUCCESSFUL pipeline only
# ═════════════════════════════════════════════════════════════════════════

def _record_successful_sync() -> None:
    """
    Write .last-sync.json so the frontend sync indicator reflects the
    real timestamp of the last SUCCESSFUL scraper + importer run.
    Called only when both steps return exit code 0.
    A failed run must never call this function.
    """
    try:
        now = datetime.now(timezone.utc)
        payload = {
            "lastSyncedAt": now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z",
            "status": "success",
            "jobsInserted": None,   # scheduler doesn't parse importer output
            "source": "scheduler",
        }
        LAST_SYNC_FILE.write_text(_json.dumps(payload, indent=2), encoding="utf-8")
        log("Sync timestamp recorded → .last-sync.json")
    except Exception as exc:
        log(f"Warning: Could not write sync timestamp: {exc}")


# ═══════════════════════════════════════════════════════════════════════════
# Subprocess runner — streams output line-by-line
# ═══════════════════════════════════════════════════════════════════════════

def run_step(cmd: list, label: str) -> bool:
    """
    Run `cmd` with CWD=PROJECT_ROOT, stream stdout+stderr to terminal.
    Returns True if exit code is 0.
    """
    global _current_process

    log(f"Running {label}...")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,        # line-buffered
        )
        _current_process = proc

        # Stream output
        for line in proc.stdout:
            sys.stdout.buffer.write(("  > " + line).encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()

        proc.wait()
        _current_process = None

        if proc.returncode == 0:
            log(f"{label} completed successfully.")
            return True
        else:
            log(f"ERROR: {label} failed with exit code {proc.returncode}.")
            return False

    except FileNotFoundError as exc:
        log(f"ERROR: Command not found — {exc}")
        _current_process = None
        return False
    except Exception as exc:
        log(f"ERROR: Unexpected error running {label}: {exc}")
        _current_process = None
        return False


# ═══════════════════════════════════════════════════════════════════════════
# Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def run_pipeline() -> None:
    sep()
    log("Starting JobFeed pipeline")
    sep()

    # ── Step 1: Telegram scraper ──────────────────────────────────────────
    scraper_ok = run_step(
        [sys.executable, str(SCRAPER_SCRIPT)],
        "telegram_scraper.py",
    )

    if not scraper_ok:
        log("Skipping import -- scraper did not succeed.")
        log("Scheduler will retry on the next cycle.")
        return

    # ── Step 2: Node.js importer ──────────────────────────────────────────
    importer_ok = run_step(
        ["node", "scripts/import_jobs.mjs"],
        "scripts/import_jobs.mjs",
    )

    if importer_ok:
        log("Pipeline completed successfully.")
        _record_successful_sync()     # ← update .last-sync.json on success only
    else:
        log("Pipeline finished with import errors.")
        log("Scheduler will retry the full pipeline on the next cycle.")
        # NOTE: _record_successful_sync() is intentionally NOT called here.
        # The previous successful timestamp is preserved in .last-sync.json.


# ═══════════════════════════════════════════════════════════════════════════
# Scheduling helpers
# ═══════════════════════════════════════════════════════════════════════════

def next_run_time() -> datetime:
    """
    Return the next wall-clock-aligned run time.

    For INTERVAL_MINUTES=30: aligns to :00 and :30 each hour.
    For INTERVAL_MINUTES=1 : aligns to each whole minute.
    """
    now_ts = datetime.now().timestamp()
    interval_s = INTERVAL_MINUTES * 60
    next_ts = (int(now_ts / interval_s) + 1) * interval_s
    return datetime.fromtimestamp(next_ts)


def sleep_until(target: datetime) -> None:
    """Sleep until `target`, waking every second to remain responsive to signals."""
    while True:
        remaining = (target - datetime.now()).total_seconds()
        if remaining <= 0:
            break
        time.sleep(min(1.0, remaining))


# ═══════════════════════════════════════════════════════════════════════════
# Graceful shutdown
# ═══════════════════════════════════════════════════════════════════════════

def _shutdown(signum=None, frame=None) -> None:
    global _current_process
    print("", flush=True)
    log("Shutdown requested.")
    if _current_process and _current_process.poll() is None:
        log("Terminating active child process...")
        _current_process.terminate()
        try:
            _current_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            log("Child did not exit cleanly — killing.")
            _current_process.kill()
    release_lock()
    print("JobFeed scheduler stopped.", flush=True)
    sys.exit(0)


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    # Register signal handlers and atexit cleanup
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)
    atexit.register(release_lock)

    # Validate paths
    if not SCRAPER_SCRIPT.exists():
        print(f"ERROR: Scraper not found at {SCRAPER_SCRIPT}", flush=True)
        sys.exit(1)
    if not IMPORTER_SCRIPT.exists():
        print(f"ERROR: Importer not found at {IMPORTER_SCRIPT}", flush=True)
        sys.exit(1)

    # Acquire lock (prevent duplicate instances)
    if not acquire_lock():
        print("ERROR: Another JobFeed scheduler instance is already running.", flush=True)
        print(f"       If this is wrong, delete: {LOCK_FILE}", flush=True)
        sys.exit(1)

    # ── Banner ────────────────────────────────────────────────────────────
    nxt = next_run_time()
    sep("=")
    print("JOBFEED SCHEDULER", flush=True)
    sep("=")
    print(f"Scheduler started at {_now()}", flush=True)
    print(f"Interval  : {INTERVAL_MINUTES} minutes", flush=True)
    print(f"Scraper   : {SCRAPER_SCRIPT.name}", flush=True)
    print(f"Importer  : scripts/{IMPORTER_SCRIPT.name}", flush=True)
    print(f"Lock file : {LOCK_FILE}", flush=True)
    print(f"", flush=True)
    print(f"Running pipeline immediately, then every {INTERVAL_MINUTES} minutes.", flush=True)
    print(f"Next scheduled run (after this one): {nxt.strftime('%H:%M:%S')}", flush=True)
    sep("=")

    # ── Run immediately ───────────────────────────────────────────────────
    run_pipeline()

    # ── Scheduling loop ───────────────────────────────────────────────────
    while True:
        nxt = next_run_time()
        wait_s = max(1, (nxt - datetime.now()).total_seconds())
        log(f"Next scheduled run: {nxt.strftime('%H:%M:%S')} (in {int(wait_s)}s)  |  Press Ctrl+C to stop.")
        sleep_until(nxt)
        run_pipeline()


if __name__ == "__main__":
    main()
