import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * SplitwiseModule.jsx — Pretty UI upgrade
 * - Same logic as before (multi-group split, balances, simplification)
 * - Upgraded styling with Tailwind-friendly classes, avatars, soft shadows, gradients and micro-interactions
 * - Drop into src/components or src/pages. Replace your existing GroupExpenses.jsx with this file.
 *
 * Props:
 *  - primaryPersonId (optional)
 *  - initialGroups (optional)
 *  - onChange (optional)
 */

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function computeBalancesForGroup(people, expenses) {
  const balances = {};
  people.forEach((p) => (balances[p.id] = 0));

  (expenses || []).forEach((e) => {
    const amount = Number(e.amount) || 0;
    const payerId = e.userId ?? e.paidBy;

    if (e.splits && e.splits.length > 0) {
      // ✅ Primary path — splits are stored per-person, use them directly
      e.splits.forEach((s) => {
        const uid = s.userId ?? s.personId;
        if (uid && balances[uid] !== undefined) {
          balances[uid] -= Number(s.share);
        }
      });
    } else {
      // ⚠️ Fallback — only runs if splits weren't returned from API
      // Divide only among people who appear as payers across all expenses
      // Never use current people.length (causes new-member contamination)
      const splitCount = people.length || 1;
      const share = amount / splitCount;
      people.forEach((p) => {
        balances[p.id] -= share;
      });
      console.warn(`Expense "${e.title}" has no splits — check findAll includes splits`);
    }

    // ✅ Always credit the payer the full amount
    if (payerId && balances[payerId] !== undefined) {
      balances[payerId] += amount;
    }
  });

  return balances;
}

export function simplifyDebts(balances) {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([id, bal]) => {
    if (bal < -0.005) debtors.push({ id, amount: -bal });
    else if (bal > 0.005) creditors.push({ id, amount: bal });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const tx = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const transfer = Math.min(d.amount, c.amount);
    tx.push({ from: d.id, to: c.id, amount: Math.round((transfer + Number.EPSILON) * 100) / 100 });
    d.amount = Math.round((d.amount - transfer + Number.EPSILON) * 100) / 100;
    c.amount = Math.round((c.amount - transfer + Number.EPSILON) * 100) / 100;
    if (Math.abs(d.amount) < 0.01) i++;
    if (Math.abs(c.amount) < 0.01) j++;
  }
  return tx;
}

