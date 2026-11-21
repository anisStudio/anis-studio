import React from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../providers/AdminAuthProvider'

interface AdminRouteProps {
  children: ReactNode
  publicLayout?: boolean
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, publicLayout }) => {
  const { isAdmin, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="admin-scope min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">Provjera prijave...</p>
          <p className="text-xs text-slate-500">Pričekaj malo.</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (publicLayout) return <>{children}</>

  return (
    <div className="admin-scope min-w-0">{children}</div>
  )
}

export default AdminRoute
