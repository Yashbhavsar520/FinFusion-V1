import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Search, Download, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { formatCurrency } from "@/utils/formatCurrency";

const API = "http://localhost:4000";

const CATEGORY_COLORS = {
  Food: "#F97316", Transport: "#3B82F6", Shopping: "#EC4899",
  Entertainment: "#FACC15", Utilities: "#14B8A6", Healthcare: "#8B5CF6",
  Groceries: "#22C55E", General: "#F43F5E", Other: "#64748B",
};

const ALL_CATEGORIES = [
  "all", "Food", "Transport", "Shopping",
  "Entertainment", "Utilities", "Healthcare", "Groceries", "General", "Other",
];

export default function ExpenseHistory() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [expenses, setExpenses]       = useState([]);
  const [summary, setSummary]         = useState(null);
  const [pagination, setPagination]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");

  // Filters
  const [category, setCategory]       = useState("all");
  const [startDate, setStartDate]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [sortBy, setSortBy]           = useState("date");
  const [sortOrder, setSortOrder]     = useState("desc");
  const [page, setPage]               = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const LIMIT = 20;

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(LIMIT),
        category, sortBy, sortOrder,
        ...(startDate && { startDate }),
        ...(endDate   && { endDate   }),
      });

      const res = await axios.get(`${API}/analytics/expenses/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setExpenses(res.data.expenses || []);
      setSummary(res.data.summary);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [page, category, startDate, endDate, sortBy, sortOrder, token]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { setPage(1); }, [category, startDate, endDate, sortBy, sortOrder]);

  async function handleDelete(id) {
    try {
      await axios.delete(`${API}/expenses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Expense deleted");
      fetchExpenses();
    } catch {
      toast.error("Failed to delete");
    }
  }

  function exportCSV() {
    const rows = [
      ["Title", "Amount", "Category", "Date"],
      ...expenses.map(e => [
        e.title,
        e.amount,
        e.category,
        new Date(e.date).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expense-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Client-side search filter on top of server results
  const filtered = expenses.filter(e =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Expense history</h1>
              <p className="text-xs text-slate-400">All your recorded transactions</p>
            </div>
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-semibold">Total spent</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(summary.grandTotal)}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-semibold">Transactions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.count}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-semibold">Average</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(summary.count > 0 ? summary.grandTotal / summary.count : 0)}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-semibold">Top category</p>
              <p className="text-lg font-bold text-slate-900 mt-1 truncate">
                {Object.entries(summary.categoryTotals).sort(([,a],[,b]) => b-a)[0]?.[0] || "—"}
              </p>
            </div>
          </div>
        )}

        {/* Search + Filter bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or category…"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition
                ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                  {ALL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">From</label>
                <input type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">To</label>
                <input type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sort</label>
                <div className="flex gap-2">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                  </select>
                  <button onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </button>
                </div>
              </div>
              {(category !== "all" || startDate || endDate) && (
                <button
                  onClick={() => { setCategory("all"); setStartDate(""); setEndDate(""); }}
                  className="col-span-2 sm:col-span-4 text-xs text-rose-500 hover:text-rose-600 text-left">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expense list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
              <p className="text-sm">No expenses found</p>
              {(category !== "all" || startDate || endDate || search) && (
                <p className="text-xs">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{expense.title}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: (CATEGORY_COLORS[expense.category] || "#64748B") + "18",
                          color: CATEGORY_COLORS[expense.category] || "#64748B",
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ backgroundColor: CATEGORY_COLORS[expense.category] || "#64748B" }} />
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(expense.date).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => handleDelete(expense.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-30 hover:bg-slate-50 transition">
                  ‹ Prev
                </button>
                <span className="text-xs text-slate-500">{page} / {pagination.totalPages}</span>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-30 hover:bg-slate-50 transition">
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}