export default function SplitwiseModule({ primaryPersonId = null, initialGroups = null, onChange = null }) {


  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePaidBy, setNewExpensePaidBy] = useState('');
  const [useCustomSplits, setUseCustomSplits] = useState(false);
  const [customSplits, setCustomSplits] = useState({});
  const inputRef = useRef(null);
  const [aiSummary, setAiSummary] = useState("Generating insights...");
  const [settlements, setSettlements] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberName, setMemberName] = useState("");
  const memberSectionRef = useRef(null);
  const membersRef = useRef(null);
  const [splitType, setSplitType] = useState("equal");
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    if (onChange) onChange(groups);
  }, [groups, onChange]);

  const getPeople = (group) =>
    group?.GroupMember?.map((m) => m.user) || [];

  const safeGroup = useMemo(() => {
    const groupList = Array.isArray(groups) ? groups : [];

    return (
      groupList.find((g) => g.id === selectedGroupId) || {
        id: null,
        name: "No Group Yet",
        expenses: [],
        GroupMember: [],
      }
    );
  }, [groups, selectedGroupId]);

  useEffect(() => {
    console.log("People:", getPeople(safeGroup));
    console.log("Expenses:", safeGroup?.expenses);
    console.log("Settlements:", settlements);
  }, [safeGroup, settlements]);
  async function fetchGroups() {
    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:4000/groups", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    console.log("GROUP API DATA:", data);

    const groupList = Array.isArray(data) ? data : [];


    setGroups(groupList);
    setSelectedGroupId(groupList[0]?.id || null);
  }

  useEffect(() => {
    fetchGroups();
  }, []);
  const groupBalances = useMemo(() => {
    if (!safeGroup) return {};

    const balances = computeBalancesForGroup(
      getPeople(safeGroup),
      safeGroup?.expenses || []
    );

    settlements
      .filter(
        (s) =>
          s.groupId === safeGroup.id &&
          getPeople(safeGroup).some((p) => p.id === s.fromUser) &&
          getPeople(safeGroup).some((p) => p.id === s.toUser)
      )
      .forEach((s) => {
        balances[s.fromUser] += s.amount;
        balances[s.toUser] -= s.amount;
      });

    return balances;
  }, [safeGroup, settlements]);


  const groupTransactions = useMemo(() => simplifyDebts(groupBalances), [groupBalances]);

  const groupTotal = safeGroup?.expenses?.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  ) || 0;
  const overall = useMemo(() => {
    const totalBalances = {};

    (Array.isArray(groups) ? groups : []).forEach((g) => {
      const b = computeBalancesForGroup(
        (g.GroupMember || []).map(m => m.user),
        g.expenses || []
      );
      Object.entries(b).forEach(([id, bal]) => {
        if (!id) return;
        totalBalances[id] = (totalBalances[id] || 0) + bal;
      });
    });

    Object.keys(totalBalances).forEach((k) => {
      totalBalances[k] = Math.round((totalBalances[k] + Number.EPSILON) * 100) / 100;
    });

    return totalBalances;
  }, [groups]);

  const splitRunningTotal = useMemo(() => {
    if (splitType === "equal") {
      // For equal split, the total is just the expense amount itself
      return Number(newExpenseAmount || 0);
    }
    return Object.values(customSplits).reduce(
      (sum, v) => sum + Number(v || 0), 0
    );
  }, [customSplits, splitType, newExpenseAmount]);

  const remaining =
    splitType === "percentage"
      ? Math.max(0, 100 - splitRunningTotal)
      : Math.max(0, Number(newExpenseAmount || 0) - splitRunningTotal);

  const balancesWithNames = {};

  Object.entries(groupBalances).forEach(([id, amount]) => {
    balancesWithNames[nameOf(id)] = amount;
  });


  useEffect(() => {
    async function fetchSettlements() {
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:4000/settlements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setSettlements(data);
    }

    fetchSettlements();
  }, []);

  async function addGroup() {
    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:4000/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newGroupName }),
    });

    const newGroup = await res.json();

    const safeNewGroup = {
      ...newGroup,
      GroupMember: newGroup.GroupMember || [],
      expenses: newGroup.expenses || [],
    };

    setGroups((prev) => [...prev, safeNewGroup]);
    setSelectedGroupId(newGroup.id);
    setNewGroupName("");
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        membersRef.current &&
        !membersRef.current.contains(e.target) &&
        memberSectionRef.current &&
        !memberSectionRef.current.contains(e.target)
      ) {
        setSelectedMember(null);
        setMemberName("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleDeleteGroup(groupId) {
    const token = localStorage.getItem("token");

    await fetch(`http://localhost:4000/groups/${groupId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }


  function canDeleteGroup(groupBalances, people) {
    if (!people.length) return true;
    return Object.values(groupBalances).every(
      (bal) => Math.abs(bal) < 0.01
    );
  }

  async function addPersonToCurrent(name) {
    const n = (name || newPersonName).trim();
    if (!n) return;
    const p = { id: uid('u'), name: n };
    await fetchGroups();
    setNewPersonName('');
  }

  async function addExpenseToCurrent() {
    const amount = Number(newExpenseAmount);

    if (!newExpenseTitle.trim() || isNaN(amount) || amount <= 0) {
      return alert("Provide title and valid amount");
    }

    if (!newExpensePaidBy) {
      return alert("Choose payer");
    }

    if (!safeGroup?.id) {
      return alert("Please select a group first");
    }

    const people = getPeople(safeGroup);
    let splits = [];

    // Equal split
    if (splitType === "equal") {
      const base = Math.floor((amount / people.length) * 100) / 100;
      let remainder = Number((amount - base * people.length).toFixed(2));

      splits = people.map((p, index) => ({
        personId: p.id,
        share: index === 0 ? Number((base + remainder).toFixed(2)) : base,
      }));
    }

    // Percentage split
    else if (splitType === "percentage") {
      let totalPercent = 0;

      splits = people.map((p) => {
        const percent = Number(customSplits[p.id] || 0);
        totalPercent += percent;

        return {
          personId: p.id,
          share: Number(((amount * percent) / 100).toFixed(2)),
        };
      });

      if (Number(totalPercent.toFixed(2)) !== 100) {
        return alert("Total % must be 100");
      }
    }

    // Exact split
    else if (splitType === "exact") {
      let total = 0;

      splits = people.map((p) => {
        const val = Number(customSplits[p.id] || 0);
        total += val;

        return {
          personId: p.id,
          share: val,
        };
      });

      if (Number(total.toFixed(2)) !== Number(amount.toFixed(2))) {
        return alert("Total must match expense amount");
      }
    }

    const payload = {
      title: newExpenseTitle.trim(),
      amount,
      category: "General",
      groupId: safeGroup.id,
      userId: newExpensePaidBy,
      splits,
    };

    try {
      const token = localStorage.getItem("token");

      const res = await fetch("http://localhost:4000/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const savedExpense = await res.json();

      if (!res.ok) {
        console.error(savedExpense);
        return alert("Failed to add expense");
      }

      console.log("Saved Expense:", savedExpense);
      console.log("Calculated splits:", splits);

      await fetchGroups();

      setNewExpenseTitle("");
      setNewExpenseAmount("");
      setNewExpensePaidBy("");
      setUseCustomSplits(false);
      setCustomSplits({});
    } catch (err) {
      console.error(err);
      alert("Failed to add expense");
    }
  }

  async function handleGroupReceiptScan(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can trigger onChange again
    e.target.value = '';

    setScanLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:4000/expenses/scan-receipt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        // ✅ Don't set Content-Type manually — browser sets multipart boundary
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Failed to scan receipt');
        return;
      }

      const data = await res.json();

      // ✅ Pre-fill the expense form fields
      setNewExpenseTitle(data.description || 'Scanned Expense');
      setNewExpenseAmount(String(data.amount || ''));

      // Scroll to the add expense form so user sees the pre-fill
      document.querySelector('section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

    } catch (err) {
      console.error(err);
      alert('Failed to scan receipt');
    } finally {
      setScanLoading(false);
    }
  }

  async function removeExpenseFromCurrent(expId) {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:4000/expenses/${expId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchGroups();
    } catch (err) {
      console.error("Failed to remove expense", err);
      alert("Failed to remove expense");
    }
  }

  function nameOf(id) {
    for (const g of groups) {
      const p = (g.GroupMember || []).map(m => m.user).find((x) => x.id === id);
      if (p) return p.name;
    }
    return typeof id === "string" ? "Unknown Member" : "Unknown";
  }

  function exportGroupSimplified() {
    const text = groupTransactions
      .map((t) => `${nameOf(t.from)} -> ${nameOf(t.to)}: ₹${t.amount.toFixed(2)}`)
      .join('\n');
    navigator.clipboard?.writeText(text).then(() => alert('Copied group simplified transactions'), () => alert('Copy failed'));
  }

  // small helpers for avatar
  function avatarInitials(name) {
    return name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  }

  async function handleAddMember() {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:4000/groups/add-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        groupId: safeGroup.id,
        name: memberName,
      }),
    });

    await fetchGroups();

    setMemberName("");
  }
  function handleEditMember() {
    if (!selectedMember) return;
    setGroups(prev =>
      prev.map(g =>
        g.id === safeGroup.id
          ? {
            ...g,
            GroupMember: g.GroupMember.map(m =>   // ✅ was g.people
              m.user.id === selectedMember.id
                ? { ...m, user: { ...m.user, name: memberName } }
                : m
            ),
          }
          : g
      )
    );
    setSelectedMember(null);
    setMemberName("");
  }

  async function handleDeleteMember() {
    if (!selectedMember) return;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `http://localhost:4000/groups/${safeGroup.id}/members/${selectedMember.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) { alert("Failed to delete member"); return; }

      await fetchGroups();
    } catch (err) {
      alert("Failed to delete member");
    }

    setSelectedMember(null);
    setMemberName("");
  }
  useEffect(() => {
    if (!safeGroup?.id) return;

    async function fetchSummary() {
      try {
        const token = localStorage.getItem("token");
        const user = JSON.parse(atob(token.split(".")[1]));

        const readableBalances = {};

        Object.entries(groupBalances).forEach(([id, val]) => {
          readableBalances[nameOf(id)] = val;
        });

        const res = await fetch("http://localhost:8000/ai-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            balances: readableBalances,
            primaryUser: user.name || "User",
          }),
        });

        const data = await res.json();
        setAiSummary(data.summary);
      } catch {
        setAiSummary("Unable to generate summary");
      }
    }

    fetchSummary();
  }, [groupBalances, safeGroup?.id]);

  async function handleSettle(transaction) {
    const token = localStorage.getItem("token");

    const payload = {
      groupId: safeGroup.id,
      fromUser: transaction.from,
      toUser: transaction.to,
      amount: Number(transaction.amount),
    };

    console.log("Settlement payload:", payload);

    const res = await fetch("http://localhost:4000/settlements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(data);

    const updated = await fetch("http://localhost:4000/settlements", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    setSettlements(Array.isArray(updated) ? updated : []);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50 py-8 px-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          {/* LEFT SIDE */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-gray-100 transition mt-1"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>

            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Groups
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage group expenses, track balances, and settle up with ease.
              </p>
            </div>
          </div>
          <div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGroupModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              + New group
            </button>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-6">
          <aside className="col-span-1 sticky top-6">
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <h3 className="text-sm font-medium mb-2">Your groups</h3>
              <ul className="space-y-2">
                {groups.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No groups yet
                  </p>
                )}
                {groups.map((g) => (
                  <li key={g.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${g.id === selectedGroupId ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'}`} onClick={() => setSelectedGroupId(g.id)}>
                    <div>
                      <div className="text-sm font-semibold">{g.name}</div>
                      <div className="text-xs text-gray-400">{(g.GroupMember || []).map(m => m.user).length} members • {(g.expenses || []).length} expenses</div>
                    </div>
                    <div className="text-gray-300 text-sm">›</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 bg-white rounded-2xl p-4 shadow-md">
              <h4 className="text-sm font-medium mb-2">Overall balances</h4>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(overall).slice(0, 6).map(([id, bal]) => (
                  <div key={id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">{avatarInitials(nameOf(id))}</div>
                      <div className="text-sm">{nameOf(id)}</div>
                    </div>
                    <div className={`font-semibold ${bal > 0 ? 'text-green-600' : 'text-orange-600'}`}>{bal > 0 ? `+₹${bal.toFixed(2)}` : `-₹${Math.abs(bal).toFixed(2)}`}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 bg-white rounded-2xl p-4 shadow-md">
              <h4 className="text-sm font-medium mb-2">Summary</h4>

              {aiSummary ? (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {aiSummary}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  {aiSummary}
                </p>)}
            </div>

            <div className="mt-4 bg-white rounded-2xl p-4 shadow-md">
              <h4 className="text-sm font-medium mb-2">Recent activity</h4>

              <div className="space-y-1">
                {(safeGroup?.expenses || []).slice(-3).reverse().map(e => (
                  <div key={e.id} className="text-sm text-gray-500 leading-5">
                    {nameOf(e.userId)} added ₹{Number(e.amount).toFixed(2)}
                  </div>
                ))}
              </div>
            </div>

          </aside>

          <main className="col-span-3">
            <div className="bg-white rounded-2xl p-5 shadow-lg mb-6">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">{safeGroup?.name}</h2>
                    <p className="text-sm text-gray-500">
                      {getPeople(safeGroup).length} members • {(safeGroup?.expenses || []).length} expenses                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">Group total</p>
                    <p className="text-xl font-semibold text-indigo-600">
                      ₹{groupTotal.toFixed(2)}
                    </p>

                    <button
                      onClick={() => handleDeleteGroup(safeGroup.id)}
                      disabled={!canDeleteGroup(groupBalances, getPeople(safeGroup))}
                      className={`mt-2 px-3 py-1 text-sm rounded-md transition
    ${canDeleteGroup(groupBalances, getPeople(safeGroup))
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div ref={membersRef} className="mt-4 flex flex-wrap gap-3">
                {getPeople(safeGroup).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedMember(p);
                      setMemberName(p.name);

                      memberSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer
    ${selectedMember?.id === p.id
                        ? "bg-indigo-100 ring-2 ring-indigo-300"
                        : "hover:bg-gray-100"
                      }
    ${primaryPersonId === p.id
                        ? "ring-2 ring-indigo-200 bg-indigo-50"
                        : "bg-gray-50"
                      }
    shadow-sm
  `}
                  >                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${primaryPersonId === p.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'} shadow`}>{avatarInitials(p.name)}</div>
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className={`text-xs ${groupBalances[p.id] > 0 ? 'text-green-600' : 'text-orange-600'}`}>{groupBalances[p.id] ? (groupBalances[p.id] > 0 ? `+₹${groupBalances[p.id].toFixed(2)}` : `-₹${Math.abs(groupBalances[p.id]).toFixed(2)}`) : '₹0.00'}</div>
                    </div>
                  </div>
                ))}

              </div>

            </div>

            <div className="grid grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl p-5 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Add expense</h3>

                    {/* ✅ Scan Receipt button */}
                    <label className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition
      ${scanLoading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}
    `}>
                      {scanLoading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Scanning…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4m10-16h-4a2 2 0 00-2 2v0M21 15v4a2 2 0 01-2 2h-4" />
                          </svg>
                          Scan Bill
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={scanLoading}
                        onChange={handleGroupReceiptScan}
                      />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <input value={newExpenseTitle} onChange={(e) => setNewExpenseTitle(e.target.value)} placeholder="Title" className="w-full border border-gray-200 rounded-lg p-2" />
                    <input value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} placeholder="Amount" className="w-full border border-gray-200 rounded-lg p-2" />
                    <select value={newExpensePaidBy} onChange={(e) => setNewExpensePaidBy(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2">
                      <option value="">Select payer</option>
                      {getPeople(safeGroup).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="flex gap-3 text-sm">
                      <label>
                        <input
                          type="radio"
                          value="equal"
                          checked={splitType === "equal"}
                          onChange={() => setSplitType("equal")}
                        /> Equal
                      </label>

                      <label>
                        <input
                          type="radio"
                          value="percentage"
                          checked={splitType === "percentage"}
                          onChange={() => setSplitType("percentage")}
                        /> %
                      </label>

                      <label>
                        <input
                          type="radio"
                          value="exact"
                          checked={splitType === "exact"}
                          onChange={() => setSplitType("exact")}
                        /> Exact
                      </label>
                    </div>
                    {splitType !== "equal" && (
                      <div className="space-y-2">
                        {getPeople(safeGroup).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <div className="w-28 text-sm">{p.name}</div>

                            <input
                              placeholder={
                                splitType === "percentage" ? "%" : "amount"
                              }
                              value={customSplits[p.id] || ""}
                              onChange={(e) =>
                                setCustomSplits((s) => ({
                                  ...s,
                                  [p.id]: e.target.value,
                                }))
                              }
                              className="border p-2 rounded flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <p>
                        Current total:{" "}
                        {splitType === "percentage"
                          ? `${splitRunningTotal}%`
                          : `₹${splitRunningTotal}`}
                      </p>

                      <p
                        className={
                          remaining === 0 ? "text-green-500" : "text-red-400"
                        }
                      >
                        Remaining:{" "}
                        {splitType === "percentage"
                          ? `${remaining}%`
                          : `₹${remaining}`}
                      </p>
                    </div>
                    {splitType === "percentage" && (
                      <p className="text-xs text-gray-400 mt-1">
                        Total must equal 100%
                      </p>
                    )}

                    {splitType === "exact" && (
                      <p className="text-xs text-gray-400 mt-1">
                        Total must equal ₹{newExpenseAmount || 0}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button onClick={addExpenseToCurrent} className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium shadow">Add</button>
                      <button onClick={() => {
                        setNewExpenseTitle(''); setNewExpenseAmount(''); setUseCustomSplits(false); setSplitType("equal");
                        setCustomSplits({}); setCustomSplits({});
                      }} className="px-4 py-2 rounded-lg bg-gray-100">Reset</button>
                    </div>

                    <hr />

                    <h4 className="font-medium">Expenses</h4>
                    <ul className="divide-y mt-2">
                      {(safeGroup?.expenses || []).map((e) => (<li key={e.id} className="py-3 flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{e.title} <span className="text-sm text-gray-400">• ₹{Number(e.amount).toFixed(2)}</span></div>
                          <div className="text-xs text-gray-400">paid by {nameOf(e.userId)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeExpenseFromCurrent(e.id)} className="text-sm text-red-500">Remove</button>
                        </div>
                      </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="bg-white rounded-2xl p-5 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Balances & Settlements</h3>
                    <button onClick={exportGroupSimplified} className="text-sm px-3 py-1 rounded-lg bg-indigo-600 text-white">Copy</button>
                  </div>

                  <div className="space-y-3">
                    {getPeople(safeGroup).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold">{avatarInitials(p.name)}</div>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-gray-400">{p.id === newExpensePaidBy ? 'recent payer' : ''}</div>
                          </div>
                        </div>
                        <div className={`font-semibold ${groupBalances[p.id] > 0 ? 'text-green-600' : 'text-orange-600'}`}>{groupBalances[p.id] ? (groupBalances[p.id] > 0 ? `+₹${groupBalances[p.id].toFixed(2)}` : `-₹${Math.abs(groupBalances[p.id]).toFixed(2)}`) : '₹0.00'}</div>
                      </div>
                    ))}

                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Simplified transactions</h4>
                      {groupTransactions.length ? (
                        <ul className="space-y-2">
                          {groupTransactions.map((t, idx) => (
                            <li key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold">{avatarInitials(nameOf(t.from))}</div>
                                <div className="text-sm">{nameOf(t.from)} pays <span className="font-semibold">{nameOf(t.to)}</span></div>
                              </div>
                              <div className="font-semibold">₹{t.amount.toFixed(2)}</div>
                              <button
                                className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                                onClick={() => handleSettle(t)}
                              >
                                Settle
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-gray-400">No settlements — everyone is settled up.</div>
                      )}
                    </div>

                  </div>
                </section>
            </div>

            <div ref={memberSectionRef} className="mt-6 bg-white rounded-2xl p-4 shadow-md">
              <h4 className="font-semibold mb-3">Add member</h4>
              <div className="flex gap-2 mt-2">
                <input
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Name"
                  className="border border-gray-200 p-2 rounded-lg flex-1"
                />

                {/* Replace your old Add button with this */}
                <button
                  onClick={handleAddMember}
                  className="bg-indigo-500 text-white px-3 py-1 rounded"
                >
                  Add
                </button>

                {selectedMember && (
                  <>
                    <button
                      onClick={handleEditMember}
                      className="bg-yellow-500 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>

                    <button
                      onClick={handleDeleteMember}
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
            {showGroupModal && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-[350px] shadow-xl animate-slide-in">

                  <h3 className="text-lg font-semibold mb-4">
                    Create New Group
                  </h3>

                  <input
                    placeholder="Enter group name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 mb-4"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowGroupModal(false)}
                      className="px-4 py-2 rounded-lg bg-gray-100"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => {
                        addGroup();
                        setShowGroupModal(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                    >
                      Create
                    </button>
                  </div>

                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
