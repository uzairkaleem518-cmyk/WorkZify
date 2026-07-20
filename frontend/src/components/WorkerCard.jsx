import { Link } from "react-router-dom";
import StarRating from "./StarRating.jsx";
import VerifiedSeal from "./VerifiedSeal.jsx";

export default function WorkerCard({ worker }) {
  return (
    <Link
      to={`/worker/${worker._id}`}
      className="card flex items-center gap-3 p-3 hover:border-teal-500 transition-colors group"
    >
      <div className="relative shrink-0">
        <div className="w-14 h-14 rounded-full bg-teal-50 dark:bg-teal-500/10 ring-2 ring-teal-500/40
                        flex items-center justify-center text-teal-600 font-display font-bold text-lg overflow-hidden">
          {worker.photoUrl ? (
            <img src={worker.photoUrl} alt={worker.name} className="w-full h-full object-cover" />
          ) : (
            worker.name?.charAt(0)
          )}
        </div>
        <span className="absolute -bottom-1 -right-1">
          <VerifiedSeal size={18} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-ink truncate">{worker.name}</h3>
          {worker.isAvailable && <span className="badge-available">Available</span>}
        </div>
        <p className="text-sm text-muted">{worker.category} · {worker.serviceArea}</p>
        <StarRating value={worker.ratingAverage} count={worker.ratingCount} size="text-sm" />
      </div>

      {worker.fee && (
        <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 shrink-0 text-right">
          {worker.fee}
        </div>
      )}
    </Link>
  );
}
