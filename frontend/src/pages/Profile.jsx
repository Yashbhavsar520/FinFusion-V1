import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Edit3, Check, X, Camera, Shield, Calendar } from "lucide-react";

const API = "http://localhost:4000";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
      setName(res.data.name || "");
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }

  async function handleUpdate() {
    setLoading(true);
    try {
      await axios.patch(`${API}/users/me`, { name }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(u => ({ ...u, name }));
      setEditingName(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function cancelEdit() {
    setName(user?.name || "");
    setEditingName(false);
  }

  const initials = (user?.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null;

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Saved toast */}
      {saved && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          <Check className="w-4 h-4" /> Profile updated
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Avatar + name hero card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="relative -mt-10 mb-4 w-fit">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white">
                {initials}
              </div>
            </div>

            {/* Name row */}
            <div className="flex items-start justify-between">
              <div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") cancelEdit(); }}
                      autoFocus
                      className="text-xl font-bold text-slate-900 border-b-2 border-indigo-400 bg-transparent outline-none pb-0.5 w-48"
                    />
                    <button onClick={handleUpdate} disabled={loading}
                      className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{user?.name || "Unnamed user"}</h2>
                    <button onClick={() => setEditingName(true)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 gap-4">

          {/* Email */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Email address</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{user?.email || "—"}</p>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-medium">Verified</span>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Display name</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{user?.name || "Not set"}</p>
              </div>
              <button onClick={() => setEditingName(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition">
                Edit
              </button>
            </div>
          </div>

          {/* Member since */}
          {joinDate && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Member since</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{joinDate}</p>
                </div>
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Password</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">••••••••</p>
              </div>
              <button onClick={() => navigate("/settings")}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition">
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Save button (visible when editing) */}
        {editingName && (
          <button onClick={handleUpdate} disabled={loading}
            className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? "Saving…" : "Save changes"}
          </button>
        )}

      </main>
    </div>
  );
}