import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import FormAlert from "../components/FormAlert.jsx";

export default function WorkerChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (newPassword !== confirmPassword) {
      setMsg("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.put("/auth/worker/change-password", {
        currentPassword,
        newPassword,
      });

      // Backend revokes the token used here as part of the password change,
      // so the old token is no longer valid on the server side either -
      // clear it locally and send the worker back to log in fresh.
      localStorage.removeItem("workerToken");
      localStorage.removeItem("workerName");
      setSuccess(true);

      setTimeout(() => navigate("/worker/login"), 1500);
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="font-display font-bold text-xl text-ink mb-4">Change Password</h1>
      <form onSubmit={submit} className="space-y-3 card p-4">
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input-field"
          autoComplete="current-password"
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input-field"
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-field"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted">
          At least 8 characters, including a letter and a number.
        </p>
        <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Updating..." : "Update Password"}
        </button>
        <FormAlert type="error">{msg}</FormAlert>
        {success && (
          <FormAlert type="success">
            Password changed. Redirecting to login...
          </FormAlert>
        )}
      </form>
    </div>
  );
}
