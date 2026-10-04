import { supabase, isSupabaseConfigured } from './supabase'

// ============================================
// Union Types
// ============================================

export type LanguageCode = 'hr' | 'en'

export type UserType = 'client' | 'carpenter'

export type DrawnBy = 'ani' | 'carpenter'

export type VrLocationPreference = 'studio' | 'client_home' | 'unsure'

export type VrPackagePreference = '3d_vr' | '3d_vr_online' | 'unsure' | null

export type VrSceneType = 'simlab_package' | 'webxr_scene' | 'video_tour' | 'image_gallery' | 'other'

export type VrAppointmentLocationPreference = 'studio' | 'client_home' | 'online' | 'other'

export type VrAppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export type ProjectStatus =
  | 'inquiry'
  | '3d_in_progress'
  | '3d_done'
  | 'vr_in_progress'
  | 'vr_done'
  | 'presented'
  | 'archived'

// ============================================
// Interfaces
// ============================================

export interface Client {
  id: string
  created_at: string
  name: string
  email: string
  phone: string | null
  language: LanguageCode
  notes: string | null
}

export interface Carpenter {
  id: string
  created_at: string
  company_name: string
  contact_name: string
  email: string
  phone: string | null
  uses_corpus: boolean
  estimated_vr_projects_per_year: number | null
  notes: string | null
}

export interface Project {
  id: string
  created_at: string
  updated_at: string
  title: string
  user_type: UserType
  client_id: string | null
  carpenter_id: string | null
  drawn_by: DrawnBy
  uses_corpus: boolean
  wants_vr: boolean
  vr_location_preference: VrLocationPreference | null
  vr_package_preference: VrPackagePreference
  status: ProjectStatus
  space_type: string | null
  area_m2: number | null
  budget: number | null
  notes: string | null
  /** Admin: ručna oznaka da je molba za recenziju poslana; null = nije poslano */
  review_request_sent_at: string | null
}

/** Globalni admin predložak molbe za recenziju (nije vezan uz pojedini projekt). */
export type ReviewRequestTemplateCategory = 'interiors' | 'lrc' | 'webAtelier'

export interface ReviewRequestTemplate {
  category: ReviewRequestTemplateCategory
  message: string
  created_at: string
  updated_at: string
}

export type ProjectFileType =
  | "plan"
  | "inspiration"
  | "space_photo"
  | "kitchen_sketch"
  | "carpenter_3d_export"
  | "vr_asset"
  | "other"

export interface ProjectFile {
  id: string
  project_id: string
  created_at: string

  file_type: ProjectFileType

  storage_bucket: string
  storage_path: string

  original_name: string
  mime_type: string | null
  size_bytes: number | null

  notes: string | null
}

