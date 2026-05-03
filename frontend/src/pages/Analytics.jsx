import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  PieChart,
  Lightbulb,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const API = "http://localhost:4000";

// Helpers
const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const CATEGORY_META = {
  FOOD: { color: "#f97316", bg: "bg-orange-50", text: "text-orange-500", icon: "🍜" },
  TRANSPORT: { color: "#3b82f6", bg: "bg-blue-50", text: "text-blue-500", icon: "🚗" },
  ENTERTAINMENT: { color: "#a855f7", bg: "bg-purple-50", text: "text-purple-500", icon: "🎮" },
  SHOPPING: { color: "#ec4899", bg: "bg-pink-50", text: "text-pink-500", icon: "🛍️" },
  HEALTH: { color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-500", icon: "💊" },
  UTILITIES: { color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-500", icon: "⚡" },
  RENT: { color: "#6366f1", bg: "bg-indigo-50", text: "text-indigo-500", icon: "🏠" },
  EDUCATION: { color: "#14b8a6", bg: "bg-teal-50", text: "text-teal-500", icon: "📚" },
  SAVINGS: { color: "#84cc16", bg: "bg-lime-50", text: "text-lime-500", icon: "💰" },
  OTHER: { color: "#94a3b8", bg: "bg-slate-50", text: "text-slate-400", icon: "📦" },
};

const getMeta = (cat) =>
  CATEGORY_META[(cat || "OTHER").toUpperCase()] || CATEGORY_META.OTHER;

// Animated Number
function AnimatedNumber({ value, duration = 900, delay = 0 }) {
  const [display, setDisplay] = useState(0);
  const numVal = Number(value || 0);

  useEffect(() => {
    let raf;
    let start = null;

    const timeout = setTimeout(() => {
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        setDisplay(Math.floor(ease * numVal));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [numVal, duration, delay]);

  return <span>{fmt(display)}</span>;
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-100 rounded-2xl ${className}`} />;
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function MetricCard({
  label,
  value,
  sub,
  iconBg,
  icon: Icon,
  accentClass,
  delay = 0,
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5"
      style={{ animation: `fadeUp 0.4s ease ${delay}ms both` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 ${accentClass}`} />
        </div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className={`text-2xl font-bold ${accentClass}`}>
        <AnimatedNumber value={value} delay={delay + 100} />
      </p>

      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function CategoryRow({ item, total, index }) {
  const meta = getMeta(item.category);
  const pct = total > 0 ? Math.min((item.amount / total) * 100, 100) : 0;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 150 + index * 70);
    return () => clearTimeout(t);
  }, [pct, index]);

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
      <div
        className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center text-base shrink-0`}
      >
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-sm font-semibold text-slate-700 capitalize">
            {item.category}
          </span>
          <span className="text-sm font-bold text-slate-800">
            {fmt(item.amount)}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${width}%`,
              backgroundColor: meta.color,
            }}
          />
        </div>
      </div>

      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.text}`}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function SuggestionItem({ text, index }) {
  const palettes = [
    { bg: "bg-indigo-50", text: "text-indigo-600" },
    { bg: "bg-emerald-50", text: "text-emerald-600" },
    { bg: "bg-amber-50", text: "text-amber-600" },
    { bg: "bg-pink-50", text: "text-pink-600" },
    { bg: "bg-teal-50", text: "text-teal-600" },
  ];

  const p = palettes[index % palettes.length];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div
        className={`w-6 h-6 rounded-lg ${p.bg} ${p.text} flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}
      >
        {index + 1}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [analytics, setAnalytics] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchData();
  }, []);

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [a, s] = await Promise.allSettled([
        axios.get(`${API}/analytics/spending`, { headers }),
        axios.get(`${API}/analytics/suggestions`, { headers }),
      ]);

      if (a.status === "fulfilled") setAnalytics(a.value.data);
      if (s.status === "fulfilled")
        setSuggestions(s.value.data?.suggestions || []);

      if ([a, s].every((r) => r.status === "rejected")) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const categories = analytics?.by_category || [];
  const total = analytics?.total_monthly || 0;
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const topCat = sorted[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          <Skeleton className="h-44" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-52" />
        </main>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-[#f5f7fb]">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>

            <h1 className="text-lg font-bold text-slate-900">Analytics</h1>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="ml-auto p-2 rounded-full hover:bg-slate-100 transition"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-500 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Could not load analytics
                </p>
              </div>
            </div>
          )}

          {/* Hero */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-9 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg ring-4 ring-white">
                  <PieChart className="w-7 h-7 text-white" />
                </div>

                {topCat && (
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-semibold">
                    Top: {topCat.category}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 uppercase">
                Total This Month
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-1">
                <AnimatedNumber value={total} />
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Biggest Spend"
              value={topCat?.amount || 0}
              sub={topCat ? `${topCat.category}` : "No data"}
              iconBg="bg-orange-50"
              icon={TrendingUp}
              accentClass="text-orange-500"
            />

            <MetricCard
              label="Monthly Average"
              value={categories.length ? total / categories.length : 0}
              sub="Average per category"
              iconBg="bg-emerald-50"
              icon={Wallet}
              accentClass="text-emerald-500"
            />
          </div>

          {/* Categories */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <SectionLabel>Spend by Category</SectionLabel>

            {sorted.length === 0 ? (
              <p className="text-sm text-slate-400">No data available.</p>
            ) : (
              sorted.map((item, i) => (
                <CategoryRow
                  key={i}
                  item={item}
                  total={total}
                  index={i}
                />
              ))
            )}
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-amber-500" />
              </div>

              <div>
                <p className="text-xs text-slate-400 uppercase">
                  Smart Suggestions
                </p>
              </div>
            </div>

            {suggestions.length === 0 ? (
              <p className="text-sm text-slate-400">
                Keep spending to generate insights.
              </p>
            ) : (
              suggestions.map((s, i) => (
                <SuggestionItem key={i} text={s} index={i} />
              ))
            )}
          </div>
        </main>
      </div>
    </>
  );
}