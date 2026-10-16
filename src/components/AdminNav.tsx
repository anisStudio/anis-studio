import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../providers/AdminAuthProvider'

const AdminNav: React.FC = () => {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="bg-slate-50 border-b border-slate-200">
      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-semibold text-slate-900">Admin panel</h2>

            <nav className="flex flex-wrap items-center gap-4">
              <NavLink
                to="/admin/settings"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Postavke
              </NavLink>
              <NavLink
                to="/admin/lrc-inquiries"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                LRC upiti
              </NavLink>
              <NavLink
                to="/admin/interiors-projects"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Interijer projekti
              </NavLink>
              <NavLink
                to="/admin/portfolio"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Portfolio
              </NavLink>
              <NavLink
                to="/admin/reviews"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Recenzije
              </NavLink>
              <NavLink
                to="/admin/web-atelier-inquiries"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Web Atelier
              </NavLink>
              <NavLink
                to="/admin/web-atelier-offers"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                WA ponude
              </NavLink>
              <NavLink
                to="/admin/web-atelier-projects"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                WA projekti
              </NavLink>
              <NavLink
                to="/admin/availability"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg ${
                    isActive
                      ? 'text-violet-700 bg-violet-50 font-semibold'
                      : 'text-slate-700 hover:text-violet-700 hover:bg-slate-100'
                  }`
                }
              >
                Kapacitet
              </NavLink>
            </nav>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? 'Odjava…' : 'Odjava'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminNav
