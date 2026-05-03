from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_summary_text(balances, primary):
    # ✅ Filter out zero balances before sending to AI
    filtered = {k: v for k, v in balances.items() if abs(v) > 0.01}

    if not filtered:
        return "Everyone is settled up."

    prompt = f"""
Balances: {filtered}
Primary user: {primary}

Generate a VERY SHORT summary (1–2 lines max):
- Use names only (no IDs)
- Use ₹ symbol (Indian Rupees)
- Do NOT use $
- Mention who owes whom
- Keep it simple like a payment app
- No bullet points, no explanations
Example:
"Asha owes ₹1900. Mel gets ₹1500, Riya gets ₹400."
"""
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
        )
        result = response.choices[0].message.content
        print(f"✅ AI summary generated: {result}")
        return result

    except Exception as e:
        print(f"❌ AI ERROR: {type(e).__name__}: {e}")
        # ✅ Check for specific errors
        if "api_key" in str(e).lower() or "authentication" in str(e).lower():
            return "AI summary unavailable — check GROQ_API_KEY in .env"
        if "rate" in str(e).lower():
            return "AI summary temporarily unavailable — rate limit hit"
        return "Unable to generate summary"