export interface VrScene {
  id: string
  project_id: string
  scene_type: VrSceneType
  title: string
  description: string | null
  simlab_project_url: string | null
  webxr_url: string | null
  video_url: string | null
  cover_image_url: string | null
  storage_bucket: string | null
  storage_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VrAppointment {
  id: string
  vr_scene_id: string
  scheduled_at: string
  location_preference: VrAppointmentLocationPreference | null
  status: VrAppointmentStatus
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  vr_link: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProjectListFilters = {
  userType?: Project["user_type"]; // 'client' | 'carpenter'
  status?: Project["status"];      // 'inquiry' | '3d_in_progress' | ...
  wantsVr?: boolean;
};

// ============================================
// Input Types
// ============================================

export type NewClientInput = Omit<Client, 'id' | 'created_at'>

export type NewCarpenterInput = Omit<Carpenter, 'id' | 'created_at'>

export type NewProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at'>

export type NewProjectFileInput = {
  project_id: string
  file_type: ProjectFileType
  storage_bucket: string
  storage_path: string
  original_name: string
  mime_type?: string | null
  size_bytes?: number | null
  notes?: string | null
}

export interface NewVrSceneInput {
  project_id: string
  scene_type: VrSceneType
  title: string
  description?: string | null
  simlab_project_url?: string | null
  webxr_url?: string | null
  video_url?: string | null
  cover_image_url?: string | null
  storage_bucket?: string | null
  storage_path?: string | null
  notes?: string | null
}

/**
 * Minimalni javni podaci o VR projektu — vraćeni iz get_public_vr_project RPC-a.
 * Ne sadrži PII (notes, budget, client_id, carpenter_id).
 * Koristi ga PublicProjectVrPage umjesto punog Project objekta.
 */
export interface PublicVrProject {
  id: string
  title: string
  wants_vr: boolean
}

/**
 * Javno sigurna VR scena — vraćena iz get_public_vr_scenes RPC-a.
 * Ne sadrži interna polja (storage_bucket, storage_path, notes).
 * Koristi ga PublicProjectVrPage umjesto punog VrScene objekta.
 */
export interface PublicVrScene {
  id: string
  project_id: string
  scene_type: VrSceneType
  title: string
  description: string | null
  simlab_project_url: string | null
  webxr_url: string | null
  video_url: string | null
  cover_image_url: string | null
}

/**
 * Javno sigurni VR termin — vraćen iz get_public_vr_appointments RPC-a.
 * Ne sadrži PII (client_name, client_email, client_phone) ni notes.
 * Koristi ga PublicProjectVrPage umjesto punog VrAppointment objekta.
 */
export interface PublicVrAppointment {
  id: string
  vr_scene_id: string
  scheduled_at: string
  location_preference: VrAppointmentLocationPreference | null
  status: VrAppointmentStatus
  vr_link: string | null
}

export interface NewVrAppointmentInput {
  vr_scene_id: string
  scheduled_at: string
  location_preference?: VrAppointmentLocationPreference | null
  status: VrAppointmentStatus
  client_name?: string | null
  client_email?: string | null
  client_phone?: string | null
  vr_link?: string | null
  notes?: string | null
}

// ============================================
// Constants
// ============================================

const NOT_CONFIGURED_ERROR =
  '[Interiors] Supabase nije konfiguriran. Provjeri .env.local i postavke.'

const PROJECT_FILES_BUCKET = "project-files"; // Bucket se kreira putem supabase/project_files_storage.sql

// Token iz create_public_inquiry_project. Vrijedi samo u ovoj stranici i
// samo za metadata RPC. Nije projektni SELECT.
const publicInquiryUploadTokens = new Map<string, string>()

function readCreatedInquiry(data: unknown): { projectId: string; uploadToken: string } {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw new Error('create_public_inquiry_project nije vratio identifikator upita.')
  }

  const record = row as Record<string, unknown>
  const projectId = record.project_id
  const uploadToken = record.upload_token
  if (typeof projectId !== 'string' || typeof uploadToken !== 'string') {
    throw new Error('create_public_inquiry_project nije vratio identifikator upita.')
  }

  return { projectId, uploadToken }
}

function readCreatedFileId(data: unknown): string {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('create_public_project_file nije vratio identifikator datoteke.')
  }
  return data
}

// ============================================
// Helper Functions
// ============================================

/**
 * Fetches projects from Supabase with optional filtering.
 * If Supabase is not configured, returns an empty array without throwing an error.
 *
 * @param filters - Optional filters for projects (applied client-side)
 * @returns Array of projects, sorted by created_at descending (newest first)
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchProjects(
  filters: ProjectListFilters = {}
): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchProjects (fallback)", filters);
    // fallback za dev bez Supabase env-a
    return [];
  }

  const { data, error } = await supabase!
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Interiors] fetchProjects error:", error);
    throw error;
  }

  let projects = (data ?? []) as Project[];

  const { userType, status, wantsVr } = filters;

  if (userType) {
    projects = projects.filter((p) => p.user_type === userType);
  }

  if (status) {
    projects = projects.filter((p) => p.status === status);
  }

  if (typeof wantsVr === "boolean") {
    projects = projects.filter((p) => p.wants_vr === wantsVr);
  }

  return projects;
}

/**
 * Fetches a single project by ID from Supabase.
 * If Supabase is not configured, returns null without throwing an error.
 *
 * @param id - The project ID to fetch
 * @returns The project if found, or null if not found
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchProjectById(id: string): Promise<Project | null> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchProjectById (fallback)", id);
    return null;
  }

  const { data, error } = await supabase!
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Interiors] fetchProjectById error:", error);
    throw error;
  }

  return (data as Project) ?? null;
}

/**
 * Fetches a single client by ID from Supabase.
 * If Supabase is not configured, returns null without throwing an error.
 *
 * @param id - The client ID to fetch
 * @returns The client if found, or null if not found
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchClientById(id: string): Promise<Client | null> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchClientById (fallback)", id);
    return null;
  }

  const { data, error } = await supabase!
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Interiors] fetchClientById error:", error);
    throw error;
  }

  return (data as Client) ?? null;
}

/**
 * Fetches a single carpenter by ID from Supabase.
 * If Supabase is not configured, returns null without throwing an error.
 *
 * @param id - The carpenter ID to fetch
 * @returns The carpenter if found, or null if not found
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchCarpenterById(id: string): Promise<Carpenter | null> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchCarpenterById (fallback)", id);
    return null;
  }

  const { data, error } = await supabase!
    .from("carpenters")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Interiors] fetchCarpenterById error:", error);
    throw error;
  }

  return (data as Carpenter) ?? null;
}

/**
 * Creates a public inquiry through create_public_inquiry_project.
 * The database forces status inquiry and returns only the new id plus an
 * upload token kept in memory for the following file metadata call.
 *
 * @param payload - The project data to create (without id, created_at, updated_at)
 * @returns The created project
 * @throws Error if Supabase is configured but the creation fails
 */
