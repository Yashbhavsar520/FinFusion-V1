import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // ✅ moved inside

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError(""); // clear old errors

    try {
      await axios.post("http://localhost:4000/auth/register", form);

      alert("Account created successfully!");
      navigate("/login");

    } catch (err) {
      console.error(err);

      const message =
        err.response?.data?.message || "Something went wrong";

      setError(message); // ✅ correct order

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">

      {/* Branding */}
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

      {/* Card */}
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded-2xl shadow-2xl w-[350px] space-y-5 animate-fade-in"
      >
        <h2 className="text-2xl font-bold text-center text-gray-800">
          Create Account ✨
        </h2>

        {/* 🔴 ERROR MESSAGE */}
        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
{/* Name */}
<div className="relative">
  <input
    type="text"
    required
    value={form.name}
    onChange={(e) =>
      setForm({ ...form, name: e.target.value })
    }
    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
  />
  <label className="absolute left-3 -top-2 text-sm bg-white px-1 text-gray-500">
    Name
  </label>
</div>

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
          {loading ? "Creating..." : "Create Account"}
        </button>

        {/* Footer */}
        <p className="text-sm text-center text-gray-500">
          Already have an account?{" "}
          <span
            className="text-indigo-600 cursor-pointer"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </form>
    </div>
  );
}