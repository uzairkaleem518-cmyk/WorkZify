import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import VerifiedSeal from "../components/VerifiedSeal.jsx";

export default function WorkerDashboard() {
  const [worker, setWorker] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("workerToken")) {
      navigate("/worker/login");
      return;
    }
    api.get("/workers/me/profile").then((res) => setWorker(res.data)).catch(() => navigate("/worker/login"));
  }, [navigate]);

  const toggleAvailability = async () => {
    const res = await api.patch("/workers/me/availability", { isAvailable: !worker.isAvailable });
    setWorker(res.data);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {}, { authRole: "worker" });
    } finally {
      localStorage.removeItem("workerToken");
      localStorage.removeItem("workerName");
      navigate("/");
    }
  };

  if (!worker) return <p className="text-center py-16 text-muted">Loading...</p>;

  const statusBadgeClass = {
    pending: "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
    suspended: "badge-suspended",
  }[worker.verificationStatus];

  const hasCnic = Boolean(worker.cnicImageUrl);
  const hasSelfie = Boolean(worker.selfieUrl);

  const statusExplainer = {
    pending:
      "Your registration is under review. Our admin team checks your CNIC and selfie before approving your profile - this usually takes 1-2 business days.",
    approved:
      "You're verified! Your profile is now visible to customers searching in your service area.",
    rejected:
      "Your application wasn't approved. Contact WorkZify support to find out why and how to resubmit your documents.",
    suspended:
      "Your account has been suspended. Contact WorkZify support to resolve this before you can appear in search again.",
  }[worker.verificationStatus];

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-ink">My Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/worker/profile/edit")}
            className="text-sm text-teal-600 dark:text-teal-300 hover:underline font-medium"
          >
            Edit Profile
          </button>
          <button onClick={logout} className="text-sm text-muted hover:text-ink underline">Logout</button>
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-display font-semibold text-ink">{worker.name}</p>
          {worker.verificationStatus === "approved" && <VerifiedSeal size={18} />}
        </div>
        <p className="text-sm text-muted">{worker.category} · {worker.serviceArea}</p>
        <span className={statusBadgeClass}>
          {worker.verificationStatus === "pending" && "Pending admin approval"}
          {worker.verificationStatus === "approved" && "Approved"}
          {worker.verificationStatus === "rejected" && "Rejected"}
          {worker.verificationStatus === "suspended" && "Suspended"}
        </span>

        <p className="text-sm text-muted pt-1">{statusExplainer}</p>

        {worker.verificationStatus === "pending" && (
          <div className="pt-2 space-y-1 border-t border-border mt-2">
            <p className="text-xs font-medium text-ink pt-2">Documents submitted for review</p>
            <div className="flex items-center gap-2 text-sm">
              <span className={hasCnic ? "text-teal-600 dark:text-teal-300" : "text-marigold-600 dark:text-marigold-400"}>
                {hasCnic ? "✓" : "○"}
              </span>
              <span className="text-ink/80">CNIC image {hasCnic ? "" : "- not received"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={hasSelfie ? "text-teal-600 dark:text-teal-300" : "text-marigold-600 dark:text-marigold-400"}>
                {hasSelfie ? "✓" : "○"}
              </span>
              <span className="text-ink/80">Selfie {hasSelfie ? "" : "- not received"}</span>
            </div>
            {(!hasCnic || !hasSelfie) && (
              <p className="text-xs text-marigold-600 dark:text-marigold-400 pt-1">
                Missing documents can delay approval. Contact WorkZify support if you believe this is an error.
              </p>
            )}
          </div>
        )}
      </div>

      {worker.verificationStatus === "approved" && (
        <div className="card p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-ink">Available for work</span>
            <input
              type="checkbox"
              checked={worker.isAvailable}
              onChange={toggleAvailability}
              className="w-5 h-5 accent-teal-500"
            />
          </label>
        </div>
      )}

      <div className="card p-4 text-sm text-ink space-y-1.5">
        <p><span className="text-muted">Rating:</span> {worker.ratingAverage} ★ ({worker.ratingCount} reviews)</p>
        <p><span className="text-muted">Fee:</span> {worker.fee || "Not set"}</p>
        <p><span className="text-muted">Experience:</span> {worker.experienceYears} yrs</p>
      </div>
    </div>
  );
}
