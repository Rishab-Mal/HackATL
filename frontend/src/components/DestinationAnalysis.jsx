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
      <div className="fx-destination fx-destination--status">
        <span className="fx-destination-loader" aria-hidden="true" />
        <span>Analyzing best destination</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fx-destination fx-destination--error">
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

  const optionList = alternatives || []
  const buyerList = recommended_buyers || []
  const allOptions = [recommended, ...optionList]
  const maxScore = Math.max(...allOptions.map((o) => o.score), 1)
  const isHighestImpact =
    optionList.length > 0 &&
    recommended.co2_saved_kg >= Math.max(...optionList.map((o) => o.co2_saved_kg))
  const topBuyers = buyerList.slice(0, 2)
  const topAlternatives = optionList.slice(0, 2)

  return (
    <div className="fx-destination">
      <div className="fx-destination-head">
        <div className="fx-destination-title">
          <span>Best destination</span>
          <h3>{recommended.name}</h3>
        </div>
        <span className="fx-destination-score">
          {isHighestImpact ? 'Impact' : 'Top pick'} {recommended.score}
        </span>
      </div>

      <div className="fx-destination-metrics" aria-label="Destination metrics">
        <div>
          <span>Revenue</span>
          <strong>${recommended.revenue_usd.toFixed(2)}</strong>
        </div>
        <div>
          <span>CO2 saved</span>
          <strong>{recommended.co2_saved_kg} kg</strong>
        </div>
        <div>
          <span>Sale window</span>
          <strong>{expected_days_to_sale}d</strong>
        </div>
      </div>

      <div className="fx-destination-foot">
        <div className="fx-destination-pill">
          {sale_probability_pct}% sale probability
        </div>
        {topBuyers.length > 0 && (
          <div className="fx-destination-buyers">
            {topBuyers.map((buyer) => (
              <span key={buyer.name}>{buyer.name}</span>
            ))}
          </div>
        )}
      </div>

      {topAlternatives.length > 0 && (
        <div className="fx-destination-options">
          {topAlternatives.map((opt) => (
            <div className="fx-destination-option" key={opt.name}>
              <div className="fx-destination-option-copy">
                <span>{opt.name}</span>
                <strong>{opt.score}/100</strong>
              </div>
              <div className="fx-destination-bar">
                <div
                  className="fx-destination-bar-fill"
                  style={{ width: `${(opt.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {environmental_equivalents && (
        <p className="fx-destination-note">
          Equivalent to {environmental_equivalents.car_miles} miles not driven.
        </p>
      )}
    </div>
  )
}
