import json
import os

INVESTMENTS_FILE = "cs2_investments.json"

def load_investments():
    if os.path.exists(INVESTMENTS_FILE):
        with open(INVESTMENTS_FILE, "r") as f:
            investments = json.load(f)
            for inv in investments:
                if "transactions" not in inv:
                    inv["transactions"] = []
                if "total_sold_value" not in inv:
                    inv["total_sold_value"] = 0.0
            return investments
    return []

def save_investments(investments):
    with open(INVESTMENTS_FILE, "w") as f:
        json.dump(investments, f, indent=4)

def add_investment(investments, new_investment):
    new_investment["transactions"] = new_investment.get("transactions", [])
    new_investment["total_sold_value"] = new_investment.get("total_sold_value", 0.0)
    investments.append(new_investment)
    save_investments(investments)

def remove_investment(investments, index):
    if 0 <= index < len(investments):
        investments.pop(index)
        save_investments(investments)

def update_investment(investments, index, field, value):
    if 0 <= index < len(investments):
        if field == "quantity":
            try:
                new_value = int(value)
                investments[index]["quantity"] = new_value if new_value > 0 else investments[index]["quantity"]
            except (ValueError, TypeError):
                pass
        elif field == "purchase_price":
            try:
                new_value = float(value)
                investments[index]["purchase_price"] = new_value if new_value >= 0 else investments[index]["purchase_price"]
            except (ValueError, TypeError):
                pass
        save_investments(investments)

def add_transaction(investments, index, transaction_type, quantity, price_per_case):
    if 0 <= index < len(investments):
        inv = investments[index]
        transaction = {
            "type": transaction_type,
            "quantity": quantity,
            "price_per_case": price_per_case,
            "total": quantity * price_per_case,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        inv["transactions"].append(transaction)

        if transaction_type == "buy":
            current_qty = inv["quantity"]
            current_total = current_qty * inv["purchase_price"]
            new_qty = quantity
            new_total = new_qty * price_per_case
            inv["quantity"] = current_qty + new_qty
            inv["purchase_price"] = (current_total + new_total) / inv["quantity"] if inv["quantity"] > 0 else 0.0
        elif transaction_type == "sell":
            inv["quantity"] = max(0, inv["quantity"] - quantity)
            inv["total_sold_value"] = inv.get("total_sold_value", 0.0) + (quantity * price_per_case)
            buy_transactions = [t for t in inv["transactions"] if t["type"] == "buy"]
            if inv["quantity"] > 0 and buy_transactions:
                total_buy_qty = sum(t["quantity"] for t in buy_transactions)
                total_buy_value = sum(t["quantity"] * t["price_per_case"] for t in buy_transactions)
                inv["purchase_price"] = total_buy_value / total_buy_qty if total_buy_qty > 0 else 0.0
            else:
                inv["purchase_price"] = 0.0

        save_investments(investments)

from datetime import datetime