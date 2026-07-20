import { useEffect, useState } from "react";
import api from "../api/api.js";
import SearchBar from "../components/SearchBar.jsx";
import WorkerCard from "../components/WorkerCard.jsx";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({ q: "", category: "", area: "", available: false });

  const loadCategories = async () => {
    const res = await api.get("/workers/categories");
    setCategories(res.data);
  };

  // reset=true -> fresh search (filters changed / first load), replaces the list
  // reset=false -> "Load more" - appends the next page onto the existing list
  const search = async (reset = true) => {
    const targetPage = reset ? 1 : page + 1;
    reset ? setLoading(true) : setLoadingMore(true);

    try {
      const params = { page: targetPage, limit: 20 };
      if (filters.q) params.q = filters.q;
      if (filters.category) params.category = filters.category;
      if (filters.area) params.area = filters.area;
      if (filters.available) params.available = "true";

      const res = await api.get("/workers", { params });

      // Defensive: handle both the new paginated shape ({workers, pagination})
      // and, just in case, a stale/old backend still returning a plain array.
      const results = Array.isArray(res.data) ? res.data : res.data.workers || [];
      const pagination = Array.isArray(res.data)
        ? { page: 1, hasMore: false }
        : res.data.pagination || { page: 1, hasMore: false };

      setWorkers((prev) => (reset ? results : [...prev, ...results]));
      setPage(pagination.page);
      setHasMore(pagination.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadCategories();
    search(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="bg-teal-500 dark:bg-teal-700 text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-14 text-center">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight">
            Find trusted professionals<br />near you
          </h1>
          <p className="mt-2 text-teal-50/90 text-sm sm:text-base">
            Plumbers, electricians, drivers &amp; more — verified profiles, real ratings, one tap to call.
          </p>
        </div>
      </div>
      {/* Truck-art scalloped seam between hero and content */}
      <div className="scallop-divider -mt-px" />

      <div className="max-w-3xl mx-auto px-4 -mt-8 pb-6 space-y-4">
        <SearchBar categories={categories} filters={filters} setFilters={setFilters} onSearch={() => search(true)} />

        <div className="space-y-2">
          {loading && (
            <div className="space-y-2 py-2" aria-live="polite" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-3 h-[76px] animate-pulse bg-surface2" />
              ))}
            </div>
          )}
          {!loading && workers.length === 0 && (
            <p className="text-center text-muted text-sm py-10">No workers found. Try a different search.</p>
          )}
          {workers.map((w) => (
            <WorkerCard key={w._id} worker={w} />
          ))}

          {!loading && hasMore && (
            <button
              type="button"
              onClick={() => search(false)}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-lg border border-teal-500 text-teal-600 dark:text-teal-300 text-sm font-medium disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
