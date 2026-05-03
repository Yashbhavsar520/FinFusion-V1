import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import importlib.util
spec = importlib.util.spec_from_file_location("routes_module", "routes/ai_routes.py")
routes_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes_module)
ai_router = routes_module.router
import io
import cv2
import numpy as np
import pytesseract                         
import easyocr
from PIL import Image 

pytesseract.pytesseract.tesseract_cmd = r"C:\Users\sanchi.pawar\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
ocr_reader = easyocr.Reader(['en'], gpu=False)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ai_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.on_event("startup")
async def startup():
    print("✅ ML service started — routes registered:")
    for route in app.routes:
        print(f"  {route.path}")

# ── Preprocessing ──────────────────────────────────────────────────────────────

def preprocess_for_tesseract(image: Image.Image) -> Image.Image:
    img = np.array(image.convert('RGB'))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    if w < 1200:
        scale = 1200 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale,
                          interpolation=cv2.INTER_CUBIC)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 10
    )
    return Image.fromarray(binary)


def preprocess_for_easyocr(image: Image.Image) -> np.ndarray:
    img = np.array(image.convert('RGB'))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    if w < 1000:
        scale = 1000 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale,
                          interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


# ── Amount extraction (your working version + hotel-bill fixes) ────────────────

def extract_total_from_text(text: str) -> float:
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    text_lower = text.lower()

    # ── Strategy 1: high-confidence label + amount on same line ───────────────
    high_confidence_patterns = [
        r'bill\s*amount\s*rs\s*[:\-\s]*([\d,]+\.?\d*)',   # ← NEW: MSEDCL style
        r'bill\s*total\s*[:\-\s]*([\d,]+\.?\d*)',
        r'net\s*amount\s*[:\-\s]*([\d,]+\.?\d*)',
        r'grand\s*total\s*[:\-\s]*([\d,]+\.?\d*)',
        r'total\s*payable\s*[:\-\s]*([\d,]+\.?\d*)',
        r'amount\s*payable\s*[:\-\s]*([\d,]+\.?\d*)',
        r'amount\s*due\s*[:\-\s]*([\d,]+\.?\d*)',
        r'total\s*due\s*[:\-\s]*([\d,]+\.?\d*)',
        r'net\s*payable\s*[:\-\s]*([\d,]+\.?\d*)',
        r'balance\s*due\s*[:\-\s]*([\d,]+\.?\d*)',
        r'total\s*amount\s*[:\-\s]*([\d,]+\.?\d*)',
        r'if\s*paid\s*before\s*due\s*date\s*[:\-\s]*([\d,]+\.?\d*)',  # utility bills
        r'due\s*date.*?[:\-\s]([\d,]+\.?\d*)$',           # "Due Date: XX-XX  5840"
    ]
    for pattern in high_confidence_patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                val = float(match.group(1).replace(',', ''))
                if 1 <= val <= 999999:
                    print(f"Strategy 1 matched: {val}")
                    return val
            except ValueError:
                continue

    # ── Strategy 2: label on one line, amount on next 1-2 lines ───────────────
    high_confidence_labels = [
        'bill total', 'net amount', 'grand total', 'total payable',
        'amount payable', 'amount due', 'total due', 'net payable',
        'balance due', 'total amount', 'bill amount',
    ]
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(lbl in line_lower for lbl in high_confidence_labels):
            for j in range(i, min(i + 3, len(lines))):
                numbers = re.findall(r'[\d,]+(?:\.\d+)?', lines[j])
                for n in reversed(numbers):
                    try:
                        val = float(n.replace(',', ''))
                        if 100 <= val <= 999999:
                            print(f"Strategy 2 matched on line {j}: {val}")
                            return val
                    except ValueError:
                        continue

    # ── Strategy 2B: Tariff line ───────────────────────────────────────────────
    for i, line in enumerate(lines):
        if re.search(r'\btariff\b', line, re.IGNORECASE):
            numbers = re.findall(r'[\d,]+(?:\.\d+)?', line)
            if i + 1 < len(lines):
                numbers += re.findall(r'[\d,]+(?:\.\d+)?', lines[i + 1])
            for n in numbers:
                try:
                    val = float(n.replace(',', ''))
                    if 50 <= val <= 999999:
                        print(f"Strategy 2B (Tariff) matched: {val}")
                        return val
                except ValueError:
                    continue

    # ── Strategy 2C: DMart/supermarket — "Items: N  Qty: N  AMOUNT" ───────────
    items_qty_re = re.compile(r'\bitems?\b.*\bqty\b', re.IGNORECASE)
    gst_total_re = re.compile(r'^T[:\s]', re.IGNORECASE)
    for line in lines:
        if items_qty_re.search(line) or gst_total_re.search(line):
            numbers = re.findall(r'[\d,]+(?:\.\d+)?', line)
            for n in reversed(numbers):
                try:
                    val = float(n.replace(',', ''))
                    if 100 <= val <= 999999:
                        print(f"Strategy 2C (items/qty row) matched: {val}")
                        return val
                except ValueError:
                    continue

    # ── Strategy 2D: Cinema/event ticket — "SEAT NO ... 110.00" ──────────────
    seat_re = re.compile(r'\bseat\b', re.IGNORECASE)
    for line in lines:
        if seat_re.search(line):
            numbers = re.findall(r'[\d,]+(?:\.\d+)?', line)
            for n in reversed(numbers):
                try:
                    val = float(n.replace(',', ''))
                    if 50 <= val <= 5000:
                        print(f"Strategy 2D (seat/ticket line) matched: {val}")
                        return val
                except ValueError:
                    continue

    # ── Strategy 2E: Utility bill — "Bill Amount Rs: 5,840" ──────────────────
    # Also catches "If Paid Before Due Date: 5,820" / "If Paid After Due Date: 5,860"
    # Take the SMALLEST of the due-date amounts (earliest/discounted amount)
    utility_re = re.compile(
        r'(paid\s*by|paid\s*before|paid\s*on\s*or\s*before|'
        r'if\s*paid.*?date|bill\s*amount|amount\s*rs)',
        re.IGNORECASE
    )
    utility_candidates = []
    for line in lines:
        if utility_re.search(line):
            numbers = re.findall(r'[\d,]+(?:\.\d+)?', line)
            for n in numbers:
                try:
                    val = float(n.replace(',', ''))
                    # Utility bills: realistic range 100–99999
                    if 100 <= val <= 99999:
                        utility_candidates.append(val)
                except ValueError:
                    continue
    if utility_candidates:
        result = min(utility_candidates)  # earliest/discounted = smallest
        print(f"Strategy 2E (utility bill) matched: {result}")
        return result

    # ── Exclusion rules ────────────────────────────────────────────────────────
    EXCLUDE_LABELS = re.compile(
        r'\b(advance|less\s*advance|refund|refundable|deposit|'
        r'cash\s*paid|cash\s*tender|cash\s*received|amount\s*received|'
        r'balance\s*paid|change|paid\s*in\s*cash|paid|payment)\b',
        re.IGNORECASE
    )
    CASH_LINE    = re.compile(r'^\s*cash\s*[:\-]', re.IGNORECASE)
    BALANCE_LINE = re.compile(r'balance\s*paid', re.IGNORECASE)
    TAX_BREAKDOWN = re.compile(
        r'^\s*(net|gst|etax|cgst|sgst|igst|cess|service\s*tax|vat)\s*[:\-]?\s*[\d]',
        re.IGNORECASE
    )
    # ✅ NEW: exclude lines with long account/consumer/phone numbers (8+ digits)
    # These are IDs, not amounts — e.g. consumer no: 190240526856
    LONG_NUMBER_LINE = re.compile(r'\b\d{8,}\b')

    def should_exclude(line: str) -> bool:
        return (EXCLUDE_LABELS.search(line) or
                CASH_LINE.search(line) or
                BALANCE_LINE.search(line) or
                TAX_BREAKDOWN.search(line) or
                LONG_NUMBER_LINE.search(line))   # ← skip lines with 8+ digit numbers

    # ── Strategy 3: "Total" lines, X.XX format, largest ──────────────────────
    total_line_candidates = []
    for line in lines:
        if re.search(r'\btotal\b', line, re.IGNORECASE):
            if should_exclude(line):
                continue
            for m in re.findall(r'\b(\d{1,6}\.\d{2})\b', line):
                try:
                    val = float(m)
                    if 1 <= val <= 999999:
                        total_line_candidates.append(val)
                except ValueError:
                    continue
    if total_line_candidates:
        result = max(total_line_candidates)
        print(f"Strategy 3 matched: {result}")
        return result

    # ── Strategy 4: All X.XX monetary values, largest ─────────────────────────
    all_monetary = []
    for line in lines:
        if should_exclude(line):
            continue
        for m in re.findall(r'\b(\d{1,6}\.\d{2})\b', line):
            try:
                val = float(m)
                if 1 <= val <= 999999:
                    all_monetary.append(val)
            except ValueError:
                continue
    if all_monetary:
        result = max(all_monetary)
        print(f"Strategy 4 matched: {result}")
        return result

    # ── Strategy 5: integer fallback — STRICT range, skip ID-like numbers ─────
    int_values = []
    for line in lines:
        if should_exclude(line):
            continue
        for n in re.findall(r'\b(\d{2,6})\b', line):  # max 6 digits = up to 999999
            try:
                val = float(n)
                if 10 <= val <= 99999:
                    int_values.append(val)
            except ValueError:
                continue
    result = max(int_values) if int_values else 0.0
    print(f"Strategy 5 (last resort) matched: {result}")
    return result