export async function createProject(
  payload: NewProjectInput
): Promise<Project> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn(NOT_CONFIGURED_ERROR)
    // soft-fallback za razvoj – vrati payload s fake ID-em
    return {
      ...payload,
      id: 'local-dev-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const { data, error } = await supabase!.rpc('create_public_inquiry_project', {
    p_title: payload.title,
    p_user_type: payload.user_type,
    p_client_id: payload.client_id,
    p_carpenter_id: payload.carpenter_id,
    p_uses_corpus: payload.uses_corpus,
    p_wants_vr: payload.wants_vr,
    p_vr_location_preference: payload.vr_location_preference,
    p_vr_package_preference: payload.vr_package_preference,
    p_space_type: payload.space_type,
    p_area_m2: payload.area_m2,
    p_budget: payload.budget,
    p_notes: payload.notes,
  })

  if (error) {
    console.error('[Interiors] createProject error:', error)
    throw error
  }

  const created = readCreatedInquiry(data)
  publicInquiryUploadTokens.set(created.projectId, created.uploadToken)

  const now = new Date().toISOString()
  return {
    ...payload,
    id: created.projectId,
    status: 'inquiry',
    drawn_by: 'ani',
    review_request_sent_at: null,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Updates the status of a project in Supabase.
 * If Supabase is not configured, returns a mock project with the updated status for development.
 *
 * @param projectId - The ID of the project to update
 * @param status - The new status to set
 * @returns The updated project
 * @throws Error if Supabase is configured but the update fails
 */
export async function updateProjectStatus(
  projectId: string,
  status: Project["status"]
): Promise<Project> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Interiors] updateProjectStatus (fallback)', { projectId, status })
    // fallback za dev bez Supabase env-a
    const now = new Date().toISOString()
    return {
      id: projectId,
      created_at: now,
      updated_at: now,
      title: '',
      user_type: 'client',
      client_id: null,
      carpenter_id: null,
      drawn_by: 'ani',
      uses_corpus: false,
      wants_vr: false,
      vr_location_preference: null,
      vr_package_preference: null,
      status: status,
      space_type: null,
      area_m2: null,
      budget: null,
      notes: null,
      review_request_sent_at: null,
    }
  }

  const { data, error } = await supabase!
    .from('projects')
    .update({
      status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('*')
    .single()

  if (error) {
    console.error('[Interiors] updateProjectStatus error:', error)
    throw error
  }

  return data as Project
}

/**
 * Postavlja ručnu admin oznaku "molba za recenziju poslana".
 * `null` = nije poslano (toggle isključen).
 */
export async function updateProjectReviewRequestSentAt(
  projectId: string,
  reviewRequestSentAt: string | null
): Promise<Project> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Interiors] updateProjectReviewRequestSentAt (fallback)', {
      projectId,
      reviewRequestSentAt,
    })
    const now = new Date().toISOString()
    return {
      id: projectId,
      created_at: now,
      updated_at: now,
      title: '',
      user_type: 'client',
      client_id: null,
      carpenter_id: null,
      drawn_by: 'ani',
      uses_corpus: false,
      wants_vr: false,
      vr_location_preference: null,
      vr_package_preference: null,
      status: 'inquiry',
      space_type: null,
      area_m2: null,
      budget: null,
      notes: null,
      review_request_sent_at: reviewRequestSentAt,
    }
  }

  const { data, error } = await supabase!
    .from('projects')
    .update({
      review_request_sent_at: reviewRequestSentAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('*')
    .single()

  if (error) {
    console.error('[Interiors] updateProjectReviewRequestSentAt error:', error)
    throw error
  }

  return data as Project
}

/**
 * Dohvaća globalni predložak poruke za molbu o recenziji (po kategoriji).
 * Vraća null ako red ne postoji ili Supabase nije konfiguriran.
 */
export async function fetchReviewRequestTemplate(
  category: ReviewRequestTemplateCategory
): Promise<ReviewRequestTemplate | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Interiors] fetchReviewRequestTemplate (fallback)', category)
    return null
  }

  const { data, error } = await supabase
    .from('review_request_templates')
    .select('*')
    .eq('category', category)
    .maybeSingle()

  if (error) {
    console.error('[Interiors] fetchReviewRequestTemplate error:', error)
    throw error
  }

  return (data as ReviewRequestTemplate) ?? null
}

