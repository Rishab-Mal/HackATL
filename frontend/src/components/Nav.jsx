import { NavLink } from 'react-router-dom'

export default function Nav() {
  return (
    <header className="nav">
      <div className="brand">Scrap Sorter</div>
      <nav>
        <NavLink to="/" end>Capture</NavLink>
        <NavLink to="/lots">Sorted Lots</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink to="/dashboard">Impact</NavLink>
      </nav>
    </header>
  )
}
