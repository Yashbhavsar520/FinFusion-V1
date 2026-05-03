from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import generate_summary_text

router = APIRouter()

# ✅ Lazy load — don't crash the whole router if model fails
_model = None

def get_model():
    global _model
    if _model is None:
        from model import train_model
        try:
            _model = train_model()
            print("✅ Model loaded successfully")
        except Exception as e:
            print(f"❌ Model failed to load: {e}")
            _model = None
    return _model


class SummaryInput(BaseModel):
    balances: dict
    primaryUser: str


@router.post("/ai-summary")
def get_summary(data: SummaryInput):
    print("🔥 AI SUMMARY HIT — balances:", data.balances)

    # ✅ Guard against empty or all-zero balances
    if not data.balances or all(abs(v) < 0.01 for v in data.balances.values()):
        return {"summary": "Everyone is settled up — no outstanding balances."}

    summary = generate_summary_text(data.balances, data.primaryUser)
    return {"summary": summary}


@router.get("/predict")
def predict(month: int):
    model = get_model()
    if model is None:
        return {"prediction": 0, "error": "Model unavailable"}
    try:
        prediction = model.predict([[month]])
        return {"prediction": float(prediction[0])}
    except Exception as e:
        print(f"Prediction error: {e}")
        return {"prediction": 0, "error": str(e)}