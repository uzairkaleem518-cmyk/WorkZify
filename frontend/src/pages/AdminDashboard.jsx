import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";

export default function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [workers, setWorkers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  const loadWorkers = async (status) => {
    const res = await api.get("/admin/workers", { params: status !== "all" ? { status } : {} });
    setWorkers(res.data);
  };

  const loadReviews = async () => {
    const res = await api.get("/admin/reviews");
    setReviews(res.data);
  };

  const loadStats = async () => {
    const res = await api.get("/admin/stats");
    setStats(res.data);
  };

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin/login");
      return;
    }
    loadStats();
  }, [navigate]);

  useEffect(() => {
    if (tab === "reviews") loadReviews();
    else if (tab !== "stats") loadWorkers(tab);
  }, [tab]);

  const act = async (id, action) => {
    await api.patch(`/admin/workers/${id}/${action}`);
    loadWorkers(tab);
  };

  const deleteReview = async (id) => {
    await api.delete(`/admin/reviews/${id}`);
    loadReviews();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {}, { authRole: "admin" });
    } finally {
      localStorage.removeItem("adminToken");
      navigate("/admin/login");
    }
  };

  const statusBadgeClass = {
    pending: "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
    suspended: "badge-suspended",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-ink">Admin Dashboard</h1>
        <button onClick={logout} className="text-sm text-muted hover:text-ink underline">Logout</button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {[
            ["Workers", stats.totalWorkers],
            ["Active now", stats.activeWorkers],
            ["Pending", stats.pendingWorkers],
            ["Customers", stats.totalCustomers],
            ["Reviews", stats.totalReviews],
            ["Avg ★", stats.averageRating],
          ].map(([label, val]) => (
            <div key={label} className="card p-2.5">
              <p className="text-lg font-display font-bold text-teal-600 dark:text-teal-400">{val}</p>
              <p className="text-[10px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 text-sm border-b border-border overflow-x-auto no-scrollbar">
        {["pending", "approved", "rejected", "suspended", "reviews"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 capitalize whitespace-nowrap transition-colors ${
              tab === t
                ? "border-b-2 border-teal-500 text-teal-600 dark:text-teal-400 font-semibold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== "reviews" && (
        <div className="space-y-2">
          {workers.length === 0 && <p className="text-sm text-muted text-center py-8">No workers here.</p>}
          {workers.map((w) => (
            <div key={w._id} className="card p-3 flex items-start justify-between gap-3">
              <div className="flex gap-3">
                {w.photoUrl && (
                  <div className="flex gap-1.5 shrink-0">
                    {[
                      ["Photo", w.photoUrl],
                    ].map(([label, url]) => (
                      <a key={label} href={url} target="_blank" rel="noreferrer" title={`View full-size ${label}`}>
                        <img
                          src={url}
                          alt={label}
                          className="w-12 h-12 rounded-lg object-cover border border-border hover:border-teal-500 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm text-ink">{w.name} <span className="text-muted">· {w.category}</span></p>
                  <p className="text-xs text-muted">{w.phone} · {w.serviceArea} {w.cnicNumber && `· CNIC: ${w.cnicNumber}`}</p>
                  <span className={`inline-block mt-1 ${statusBadgeClass[w.verificationStatus]}`}>
                    {w.verificationStatus}
                  </span>
                  {(w.identityDocuments?.cnicUrl || w.identityDocuments?.selfieUrl) && (
                    <div className="flex gap-2 mt-2">
                      {w.identityDocuments.cnicUrl && <a href={w.identityDocuments.cnicUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-600 dark:text-teal-300 underline">View CNIC</a>}
                      {w.identityDocuments.selfieUrl && <a href={w.identityDocuments.selfieUrl} target="_blank" rel="noreferrer" className="text-xs text-teal-600 dark:text-teal-300 underline">View selfie</a>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {w.verificationStatus !== "approved" && (
                  <button onClick={() => act(w._id, "approve")} className="text-xs bg-teal-500 text-white px-2.5 py-1.5 rounded-full font-medium hover:bg-teal-600">Approve</button>
                )}
                {w.verificationStatus !== "rejected" && (
                  <button onClick={() => act(w._id, "reject")} className="text-xs bg-rani-500 text-white px-2.5 py-1.5 rounded-full font-medium hover:bg-rani-600">Reject</button>
                )}
                {w.verificationStatus === "approved" && (
                  <button onClick={() => act(w._id, "suspend")} className="text-xs bg-surface2 text-ink border border-border px-2.5 py-1.5 rounded-full font-medium hover:border-teal-500">Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-2">
          {reviews.length === 0 && <p className="text-sm text-muted text-center py-8">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r._id} className="card p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{r.worker?.name} <span className="text-muted">← {r.customer?.name}</span></p>
                <p className="text-xs text-muted">{r.rating}★ {r.comment}</p>
              </div>
              <button onClick={() => deleteReview(r._id)} className="text-xs bg-rani-500 text-white px-2.5 py-1.5 rounded-full font-medium shrink-0 hover:bg-rani-600">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
