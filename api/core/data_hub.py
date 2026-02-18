import json
import os
from datetime import datetime
from typing import Dict, Any, List

class DataHub:
    """
    Strategic Data Hub for Trade Pilot X.
    Manages persistence of COT, Macro, and Sentiment data.
    """
    def __init__(self, storage_path: str = "/data/.openclaw/workspace/tradepilot-x/data/market_core.json"):
        self.storage_path = storage_path
        self._ensure_storage()
        self.data = self._load_data()

    def _ensure_storage(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump({"assets": {}, "last_update": None}, f)

    def _load_data(self) -> Dict[str, Any]:
        with open(self.storage_path, 'r') as f:
            return json.load(f)

    def save_snapshot(self, asset_updates: Dict[str, Any]):
        """Updates internal storage with fresh data points."""
        self.data["assets"].update(asset_updates)
        self.data["last_update"] = datetime.now().isoformat()
        with open(self.storage_path, 'w') as f:
            json.dump(self.data, f, indent=4)

    def get_asset_context(self, symbol: str) -> Dict[str, Any]:
        """Returns the stored sentiment and macro context for an asset."""
        return self.data["assets"].get(symbol, {
            "sentiment": {"score": 0, "bias": "Neutral"},
            "macro": {"score": 0, "details": {}},
            "cot": {"score": 0}
        })

# Initialize with the data we just extracted from the PDF
if __name__ == "__main__":
    hub = DataHub()
    # Migration from PDF snapshot
    pdf_snapshot = {
        "GOLD": {"sentiment": 3, "macro": 2, "cot": 2, "bias": "Strong Bullish"},
        "USOIL": {"sentiment": 2, "macro": 2, "cot": 2, "bias": "Strong Bullish"},
        "EURUSD": {"sentiment": 1, "macro": 1, "cot": 0, "bias": "Neutral/Bullish"},
        "USDJPY": {"sentiment": -3, "macro": -2, "cot": -2, "bias": "Strong Bearish"},
        "GBPUSD": {"sentiment": 2, "macro": 2, "cot": 1, "bias": "Bullish"}
    }
    hub.save_snapshot(pdf_snapshot)
    print("Data Hub initialized with EdgeFinder Intelligence.")
