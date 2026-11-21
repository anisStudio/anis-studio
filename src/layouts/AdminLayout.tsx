import { Outlet } from 'react-router-dom'
import AdminNav from '../components/AdminNav'

/**
 * Persistent shell for authenticated admin routes.
 * Nav stays mounted; only the outlet content swaps (no page-level AnimatedPage).
 */
export default function AdminLayout() {
  return (
    <div className="studio-admin-layout">
      <AdminNav />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