/**
 * Sprema globalni predložak (upsert po category).
 */
export async function upsertReviewRequestTemplate(
  category: ReviewRequestTemplateCategory,
  message: string
): Promise<ReviewRequestTemplate> {
  const trimmed = message.trim()
  if (!trimmed) {
    throw new Error('Predložak poruke ne smije biti prazan.')
  }

  if (!isSupabaseConfigured || !supabase) {
    console.log('[Interiors] upsertReviewRequestTemplate (fallback)', {
      category,
    })
    const now = new Date().toISOString()
    return {
      category,
      message: trimmed,
      created_at: now,
      updated_at: now,
    }
  }

  const { data, error } = await supabase
    .from('review_request_templates')
    .upsert(
      {
        category,
        message: trimmed,
      },
      { onConflict: 'category' }
    )
    .select('*')
    .single()

  if (error) {
    console.error('[Interiors] upsertReviewRequestTemplate error:', error)
    throw error
  }

  return data as ReviewRequestTemplate
}

/**
 * Creates a new client in Supabase (or returns existing if email already exists).
 * Uses a SECURITY DEFINER RPC function so anon users never get direct SELECT/INSERT
 * on the clients table — only a UUID is returned.
 * If Supabase is not configured, returns a mock client with fake ID for development.
 *
 * @param input - The client data to create (without id, created_at)
 * @returns Minimal Client object containing id and the submitted data
 * @throws Error if Supabase is configured but the RPC call fails
 */
export async function createClient(input: {
  name: string
  email: string
  phone: string | null
  language: string
  notes: string | null
}): Promise<Client> {
  if (!isSupabaseConfigured) {
    console.log('[Interiors] createClient (fallback)', input)

    const now = new Date().toISOString()

    return {
      id: 'fallback-client',
      created_at: now,
      name: input.name,
      email: input.email,
      phone: input.phone,
      language: input.language as Client['language'],
      notes: input.notes,
    }
  }

  const { data: clientId, error } = await supabase!
    .rpc('find_or_create_client', {
      p_name:     input.name,
      p_email:    input.email,
      p_phone:    input.phone,
      p_language: input.language,
      p_notes:    input.notes,
    })

  if (error) {
    console.error('[Interiors] createClient rpc error:', error)
    throw error
  }

  return {
    id: clientId as string,
    created_at: new Date().toISOString(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    language: input.language as Client['language'],
    notes: input.notes,
  }
}

/**
 * Creates a new carpenter in Supabase (or returns existing if email already exists).
 * Uses a SECURITY DEFINER RPC function so anon users never get direct SELECT/INSERT
 * on the carpenters table — only a UUID is returned.
 * If Supabase is not configured, returns a mock carpenter with fake ID for development.
 *
 * @param payload - The carpenter data to create (without id, created_at)
 * @returns Minimal Carpenter object containing id and the submitted data
 * @throws Error if Supabase is configured but the RPC call fails
 */
export async function createCarpenter(payload: NewCarpenterInput): Promise<Carpenter> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn(NOT_CONFIGURED_ERROR)
    // soft-fallback za razvoj – vrati payload s fake ID-em
    return {
      ...payload,
      id: 'local-dev-id',
      created_at: new Date().toISOString(),
    }
  }

  const { data: carpenterId, error } = await supabase!
    .rpc('find_or_create_carpenter', {
      p_company_name:                   payload.company_name,
      p_contact_name:                   payload.contact_name,
      p_email:                          payload.email,
      p_phone:                          payload.phone,
      p_uses_corpus:                    payload.uses_corpus,
      p_estimated_vr_projects_per_year: payload.estimated_vr_projects_per_year,
      p_notes:                          payload.notes,
    })

  if (error) {
    console.error('[Interiors] createCarpenter rpc error:', error)
    throw error
  }

  return {
    id: carpenterId as string,
    created_at: new Date().toISOString(),
    company_name: payload.company_name,
    contact_name: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    uses_corpus: payload.uses_corpus,
    estimated_vr_projects_per_year: payload.estimated_vr_projects_per_year,
    notes: payload.notes,
  }
}

