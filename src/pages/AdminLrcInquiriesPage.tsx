import React, { useState, useEffect } from 'react'
import { fetchLrcInquiries, updateLrcInquiryStatus, type LrcInquiry, type LrcInquiryStatus } from '../lib/lrcInquiries'
import { lrcInquiryProductLabel } from '../lib/lrcInquiryLabel'
import { isSupabaseConfigured } from '../lib/supabase'
import { TableSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const AdminLrcInquiriesPage: React.FC = () => {
  const [inquiries, setInquiries] = useState<LrcInquiry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<LrcInquiryStatus | 'all'>('all')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase nije konfiguriran. Dohvat podataka nije moguć.')
      setIsLoading(false)
      return
    }

    async function loadInquiries() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchLrcInquiries()
        setInquiries(data)
      } catch (err) {
        const errorMessage = 'Došlo je do greške pri dohvaćanju upita. Pokušaj ponovo.'
        setError(errorMessage)
        console.error('Error fetching LRC inquiries:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInquiries()
  }, [])

  // Filter inquiries based on selected status
  const filteredInquiries = filterStatus === 'all' 
    ? inquiries 
    : inquiries.filter(inquiry => inquiry.status === filterStatus)

  // Handle status update with optimistic updates
  const handleStatusUpdate = async (inquiryId: string, newStatus: LrcInquiryStatus) => {
    const inquiry = inquiries.find(i => i.id === inquiryId)
    if (!inquiry) return

    const previousStatus = inquiry.status

    // Optimistic update
    setUpdatingIds(prev => new Set(prev).add(inquiryId))
    setInquiries(prev => 
      prev.map(i => i.id === inquiryId ? { ...i, status: newStatus } : i)
    )

    try {
      await updateLrcInquiryStatus(inquiryId, newStatus)
    } catch (err) {
      // Rollback on error
      setInquiries(prev => 
        prev.map(i => i.id === inquiryId ? { ...i, status: previousStatus } : i)
      )
      setError('Došlo je do greške pri ažuriranju statusa. Pokušaj ponovo.')
      console.error('Error updating inquiry status:', err)
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(inquiryId)
        return next
      })
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="mb-8 border-b pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            LRC Upiti
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pregled svih upita za personalizirane proizvode iz LRC forme.
          </p>
        </header>

        {/* Filter Tabs */}
        {!isLoading && !error && inquiries.length > 0 && (
          <div className="mb-6 border-b border-slate-200">
            <nav className="flex space-x-8" aria-label="Status filter">
              {(['all', 'new', 'read', 'archived'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      filterStatus === status
                        ? 'border-violet-600 text-violet-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }
                  `}
                >
                  {status === 'all' 
                    ? `Svi (${inquiries.length})`
                    : status === 'new'
                    ? `Novi (${inquiries.filter(i => i.status === 'new').length})`
                    : status === 'read'
                    ? `Pročitano (${inquiries.filter(i => i.status === 'read').length})`
                    : `Arhivirano (${inquiries.filter(i => i.status === 'archived').length})`
                  }
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && <TableSkeleton rows={5} />}

        {/* Empty state */}
        {!isLoading && !error && inquiries.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Trenutno nema upita.</p>
          </div>
        )}

        {/* Filtered empty state */}
        {!isLoading && !error && inquiries.length > 0 && filteredInquiries.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
            <p className="text-slate-600">
              Nema upita s statusom "{filterStatus === 'all' ? 'svi' : filterStatus}".
            </p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && inquiries.length > 0 && filteredInquiries.length > 0 && (
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Proizvod
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ime
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Telefon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Jezik
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Akcije
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredInquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {formatDate(inquiry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <div className="max-w-xs">
                          <div className="font-medium">
                            {lrcInquiryProductLabel(inquiry.product, inquiry.language)}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {inquiry.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {inquiry.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <a
                          href={`mailto:${inquiry.email}`}
                          className="text-violet-600 hover:text-violet-800 hover:underline"
                        >
                          {inquiry.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {inquiry.phone ? (
                          <a
                            href={`tel:${inquiry.phone}`}
                            className="text-violet-600 hover:text-violet-800 hover:underline"
                          >
                            {inquiry.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <span className="uppercase">{inquiry.language}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge
                          status={inquiry.status === 'new' ? 'new' : inquiry.status === 'read' ? 'read' : 'archived'}
                          label={inquiry.status === 'new' ? 'Novi' : inquiry.status === 'read' ? 'Pročitano' : 'Arhivirano'}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {inquiry.status === 'new' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(inquiry.id, 'read')}
                                disabled={updatingIds.has(inquiry.id)}
                                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingIds.has(inquiry.id) ? '...' : 'Označi kao pročitano'}
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(inquiry.id, 'archived')}
                                disabled={updatingIds.has(inquiry.id)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingIds.has(inquiry.id) ? '...' : 'Arhiviraj'}
                              </button>
                            </>
                          )}
                          {inquiry.status === 'read' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(inquiry.id, 'new')}
                                disabled={updatingIds.has(inquiry.id)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingIds.has(inquiry.id) ? '...' : 'Vrati na novo'}
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(inquiry.id, 'archived')}
                                disabled={updatingIds.has(inquiry.id)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingIds.has(inquiry.id) ? '...' : 'Arhiviraj'}
                              </button>
                            </>
                          )}
                          {inquiry.status === 'archived' && (
                            <button
                              onClick={() => handleStatusUpdate(inquiry.id, 'new')}
                              disabled={updatingIds.has(inquiry.id)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {updatingIds.has(inquiry.id) ? '...' : 'Vrati na novo'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {!isLoading && !error && inquiries.length > 0 && (
          <div className="mt-4 text-sm text-slate-600">
            {filterStatus === 'all' ? (
              <>Ukupno upita: <span className="font-semibold">{inquiries.length}</span></>
            ) : (
              <>
                Prikazano: <span className="font-semibold">{filteredInquiries.length}</span> od{' '}
                <span className="font-semibold">{inquiries.length}</span> upita
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

export default AdminLrcInquiriesPage

