import { NavLink } from 'react-router-dom'
import { ReweaveLogo } from './ReweaveMark.jsx'

export default function Nav() {
  return (
    <header className="nav">
      <div className="brand">
        <ReweaveLogo height={28} light />
      </div>
      <nav>
        <NavLink to="/" end>Capture</NavLink>
        <NavLink to="/lots">Sorted Lots</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink to="/dashboard">Impact</NavLink>
      </nav>
    </header>
  )
}
