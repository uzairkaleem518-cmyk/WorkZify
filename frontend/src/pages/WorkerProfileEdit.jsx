import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api.js";
import FormAlert from "../components/FormAlert.jsx";

export default function WorkerProfileEdit() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null); // null until profile is loaded
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("workerToken")) {
      navigate("/worker/login");
      return;
    }

    Promise.all([
      api.get("/workers/categories"),
      api.get("/workers/me/profile"),
    ])
      .then(([categoriesRes, profileRes]) => {
        setCategories(categoriesRes.data);
        const w = profileRes.data;
        setForm({
          name: w.name || "",
          email: w.email || "",
          category: w.category || "",
          experienceYears: w.experienceYears ?? 0,
          fee: w.fee || "",
          languages: (w.languages || []).join(", "),
          serviceArea: w.serviceArea || "",
          bio: w.bio || "",
          photoUrl: w.photoUrl || "",
        });
      })
      .catch(() => navigate("/worker/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const update = (field) => (e) => {
    const value = e.target.type === "number" ? e.target.value : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setSuccess(false);

    if (form.name.trim().length < 2) {
      setMsg("Name must be at least 2 characters.");
      return;
    }
    if (form.bio.length > 500) {
      setMsg("Bio must be 500 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        experienceYears: form.experienceYears === "" ? 0 : Number(form.experienceYears),
        languages: form.languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
      };

      const res = await api.put("/workers/me/profile", payload);
      setForm({
        ...form,
        ...res.data,
        languages: (res.data.languages || []).join(", "),
      });
      setSuccess(true);
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <p className="text-center py-16 text-muted">Loading...</p>;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-ink">Edit Profile</h1>
        <button
          onClick={() => navigate("/worker/dashboard")}
          className="text-sm text-muted hover:text-ink underline"
        >
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3 card p-4">
        <div>
          <label className="text-xs text-muted">Name</label>
          <input value={form.name} onChange={update("name")} className="input-field" />
        </div>

        <div>
          <label className="text-xs text-muted">Email</label>
          <input type="email" value={form.email} onChange={update("email")} className="input-field" />
        </div>

        <div>
          <label className="text-xs text-muted">Trade Category</label>
          <select value={form.category} onChange={update("category")} className="input-field">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Experience (years)</label>
            <input
              type="number"
              min="0"
              max="70"
              value={form.experienceYears}
              onChange={update("experienceYears")}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Fee</label>
            <input
              placeholder="e.g. PKR 500/hour"
              value={form.fee}
              onChange={update("fee")}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">Service Area</label>
          <input value={form.serviceArea} onChange={update("serviceArea")} className="input-field" />
        </div>

        <div>
          <label className="text-xs text-muted">Languages</label>
          <input
            placeholder="e.g. Urdu, English"
            value={form.languages}
            onChange={update("languages")}
            className="input-field"
          />
          <p className="text-xs text-muted mt-0.5">Comma-separated</p>
        </div>

        <div>
          <label className="text-xs text-muted">Bio</label>
          <textarea
            value={form.bio}
            onChange={update("bio")}
            maxLength={500}
            rows={3}
            className="input-field resize-none"
          />
          <p className="text-xs text-muted mt-0.5 text-right">{form.bio.length}/500</p>
        </div>

        <div>
          <label className="text-xs text-muted">Photo URL</label>
          <input
            placeholder="https://..."
            value={form.photoUrl}
            onChange={update("photoUrl")}
            className="input-field"
          />
          <p className="text-xs text-muted mt-0.5">
            Paste a Cloudinary image link. Direct photo upload isn't wired up here yet.
          </p>
        </div>

        <button disabled={saving} className="btn-primary w-full disabled:opacity-60">
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <FormAlert type="error">{msg}</FormAlert>
        {success && <FormAlert type="success">Profile updated successfully.</FormAlert>}
      </form>
    </div>
  );
}
