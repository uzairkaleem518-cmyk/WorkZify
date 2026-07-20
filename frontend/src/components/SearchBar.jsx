export default function SearchBar({ categories, filters, setFilters, onSearch }) {
  return (
    <div className="card p-4 space-y-3">
      <input
        type="text"
        placeholder="Search worker by name..."
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        className="input-field"
      />
      <div className="flex gap-2">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="input-field flex-1"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Area (e.g. your neighborhood)"
          value={filters.area}
          onChange={(e) => setFilters({ ...filters, area: e.target.value })}
          className="input-field flex-1"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={filters.available}
          onChange={(e) => setFilters({ ...filters, available: e.target.checked })}
          className="w-4 h-4 accent-teal-500"
        />
        Only show available workers
      </label>
      <button onClick={onSearch} className="btn-primary w-full">
        Search
      </button>
    </div>
  );
}
