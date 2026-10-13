"""
Launcher for VeriFace AI FastAPI Backend Server
Run: python run.py
"""

import sys
import uvicorn

if __name__ == "__main__":
    # Ensure UTF-8 output encoding if possible
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("==================================================")
    print(" [*] Starting VeriFace AI FastAPI Backend")
    print(" [*] JWT Authentication & RBAC Active")
    print(" [*] Listening on http://localhost:8000")
    print(" [*] Interactive Swagger API Docs: http://localhost:8000/docs")
    print("==================================================")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
