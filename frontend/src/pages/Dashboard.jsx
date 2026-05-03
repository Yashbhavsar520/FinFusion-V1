import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { User, Settings, BarChart3, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMemo } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";

import {
  Lightbulb,
  Plus,
  Upload,
  TrendingUp,
  Users,
  Target,
  Receipt,
} from "lucide-react";

import { formatCurrency } from "@/utils/formatCurrency";
import { useNavigate } from "react-router-dom";

// ---- API / MOCK SETUP (same as before) ----
const USE_MOCK =
  String(process.env.REACT_APP_USE_MOCK || "").toLowerCase() === "true";
const API = "http://localhost:4000";

let mockApi = null;
if (USE_MOCK) {
  mockApi = require("@/lib/api");
}

const COLORS = {
Food:          "#F97316", // vibrant orange
Transport:     "#3B82F6", // fresh blue
Shopping:      "#EC4899", // lively pink
Entertainment: "#FACC15", // bright yellow
Utilities:     "#14B8A6", // aqua teal
Healthcare:    "#8B5CF6", // modern violet
Groceries:     "#22C55E", // fresh green
Medical:       "#FB7185", // soft rose
Other:         "#64748B", // sleek slate
};

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Healthcare",
  "Other",
];

export default function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_monthly: 0,
    by_category: [],
  });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(0);
  const [newExpense, setNewExpense] = useState({
    amount: "",
    category: "Food",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [income, setIncome] = useState(0);
  const [tempIncome, setTempIncome] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(null);
  const menuRef = useRef(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);

useEffect(() => {
  async function fetchUser() {
    try {
      const res = await axios.get("http://localhost:4000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setIncome(res.data.income || 0);
      setUser(res.data);
      setTempIncome((res.data.income || 0).toString());
    } catch (err) {
      console.error("Failed to fetch user", err);
    }
  }

  if (token) {
    fetchUser();
  }
}, [token]);
  
  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    navigate("/login", { replace: true });
    return;
  }
  loadData();
}, []);
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    function handleEsc(event) {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

function handleLogout() {
  localStorage.removeItem("token");

  navigate("/login");
}
 async function loadData() {
  try {
    setDataLoading(true);

    const token = localStorage.getItem("token");

    const [e, a, s, p] = await Promise.all([
      axios.get(`${API}/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API}/analytics/spending`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API}/analytics/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API}/analytics/ml-prediction`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    setExpenses(e.data || []);
    setAnalytics(a.data);
    setSuggestions(s.data.suggestions);
    setPrediction(p.data.prediction);

  } catch (err) {
    console.error(err);
    toast.error("Failed to load data");
  } finally {
    setDataLoading(false);
  }
}

  async function handleAddExpense(e) {
  e.preventDefault();
  setLoading(true);

  try {
    const token = localStorage.getItem("token");

    const payload = {
      title: newExpense.description || "Expense",
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      date:     newExpense.date,
    };

    await axios.post(`${API}/expenses`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    toast.success("Expense added successfully!");

    setShowAddExpense(false);
    setNewExpense({
      amount: "",
      category: "Food",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });

    await loadData();
  } catch (err) {
    console.error(err);
    toast.error("Failed to add expense");
  } finally {
    setLoading(false);
  }
}

  async function deleteExpense(id) {
    try {
      if (USE_MOCK) {
        await mockApi.deleteExpense(id);
      } else {
        await axios.delete(`${API}/expenses/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
      }
      toast.success("Expense deleted");
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete expense");
    }
  }

  async function saveIncome() {
  try {
    const token = localStorage.getItem("token");
    const finalIncome = Number(tempIncome);

    await axios.patch(
      "http://localhost:4000/users/income",
      { income: finalIncome },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setIncome(finalIncome);
    setTempIncome(finalIncome.toString()); 
    setEditingIncome(false);

  } catch (err) {
    console.error(err);
    alert("Failed to update income");
  }
}

async function handleReceiptUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  setScanningReceipt(true);   // ← use dedicated state
  try {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const res = await axios.post(`${API}/expenses/scan-receipt`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    });

    setNewExpense((ne) => ({
      ...ne,
      amount: String(res.data.amount ?? ''),
      category: res.data.category ?? 'Other',
      description: res.data.description ?? '',
    }));

    setShowAddExpense(true);
    toast.success('Receipt scanned — review and confirm');

  } catch (err) {
    console.error(err);
    toast.error(err.response?.data?.message || 'Failed to scan receipt');
  } finally {
    setScanningReceipt(false);
  }
}

  const totalExpense = analytics?.total_monthly || 0;

