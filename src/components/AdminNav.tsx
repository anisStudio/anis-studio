import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { PanelsTopLeft, Images, MessageSquare, Armchair, Box, Inbox, Mail, FileText, Folders, CalendarDays, Settings, Menu, X, LogOut } from 'lucide-react'
import { useAdminAuth } from '../providers/AdminAuthProvider'

const groups = [
  { title: 'Studio', items: [['Pregled stranice', '/admin/preview', PanelsTopLeft], ['Portfolio', '/admin/portfolio', Images], ['Recenzije', '/admin/reviews', MessageSquare]] },
  { title: 'LRC', items: [['Proizvodi', '/admin/lrc-products', Box], ['LRC upiti', '/admin/lrc-inquiries', Inbox]] },
  { title: 'Interijeri', items: [['Interijer projekti', '/admin/interiors-projects', Armchair]] },
  { title: 'Web Atelier', items: [['WA upiti', '/admin/web-atelier-inquiries', Mail], ['WA ponude', '/admin/web-atelier-offers', FileText], ['WA projekti', '/admin/web-atelier-projects', Folders]] },
  { title: 'Upravljanje', items: [['Kapacitet', '/admin/availability', CalendarDays], ['Postavke', '/admin/settings', Settings]] },
] as const

export default function AdminNav() {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const open = openedAt === pathname

  async function handleLogout() {
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
    <aside className="studio-admin-sidebar">
      <div className="studio-admin-brand">
        <div><strong>Ani’s Studio</strong><small>Admin panel</small></div>
        <button type="button" className="studio-admin-menu" aria-expanded={open} aria-controls="admin-links" onClick={() => setOpenedAt(open ? null : pathname)}>
          {open ? <X size={18} /> : <Menu size={18} />} Izbornik
        </button>
      </div>
      <div id="admin-links" className="studio-admin-links" data-open={open}>
        <nav aria-label="Administracija">
          {groups.map(group => (
            <div className="studio-admin-group" key={group.title}>
              <span>{group.title}</span>
              {group.items.map(([label, path, Icon]) => (
                <NavLink key={path} to={path} onClick={() => setOpenedAt(null)}>
                  <Icon size={17} aria-hidden="true" />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" className="studio-admin-logout" onClick={handleLogout} disabled={isLoggingOut}>
          <LogOut size={17} aria-hidden="true" />{isLoggingOut ? 'Odjava…' : 'Odjava'}
        </button>
      </div>
    </aside>
  )
}
