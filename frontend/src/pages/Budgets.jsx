import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, TrendingUp, AlertTriangle,
  CheckCircle, Info, RefreshCw, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, Legend,
} from 'recharts';

const API    = 'http://localhost:4000';
const ML_API = 'http://localhost:8000';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CATEGORIES = [
  'Food','Transport','Shopping','Entertainment',
  'Utilities','Healthcare','Groceries','Other',
];
const CAT_COLORS = {
  Food: '#FF6C0C', Transport: '#8CA9FF', Shopping: '#FF0066',
  Entertainment: '#FFBB28', Utilities: '#00C49F', Healthcare: '#934790',
  Groceries: '#4ADE80', Other: '#94A3B8',
};

function catColor(cat) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},65%,55%)`;
}

const now = new Date();
const DAYS_IN_MONTH = (m, y) => new Date(y, m, 0).getDate();
const TODAY_DAY = now.getDate();

// Mini sparkline bars (last 6 values)
function MiniSparkline({ values = [], color = '#94A3B8' }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-sm opacity-80"
          style={{
            height: `${Math.max(4, (v / max) * 20)}px`,
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

function SeverityBadge({ s }) {
  const map = {
    high:   'bg-red-50 text-red-600 border border-red-200',
    medium: 'bg-amber-50 text-amber-600 border border-amber-200',
    low:    'bg-blue-50 text-blue-600 border border-blue-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase ${map[s] || 'bg-slate-100 text-slate-500'}`}>
      {s}
    </span>
  );
}

