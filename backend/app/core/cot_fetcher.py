import pandas as pd
import requests
import io
import zipfile

class COTFetcher:
    """
    NYX COT Automator.
    Uses the stable history files from the CFTC archives.
    """
    def __init__(self):
        # This is the most reliable bulk data endpoint for Futures Only
        self.url = "https://www.cftc.gov/files/dea/history/deafut24.zip" 

    def fetch_latest_cot(self):
        print(f"Connecting to CFTC Data Archives...")
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        try:
            # Step 1: Download
            r = requests.get(self.url, headers=headers, timeout=30)
            if r.status_code != 200:
                # Try previous year if current isn't ready
                r = requests.get("https://www.cftc.gov/files/dea/history/deafut2024.zip", headers=headers)
                if r.status_code != 200:
                    return {"error": "CFTC Endpoint Inaccessible"}

            # Step 2: Extract CSV from ZIP
            z = zipfile.ZipFile(io.BytesIO(r.content))
            with z.open(z.namelist()[0]) as f:
                df = pd.read_csv(f, low_memory=False)
            
            # Step 3: Get latest date and filter
            df['date_obj'] = pd.to_datetime(df['As_of_Date_In_Form_YYMMDD'], format='%y%m%d')
            latest_date = df['date_obj'].max()
            df = df[df['date_obj'] == latest_date]
            
            # Step 4: Asset Map (Institutional Mapping)
            mapping = {
                "GOLD": "GOLD - COMMODITY EXCHANGE INC.",
                "EURUSD": "EURO CURRENCY - CHICAGO MERCANTILE EXCHANGE",
                "USDJPY": "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
                "GBPUSD": "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",
                "USOIL": "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",
                "BTC": "BITCOIN - CHICAGO MERCANTILE EXCHANGE"
            }
            
            results = {}
            for asset, cftc_name in mapping.items():
                match = df[df['Market_and_Exchange_Names'].str.strip() == cftc_name]
                if not match.empty:
                    row = match.iloc[0]
                    longs = int(row['NonComm_Positions_Long_All'])
                    shorts = int(row['NonComm_Positions_Short_All'])
                    perc_long = (longs / (longs + shorts)) * 100
                    
                    score = 0
                    if perc_long >= 70: score = 2
                    elif perc_long >= 60: score = 1
                    elif perc_long <= 30: score = -2
                    elif perc_long <= 40: score = -1
                    
                    results[asset] = {
                        "score": score,
                        "perc_long": round(perc_long, 1),
                        "date": latest_date.strftime('%Y-%m-%d')
                    }
            return results
        except Exception as e:
            return {"error": str(e)}

if __name__ == "__main__":
    fetcher = COTFetcher()
    import json
    print(json.dumps(fetcher.fetch_latest_cot(), indent=2))
