import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api.js";
import StarRating from "../components/StarRating.jsx";
import VerifiedSeal from "../components/VerifiedSeal.jsx";

export default function WorkerProfile() {
  const { id } = useParams();
  const [worker, setWorker] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");

  const isCustomerLoggedIn = !!localStorage.getItem("customerToken");

  const load = async () => {
    const w = await api.get(`/workers/${id}`);
    setWorker(w.data);
    const r = await api.get(`/reviews`, { params: { workerId: id } });
    setReviews(r.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitReview = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/reviews", { workerId: id, rating: Number(rating), comment });
      setComment("");
      setMsg("Thanks for your review!");
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not submit review");
    }
  };

  if (!worker) return <p className="text-center py-16 text-muted">Loading...</p>;

  const phone = worker.phone;
  const waLink = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      <div className="card p-4 flex gap-4 items-center">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-teal-50 dark:bg-teal-500/10 ring-2 ring-teal-500/40
                          flex items-center justify-center text-teal-600 font-display font-bold text-2xl overflow-hidden">
            {worker.photoUrl ? (
              <img src={worker.photoUrl} alt={worker.name} className="w-full h-full object-cover" />
            ) : (
              worker.name.charAt(0)
            )}
          </div>
          <span className="absolute -bottom-1 -right-1">
            <VerifiedSeal size={24} />
          </span>
        </div>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-ink">{worker.name}</h1>
          <p className="text-sm text-muted">{worker.category} · {worker.serviceArea}</p>
          <StarRating value={worker.ratingAverage} count={worker.ratingCount} />
          {worker.isAvailable && <span className="badge-available inline-block mt-1.5">Available now</span>}
        </div>
      </div>

      {worker.bio && (
        <div className="card p-4 text-sm text-ink/90 leading-relaxed">{worker.bio}</div>
      )}

      <div className="card p-4 text-sm text-ink grid grid-cols-2 gap-3">
        <div><span className="text-muted block text-xs">Experience</span>{worker.experienceYears || 0} yrs</div>
        <div><span className="text-muted block text-xs">Fee</span>{worker.fee || "N/A"}</div>
        {worker.languages?.length > 0 && (
          <div className="col-span-2"><span className="text-muted block text-xs">Languages</span>{worker.languages.join(", ")}</div>
        )}
      </div>

      <div className="flex gap-3">
        <a href={`tel:${phone}`} className="btn-primary flex-1">📞 Call</a>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn-accent flex-1">💬 WhatsApp</a>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-display font-semibold text-ink">Reviews ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r._id} className="border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-ink">{r.customer?.name || "Customer"}</span>
              <StarRating value={r.rating} size="text-xs" />
            </div>
            {r.comment && <p className="text-sm text-muted">{r.comment}</p>}
          </div>
        ))}

        <div className="pt-2">
          {isCustomerLoggedIn ? (
            <form onSubmit={submitReview} className="space-y-2">
              <select value={rating} onChange={(e) => setRating(e.target.value)} className="input-field">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>
                ))}
              </select>
              <textarea
                placeholder="Write a short review..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="input-field"
                rows={2}
                maxLength={500}
              />
              <button className="btn-primary">Submit Review</button>
              {msg && <p className="text-xs text-muted">{msg}</p>}
            </form>
          ) : (
            <p className="text-xs text-muted">Log in as a customer to leave a review.</p>
          )}
        </div>
      </div>
    </div>
  );
}
