import uvicorn
import os
import sys

# Adaugam calea curenta in path pentru importuri
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    # Importam app-ul din index.py (fostul main.py)
    from index import app
    print(f"Starting TradePilotX API on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
