// Carter's pilot spotlight — the "oh I get it" moment for judges.
// Navy Cotton Twill Offcuts (9.5 kg) from Batch 18 → claimed by Looptex Recyclers.
// Numbers derived from constants.py: CARBON_PER_KG=2.1, WATER_PER_KG=2700.

export default function CarterSpotlight() {
  return (
    <div className="spotlight">
      <div className="spotlight-eyebrow">
        <span className="spotlight-badge">🌿 Pilot Program</span>
        <span className="spotlight-tag">Deal closed</span>
      </div>

      <h2 className="spotlight-title">Carter's Supplier × Scrap Sorter</h2>
      <p className="spotlight-sub">
        How one Atlanta garment supplier turned production offcuts into a circular
        supply chain — without changing a single thing on the factory floor.
      </p>

      {/* Flow diagram */}
      <div className="spotlight-flow">
        <div className="flow-node">
          <div className="flow-icon">🏭</div>
          <div className="flow-node-label">Carter's Supplier</div>
          <div className="flow-node-detail">Batch 18 — kids' pants line<br />100% cotton twill offcuts</div>
        </div>

        <div className="flow-arrow">→</div>

        <div className="flow-node flow-node--accent">
          <div className="flow-icon">🧵</div>
          <div className="flow-node-label">Scrap Sorter</div>
          <div className="flow-node-detail">Photo upload → AI detection<br />Sorted into navy lot in &lt;30 s</div>
        </div>

        <div className="flow-arrow">→</div>

        <div className="flow-node">
          <div className="flow-icon">♻️</div>
          <div className="flow-node-label">Looptex Recyclers</div>
          <div className="flow-node-detail">Atlanta, GA<br />Reclaimed yarn for industrial use</div>
        </div>
      </div>

      {/* Impact stats */}
      <div className="spotlight-stats">
        <div className="spotlight-stat">
          <span className="spotlight-stat-value">9.5 kg</span>
          <span className="spotlight-stat-label">fabric diverted from landfill</span>
        </div>
        <div className="spotlight-divider" />
        <div className="spotlight-stat">
          <span className="spotlight-stat-value">~20 kg</span>
          <span className="spotlight-stat-label">CO₂ equivalent saved</span>
        </div>
        <div className="spotlight-divider" />
        <div className="spotlight-stat">
          <span className="spotlight-stat-value">25,650 L</span>
          <span className="spotlight-stat-label">water saved</span>
        </div>
        <div className="spotlight-divider" />
        <div className="spotlight-stat">
          <span className="spotlight-stat-value">$30</span>
          <span className="spotlight-stat-label">revenue from waste</span>
        </div>
      </div>

      {/* Quote */}
      <blockquote className="spotlight-quote">
        "Instead of paying to dispose of offcuts, we now have a buyer lined up
        before the batch even ships."
        <cite>— Supplier operations lead, Atlanta pilot site</cite>
      </blockquote>
    </div>
  )
}
