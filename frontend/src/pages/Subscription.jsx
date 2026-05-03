import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Zap, Star, Lock } from "lucide-react";

const API = "http://localhost:4000";

const FREE_FEATURES = [
  "Track personal expenses",
  "Basic category analytics",
  "Group expense splitting",
  "Monthly budget overview",
];

const PRO_FEATURES = [
  "Everything in Free",
  "AI spending predictions",
  "Smart budget suggestions",
  "Receipt scanning (OCR)",
  "Advanced anomaly detection",
  "Spending history export",
  "Priority support",
];

export default function Subscription() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [plan, setPlan] = useState("FREE");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchPlan();
  }, []);

  async function fetchPlan() {
    try {
      const res = await axios.get(`${API}/users/plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlan(res.data.plan || "FREE");
    } catch {
      // endpoint may not exist yet — default to FREE
    } finally {
      setFetching(false);
    }
  }

  async function upgradeToPro() {
    setLoading(true);
    try {
      await axios.patch(`${API}/users/plan`, { plan: "PRO" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlan("PRO");
    } catch {
      alert("Upgrade failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Subscription</h1>
            <p className="text-xs text-slate-400">Manage your plan</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Current plan badge */}
        {!fetching && (
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
            plan === "PRO"
              ? "bg-indigo-50 border-indigo-100"
              : "bg-slate-50 border-slate-100"
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              plan === "PRO" ? "bg-indigo-100" : "bg-white border border-slate-200"
            }`}>
              {plan === "PRO" ? <Star className="w-5 h-5 text-indigo-600" /> : <Zap className="w-5 h-5 text-slate-400" />}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Current plan</p>
              <p className={`text-sm font-bold ${plan === "PRO" ? "text-indigo-700" : "text-slate-700"}`}>
                {plan === "PRO" ? "Pro — All features unlocked" : "Free — Limited features"}
              </p>
            </div>
            {plan === "PRO" && (
              <span className="ml-auto text-xs bg-indigo-600 text-white px-3 py-1 rounded-full font-semibold">Active</span>
            )}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Free */}
          <div className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col ${
            plan === "FREE" ? "border-slate-200" : "border-slate-100 opacity-75"
          }`}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Free</h2>
              {plan === "FREE" && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">Your plan</span>
              )}
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mb-1">₹0<span className="text-sm font-normal text-slate-400">/mo</span></p>
            <p className="text-xs text-slate-400 mb-5">Core features, always free</p>

            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-slate-500" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {plan === "FREE" && (
              <div className="mt-5 w-full py-2.5 rounded-xl border border-slate-200 text-center text-sm font-semibold text-slate-400 cursor-default select-none">
                Current plan
              </div>
            )}
          </div>

          {/* Pro */}
          <div className={`rounded-2xl border-2 shadow-sm p-6 flex flex-col relative overflow-hidden ${
            plan === "PRO"
              ? "bg-white border-indigo-300"
              : "bg-white border-indigo-400"
          }`}>
            {/* Recommended badge */}
            {plan !== "PRO" && (
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                RECOMMENDED
              </div>
            )}

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                Pro <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              </h2>
              {plan === "PRO" && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">Active</span>
              )}
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mb-1">₹299<span className="text-sm font-normal text-slate-400">/mo</span></p>
            <p className="text-xs text-slate-400 mb-5">Full AI-powered finance suite</p>

            <ul className="space-y-2.5 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-indigo-600" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {plan === "PRO" ? (
                <div className="w-full py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-center text-sm font-semibold text-indigo-600 select-none">
                  You're on Pro
                </div>
              ) : (
                <button onClick={upgradeToPro} disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50 shadow-md">
                  {loading ? "Processing…" : "Upgrade to Pro →"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fine print */}
        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
          <Lock className="w-3.5 h-3.5" />
          Secure payment · Cancel anytime · No hidden fees
        </div>

      </main>
    </div>
  );
}