/**
 * Fetches all carpenters from Supabase.
 * If Supabase is not configured, returns an empty array without throwing an error.
 *
 * @returns Array of carpenters, sorted by created_at descending (newest first)
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchCarpenters(): Promise<Carpenter[]> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn(NOT_CONFIGURED_ERROR)
    return []
  }

  const { data, error } = await supabase!
    .from('carpenters')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Interiors] fetchCarpenters error:', error)
    throw error
  }

  return (data ?? []) as Carpenter[]
}

/**
 * Creates a new project file record in Supabase.
 * If Supabase is not configured, returns a mock project file with fake ID for development.
 *
 * @param input - The project file data to create
 * @returns The created project file
 * @throws Error if Supabase is configured but the creation fails
 */
export async function createProjectFile(
  input: NewProjectFileInput
): Promise<ProjectFile> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] createProjectFile (fallback)", input)

    const now = new Date().toISOString()

    return {
      id: "fallback-project-file",
      created_at: now,
      project_id: input.project_id,
      file_type: input.file_type,
      storage_bucket: input.storage_bucket,
      storage_path: input.storage_path,
      original_name: input.original_name,
      mime_type: input.mime_type ?? null,
      size_bytes: input.size_bytes ?? null,
      notes: input.notes ?? null,
    }
  }

  const uploadToken = publicInquiryUploadTokens.get(input.project_id)
  if (!uploadToken) {
    throw new Error('Nedostaje token za prilog ovog upita.')
  }

  const { data, error } = await supabase!.rpc('create_public_project_file', {
    p_upload_token: uploadToken,
    p_file_type: input.file_type,
    p_storage_path: input.storage_path,
    p_original_name: input.original_name,
    p_mime_type: input.mime_type ?? null,
    p_size_bytes: input.size_bytes ?? null,
    p_notes: input.notes ?? null,
  })

  if (error) {
    console.error("[Interiors] createProjectFile error:", error)
    throw error
  }

  return {
    id: readCreatedFileId(data),
    created_at: new Date().toISOString(),
    project_id: input.project_id,
    file_type: input.file_type,
    storage_bucket: PROJECT_FILES_BUCKET,
    storage_path: input.storage_path,
    original_name: input.original_name,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    notes: input.notes ?? null,
  }
}

/**
 * Fetches all project files for a specific project from Supabase.
 * If Supabase is not configured, returns an empty array without throwing an error.
 *
 * @param projectId - The project ID to fetch files for
 * @returns Array of project files, sorted by created_at ascending (oldest first)
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchProjectFilesForProject(
  projectId: string
): Promise<ProjectFile[]> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchProjectFilesForProject (fallback)", projectId)
    return []
  }

  const { data, error } = await supabase!
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[Interiors] fetchProjectFilesForProject error:", error)
    throw error
  }

  return (data ?? []) as ProjectFile[]
}

/**
 * Uploads a file to Supabase Storage and creates a project file record.
 * If Supabase is not configured, returns null without throwing an error.
 *
 * @param projectId - The project ID to associate the file with
 * @param file - The file to upload
 * @param fileType - The type of file (plan, inspiration, etc.)
 * @returns The created project file record, or null if Supabase is not configured
 * @throws Error if Supabase is configured but the upload or creation fails
 */
