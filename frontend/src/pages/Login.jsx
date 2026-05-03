import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:4000/auth/login",
        form
      );

      localStorage.setItem("token", res.data.access_token);

      navigate("/");

    } catch (err) {
      alert("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
   <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">

 <div className="flex items-center gap-2 mb-6">
        <div className="h-10 w-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-bold text-lg shadow">
          F
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            FinFusion
          </h1>
          <p className="text-white text-sm opacity-80">
            Smart finance. Simplified.
          </p>
        </div>
      </div>

  {/* 🔲 Login Card */}
  <form
    onSubmit={handleLogin}
    className="bg-white p-8 rounded-2xl shadow-2xl w-[350px] space-y-5 animate-fade-in"
  >
    <h2 className="text-2xl font-bold text-center text-gray-800">
      Welcome Back 👋
    </h2>

    {/* Email */}
    <div className="relative">
      <input
        type="email"
        required
        value={form.email}
        onChange={(e) =>
          setForm({ ...form, email: e.target.value })
        }
        className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <label className="absolute left-3 -top-2 text-sm bg-white px-1 text-gray-500">
        Email
      </label>
    </div>

    {/* Password */}
    <div className="relative">
      <input
        type="password"
        required
        value={form.password}
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
        className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <label className="absolute left-3 -top-2 text-sm bg-white px-1 text-gray-500">
        Password
      </label>
    </div>

    {/* Button */}
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-lg text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 transition"
    >
      {loading ? "Logging in..." : "Login"}
    </button>

    {/* Footer */}
    <p className="text-sm text-center text-gray-500">
      New here?{" "}
      <span
        className="text-indigo-600 cursor-pointer"
        onClick={() => navigate("/register")}
      >
        Create account
      </span>
    </p>
  </form>
</div>
  );
}