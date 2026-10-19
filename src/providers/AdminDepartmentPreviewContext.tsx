import { createContext, useContext } from 'react'

/**
 * True while PublicServiceGuard is serving a department with public flag off
 * to a confirmed admin. PageSEO forces noindex in this mode.
 */
export const AdminDepartmentPreviewContext = createContext(false)

export function useAdminDepartmentPreview(): boolean {
  return useContext(AdminDepartmentPreviewContext)
}