export async function uploadProjectFileToStorage(
  projectId: string,
  file: File,
  fileType: ProjectFileType
): Promise<ProjectFile | null> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] uploadProjectFileToStorage (fallback)", {
      projectId,
      fileName: file.name,
      fileType,
    })

    // u dev okruženju bez Supabase-a samo preskačemo upload
    return null
  }

  // malo čišćenje imena datoteke za path
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_\u0100-\u017F]/g, "_")
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${projectId}/${timestamp}-${random}-${safeName}`

  // 1) Upload u Storage
  const { error: uploadError } = await supabase!.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
    })

  if (uploadError) {
    console.error(
      "[Interiors] uploadProjectFileToStorage upload error:",
      uploadError
    )
    throw uploadError
  }

  // uploadData.path može sadržavati prefiks bucketa ("project-files/..."),
  // što bi slomilo createSignedUrl. Koristimo lokalni `path` koji je uvijek
  // ispravni object key unutar bucketa.
  const storagePath = path

  // 2) Zapis u project_files tablicu
  const projectFile = await createProjectFile({
    project_id: projectId,
    file_type: fileType,
    storage_bucket: PROJECT_FILES_BUCKET,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    notes: null,
  })

  return projectFile
}

// ============================================
// VR helpers
// ============================================

/**
 * Creates a new VR scene in Supabase.
 * If Supabase is not configured, returns a mock VR scene with fake ID for development.
 *
 * @param input - The VR scene data to create
 * @returns The created VR scene
 * @throws Error if Supabase is configured but the creation fails
 */
export async function createVrScene(
  input: NewVrSceneInput
): Promise<VrScene> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] createVrScene (fallback)", input)
    const now = new Date().toISOString()
    return {
      id: "mock-vr-scene",
      project_id: input.project_id,
      scene_type: input.scene_type,
      title: input.title,
      description: input.description ?? null,
      simlab_project_url: input.simlab_project_url ?? null,
      webxr_url: input.webxr_url ?? null,
      video_url: input.video_url ?? null,
      cover_image_url: input.cover_image_url ?? null,
      storage_bucket: input.storage_bucket ?? null,
      storage_path: input.storage_path ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    }
  }

  const { data, error } = await supabase!
    .from("vr_scenes")
    .insert(input)
    .select("*")
    .single()

  if (error) {
    console.error("[Interiors] createVrScene error:", error)
    throw error
  }

  return data as VrScene
}

/**
 * Fetches all VR scenes for a specific project from Supabase.
 * If Supabase is not configured, returns an empty array without throwing an error.
 *
 * @param projectId - The project ID to fetch VR scenes for
 * @returns Array of VR scenes, sorted by created_at ascending (oldest first)
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchVrScenesForProject(
  projectId: string
): Promise<VrScene[]> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchVrScenesForProject (fallback)", projectId)
    return []
  }

  const { data, error } = await supabase!
    .from("vr_scenes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[Interiors] fetchVrScenesForProject error:", error)
    throw error
  }

  return (data ?? []) as VrScene[]
}

/**
 * Creates a new VR appointment in Supabase.
 * If Supabase is not configured, returns a mock VR appointment with fake ID for development.
 *
 * @param input - The VR appointment data to create
 * @returns The created VR appointment
 * @throws Error if Supabase is configured but the creation fails
 */
export async function createVrAppointment(
  input: NewVrAppointmentInput
): Promise<VrAppointment> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] createVrAppointment (fallback)", input)
    const now = new Date().toISOString()
    return {
      id: "mock-vr-appointment",
      vr_scene_id: input.vr_scene_id,
      scheduled_at: input.scheduled_at,
      location_preference: input.location_preference ?? null,
      status: input.status,
      client_name: input.client_name ?? null,
      client_email: input.client_email ?? null,
      client_phone: input.client_phone ?? null,
      vr_link: input.vr_link ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    }
  }

  const { data, error } = await supabase!
    .from("vr_appointments")
    .insert({
      vr_scene_id: input.vr_scene_id,
      scheduled_at: input.scheduled_at,
      location_preference: input.location_preference ?? null,
      status: input.status,
      client_name: input.client_name ?? null,
      client_email: input.client_email ?? null,
      client_phone: input.client_phone ?? null,
      vr_link: input.vr_link ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[Interiors] createVrAppointment error:", error)
    throw error
  }

  return data as VrAppointment
}

/**
 * Fetches all VR appointments for a specific VR scene from Supabase.
 * If Supabase is not configured, returns an empty array without throwing an error.
 *
 * @param vrSceneId - The VR scene ID to fetch appointments for
 * @returns Array of VR appointments, sorted by scheduled_at ascending (oldest first)
 * @throws Error if Supabase is configured but the fetch fails
 */
export async function fetchVrAppointmentsForScene(
  vrSceneId: string
): Promise<VrAppointment[]> {
  if (!isSupabaseConfigured) {
    console.log("[Interiors] fetchVrAppointmentsForScene (fallback)", vrSceneId)
    return []
  }

  const { data, error } = await supabase!
    .from("vr_appointments")
    .select("*")
    .eq("vr_scene_id", vrSceneId)
    .order("scheduled_at", { ascending: true })

  if (error) {
    console.error("[Interiors] fetchVrAppointmentsForScene error:", error)
    throw error
  }

  return (data ?? []) as VrAppointment[]
}

// ============================================
// Public VR helpers (anon-safe, SECURITY DEFINER RPC)
// ============================================

/**
 * Dohvaća minimalne javne podatke o VR projektu putem SECURITY DEFINER RPC-a.
 * Vraća samo { id, title, wants_vr } — bez PII (notes, budget, client_id itd.).
 * Koristi se na PublicProjectVrPage umjesto fetchProjectById kako bi se izbjegao
 * direktni anon SELECT na projects tablicu.
 *
 * Uvjet u RPC-u: wants_vr = true — ako projekt nije VR, vraća null.
 *
 * @param id - UUID projekta iz URL-a (/vr/:projectId)
 * @returns PublicVrProject objekt ili null (projekt ne postoji ili nije VR)
 * @throws Error ako je Supabase konfiguriran ali RPC poziv ne uspije
 */
export async function fetchPublicVrProject(
  id: string
): Promise<PublicVrProject | null> {
  if (!isSupabaseConfigured) {
    console.log('[Interiors] fetchPublicVrProject (fallback)', id)
    return null
  }

  const { data, error } = await supabase!
    .rpc('get_public_vr_project', { p_project_id: id })

  if (error) {
    console.error('[Interiors] fetchPublicVrProject error:', error)
    throw error
  }

  // RPC vraća array (RETURNS TABLE) — uzimamo prvi red ili null
  if (!data || (Array.isArray(data) && data.length === 0)) return null

  const row = Array.isArray(data) ? data[0] : data
  return row as PublicVrProject
}

/**
 * Dohvaća javno sigurne VR scene za projekt putem SECURITY DEFINER RPC-a.
 * Vraća samo javna polja — bez storage_bucket, storage_path, notes.
 * Koristi se na PublicProjectVrPage umjesto fetchVrScenesForProject.
 *
 * @param projectId - UUID projekta iz URL-a
 * @returns Array PublicVrScene objekata (prazan array ako projekt nije VR ili nema scena)
 * @throws Error ako je Supabase konfiguriran ali RPC poziv ne uspije
 */
export async function fetchPublicVrScenesForProject(
  projectId: string
): Promise<PublicVrScene[]> {
  if (!isSupabaseConfigured) {
    console.log('[Interiors] fetchPublicVrScenesForProject (fallback)', projectId)
    return []
  }

  const { data, error } = await supabase!
    .rpc('get_public_vr_scenes', { p_project_id: projectId })

  if (error) {
    console.error('[Interiors] fetchPublicVrScenesForProject error:', error)
    throw error
  }

  return (data ?? []) as PublicVrScene[]
}

/**
 * Dohvaća javno sigurne VR termine za scenu putem SECURITY DEFINER RPC-a.
 * Vraća samo scheduled termine bez PII (client_name, client_email, client_phone, notes).
 * Koristi se na PublicProjectVrPage umjesto fetchVrAppointmentsForScene.
 *
 * @param sceneId - UUID VR scene
 * @returns Array PublicVrAppointment objekata (samo status = 'scheduled')
 * @throws Error ako je Supabase konfiguriran ali RPC poziv ne uspije
 */
export async function fetchPublicVrAppointmentsForScene(
  sceneId: string
): Promise<PublicVrAppointment[]> {
  if (!isSupabaseConfigured) {
    console.log('[Interiors] fetchPublicVrAppointmentsForScene (fallback)', sceneId)
    return []
  }

  const { data, error } = await supabase!
    .rpc('get_public_vr_appointments', { p_scene_id: sceneId })

  if (error) {
    console.error('[Interiors] fetchPublicVrAppointmentsForScene error:', error)
    throw error
  }

  return (data ?? []) as PublicVrAppointment[]
}

// ============================================
// Delete helpers
// ============================================

/**
 * Attempts to delete a list of project files from Supabase Storage.
 * Never throws — failures are collected and returned as strings so the caller
 * can warn the admin without blocking the DB deletion.
 *
 * Requires an authenticated session with the "project_files_authenticated_delete"
 * and "project_files_authenticated_select" storage policies in place.
 *
 * @param files - Array of ProjectFile records whose storage objects should be removed
 * @returns Array of human-readable failure strings (empty if all succeeded)
 */
export async function deleteProjectFilesFromStorage(
  files: ProjectFile[]
): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) {
    console.log("[Interiors] deleteProjectFilesFromStorage (fallback) – Supabase nije konfiguriran")
    return []
  }

  if (files.length === 0) {
    return []
  }

  const failures: string[] = []

  for (const file of files) {
    try {
      const { data: removed, error } = await supabase.storage
        .from(file.storage_bucket)
        .remove([file.storage_path])

      if (error) {
        const msg = `${file.storage_bucket}/${file.storage_path}: ${error.message}`
        console.warn("[Interiors] deleteProjectFilesFromStorage – greška pri brisanju:", msg)
        failures.push(msg)
        continue
      }

      if (!removed?.length) {
        const msg = `${file.storage_bucket}/${file.storage_path}: objekt nije pronađen u bucketu (možda već obrisan)`
        console.warn("[Interiors] deleteProjectFilesFromStorage –", msg)
        // Not treated as a hard failure – the file is gone either way
      }
    } catch (err) {
      const msg = `${file.storage_bucket}/${file.storage_path}: ${err instanceof Error ? err.message : String(err)}`
      console.warn("[Interiors] deleteProjectFilesFromStorage – neočekivana greška:", msg)
      failures.push(msg)
    }
  }

  return failures
}

/**
 * Permanently deletes a project and all related data.
 *
 * Order of operations:
 * 1. Fetch project_files rows (to obtain storage paths before cascade removes them)
 * 2. Delete Storage objects from project-files bucket (failures are non-fatal)
 * 3. Delete the project row — DB cascade handles:
 *    - project_files rows
 *    - vr_scenes rows
 *    - vr_appointments rows (via vr_scenes cascade)
 *
 * clients and carpenters are NOT deleted.
 *
 * @param projectId - The ID of the project to permanently delete
 * @returns { storageErrors } – non-empty if some Storage objects could not be removed
 * @throws Error if the DB deletion fails
 */
export async function deleteProject(
  projectId: string
): Promise<{ storageErrors: string[] }> {
  if (!isSupabaseConfigured || !supabase) {
    console.log("[Interiors] deleteProject (fallback) – Supabase nije konfiguriran", projectId)
    return { storageErrors: [] }
  }

  // 1) Fetch project files before any deletion so storage paths are available
  const files = await fetchProjectFilesForProject(projectId)

  // 2) Remove Storage objects (non-fatal failures collected)
  const storageErrors = await deleteProjectFilesFromStorage(files)

  // 3) Delete project row — cascade handles child table rows
  const { error: dbError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)

  if (dbError) {
    console.error("[Interiors] deleteProject – DB greška pri brisanju projekta:", dbError)
    throw dbError
  }

  return { storageErrors }
}