const budgetRemaining = income - totalExpense;

const savingsRate =
  income > 0 ? ((income - totalExpense) / income) * 100 : 0;

const hasMultipleCategories = analytics?.by_category?.length > 1;
const isPredictionAvailable =
  prediction !== null && prediction !== undefined && prediction > 0;

  const chartData = [
    {
      name: "Current",
      amount: analytics?.total_monthly || 0,
    },
    {
      name: "Predicted",
      amount: prediction || 0,
    },
  ];

if (!localStorage.getItem("token")) {
  return null;
}

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* ── Receipt scanning overlay ───────────────────────────────── */}
{scanningReceipt && (
  <div className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4 bg-white rounded-2xl px-10 py-8 shadow-2xl">
      {/* Spinner */}
      <div className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      <p className="text-sm font-semibold text-slate-700">Scanning receipt…</p>
      <p className="text-xs text-slate-400">This may take a few seconds</p>
    </div>
  </div>
)}
      <Toaster position="top-right" />

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">

          {/* LEFT: LOGO */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-lg font-bold">
              F
            </div>
            <span className="font-semibold text-slate-800 text-lg">
              FinFusion
            </span>
          </div>

          {/* RIGHT: NAV + AVATAR */}
          <div className="flex items-center gap-6">

            {/* ✅ MOVE NAV HERE */}
            <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
              <Link
                to="/"
                className="text-indigo-600 border-b-2 border-indigo-500 pb-1"
              >
                Dashboard
              </Link>
              <Link to="/groups" className="hover:text-slate-800">
                Groups
              </Link>
              <Link to="/budgets" className="hover:text-slate-800">
                Budgets
              </Link>
              <Link to="/forecast" className="hover:text-slate-800">
                Forecast
              </Link>
            </nav>
            <div ref={menuRef} className="relative">
              <div
                onClick={(e) => {
                  setShowProfileMenu(!showProfileMenu)
                }}
                className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 flex items-center justify-center text-white text-sm font-semibold cursor-pointer"
              >
                {user?.name?.[0]?.toUpperCase() || "U"} 
              </div>
              {showProfileMenu && (
                <div
                  className="absolute right-6 top-16 w-56 bg-white shadow-lg rounded-xl border p-3 z-50 animate-slide-in">
                  <div className="text-sm font-semibold text-slate-800 px-3 py-2 border-b">
                   {user?.name || "User"}
                  </div>

                  <button
  onClick={() => navigate("/profile")}
  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 rounded-md text-sm"
>
  <User className="w-4 h-4" />
  Profile
</button>

                  <button className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 rounded-md text-sm"
                    onClick={() => navigate("/settings")}>
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>

                  <button 
                  onClick={() => navigate("/analytics")}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 rounded-md text-sm">
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                  </button>

                  <button 
                  onClick={() => navigate("/subscription")}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 rounded-md text-sm">
                    <CreditCard className="w-4 h-4" />
                    Subscription
                  </button>

                  <button
  onClick={() => navigate("/expenses/history")}
  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-100 rounded-md text-sm"
>
  <Receipt className="w-4 h-4" />
  Expense history
</button>

<div className="border-t my-2"></div>

                  <button
  onClick={handleLogout}
  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-500 rounded-md text-sm"
>
  <LogOut className="w-4 h-4" />
  Sign Out
</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="container mx-auto px-6 py-8">
        {/* GREETING */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">
           Hello {user?.name || "User"}
          </p>
          <h1
            className="text-3xl md:text-4xl font-bold mt-2 text-slate-900"
            data-testid="dashboard-title"
          >
            Here&apos;s your financial overview for the month.
          </h1>
        </div>

        {/* TOP GRID: HERO CARD + DONUT CHART */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.2fr] gap-8">
          {/* LEFT STACK: HERO + 3 SMALL CARDS */}
          <div className="space-y-6">
            {/* HERO CARD */}
            <Card className="relative overflow-hidden rounded-[24px] border-0 shadow-[0_24px_60px_rgba(15,23,42,0.15)] bg-gradient-to-tr from-[#5b5fff] via-[#8b5cf6] to-[#ff6bb5] text-white p-6 md:p-7 h-[200px]">
              <div className="absolute -right-16 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-xl" />

              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] font-semibold text-white/70">
                    Total Spending this Month
                  </p>
                  <p
                    className="text-4xl md:text-5xl font-semibold mt-3"
                    data-testid="total-spending-amount"
                  >
                    {formatCurrency(analytics?.total_monthly || 0)}
                  </p>
                  <p className="text-sm mt-3 text-white/80">
                    {budgetRemaining < 0
  ? "You're overspending this month ⚠️"
  : "You're managing your finances well 🎉"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  {/* Quick Action FAB */}
                  <Dialog
                    open={showAddExpense}
                    onOpenChange={setShowAddExpense}
                  >
                    
                      <button
  className="mt-6 h-11 w-11 rounded-full bg-white/90 text-indigo-600 shadow-md flex items-center justify-center hover:bg-white"
  data-testid="add-expense-btn"
  onClick={() => {
    setNewExpense({
      amount: "",
      category: "Food",
      description: "",
      customCategory: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowAddExpense(true);
  }}
>
  <Plus className="w-5 h-5" />
</button>
                   

                    <DialogContent data-testid="add-expense-dialog">
                      <DialogHeader>
                        <DialogTitle>Add New Expense</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                          <Label htmlFor="amount">Amount</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={newExpense.amount}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                amount: e.target.value,
                              })
                            }
                            required
                            data-testid="expense-amount-input"
                          />
                        </div>

                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select
                            value={newExpense.category}
                            onValueChange={(val) =>
                              setNewExpense({ ...newExpense, category: val })
                            }
                          >
                            <SelectTrigger data-testid="expense-category-select">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem
                                  key={cat}
                                  value={cat}
                                  data-testid={`category-option-${cat}`}
                                >
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Optional custom title when category is "Other" */}
{newExpense.category === "Other" && (
  <div>
    <Label htmlFor="customCategory">
      Custom Label{" "}
      <span className="text-slate-400 font-normal">(optional)</span>
    </Label>
    <Input
      id="customCategory"
      placeholder='e.g. "Gift", "Donation", "Misc" — leave blank for Other'
      value={newExpense.customCategory ?? ""}
      onChange={(e) =>
        setNewExpense({ ...newExpense, customCategory: e.target.value })
      }
    />
  </div>
)}
                        </div>

                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={newExpense.description}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                description: e.target.value,
                              })
                            }
                            required
                            data-testid="expense-description-input"
                          />
                        </div>

                        <div>
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={newExpense.date}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                date: e.target.value,
                              })
                            }
                            required
                            data-testid="expense-date-input"
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loading}
                          data-testid="submit-expense-btn"
                        >
                          {loading ? "Adding…" : "Add Expense"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>

            {/* 3 SMALL SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Income */}
              {/* Income */}
<Card className="rounded-[20px] border-0 shadow-sm bg-white px-6 py-6 h-[170px] flex flex-col justify-between">
  <div>
    <p className="text-xs text-slate-400 font-semibold uppercase">
      Monthly Income
    </p>

    {editingIncome ? (
      <div className="flex gap-2 mt-2">
      <input
  type="number"
  value={tempIncome}
  placeholder="Enter income"
  onChange={(e) => setTempIncome(e.target.value)}
  className="border p-2 rounded w-full outline-none focus:ring-2 focus:ring-indigo-400"
/>
        <button
          onClick={saveIncome}
          className="bg-indigo-600 text-white px-3 rounded"
        >
          Save
        </button>
      </div>
    ) : (
      <div className="mt-2">
        <p className="text-2xl font-semibold text-slate-900">
          {formatCurrency(income)}
        </p>

        <button
          onClick={() => {
            setTempIncome(income.toString());
            setEditingIncome(true);
          }}
          className="text-sm text-indigo-600 mt-1"
        >
          Edit
        </button>
      </div>
    )}
  </div>

  <p className="text-xs text-emerald-500 mt-2">
    Your monthly earnings
  </p>
</Card>

              {/* Savings Rate */}
              <Card className="rounded-[20px] border-0 shadow-sm bg-white px-6 py-6 h-[170px] flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">
                    Savings Rate
                  </p>
                  <p className="text-2xl font-semibold mt-2 text-slate-900">
{Math.round(savingsRate)}%                  </p>
                </div>
                <p className="text-xs text-emerald-500 mt-2">+1.5%</p>
              </Card>

              {/* Budget Remaining */}
              <Card className="rounded-[20px] border-0 shadow-sm bg-white px-6 py-6 h-[170px] flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">
                    Budget Remaining
                  </p>
                  <p className="text-2xl font-semibold mt-2 text-slate-900">
                    {formatCurrency(budgetRemaining)}
                  </p>
                </div>
<p className={`text-xs mt-2 ${budgetRemaining < 0 ? "text-rose-500" : "text-emerald-500"}`}>
  {budgetRemaining < 0 ? "Overspending ⚠️" : "Within budget ✅"}
</p>              </Card>
<Card className="rounded-[20px] border-0 shadow-sm bg-white px-6 py-6 h-[170px] flex flex-col justify-between">

  <div>
    <p className="text-xs text-slate-400 font-semibold uppercase">
      Predicted Spending
    </p>

    {prediction > 0 ? (
      <>
        <p className="text-2xl font-semibold mt-2 text-blue-600">
          {formatCurrency(prediction)}
        </p>

        <p className="text-xs text-slate-400 mt-1">
          Current: {formatCurrency(analytics?.total_monthly || 0)}
        </p>
      </>
    ) : (
      <p className="text-sm text-slate-400 mt-2">
        No prediction available
      </p>
    )}
  </div>

  {/* Insight */}
  {prediction > 0 && (
    <p
      className={`text-xs mt-2 ${
        prediction > (analytics?.total_monthly || 0)
          ? "text-rose-500"
          : "text-emerald-500"
      }`}
    >
      {prediction > (analytics?.total_monthly || 0)
        ? "Spending may increase ⚠️"
        : "Spending looks stable ✅"}
    </p>
  )}
</Card>
            </div>
          </div>

          {/* RIGHT: DONUT CHART CARD */}
          <Card
            className="rounded-[24px] border-0 shadow-sm bg-white p-6 flex flex-col"
            data-testid="spending-chart-card"
          >
            <p className="text-sm font-semibold text-slate-900 mb-1">
              Spending by Category
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Breakdown of your monthly expenses.
            </p>

            {analytics?.by_category?.length > 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* DONUT CHART */}
                {/* DONUT CHART */}
<div className="relative flex items-center justify-center w-full py-4">
  <ResponsiveContainer width="100%" height={220}>
    <PieChart>
      <Pie
        data={analytics.by_category}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={85}
        startAngle={90}
        endAngle={-270}
        paddingAngle={2}
        cornerRadius={10}
        dataKey="amount"
      >
        {analytics.by_category.map((entry, index) => (
  <Cell
    key={index}
    fill={COLORS[entry.category] ?? "#94A3B8"}
  />
))}
      </Pie>

      {/* ── ADD THIS ── */}
      <Tooltip
        formatter={(value, name, props) => [
          `₹${Number(value).toLocaleString('en-IN')}`,
          props.payload.category,
        ]}
        contentStyle={{
          borderRadius: '12px',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          fontSize: '12px',
          padding: '8px 12px',
        }}
        itemStyle={{ color: '#334155' }}
        labelStyle={{ display: 'none' }}
      />
    </PieChart>
  </ResponsiveContainer>

  {/* CENTER TEXT */}
  <div className="absolute text-center pointer-events-none">
    <p className="text-xs text-slate-400">Total</p>
    <p className="text-xl font-bold text-slate-900">
      {formatCurrency(analytics?.total_monthly || 0)}
    </p>
  </div>
</div>
                {/* Legend */}
                <div className="mt-8 grid grid-cols-2 gap-y-2 text-xs text-slate-500 w-full">
                  {analytics.by_category.map((item, i) => (
  <div key={item.category + i} className="flex items-center gap-2">
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: COLORS[item.category] ?? "#94A3B8" }}
    />
    <span>{item.category}</span>
  </div>
))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
                No data yet
              </div>
            )}
          </Card>

        </div>

        {/* BOTTOM GRID: RECENT EXPENSES + AI SUGGESTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.1fr] gap-8 mt-10">

          {/* RECENT EXPENSES */}
          <Card
            className="rounded-[24px] border-0 shadow-sm bg-white p-6 flex flex-col"
            data-testid="recent-expenses-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Recent Expenses
                </p>
                <p className="text-xs text-slate-400">
                  Track your latest transactions.
                </p>
              </div>

              {/* Secondary Quick Action button */}
              <Button
  size="icon"
  variant="outline"
  className="rounded-full border-dashed"
  onClick={() => {
    setNewExpense({
      amount: "",
      category: "Food",
      description: "",
      customCategory: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowAddExpense(true);
  }}
>
  <Plus className="w-4 h-4" />
</Button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {expenses.slice(0, 10).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between px-3 py-3 rounded-[16px] hover:bg-slate-50 transition-colors"
                  data-testid={`expense-item-${expense.id}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* little icon circle */}
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                      {expense.category?.[0] || "₹"}
                    </div>

                    <div>
                      <p
                        className="text-sm font-semibold text-slate-900"
                        data-testid={`expense-description-${expense.id}`}
                      >
                        {expense.description}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {expense.date} • {expense.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p
                      className="text-sm font-semibold text-slate-900"
                      data-testid={`expense-amount-${expense.id}`}
                    >
                      {formatCurrency(expense.amount || 0)}
                    </p>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteExpense(expense.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      data-testid={`delete-expense-${expense.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}

              {expenses.length === 0 && (
                <div className="text-center py-10 text-slate-300 text-sm">
                  No expenses yet. Add your first expense!
                </div>
              )}
            </div>

            {/* Scan Receipt Button (bottom) */}
            <div className="mt-5 flex justify-end">
              <Button
                variant="outline"
                className="rounded-full text-xs font-semibold flex items-center gap-2"
                onClick={() =>
                  document.getElementById("receipt-upload")?.click()
                }
                data-testid="scan-receipt-btn"
              >
                <Upload className="w-4 h-4" />
                Scan Receipt
              </Button>
              <input
                id="receipt-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReceiptUpload}
              />
            </div>
          </Card>

          {/* AI SUGGESTIONS */}
          <Card
            className="rounded-[24px] border-0 shadow-sm bg-white p-6"
            data-testid="suggestions-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-500">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  AI Suggestions
                </p>
                <p className="text-xs text-slate-400">
                  Get insights from your spending.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-3 rounded-[18px] bg-slate-50"
                  data-testid={`suggestion-${idx}`}
                >
                  <div className="mt-1">
                    <div className="h-7 w-7 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-500 text-xs">
                      <Target className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{s}</p>
                </div>
              ))}

              {suggestions.length === 0 && (
                <p className="text-xs text-slate-400">
                  No suggestions yet. Add more expenses to get AI tips.
                </p>
              )}
            </div>

            {/* Link to Groups / Budgets for extra UX */}
            <div className="mt-6 flex flex-col gap-2 text-xs">
              <Link
                to="/groups"
                className="inline-flex items-center gap-2 text-indigo-500 hover:text-indigo-600"
              >
                <Users className="w-3 h-3" />
                View your group expenses
              </Link>
              <Link
                to="/budgets"
                className="inline-flex items-center gap-2 text-indigo-500 hover:text-indigo-600"
              >
                <Receipt className="w-3 h-3" />
                Manage your AI budgets
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
