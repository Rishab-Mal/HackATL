import { useEffect, useState } from 'react'
import { getActivity } from '../api.js'

// "Deals closed" timeline -- recent lot claims, newest first. Adds social
// proof / momentum to the Marketplace page. Re-fetches whenever refreshKey
// changes (e.g. after the current user claims a lot).

export default function ActivityFeed({ refreshKey }) {
  const [activity, setActivity] = useState([])

  useEffect(() => {
    getActivity().then(setActivity).catch(() => {})
  }, [refreshKey])

  if (activity.length === 0) return null

  return (
    <div className="activity-feed">
      <h2>Recent activity</h2>
      <ul className="activity-list">
        {activity.map((item) => (
          <li key={item.lot_id}>
            <span>
              <strong>{item.buyer_name}</strong> claimed <strong>{item.lot_name}</strong>
            </span>
            <span className="activity-time">{timeAgo(item.claimed_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function timeAgo(isoString) {
  const date = new Date(/[zZ+]|-\d\d:\d\d$/.test(isoString) ? isoString : `${isoString}Z`)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
