// Shared filter bar for the Sorted Lots and Marketplace pages. Options
// (available fabric types / colors / price range) come from
// GET /api/lots/filters so the dropdowns always match real data.

export default function LotFilters({ options, filters, onChange }) {
  const hasActiveFilters = Boolean(filters.fabric_type || filters.color_name || filters.min_price || filters.max_price)

  function update(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function clear() {
    onChange({ fabric_type: '', color_name: '', min_price: '', max_price: '' })
  }

  return (
    <div className="filter-bar">
      <label>
        Fabric type
        <select value={filters.fabric_type} onChange={(e) => update('fabric_type', e.target.value)}>
          <option value="">All</option>
          {(options?.fabric_types ?? []).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label>
        Color
        <select value={filters.color_name} onChange={(e) => update('color_name', e.target.value)}>
          <option value="">All</option>
          {(options?.colors ?? []).map((c) => (
            <option key={c.color_name} value={c.color_name}>
              {capitalize(c.color_name)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Min price ($)
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder={options?.min_price ?? 0}
          value={filters.min_price}
          onChange={(e) => update('min_price', e.target.value)}
        />
      </label>

      <label>
        Max price ($)
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder={options?.max_price ?? ''}
          value={filters.max_price}
          onChange={(e) => update('max_price', e.target.value)}
        />
      </label>

      {hasActiveFilters && (
        <button type="button" className="clear-filters" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