def extract_category_from_text(text: str) -> str:
    text_lower = text.lower()

    # ── Utility bill signals — check FIRST, most distinctive ──────────────────
    UTILITY_SIGNALS = re.compile(
        r'\b(msedcl|bescom|tata\s*power|adani\s*electricity|mahadiscom|'
        r'mahavitaran|electricity|electric\s*bill|e-?bill|'
        r'water\s*bill|gas\s*bill|bsnl|airtel\s*broadband|'
        r'consumer\s*no|meter\s*no|billing\s*unit|units?\s*consumed|'
        r'sanction\s*load|current\s*reading|previous\s*reading|'
        r'bill\s*of\s*supply|supply\s*date|due\s*date)\b',
        re.IGNORECASE
    )
    if UTILITY_SIGNALS.search(text):
        return "Utilities"

    # ── Cinema/entertainment ───────────────────────────────────────────────────
    CINEMA_SIGNALS = re.compile(
        r'\b(seat\s*no|i\s*class|ii\s*class|screen|multiplex|'
        r'pvr|inox|cinepolis|carnival|movie|cinema|film|'
        r'ticket|show\s*time|audi)\b',
        re.IGNORECASE
    )
    if CINEMA_SIGNALS.search(text):
        return "Entertainment"

    # ── Grocery ───────────────────────────────────────────────────────────────
    GROCERY_SIGNALS = re.compile(
        r'\b(dmart|d\s*mart|bigbasket|grofers|blinkit|'
        r'reliance\s*fresh|more\s*supermarket|spencer|'
        r'grocery|groceries|supermarket|provisions|kirana|'
        r'vegetables|fruits|dairy)\b',
        re.IGNORECASE
    )
    if GROCERY_SIGNALS.search(text):
        return "Groceries"

    if re.search(r'\bhsn\b', text_lower) and not CINEMA_SIGNALS.search(text):
        return "Groceries"

    keyword_map = {
        "Food":          ["restaurant", "cafe", "diner", "diners", "pizza", "burger",
                          "coffee", "bar", "grill", "kitchen", "eat",
                          "chicken", "salad", "mojito", "vat 5", "cash/bill",
                          "waiter", "kot"],
        "Transport":     ["uber", "ola", "taxi", "fuel", "petrol", "diesel",
                          "parking", "toll", "bus", "metro", "train", "flight",
                          "rapido", "irctc"],
        "Healthcare":    ["pharmacy", "medical", "hospital", "clinic", "doctor",
                          "medicine", "health", "lab", "diagnostic",
                          "apollo", "medplus"],
        "Shopping":      ["amazon", "flipkart", "store", "mall",
                          "retail", "cloth", "fashion", "wear", "myntra",
                          "lifestyle", "westside"],
        "Utilities":     ["electricity", "water", "gas", "internet", "broadband",
                          "mobile", "recharge", "utility"],
        "Entertainment": ["cinema", "movie", "theatre", "netflix", "spotify",
                          "game", "concert", "event", "ticket", "pvr", "inox"],
    }
    for category, keywords in keyword_map.items():
        if any(kw in text_lower for kw in keywords):
            return category

    return "Other"


