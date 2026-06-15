import { useEffect, useState } from 'react'
import { analyzeDestinations } from '../api.js'

export default function DestinationAnalysis({ group }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    analyzeDestinations({
      fabric_type: group.fabric_type_guess || 'mixed textile',
      composition: group.composition_guess || '',
      color_name: group.color_name || '',
      weight_kg: (group.estimated_weight_g || 0) / 1000,
      material_family: group.material_sort_family || group.material_family || null,
    })
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Analysis failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [group])

  if (loading) {
    return (
      <div className="mx-1 mb-2 rounded-md border border-[#2a3035] bg-[#131618] px-4 py-3 text-sm text-[#a7a29a]">
        Analyzing best destination…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-1 mb-2 rounded-md border border-[#2a3035] bg-[#131618] px-4 py-3 text-sm text-[#d06b5d]">
        Could not load destination analysis: {error}
      </div>
    )
  }

  if (!data) return null

  const {
    recommended,
    alternatives,
    recommended_buyers,
    sale_probability_pct,
    expected_days_to_sale,
    environmental_equivalents,
  } = data

  const allOptions = [recommended, ...alternatives]
  const maxScore = Math.max(...allOptions.map((o) => o.score), 1)
  const isHighestImpact =
    alternatives.length > 0 &&
    recommended.co2_saved_kg >= Math.max(...alternatives.map((o) => o.co2_saved_kg))

  return (
    <div className="mx-1 mb-2 rounded-md border border-[#2a3035] bg-[#131618] p-4 text-[#f0eee8]">
      <div className="mb-3">
        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[#a7a29a]">
          AI Destination Analysis
        </span>
        <h3 className="mt-1 text-base font-bold">{recommended.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>
            <strong>${recommended.revenue_usd.toFixed(2)}</strong> projected revenue
          </span>
          <span className="text-[#a7a29a]">·</span>
          <span>
            <strong>{recommended.co2_saved_kg} kg</strong> CO2 saved
          </span>
          <span className="rounded-full bg-[rgba(127,160,111,0.16)] px-2 py-0.5 text-xs font-bold text-[#7fa06f]">
            {isHighestImpact ? 'Highest Impact · ' : 'Top pick · '}
            {recommended.score}/100
          </span>
        </div>
      </div>

      <div className="mb-3">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#a7a29a]">
          Alternative destinations
        </h4>
        <div className="flex flex-col gap-2">
          {allOptions.map((opt) => (
            <div key={opt.name} className="text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold">{opt.name}</span>
                <span className="text-[#a7a29a]">
                  ${opt.revenue_usd.toFixed(2)} · {opt.co2_saved_kg} kg CO2 · {opt.score}/100
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#2a3035]">
                <div
                  className="h-1.5 rounded-full bg-[#7fa06f]"
                  style={{ width: `${(opt.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {recommended_buyers.length > 0 && (
        <div className="mb-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#a7a29a]">
            Recommended buyers
          </h4>
          <ul className="flex flex-col gap-1 text-sm">
            {recommended_buyers.map((b) => (
              <li key={b.name} className="flex items-center justify-between">
                <span>{b.name}</span>
                <span className="text-[#a7a29a]">{b.match_pct}% match</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span>
          Sale probability: <strong>{sale_probability_pct}%</strong>
        </span>
        <span>
          Expected time to sale: <strong>{expected_days_to_sale} days</strong>
        </span>
      </div>

      <div className="text-xs text-[#a7a29a]">
        Equivalent to <strong className="text-[#f0eee8]">{environmental_equivalents.car_miles}</strong>{' '}
        miles not driven, <strong className="text-[#f0eee8]">{environmental_equivalents.showers}</strong>{' '}
        showers saved, and{' '}
        <strong className="text-[#f0eee8]">{environmental_equivalents.phone_charges}</strong> phone
        charges avoided.
      </div>
    </div>
  )
}
