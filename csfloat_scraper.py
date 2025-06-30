import logging
import json
import os
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

PRICE_CACHE_FILE = "price_cache.json"
CONFIG_FILE = "config.json"

ITEM_DEF_INDEX = {
    "Fever Case": 7007,
    "Gallery Case": 7003,
    "Kilowatt Case": 4904,
    "Revolution Case": 4880,
    "Recoil Case": 4846,
    "Dreams & Nightmares Case": 4818,
    "Operation Riptide Case": 4790,
    "Snakebite Case": 4747,
    "Operation Broken Fang Case": 4717,
    "Fracture Case": 4698,
    "Prisma 2 Case": 4695,
    "CS20 Case": 4669,
    "Shattered Web Case": 4620,
    "Prisma Case": 4598,
    "Danger Zone Case": 4548,
    "Horizon Case": 4482,
    "Clutch Case": 4471,
    "Spectrum 2 Case": 4403,
    "Operation Hydra Case": 4352,
    "Spectrum Case": 4351,
    "Glove Case": 4288,
    "Gamma 2 Case": 4281,
    "Gamma Case": 4236,
    "Chroma 3 Case": 4233,
    "Operation Wildfire Case": 4187,
    "Revolver Case": 4186,
    "Shadow Case": 4138,
    "Falchion Case": 4091,
    "Chroma 2 Case": 4089,
    "Chroma Case": 4061,
    "Operation Vanguard Case": 4029,
    "Operation Breakout Case": 4018,
    "Huntsman Case": 4017,
    "Operation Phoenix Case": 4011,
    "CSGO Weapon Case 3": 4010,
    "Winter Offensive Case": 4009,
    "Operation Bravo Case": 4003,
    "CSGO Weapon Case 2": 4004,
    "CSGO Weapon Case": 4001
}

class CSFloatScraper:
    def __init__(self):
        self.price_cache = self._load_cache()
        self.CACHE_EXPIRY = timedelta(hours=1)
        self.config = self._load_config()
        self.api_key = self._load_api_key()

    def _load_config(self):
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r") as f:
                try:
                    config = json.load(f)
                    return config
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse config.json: {e}. Returning default config.")
                    return {"api_key": None, "is_valid": False}
        return {"api_key": None, "is_valid": False}

    def _save_config(self, config):
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=4)

    def _load_api_key(self):
        return self.config.get("api_key")

    def _load_cache(self):
        if os.path.exists(PRICE_CACHE_FILE):
            with open(PRICE_CACHE_FILE, "r") as f:
                try:
                    cache = json.load(f)
                    if not cache:
                        logger.info("Price cache file is empty, starting with empty cache")
                        return {}
                    for item in cache:
                        cache[item]["timestamp"] = datetime.fromisoformat(cache[item]["timestamp"])
                    logger.info("Loaded price cache from file")
                    return cache
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Failed to parse price_cache.json: {e}. Starting with empty cache.")
                    return {}
        logger.info("No price cache file found, starting with empty cache")
        return {}

    def save_cache(self):
        cache_copy = {k: {"price": v["price"], "timestamp": v["timestamp"].isoformat()} for k, v in self.price_cache.items()}
        with open(PRICE_CACHE_FILE, "w") as f:
            json.dump(cache_copy, f, indent=4)
        logger.info("Price cache saved to file")

    def validate_api_key(self, api_key):
        if not api_key:
            return False
        url = "https://csfloat.com/api/v1/listings"
        headers = {"Authorization": api_key}
        try:
            response = requests.get(url, headers=headers, params={"limit": 1})
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException:
            return False

    def set_api_key(self, api_key):
        if self.validate_api_key(api_key):
            self.config["api_key"] = api_key
            self.config["is_valid"] = True
            self._save_config(self.config)
            self.api_key = api_key
            logger.info("API key validated and saved")
            return True
        return False

    def fetch_prices(self, item_names):
        if not self.api_key:
            logger.error("No API key available, cannot fetch prices")
            return False

        url = "https://csfloat.com/api/v1/listings"
        headers = {"Authorization": self.api_key}
        price_queue = {}

        try:
            for item_name in item_names:
                def_index = ITEM_DEF_INDEX.get(item_name)
                if not def_index:
                    logger.warning(f"No def_index found for {item_name}, skipping")
                    continue

                params = {
                    "type": "buy_now",
                    "sort_by": "lowest_price",
                    "limit": 50,
                    "def_index": def_index,
                    "page": 0
                }

                page = 0
                while True:
                    params["page"] = page
                    logger.info(f"Fetching page {page} for {item_name} with params: {params}")
                    response = requests.get(url, headers=headers, params=params)
                    response.raise_for_status()
                    data = response.json()
                    logger.info(f"Page {page} API response for {item_name}: {json.dumps(data, indent=2)}")

                    listings = data.get("data", data.get("listings", []))
                    logger.info(f"Found {len(listings)} listings for {item_name} on page {page} (from 'data' or 'listings')")

                    if not listings:
                        logger.warning(f"No more listings found for {item_name} on page {page}, stopping pagination")
                        break

                    if listings:
                        listing = listings[0]
                        market_hash_name = listing["item"]["market_hash_name"]
                        price_cents = listing["price"]
                        price_dollars = round(price_cents / 100, 2)
                        price_queue[item_name] = price_dollars
                        logger.info(f"Fetched price for {item_name} (market_hash_name: {market_hash_name}): ${price_dollars}")
                        break

                    page += 1

            for item_name in item_names:
                if item_name not in price_queue:
                    logger.warning(f"No listing found for {item_name} after pagination")

            self.price_cache.clear()
            for name, price in price_queue.items():
                self.price_cache[name] = {"price": price, "timestamp": datetime.now()}
            self.save_cache()
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch prices: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False

    def get_price(self, item_name):
        if item_name in self.price_cache:
            if datetime.now() - self.price_cache[item_name]["timestamp"] < self.CACHE_EXPIRY:
                logger.info(f"Using cached price for {item_name}: ${self.price_cache[item_name]['price']}")
                return self.price_cache[item_name]["price"]
        return None

    def append_price_history(self, case_names):
        history_file = "price_history.json"
        history = {}
        if os.path.exists(history_file):
            try:
                with open(history_file, "r") as f:
                    history = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load existing price history: {e}")

        today = datetime.now().strftime("%Y-%m-%d")

        for case_name in case_names:
            price = self.get_price(case_name)
            if price is not None:
                if case_name not in history:
                    history[case_name] = []
                history[case_name].append({"date": today, "price": price})

        try:
            with open(history_file, "w") as f:
                json.dump(history, f, indent=2)
            logger.info("Appended to price_history.json")
        except Exception as e:
            logger.error(f"Failed to write price history: {e}")

    def close(self):
        self.save_cache()