def extract_description_from_text(text: str, tess_text: str = "", easy_text: str = "") -> str:

    def score_line(line: str) -> int:
        score = 0
        letters = len(re.findall(r'[a-zA-Z]', line))
        total = max(len(line), 1)
        if letters / total >= 0.5:
            score += 3
        words = line.split()
        if 2 <= len(words) <= 6:
            score += 2
        # Bonus for recognisable venue/brand words
        if re.search(
            r'\b(mart|dmart|diners?|hotel|restaurant|pharmacy|cafe|store|'
            r'clinic|hospital|supermarket|cinema|theatre|multiplex|'
            r'pvr|inox|cinepolis|carnival)\b', line, re.I
        ):
            score += 4
        noise = re.compile(
            r'\b(gst|tin|gstin|sac|ph|tel|mob|www|http|receipt|invoice|'
            r'bill|date|time|cash|waiter|table|cover|kot|pos|plot|near|'
            r'phone|fax|cashier|vou|hsn|qty|rate|value|items?|seat|area|'
            r'class|screen|user|printed|transaction)\b', re.I)
        if noise.search(line):
            score -= 5
        if re.fullmatch(r'[\d\s/\-:.,#*]+', line):
            score -= 5
        if len(line) < 4:
            score -= 3
        if letters / total < 0.4:
            score -= 3
        return score

    def best_name_from_text(raw: str) -> tuple:
        lines = [l.strip() for l in raw.split('\n') if l.strip()]
        best, best_score = "Receipt", -99
        for line in lines[:10]:
            clean = re.sub(r'[^a-zA-Z0-9 &\'\-.]', ' ', line).strip()
            clean = re.sub(r'\s+', ' ', clean).strip()
            s = score_line(clean)
            if s > best_score and len(clean) >= 4:
                best, best_score = clean, s
        return best, best_score

    easy_name, easy_score = best_name_from_text(easy_text) if easy_text else ("", -99)
    tess_name, tess_score = best_name_from_text(tess_text) if tess_text else ("", -99)

    print(f"Description candidates — EasyOCR: '{easy_name}' ({easy_score}), "
          f"Tesseract: '{tess_name}' ({tess_score})")

    if easy_score >= tess_score and easy_score > -5:
        return easy_name.title()
    elif tess_score > -5:
        return tess_name.title()

    name, score = best_name_from_text(text)
    return name.title() if score > -5 else "Scanned Receipt"

