"""Launch the AI Factory backend server."""

import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parent / "backend"
VENV_DIR = BACKEND_DIR / ".venv"
REQUIREMENTS = BACKEND_DIR / "requirements.txt"

def get_python():
    """Return the venv Python executable path."""
    return VENV_DIR / "Scripts" / "python.exe"

def ensure_venv():
    """Create venv if it doesn't exist."""
    if not VENV_DIR.exists():
        print("Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)

def install_deps():
    """Install requirements into the venv."""
    python = get_python()
    print("Installing dependencies...")
    subprocess.run(
        [str(python), "-m", "pip", "install", "-r", str(REQUIREMENTS), "-q"],
        check=True,
    )

def start_server():
    """Start uvicorn with auto-reload."""
    python = get_python()
    subprocess.run(
        [str(python), "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
        cwd=str(BACKEND_DIR),
    )

if __name__ == "__main__":
    ensure_venv()
    install_deps()
    start_server()
