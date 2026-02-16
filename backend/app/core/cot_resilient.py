import pandas as pd
import requests
import io

class COTFetcher:
    """
    NYX COT Scraper.
    CFTC often updates URLs or has restrictive access.
    This module uses a more resilient approach for current data.
    """
    def __init__(self):
        # The 'Futures Only' report for the current week is usually here
        self.url = "https://www.cftc.gov/dea/futures/deacot.txt"

    def fetch_latest_cot(self):
        print("Scraping current COT textual report...")
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            r = requests.get(self.url, headers=headers)
            
            if r.status_code != 200:
                print(f"CFTC Text Report not available: {r.status_code}")
                # Fallback: Scrape from a secondary financial data provider if necessary
                return None

            content = r.text
            
            # MAPPING (Target assets in the text report)
            mapping = {
                "GOLD": "GOLD - COMMODITY EXCHANGE INC.",
                "EUR": "EURO CURRENCY - CHICAGO MERCANTILE EXCHANGE",
                "JPY": "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
                "GBP": "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",
                "OIL": "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",
                "BTC": "BITCOIN - CHICAGO MERCANTILE EXCHANGE"
            }
            
            results = {}
            lines = content.split('\n')
            
            for key, full_name in mapping.items():
                for i, line in enumerate(lines):
                    if full_name in line:
                        # Data is usually 3 lines below the name
                        # Positions: Long, Short, Spreading
                        data_line = lines[i+3]
                        parts = data_line.strip().split()
                        
                        try:
                            # Standard layout: [Longs] [Shorts] [Spreading]
                            longs = int(parts[0].replace(',', ''))
                            shorts = int(parts[1].replace(',', ''))
                            net = longs - shorts
                            total = longs + shorts
                            perc_long = (longs/total)*100 if total > 0 else 50
                            
                            # Score logic (EdgeFinder standard)
                            score = 0
                            if perc_long >= 70: score = 2
                            elif perc_long >= 60: score = 1
                            elif perc_long <= 30: score = -2
                            elif perc_long <= 40: score = -1
                            
                            results[key] = {
                                "net": net,
                                "perc_long": round(perc_long, 1),
                                "score": score,
                                "label": "BULLISH" if net > 0 else "BEARISH"
                            }
                        except (ValueError, IndexError):
                            continue
            return results
        except Exception as e:
            print(f"Scraper Error: {e}")
            return None

if __name__ == "__main__":
    fetcher = COTFetcher()
    data = fetcher.fetch_latest_cot()
    print(data)
