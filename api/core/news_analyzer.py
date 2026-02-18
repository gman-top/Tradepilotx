import os
import requests
import json

class NewsAnalyzer:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "minimax/minimax-01"

    def analyze_market_sentiment(self, asset_name: str, news_context: str):
        """
        Uses MiniMax-01 via OpenRouter to analyze raw news text and return a sentiment score.
        """
        prompt = f"""
        Analyze the following market news for {asset_name}. 
        Provide a sentiment score from -5 (Extremely Bearish/Negative) to +5 (Extremely Bullish/Positive).
        Return ONLY a JSON object with:
        "score": (int),
        "summary": (brief 1-sentence explanation),
        "impact_level": (High/Medium/Low)

        News Content:
        {news_context}
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a senior macro economist and news analyst."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"}
        }

        try:
            response = requests.post(self.url, headers=headers, json=payload, timeout=15)
            result = response.json()
            content = result['choices'][0]['message']['content']
            return json.loads(content)
        except Exception as e:
            print(f"MiniMax Error: {e}")
            return {"score": 0, "summary": "Analysis unavailable", "impact_level": "Low"}

if __name__ == "__main__":
    # Test call
    analyzer = NewsAnalyzer()
    test_news = "The Federal Reserve indicated a potential pause in rate hikes as inflation cooling beats expectations."
    print(analyzer.analyze_market_sentiment("GOLD", test_news))
