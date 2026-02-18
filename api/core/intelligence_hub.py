import json
import os

class IntelligenceHub:
    """
    Acts as the source of truth for Institutional & Fundamental data.
    This is where we store/fetch COT and Macro data to feed the engine.
    """
    def __init__(self):
        self.data_path = "/data/.openclaw/workspace/tradepilot-x/data/market_intelligence.json"
        self._ensure_data_exists()

    def _ensure_data_exists(self):
        if not os.path.exists(self.data_path):
            initial_data = {
                "GOLD": {"cot_score": 1, "retail_score": 1, "macro_score": 2, "status": "Institutional Buying"},
                "EURUSD": {"cot_score": -1, "retail_score": 0, "macro_score": -1, "status": "USD Strength"},
                "USOIL": {"cot_score": 1, "retail_score": 1, "macro_score": 2, "status": "Supply Constraints"},
                "USDJPY": {"cot_score": -2, "retail_score": -1, "macro_score": -2, "status": "Carry Trade Unwind"},
                "SPX500": {"cot_score": -1, "retail_score": 0, "macro_score": 3, "status": "Tech Momentum"}
            }
            with open(self.data_path, "w") as f:
                json.dump(initial_data, f, indent=4)

    def get_asset_intel(self, asset_name: str) -> dict:
        with open(self.data_path, "r") as f:
            data = json.load(f)
        return data.get(asset_name, {"cot_score": 0, "retail_score": 0, "macro_score": 0})

    def update_intel(self, asset_name: str, new_data: dict):
        with open(self.data_path, "r") as f:
            data = json.load(f)
        data[asset_name] = new_data
        with open(self.data_path, "w") as f:
            json.dump(data, f, indent=4)
