"""Shared test setup for backend imports."""
import sys
from pathlib import Path

# Running pytest from backend/tests should resolve the local app package reliably.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