export default function Budgets() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [status,   setStatus]   = useState(null);
  const [history,  setHistory]  = useState({});
  const [insights, setInsights] = useState(null);

  const [loadingStatus,   setLoadingStatus]   = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [newCategory, setNewCategory] = useState('Food');
  const [newLimit,    setNewLimit]    = useState('');
  const [adding,      setAdding]      = useState(false);
  const [copyingLast, setCopyingLast] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await axios.get(`${API}/budget/status?month=${month}&year=${year}`, { headers });
      setStatus(res.data);
    } catch {
      setStatus({ totalLimit: 0, totalSpent: 0, totalRemaining: 0, categories: [] });
    } finally {
      setLoadingStatus(false);
    }
  }, [month, year, token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/budget/history?months=6`, { headers });
      setHistory(res.data);
    } catch {
      setHistory({});
    }
  }, [token]);

  const fetchInsights = useCallback(async (hist, budgetCategories) => {
    if (!Object.keys(hist).length) return;
    setLoadingInsights(true);
    try {
      const res = await axios.get(`${ML_API}/budget-insights`, {
        params: {
          history: JSON.stringify(hist),
          budgets: JSON.stringify(budgetCategories.map(c => ({ category: c.category, limit: c.limit }))),
        },
      });
      setInsights(res.data);
    } catch {
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

// Replace the two separate useEffects with one coordinated fetch
useEffect(() => {
  async function loadAll() {
    setLoadingStatus(true);
    try {
      const [statusRes, histRes] = await Promise.all([
        axios.get(`${API}/budget/status?month=${month}&year=${year}`, { headers }),
        axios.get(`${API}/budget/history?months=6`, { headers }),
      ]);
      const s = statusRes.data;
      const h = histRes.data;
      setStatus(s);
      setHistory(h);
      // Now both are ready — call insights
      if (Object.keys(h).length > 0) {
        fetchInsights(h, s?.categories || []);
      }
    } catch {
      setStatus({ totalLimit: 0, totalSpent: 0, totalRemaining: 0, categories: [] });
    } finally {
      setLoadingStatus(false);
    }
  }
  loadAll();
}, [month, year, token]);


  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleAddBudget() {
    const limit = parseFloat(newLimit);
    if (!limit || limit <= 0) return toast.error('Enter a valid limit');
    setAdding(true);
    try {
      await axios.post(`${API}/budget`, { limit, month, year, category: newCategory }, { headers });
      toast.success(`Budget saved for ${newCategory}`);
      setNewLimit('');
      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add budget');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    if (!id) return;
    try {
      await axios.delete(`${API}/budget/${id}`, { headers });
      toast.success('Budget removed');
      await fetchStatus();
    } catch {
      toast.error('Failed to delete');
    }
  }

  // Copy last month's budgets to current month
  async function handleCopyLastMonth() {
    setCopyingLast(true);
    try {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear  = month === 1 ? year - 1 : year;
      const res = await axios.get(`${API}/budget/status?month=${prevMonth}&year=${prevYear}`, { headers });
      const prevBudgets = (res.data?.categories || []).filter(c => c.limit > 0);
      if (!prevBudgets.length) { toast.info('No budgets found for last month'); return; }
      await Promise.all(
        prevBudgets.map(c =>
          axios.post(`${API}/budget`, { limit: c.limit, month, year, category: c.category }, { headers })
        )
      );
      toast.success(`Copied ${prevBudgets.length} budgets from last month`);
      await fetchStatus();
      await fetchHistory();
    } catch {
      toast.error('Failed to copy budgets');
    } finally {
      setCopyingLast(false);
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const daysInMonth    = DAYS_IN_MONTH(month, year);
  const daysLeft       = isCurrentMonth ? Math.max(0, daysInMonth - TODAY_DAY) : 0;
  const daysPassed     = isCurrentMonth ? TODAY_DAY : daysInMonth;

  // Daily spend velocity
  const totalSpent    = status?.totalSpent || 0;
  const totalLimit    = status?.totalLimit || 0;
  const dailyAvg      = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const projectedEnd  = isCurrentMonth ? Math.round(dailyAvg * daysInMonth) : totalSpent;
  const velocityPct   = totalLimit > 0 ? Math.min((projectedEnd / totalLimit) * 100, 100) : 0;
  const withinBudget  = projectedEnd <= totalLimit;

  // Budget efficiency score: 0-100 based on forecast accuracy + anomaly freq
  const anomalyCount = insights ? Object.values(insights.anomalies || {}).filter(Boolean).length : 0;
  const totalCats    = status?.categories?.filter(c => c.limit > 0).length || 1;
  const efficiencyScore = insights
    ? Math.max(0, Math.round(100 - anomalyCount * 15 - (insights.suggestions?.filter(s => s.severity === 'high').length || 0) * 10))
    : null;

  // Potential savings
  const potentialSavings = (() => {
    if (!insights || !status) return null;
    let savings = 0;
    const breakdown = [];
    for (const cat of (status.categories || [])) {
      if (cat.limit <= 0) continue;
      const forecast = insights.forecasts?.[cat.category] ?? cat.spent;
      const diff = forecast - cat.limit;
      if (diff > 0) {
        savings += diff;
        breakdown.push({ cat: cat.category, over: Math.round(diff) });
      } else if (diff < 0) {
        breakdown.push({ cat: cat.category, under: Math.round(Math.abs(diff)) });
      }
    }
    return { savings: Math.round(savings), breakdown };
  })();

  // Category sparkline data from history
  function getCatSparkline(category) {
    const months = Object.keys(history).sort();
    return months.slice(-6).map(m => history[m]?.[category] || 0);
  }

  // Projected month-end for a category
  function projectedMonthEnd(spent) {
    if (!isCurrentMonth || daysPassed === 0) return spent;
    return Math.round((spent / daysPassed) * daysInMonth);
  }

  // Overall health
  const usedPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const healthLabel = usedPct >= 100 ? 'Exceeded 🚨'
                    : usedPct >= 80  ? 'Warning ⚠️ — on pace to exceed'
                    : 'On Track ✅';
  const healthColor = usedPct >= 100 ? 'text-red-600'
                    : usedPct >= 80  ? 'text-amber-500'
                    : 'text-emerald-600';

  // Chart data
  const chartData = (status?.categories || [])
    .filter(c => c.limit > 0)
    .map(c => ({ name: c.category, Budget: c.limit, Spent: c.spent, fill: catColor(c.category) }));

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="min-h-screen bg-[#F7F6F2] font-sans">
      <Toaster position="top-right" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Budgets</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI-powered spend tracking · {MONTHS[month - 1]} {year}
              </p>
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
              <select value={month - 1} onChange={e => setMonth(Number(e.target.value) + 1)}
                className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer">
                {MONTHS.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="text-sm text-slate-500 bg-transparent outline-none cursor-pointer">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={nextMonth}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Summary cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total Budget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Budget</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">
              ₹{(totalLimit).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              across {(status?.categories || []).filter(c => c.limit > 0).length} categories
            </p>
          </div>
          {/* Total Spent */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Spent</p>
            <p className="text-3xl font-bold text-rose-500 mt-1">
              ₹{totalSpent.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-1">{usedPct}% of budget used</p>
          </div>
          {/* Remaining */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Remaining</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">
              ₹{Math.max(0, status?.totalRemaining || 0).toLocaleString('en-IN')}
            </p>
            {isCurrentMonth && (
              <p className="text-xs text-slate-400 mt-1">{daysLeft} days left in month</p>
            )}
          </div>
          {/* Savings Gap */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Savings Gap</p>
            <p className="text-3xl font-bold text-sky-500 mt-1">
              ₹{(potentialSavings?.savings || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-1">vs. forecast overage</p>
          </div>
        </div>

        {/* ── Spend velocity bar ───────────────────────────────────────────── */}
        {isCurrentMonth && totalLimit > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-800">
                Spend velocity — {MONTHS[month - 1]} {year}
              </p>
              <p className="text-sm text-slate-500">
                ₹{Math.round(dailyAvg).toLocaleString('en-IN')}/day avg
              </p>
            </div>
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${velocityPct}%`,
                  background: velocityPct >= 90
                    ? '#ef4444'
                    : velocityPct >= 70
                    ? '#f59e0b'
                    : '#FF6C0C',
                }}
              />
              {/* today marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-slate-700 opacity-30"
                style={{ left: `${(TODAY_DAY / daysInMonth) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>₹0</span>
              <span>₹{totalLimit.toLocaleString('en-IN')} budget</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              At this rate, projected month-end spend:{' '}
              <span className="font-semibold text-slate-700">
                ₹{projectedEnd.toLocaleString('en-IN')}
              </span>
              {' · '}
              <span className={withinBudget ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                {withinBudget ? 'within budget' : 'over budget'}
              </span>
            </p>
          </div>
        )}

        {/* ── Main two-column layout ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: add form + category cards */}
          <div className="lg:col-span-2 space-y-5">

            {/* Add / Update Budget */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3">Add / update budget</h3>
              <div className="mb-3">
                <button
                  onClick={handleCopyLastMonth}
                  disabled={copyingLast}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${copyingLast ? 'animate-spin' : ''}`} />
                  Copy from last month
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="flex-1 min-w-[140px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  placeholder={`Limit (₹)`}
                  value={newLimit}
                  onChange={e => setNewLimit(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddBudget()}
                  className="flex-1 min-w-[140px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <button
                  onClick={handleAddBudget}
                  disabled={adding}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-50"
                >
                  {adding ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Category budget cards */}
            <div>
              {(status?.categories?.filter(c => c.limit > 0).length || 0) > 0 && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Category budgets
                </p>
              )}

              {loadingStatus ? (
                <div className="text-center py-16 text-slate-300 text-sm">Loading…</div>
              ) : (status?.categories || []).filter(c => c.limit > 0).length === 0 ? (
                <div className="text-center py-16 text-slate-300 text-sm">
                  No budgets yet — add one above.
                </div>
              ) : (
                <div className="space-y-3">
                  {(status?.categories || [])
                    .filter(c => c.limit > 0)
                    .map(cat => {
                      const riskScore  = insights?.risk_scores?.[cat.category];
                      const isAnomaly  = insights?.anomalies?.[cat.category];
                      const forecast   = insights?.forecasts?.[cat.category];
                      const sparkline  = getCatSparkline(cat.category);
                      const projected  = projectedMonthEnd(cat.spent);
                      const pct        = cat.percentage || 0;
                      const color      = catColor(cat.category);

                      const trendIcon = forecast !== undefined && cat.spent > 0
                        ? forecast > cat.spent
                          ? <ArrowUp className="w-3 h-3 text-red-400" />
                          : <ArrowDown className="w-3 h-3 text-emerald-500" />
                        : null;

                      const borderColor = isAnomaly
                        ? 'border-amber-300'
                        : pct >= 100
                        ? 'border-red-200'
                        : pct >= 80
                        ? 'border-amber-200'
                        : 'border-slate-100';

                      return (
                        <div
                          key={cat.category}
                          className={`bg-white rounded-2xl p-5 border shadow-sm ${borderColor}`}
                        >
                          {/* Row 1: name + spent/limit + delete */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-semibold text-slate-800">{cat.category}</span>
                              {isAnomaly && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  anomaly
                                </span>
                              )}
                              {trendIcon && (
                                <span className="flex items-center">{trendIcon}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-700">
                                ₹{cat.spent.toLocaleString('en-IN')} / ₹{cat.limit.toLocaleString('en-IN')}
                              </span>
                              {cat.id && (
                                <button
                                  onClick={() => handleDelete(cat.id)}
                                  className="p-1 rounded-lg border border-slate-200 text-slate-300 hover:text-red-400 hover:border-red-200 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color,
                              }}
                            />
                          </div>

                          {/* ML row */}
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            {forecast !== undefined && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-indigo-400" />
                                Forecast ₹{Math.round(forecast).toLocaleString('en-IN')}
                              </span>
                            )}
                            {riskScore !== null && riskScore !== undefined && (
                              <span className={`font-bold ${
                                riskScore >= 1 ? 'text-red-500' :
                                riskScore >= 0.8 ? 'text-amber-500' : 'text-emerald-500'
                              }`}>
                                Risk {Math.round(riskScore * 100)}%
                              </span>
                            )}
                            {isCurrentMonth && (
                              <span className="text-slate-400">
                                Proj. ₹{projected.toLocaleString('en-IN')} by month end
                              </span>
                            )}
                          </div>

                          {/* Sparkline */}
                          {sparkline.some(v => v > 0) && (
                            <div className="mt-3">
                              <MiniSparkline values={sparkline} color={color} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Unbudgeted categories */}
              {(status?.categories || []).filter(c => c.status === 'NO_BUDGET').length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Unbudgeted spending
                  </p>
                  <div className="space-y-2">
                    {(status?.categories || [])
                      .filter(c => c.status === 'NO_BUDGET')
                      .map(cat => (
                        <div key={cat.category}
                          className="bg-white rounded-xl px-4 py-3 border border-dashed border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                            <span className="text-sm text-slate-600">{cat.category}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              No budget set
                            </span>
                          </div>
                          <span className="text-sm text-slate-700 font-medium">
                            ₹{cat.spent.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4">Budget vs Actual</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={v => `₹${Number(v).toLocaleString('en-IN')}`}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Budget" fill="#e0e7ff" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Spent" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Budget Health */}
            {totalLimit > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">Budget health</h3>
                <p className={`text-5xl font-bold ${healthColor}`}>{usedPct}%</p>
                <p className="text-sm text-slate-400 mt-1">of total budget used</p>
                <p className={`text-sm font-semibold mt-2 ${healthColor}`}>{healthLabel}</p>

                {efficiencyScore !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Budget efficiency score</span>
                      <span className="font-semibold text-slate-700">{efficiencyScore} / 100</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                        style={{ width: `${efficiencyScore}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Based on forecast accuracy + anomaly frequency
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Potential Savings */}
            {potentialSavings && potentialSavings.savings > 0 && (
              <div className="bg-[#F0F7EC] rounded-2xl p-5 border border-[#C7E3B8]">
                <h3 className="font-semibold text-slate-800 mb-1">Potential savings this month</h3>
                <p className="text-4xl font-bold text-emerald-700 mt-1">
                  ₹{potentialSavings.savings.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  If overspending categories stay at forecast
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {potentialSavings.breakdown
                    .filter(b => b.over)
                    .map(b => `${b.cat} over by ~₹${b.over.toLocaleString('en-IN')}`)
                    .join(' · ')}
                  {potentialSavings.breakdown.filter(b => b.under).length > 0 && ' · '}
                  {potentialSavings.breakdown
                    .filter(b => b.under)
                    .map(b => `${b.cat} under by ~₹${b.under.toLocaleString('en-IN')}`)
                    .join(' · ')}
                </p>
              </div>
            )}

            {/* AI Insights */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                AI insights
                {loadingInsights && (
                  <span className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
                )}
              </h3>

              {!insights && !loadingInsights && (
                <p className="text-xs text-slate-400">
                  Add expenses for 2+ months to unlock AI forecasts and anomaly detection.
                </p>
              )}

              {insights?.suggestions?.length === 0 && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  All budgets look healthy!
                </div>
              )}

              <div className="space-y-3">
                {insights?.suggestions?.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-slate-700">{s.category}</span>
                      <SeverityBadge s={s.severity} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{s.message}</p>
                    {s.forecast !== undefined && s.limit !== undefined && (
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        Forecast ₹{Math.round(s.forecast).toLocaleString('en-IN')} · limit ₹{Math.round(s.limit).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 6-month avg spend */}
            {Object.keys(history).length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400" />
                  6-Month Avg Spend
                </h3>
                <div className="space-y-2.5">
                  {(() => {
                    const totals = {};
                    const monthCount = Object.keys(history).length || 1;
                    Object.values(history).forEach(md => {
                      Object.entries(md).forEach(([cat, amt]) => {
                        totals[cat] = (totals[cat] || 0) + amt;
                      });
                    });
                    return Object.entries(totals)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([cat, total]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: catColor(cat) }} />
                            <span className="text-slate-600">{cat}</span>
                          </div>
                          <span className="font-semibold text-slate-800">
                            ₹{Math.round(total / monthCount).toLocaleString('en-IN')}/mo
                          </span>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
