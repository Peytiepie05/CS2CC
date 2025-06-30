from flask import Flask, render_template, request, jsonify
from csfloat_scraper import CSFloatScraper
from investment_manager import load_investments, save_investments, add_investment, remove_investment, update_investment, add_transaction
from datetime import datetime
from dateutil.parser import parse
import webbrowser
import logging
import subprocess
import sys
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_url_path='/static', static_folder='static', template_folder='templates')

PRESET_CASES = [
    ("Fever Case", "March 31, 2025"),
    ("Gallery Case", "October 2, 2024"),
    ("Kilowatt Case", "February 6, 2024"),
    ("Revolution Case", "February 9, 2023"),
    ("Recoil Case", "July 1, 2022"),
    ("Dreams & Nightmares Case", "January 20, 2022"),
    ("Operation Riptide Case", "September 21, 2021"),
    ("Snakebite Case", "May 3, 2021"),
    ("Operation Broken Fang Case", "December 3, 2020"),
    ("Fracture Case", "August 6, 2020"),
    ("Prisma 2 Case", "March 31, 2020"),
    ("CS20 Case", "October 18, 2019"),
    ("Shattered Web Case", "November 18, 2019"),
    ("Prisma Case", "March 13, 2019"),
    ("Danger Zone Case", "December 6, 2018"),
    ("Horizon Case", "August 2, 2018"),
    ("Clutch Case", "February 15, 2018"),
    ("Spectrum 2 Case", "September 14, 2017"),
    ("Operation Hydra Case", "May 23, 2017"),
    ("Spectrum Case", "March 15, 2017"),
    ("Glove Case", "November 28, 2016"),
    ("Gamma 2 Case", "August 18, 2016"),
    ("Gamma Case", "June 15, 2016"),
    ("Chroma 3 Case", "April 27, 2016"),
    ("Operation Wildfire Case", "February 17, 2016"),
    ("Revolver Case", "December 8, 2015"),
    ("Shadow Case", "September 17, 2015"),
    ("Falchion Case", "May 26, 2015"),
    ("Chroma 2 Case", "April 15, 2015"),
    ("Chroma Case", "January 8, 2015"),
    ("Operation Vanguard Case", "November 11, 2014"),
    ("Operation Breakout Case", "July 1, 2014"),
    ("Huntsman Case", "May 1, 2014"),
    ("Operation Phoenix Case", "February 20, 2014"),
    ("CSGO Weapon Case 3", "February 12, 2014"),
    ("Winter Offensive Case", "December 18, 2013"),
    ("Operation Bravo Case", "September 19, 2013"),
    ("CSGO Weapon Case 2", "November 8, 2013"),
    ("CSGO Weapon Case", "August 14, 2013")
]

PRESET_CASES.sort(key=lambda x: parse(x[1]), reverse=True)
CASE_NAMES = [case[0] for case in PRESET_CASES]
RELEASE_YEARS = {case[0]: parse(case[1]).year for case in PRESET_CASES}
RELEASE_DATES = {case[0]: case[1] for case in PRESET_CASES}

try:
    scraper = CSFloatScraper()
    investments = load_investments()
    logger.info("Scraper and investments loaded successfully")
except Exception as e:
    logger.error(f"Failed to initialize scraper or load investments: {e}")
    raise

@app.route('/')
def index():
    global investments
    return render_template('index.html', investments=investments, case_names=CASE_NAMES, release_years=RELEASE_YEARS, release_dates=RELEASE_DATES, api_key_valid=scraper.config.get("is_valid", False))

@app.route('/set_api_key', methods=['POST'])
def set_api_key():
    global scraper
    api_key = request.form.get('api_key')
    if scraper.set_api_key(api_key):
        return jsonify({"status": "success", "message": "API key validated and saved"})
    return jsonify({"status": "error", "message": "Invalid API key, please try again"})

@app.route('/add_case', methods=['POST'])
def add_case():
    global investments
    case = request.form.get('case')
    qty = int(request.form.get('qty', 1))
    price = float(request.form.get('price', 0.0))
    if not any(inv["item_name"] == case for inv in investments):
        new_inv = {
            "item_name": case,
            "quantity": qty,
            "purchase_price": price,
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "lowest_price": scraper.get_price(case),
            "last_updated": "",
            "transactions": [{"type": "buy", "quantity": qty, "price_per_case": price, "total": qty * price, "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}],
            "total_sold_value": 0.0
        }
        add_investment(investments, new_inv)
    return jsonify({"status": "success", "investments": investments})

@app.route('/remove_case', methods=['POST'])
def remove_case():
    global investments
    index = int(request.form.get('index'))
    remove_investment(investments, index)
    return jsonify({"status": "success", "investments": investments})

@app.route('/update_investment', methods=['POST'])
def update_investment_route():
    global investments
    data = request.get_json()
    index = int(data['index'])
    field = data['field']
    value = data['value']
    update_investment(investments, index, field, value)
    return jsonify({"status": "success", "investments": investments})

@app.route('/add_transaction', methods=['POST'])
def add_transaction_route():
    global investments
    data = request.get_json()
    index = int(data['index'])
    transaction_type = data['type']
    qty = int(data['quantity'])
    price = float(data['price'])
    add_transaction(investments, index, transaction_type, qty, price)
    return jsonify({"status": "success", "investments": investments})

@app.route('/refresh_prices', methods=['POST'])
def refresh_prices():
    global investments
    if scraper.fetch_prices(CASE_NAMES):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Update invested cases
        for inv in investments:
            price = scraper.get_price(inv["item_name"])
            if price is not None:
                inv["lowest_price"] = price
            else:
                inv["lowest_price"] = None
            inv["last_updated"] = now

        save_investments(investments)
        scraper.append_price_history(CASE_NAMES)

        return jsonify({
            "status": "success",
            "investments": investments,
            "all_prices": {name: scraper.get_price(name) for name in CASE_NAMES}
        })
    return jsonify({"status": "error", "message": "Failed to refresh prices"})

@app.route('/reorder_investments', methods=['POST'])
def reorder_investments():
    global investments
    data = request.get_json()
    new_investments = data.get('investments', [])
    if len(new_investments) == len(investments):
        investments = new_investments
        save_investments(investments)
        return jsonify({"status": "success", "investments": investments})
    return jsonify({"status": "error", "message": "Invalid investments data"})

@app.teardown_appcontext
def close_scraper(exception=None):
    scraper.close()

import webview
from threading import Thread
import time

class WindowAPI:
    def minimize(self):
        webview.windows[0].minimize()

    def toggle_maximize(self):
        window = webview.windows[0]
        if window.width == window.screen.width and window.height == window.screen.height:
            window.restore()
        else:
            window.toggle_fullscreen()

    def close(self):
        webview.windows[0].destroy()

def start_flask():
    from app import app
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    flask_thread = Thread(target=start_flask, daemon=True)
    flask_thread.start()
    time.sleep(1)
    webview.create_window(
        "Case Collector",
        "http://127.0.0.1:5000",
        width=1350,
        height=900,
        resizable=True,
        frameless=False,
        js_api=WindowAPI()
    )
    webview.start()

@app.route('/price_history', methods=['GET'])
def get_price_history():
    prices = {}
    history = {}

    if os.path.exists("price_history.json"):
        try:
            with open("price_history.json", "r") as f:
                history = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read price history: {e}")

    for case in CASE_NAMES:
        if case in history and history[case]:
            prices[case] = history[case][-1]["price"]
        elif case in scraper.price_cache:
            prices[case] = scraper.price_cache[case]["price"]
        else:
            prices[case] = 0.0

    return jsonify({"status": "success", "prices": prices})