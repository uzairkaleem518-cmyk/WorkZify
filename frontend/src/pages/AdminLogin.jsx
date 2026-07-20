import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import FormAlert from "../components/FormAlert.jsx";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await api.post("/admin/login", { email, password });
      localStorage.setItem("adminToken", res.data.token);
      navigate("/admin/dashboard");
    } catch (err) {
      setMsg(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="font-display font-bold text-xl text-ink mb-4">Admin Login</h1>
      <form onSubmit={submit} className="space-y-3 card p-4">
        <input placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
        <button disabled={loading} className="btn-secondary w-full disabled:opacity-60">
          {loading ? "Logging in..." : "Log In"}
        </button>
        <FormAlert type="error">{msg}</FormAlert>
      </form>
    </div>
  );
}
