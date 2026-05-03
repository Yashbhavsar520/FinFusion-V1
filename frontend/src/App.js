import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import GroupExpenses from './pages/GroupExpenses';
import Budgets from './pages/Budgets';
import Forecasting from './pages/Forecasting';
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Subscription from "./pages/Subscription";
import ExpenseHistory from "./pages/ExpenseHistory";


function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/groups" element={<GroupExpenses />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/forecast" element={<Forecasting />} />
          <Route path="/expenses/history" element={<ExpenseHistory />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;