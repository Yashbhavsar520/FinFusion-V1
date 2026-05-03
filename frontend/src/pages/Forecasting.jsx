import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft, TrendingUp, AlertTriangle, Wallet, Sparkles,
  ChevronLeft, ChevronRight, Flame, Calendar, PieChart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  Tooltip, XAxis, YAxis, BarChart, Bar, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell,
  AreaChart, Area,
} from "recharts";

const API    = "http://localhost:4000";
const ML_API = "http://localhost:8000";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const CAT_COLORS = {
  Food:"#FF6C0C", Transport:"#8CA9FF", Shopping:"#FF0066",
  Entertainment:"#FFBB28", Utilities:"#00C49F", Healthcare:"#934790",
  Groceries:"#4ADE80", Other:"#94A3B8",
};
function catColor(cat) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},65%,55%)`;
}

const today = new Date();

export default function Forecast() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");
  const headers  = { Authorization: `Bearer ${token}` };

  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(today.getFullYear());

  const [expenses,     setExpenses]     = useState([]);
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [history,      setHistory]      = useState({});
  const [mlData,       setMlData]       = useState(null);

  const [loading,    setLoading]    = useState(true);
  const [mlLoading,  setMlLoading]  = useState(false);
  const [activeTab,  setActiveTab]  = useState("overview");

  // ── Fetch backend data ────────────────────────────────────────────────────
const fetchAll = useCallback(async () => {
  setLoading(true);
  try {
    const [expRes, histRes] = await Promise.all([
      axios.get(`${API}/analytics/expenses/all`, {
  headers,
  params: {
    limit: 500,
    startDate: `${selYear}-${String(selMonth).padStart(2, "0")}-01`,
    endDate:   getMonthEndDate(selYear, selMonth),
    sortBy:    "date",
    sortOrder: "asc",
  },
}),
      axios.get(`${API}/budget/history?months=6`, { headers }),
    ]);

    setExpenses(expRes.data.expenses || []);
    setHistory(histRes.data || {});

      try {
        const bRes = await axios.get(
          `${API}/budget/status?month=${selMonth}&year=${selYear}`, { headers }
        );
        setBudgetStatus(bRes.data);
      } catch {
        setBudgetStatus(null);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selMonth, selYear, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Call FastAPI ML ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!Object.keys(history).length) return;

    const budgetList = budgetStatus?.categories?.filter(c => c.limit > 0).map(c => ({
      category: c.category, limit: c.limit,
    })) || [];

    async function fetchML() {
      setMlLoading(true);
      try {
        const res = await axios.get(`${ML_API}/budget-insights`, {
          params: {
            history: JSON.stringify(history),
            budgets: JSON.stringify(budgetList),
          },
        });
        console.log("ML data:", res.data); 
        setMlData(res.data);
      } catch {
        setMlData(null);
      } finally {
        setMlLoading(false);
      }
    }
    fetchML();
  }, [history, budgetStatus]);

  function getMonthEndDate(year, month) {
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

  // ── Spending by category for selected month ───────────────────────────────
  // FIX: parse date parts directly to avoid UTC→IST timezone shift bug
  const categorySpend = useMemo(() => {
  const map = {};
  expenses.forEach(e => {
    const [y, m] = parseDateParts(e.date);      // ✅ was splitting on full ISO string
    if (y === selYear && m === selMonth) {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    }
  });
  return map;
}, [expenses, selMonth, selYear]);

  const totalThisMonth = Object.values(categorySpend).reduce((a, b) => a + b, 0);

  // ── Burn rate ─────────────────────────────────────────────────────────────
  const burnRate = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = now.getMonth() + 1 === selMonth && now.getFullYear() === selYear;
    const daysInMonth  = new Date(selYear, selMonth, 0).getDate();
    const daysPassed   = isCurrentMonth ? now.getDate() : daysInMonth;
    const dailyRate    = daysPassed > 0 ? totalThisMonth / daysPassed : 0;
    const projectedTotal = Math.round(dailyRate * daysInMonth);
    const daysLeft     = isCurrentMonth ? daysInMonth - now.getDate() : 0;
    return { dailyRate: Math.round(dailyRate), projectedTotal, daysLeft, daysPassed };
  }, [totalThisMonth, selMonth, selYear]);

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const months = Object.keys(history).sort().slice(-6);
    return months.map(mk => {
      const [, m] = mk.split("-").map(Number);
      const total = Object.values(history[mk] || {}).reduce((a, b) => a + b, 0);
      const forecast = mlData?.forecasts
        ? Object.values(mlData.forecasts).reduce((a, b) => a + b, 0)
        : null;
      return {
        month:    MONTH_NAMES[m - 1].slice(0, 3),
        actual:   Math.round(total),
        forecast: forecast ? Math.round(forecast) : null,
      };
    });
  }, [history, mlData]);

  // ── Category chart data (actual vs forecast vs budget) ───────────────────
 const categoryChartData = useMemo(() => {
  const cats = new Set([
    ...Object.keys(categorySpend),
    ...Object.keys(mlData?.forecasts || {}),
  ]);
  return Array.from(cats).map(cat => {
    const actual = categorySpend[cat] || 0;
    const mlForecast = mlData?.forecasts?.[cat];
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const burnForecast = burnRate.daysPassed > 0
      ? Math.round((actual / burnRate.daysPassed) * daysInMonth)
      : 0;

    return {
      category: cat,
      actual:   Math.round(actual),
      forecast: mlForecast ? Math.round(mlForecast) : burnForecast,
      budget:   budgetStatus?.categories?.find(c => c.category === cat)?.limit || 0,
      color:    catColor(cat),
    };
  });
}, [categorySpend, mlData, budgetStatus, burnRate, selYear, selMonth]);

  // ── Heatmap: daily spending ───────────────────────────────────────────────
  // FIX: parse date parts directly to avoid UTC→IST timezone shift bug
 const heatmapData = useMemo(() => {
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const dayMap = {};
  expenses.forEach(e => {
    const [y, m, d] = parseDateParts(e.date);   // ✅ was splitting on full ISO string
    if (y === selYear && m === selMonth) {
      dayMap[d] = (dayMap[d] || 0) + Number(e.amount || 0);
    }
  });
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day:    i + 1,
    amount: Math.round(dayMap[i + 1] || 0),
  }));
}, [expenses, selMonth, selYear]);

  const maxDayAmount = Math.max(...heatmapData.map(d => d.amount), 1);

  // ── Radar chart data ──────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    return Object.entries(categorySpend)
      .slice(0, 7)
      .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }));
  }, [categorySpend]);

  // ── ML summary numbers ────────────────────────────────────────────────────
  const totalForecast = mlData?.forecasts
    ? Math.round(Object.values(mlData.forecasts).reduce((a, b) => a + b, 0))
    : burnRate.projectedTotal;

  const anomalyCount = mlData?.anomalies
    ? Object.values(mlData.anomalies).filter(Boolean).length
    : 0;

  const highRiskCats = mlData?.risk_scores
    ? Object.entries(mlData.risk_scores).filter(([, v]) => v !== null && v >= 0.8)
    : [];

  // ── Month nav ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); }
    else setSelMonth(m => m - 1);
  }
  function nextMonth() {
    if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); }
    else setSelMonth(m => m + 1);
  }

  function parseDateParts(dateStr) {
  if (!dateStr) return [null, null, null];
  // Take only the date portion before any 'T'
  const datePart = dateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return [y, m, d];
}

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading forecast…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50">
      <Toaster position="top-right" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Forecast</h1>
              <p className="text-xs text-slate-400">
                AI-powered spending insights · {MONTH_NAMES[selMonth - 1]} {selYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="p-2 rounded-xl bg-white shadow-sm border hover:bg-slate-50">
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 py-2 bg-white rounded-xl shadow-sm border text-sm font-medium">
              {MONTH_NAMES[selMonth - 1]} {selYear}
            </span>
            <button onClick={nextMonth}
              className="p-2 rounded-xl bg-white shadow-sm border hover:bg-slate-50">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Summary cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            title="This Month"
            value={`₹${totalThisMonth.toLocaleString("en-IN")}`}
            sub="actual so far"
            icon={<Wallet className="w-5 h-5 text-indigo-500" />}
            color="text-indigo-600"
          />
          <SummaryCard
            title="ML Forecast"
            value={`₹${totalForecast.toLocaleString("en-IN")}`}
            sub={mlData ? "exponential smoothing" : "burn-rate estimate"}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            color="text-emerald-600"
            badge={mlLoading ? "loading…" : mlData ? "AI" : null}
          />
          <SummaryCard
            title="Daily Burn Rate"
            value={`₹${burnRate.dailyRate.toLocaleString("en-IN")}/day`}
            sub={`${burnRate.daysLeft} days left`}
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            color="text-orange-600"
          />
          <SummaryCard
            title="Anomalies"
            value={`${anomalyCount} detected`}
            sub={anomalyCount > 0 ? `${highRiskCats.length} high-risk categories` : "All normal"}
            icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
            color={anomalyCount > 0 ? "text-rose-600" : "text-emerald-600"}
          />
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-slate-200">
          {["overview", "category", "heatmap"].map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW ──────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">

            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-1">6-Month Spending Trend</h3>
              <p className="text-xs text-slate-400 mb-4">
                Actual spend vs ML forecast (exponential smoothing α=0.4)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }}
                    tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={v => `₹${Number(v).toLocaleString("en-IN")}`} />
                  <Legend />
                  <Area type="monotone" dataKey="actual"   stroke="#6366f1"
                    strokeWidth={2} fill="url(#actualGrad)"   name="Actual" />
                  <Area type="monotone" dataKey="forecast" stroke="#22c55e"
                    strokeWidth={2} fill="url(#forecastGrad)" name="ML Forecast"
                    strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                AI Insights
                {mlLoading && (
                  <span className="ml-auto h-4 w-4 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                )}
              </h3>

              {!mlData && !mlLoading && (
                <p className="text-xs text-slate-400 mt-2">
                  Add expenses across 2+ months to unlock AI-powered anomaly detection and forecasts.
                </p>
              )}

              <div className="space-y-3 flex-1 overflow-y-auto">
                {mlData?.suggestions?.length === 0 && (
                  <div className="text-sm text-emerald-600 flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                    ✅ All spending patterns look healthy!
                  </div>
                )}
                {mlData?.suggestions?.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: catColor(s.category) }} />
                        {s.category}
                      </span>
                      <SeverityBadge level={s.severity} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{s.message}</p>
                    {s.forecast && s.limit && (
                      <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-1.5 rounded-full bg-indigo-400"
                          style={{ width: `${Math.min((s.forecast / s.limit) * 100, 100)}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-700">Projected Month-End</p>
                <p className="text-xl font-extrabold text-indigo-600 mt-0.5">
                  ₹{burnRate.projectedTotal.toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-indigo-400 mt-0.5">
                  Based on ₹{burnRate.dailyRate}/day × {new Date(selYear, selMonth, 0).getDate()} days
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ── TAB: CATEGORY ──────────────────────────────────────────────────── */}
        {activeTab === "category" && (
          <div className="grid lg:grid-cols-3 gap-6">

            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-1">Actual vs Forecast vs Budget</h3>
              <p className="text-xs text-slate-400 mb-4">Per category for {MONTH_NAMES[selMonth - 1]}</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryChartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }}
                    tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={v => `₹${Number(v).toLocaleString("en-IN")}`} />
                  <Legend />
                  <Bar dataKey="actual"   name="Actual"   radius={[4,4,0,0]}>
                    {categoryChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                  <Bar dataKey="forecast" name="Forecast" fill="#e0e7ff" radius={[4,4,0,0]} />
                  <Bar dataKey="budget"   name="Budget"   fill="#bbf7d0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-800 mb-3">Spending Shape</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                    <Radar dataKey="amount" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

<div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
  <h3 className="font-semibold text-slate-800 mb-3">Risk Scores</h3>
  <div className="space-y-3">
    {!mlData ? (
      <p className="text-xs text-slate-400">ML data loading…</p>
    ) : !budgetStatus?.categories?.some(c => c.limit > 0) ? (
      <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
        Set budgets in the <button
          onClick={() => navigate("/budgets")}
          className="text-indigo-500 underline">Budgets page
        </button> to see risk scores per category.
      </div>
    ) : Object.entries(mlData.risk_scores || {}).filter(([, v]) => v !== null).length === 0 ? (
      <p className="text-xs text-slate-400">Need 2+ months of data for risk scoring.</p>
    ) : (
      Object.entries(mlData.risk_scores)
        .filter(([, v]) => v !== null)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, score]) => (
          <div key={cat}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-700">
                <span className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: catColor(cat) }} />
                {cat}
              </span>
              <span className={`font-semibold ${
                score >= 1   ? "text-red-500" :
                score >= 0.8 ? "text-amber-500" : "text-emerald-500"
              }`}>
                {Math.round(score * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-1.5 rounded-full transition-all ${
                score >= 1   ? "bg-red-500" :
                score >= 0.8 ? "bg-amber-400" : "bg-emerald-400"
              }`} style={{ width: `${Math.min(score * 100, 100)}%` }} />
            </div>
          </div>
        ))
    )}
  </div>
</div>
            </div>
          </div>
        )}

        {/* ── TAB: HEATMAP ───────────────────────────────────────────────────── */}
        {activeTab === "heatmap" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Daily Spending — {MONTH_NAMES[selMonth - 1]} {selYear}
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Darker = higher spend. Hover for exact amount.
              </p>

              <div className="grid grid-cols-7 gap-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} className="text-center text-[10px] text-slate-400 font-semibold pb-1">{d}</div>
                ))}
                {Array.from({ length: new Date(selYear, selMonth - 1, 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {heatmapData.map(({ day, amount }) => {
                  const intensity = maxDayAmount > 0 ? amount / maxDayAmount : 0;
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() + 1 === selMonth &&
                    today.getFullYear() === selYear;
                  return (
                    <div key={day}
                      title={`Day ${day}: ₹${amount.toLocaleString("en-IN")}`}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-default
                        transition hover:ring-2 hover:ring-indigo-300
                        ${isToday ? "ring-2 ring-indigo-500" : ""}`}
                      style={{
                        backgroundColor: amount === 0
                          ? "#f8fafc"
                          : `rgba(99,102,241,${0.15 + intensity * 0.85})`,
                      }}>
                      <span className="text-[10px] text-slate-500">{day}</span>
                      {amount > 0 && (
                        <span className="text-[9px] font-semibold text-white mt-0.5">
                          ₹{amount >= 1000 ? `${(amount/1000).toFixed(1)}k` : amount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Daily Breakdown</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={heatmapData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }}
                      tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={v => [`₹${Number(v).toLocaleString("en-IN")}`, "Spent"]} />
                    <Bar dataKey="amount" radius={[4,4,0,0]}>
                      {heatmapData.map((entry, i) => (
                        <Cell key={i}
                          fill={
                            entry.amount === 0                           ? "#f1f5f9" :
                            entry.amount / maxDayAmount > 0.7            ? "#ef4444" :
                            entry.amount / maxDayAmount > 0.4            ? "#f59e0b" : "#6366f1"
                          } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {mlData?.anomalies && Object.values(mlData.anomalies).some(Boolean) && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100">
                <h3 className="font-semibold text-rose-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Anomalous Categories This Month
                </h3>
                <div className="space-y-2">
                  {Object.entries(mlData.anomalies)
                    .filter(([, v]) => v)
                    .map(([cat]) => (
                      <div key={cat}
                        className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                        <span className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: catColor(cat) }} />
                          {cat}
                        </span>
                        <span className="text-xs text-rose-500">
                          Spend is &gt;2σ above your average
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ title, value, sub, icon, color, badge }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400 font-semibold uppercase">{title}</p>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
              {badge}
            </span>
          )}
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SeverityBadge({ level }) {
  const map = {
    high:   "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low:    "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[level] || "bg-slate-100 text-slate-500"}`}>
      {level?.toUpperCase()}
    </span>
  );
}