# ── Endpoint ───────────────────────────────────────────────────────────────────

@app.post("/scan-receipt")
async def scan_receipt(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))

        # Tesseract pass
        tess_text = pytesseract.image_to_string(
            preprocess_for_tesseract(image),
            config='--psm 6 --oem 3'
        )

        # EasyOCR pass
        easy_results = ocr_reader.readtext(
            preprocess_for_easyocr(image),
            detail=0, paragraph=False
        )
        easy_text = "\n".join(easy_results)

        combined_text = tess_text + "\n" + easy_text
        print(f"Tesseract:\n{tess_text}")
        print(f"EasyOCR:\n{easy_text}")

        amount      = extract_total_from_text(combined_text)
        # ✅ Pass tess_text and easy_text separately so description
        #    can pick the better OCR source independently
        description = extract_description_from_text(combined_text, tess_text, easy_text)
        category    = extract_category_from_text(combined_text)

        print(f"Extracted → amount: {amount}, desc: {description}, cat: {category}")

        return {"amount": amount, "description": description, "category": category}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Receipt scan error: {e}")
        raise HTTPException(status_code=400,
                            detail=f"Failed to scan receipt: {str(e)}")


@app.get("/budget-insights")
async def budget_insights(history: str, budgets: str):
    """
    ML-powered budget insights:
    - Exponential smoothing forecast per category
    - Anomaly detection (spend > 2 std devs from mean)
    - Over-budget risk score
    
    history: JSON string of {YYYY-MM: {category: amount}}
    budgets: JSON string of [{category, limit}]
    """
    import json, math

    try:
        hist = json.loads(history)   # {YYYY-MM: {cat: amount}}
        budget_list = json.loads(budgets)  # [{category, limit}]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    # Build per-category time series
    all_months = sorted(hist.keys())
    categories = set()
    for month_data in hist.values():
        categories.update(month_data.keys())

    forecasts = {}
    anomalies = {}
    risk_scores = {}

    ALPHA = 0.4  # smoothing factor

    for cat in categories:
        series = [hist[m].get(cat, 0) for m in all_months]

        # Exponential smoothing forecast
        if len(series) >= 2:
            smoothed = series[0]
            for val in series[1:]:
                smoothed = ALPHA * val + (1 - ALPHA) * smoothed
            forecasts[cat] = round(smoothed, 2)
        elif len(series) == 1:
            forecasts[cat] = series[0]
        else:
            forecasts[cat] = 0

        # Anomaly detection — flag if latest spend > mean + 2*std
        if len(series) >= 3:
            mean = sum(series) / len(series)
            std = math.sqrt(sum((x - mean) ** 2 for x in series) / len(series))
            latest = series[-1]
            anomalies[cat] = latest > (mean + 2 * std) and latest > 0
        else:
            anomalies[cat] = False

        # Risk score: forecast vs budget limit
        budget_limit = next(
            (b["limit"] for b in budget_list if b["category"] == cat), None
        )
        if budget_limit and budget_limit > 0:
            risk_scores[cat] = round(min(forecasts[cat] / budget_limit, 2.0), 2)
        else:
            risk_scores[cat] = None

    # Top suggestions
    suggestions = []
    for cat, forecast in forecasts.items():
        budget_limit = next(
            (b["limit"] for b in budget_list if b["category"] == cat), None
        )
        if anomalies.get(cat):
            suggestions.append({
                "type": "anomaly",
                "category": cat,
                "message": f"Unusual spike in {cat} spending detected this month.",
                "severity": "high",
            })
        if budget_limit and forecast > budget_limit:
            suggestions.append({
                "type": "over_budget_risk",
                "category": cat,
                "message": f"{cat} is forecast to exceed budget by ₹{round(forecast - budget_limit)}.",
                "severity": "medium",
                "forecast": forecast,
                "limit": budget_limit,
            })
        if budget_limit and forecast < budget_limit * 0.5:
            suggestions.append({
                "type": "underspend",
                "category": cat,
                "message": f"{cat} budget may be too high — forecasted spend is only ₹{round(forecast)}.",
                "severity": "low",
                "forecast": forecast,
                "limit": budget_limit,
            })

    return {
        "forecasts": forecasts,
        "anomalies": anomalies,
        "risk_scores": risk_scores,
        "suggestions": suggestions,
    }