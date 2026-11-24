import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import {
  createLrcProduct,
  deleteLrcProduct,
  deleteUnusedLrcProductImages,
  fetchAdminLrcProducts,
  lrcCatalogErrorCode,
  setLrcProductVisibility,
  updateLrcProduct,
  uploadLrcProductImage,
} from '../lib/lrcCatalogApi'
import {
  LRC_PRODUCT_CODE,
  emptyLrcProductInput,
  formatLrcEuro,
  lrcCoverIndex,
  lrcDraftFromInput,
  lrcFrameStyle,
  lrcPublishBlock,
  moveLrcPhoto,
  productToInput,
  removeLrcPhoto,
  sortLrcProducts,
  withLrcCover,
  type LrcCatalogPhoto,
  type LrcProduct,
  type LrcProductInput,
} from '../lib/lrcCatalog'

const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100'

interface EditorState {
  mode: 'create' | 'edit'
  code: string
  input: LrcProductInput
  removedSrcs: string[]
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Došlo je do greške. Pokušaj ponovo.'
}

export default function AdminLrcProductsPage() {
  const [products, setProducts] = useState<LrcProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set())

  async function loadProducts() {
    setIsLoading(true)
    setError(null)
    setNotice(null)
    try {
      const rows = await fetchAdminLrcProducts()
      setProducts(sortLrcProducts(rows))
    } catch (err) {
      setProducts([])
      const code = lrcCatalogErrorCode(err)
      setError(messageFrom(err))
      if (code === 'missing_table') {
        setNotice('Javne kartice i obrazac i dalje pokazuju tri odobrene kutije dok migracija nije na bazi.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  function openCreate() {
    const nextOrder = products.reduce((max, product) => Math.max(max, product.sortOrder), 0) + 1
    setError(null)
    setConfirmDelete(false)
    setEditor({ mode: 'create', code: '', input: emptyLrcProductInput(nextOrder), removedSrcs: [] })
  }

  function openEdit(product: LrcProduct) {
    setError(null)
    setConfirmDelete(false)
    setEditor({ mode: 'edit', code: product.code, input: productToInput(product), removedSrcs: [] })
  }

  function patchInput(patch: Partial<LrcProductInput>) {
    setEditor((current) => (current ? { ...current, input: { ...current.input, ...patch } } : current))
  }

  function patchPhoto(index: number, photo: LrcCatalogPhoto) {
    setEditor((current) => {
      if (!current) return current
      const photos = current.input.photos.map((item, photoIndex) => (photoIndex === index ? photo : item))
      return { ...current, input: { ...current.input, photos } }
    })
  }

  async function handleSave() {
    if (!editor) return
    const visible = editor.mode === 'edit' && products.find((product) => product.code === editor.code)?.isVisible === true
    const parsed = lrcDraftFromInput(editor.input, { visible })
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    if (editor.mode === 'create' && products.some((product) => product.code === parsed.draft.code)) {
      setError('Šifra već postoji.')
      return
    }
    setSaving(true)
    setError(null)
    const removedSrcs = editor.removedSrcs
    try {
      if (editor.mode === 'create') {
        await createLrcProduct(parsed.draft)
        toast.success('Proizvod je spremljen i skriven.')
      } else {
        await updateLrcProduct(editor.code, parsed.draft)
        toast.success('Proizvod je spremljen.')
      }
      const rows = sortLrcProducts(await fetchAdminLrcProducts())
      setProducts(rows)
      let cleanupError: string | null = null
      if (removedSrcs.length > 0) {
        try {
          await deleteUnusedLrcProductImages(removedSrcs, rows)
        } catch (err) {
          cleanupError = `Proizvod je spremljen, ali fotografija je ostala u pohrani. ${messageFrom(err)}`
        }
      }
      const saved = rows.find((product) => product.code === parsed.draft.code)
      if (saved) {
        setEditor({
          mode: 'edit',
          code: saved.code,
          input: productToInput(saved),
          removedSrcs: cleanupError ? removedSrcs : [],
        })
      }
      if (cleanupError) setError(cleanupError)
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editor || editor.mode !== 'edit') return
    const saved = products.find((product) => product.code === editor.code)
    const candidates = [
      ...(saved?.photos.map((photo) => photo.src) ?? []),
      ...editor.input.photos.map((photo) => photo.src),
      ...editor.removedSrcs,
    ]
    setDeleting(true)
    setError(null)
    try {
      await deleteLrcProduct(editor.code)
      const rows = sortLrcProducts(await fetchAdminLrcProducts())
      setProducts(rows)
      setEditor(null)
      setConfirmDelete(false)
      toast.success('Proizvod je trajno izbrisan.')
      try {
        await deleteUnusedLrcProductImages(candidates, rows)
      } catch (err) {
        setError(`Proizvod je izbrisan, ali fotografija je ostala u pohrani. ${messageFrom(err)}`)
      }
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setDeleting(false)
    }
  }

  async function handleVisibility(product: LrcProduct) {
    const nextVisible = !product.isVisible
    if (nextVisible) {
      const block = lrcPublishBlock(product)
      if (block) {
        setError(block)
        return
      }
    }
    setPendingCodes((prev) => new Set(prev).add(product.code))
    setError(null)
    setProducts((prev) => prev.map((item) => (item.code === product.code ? { ...item, isVisible: nextVisible } : item)))
    try {
      await setLrcProductVisibility(product.code, nextVisible)
    } catch (err) {
      setProducts((prev) => prev.map((item) => (item.code === product.code ? { ...item, isVisible: product.isVisible } : item)))
      setError(messageFrom(err))
    } finally {
      setPendingCodes((prev) => {
        const next = new Set(prev)
        next.delete(product.code)
        return next
      })
    }
  }

  async function handleAddPhotos(files: FileList | null) {
    if (!editor || !files || files.length === 0) return
    const code = (editor.mode === 'edit' ? editor.code : editor.input.code).trim().toUpperCase()
    if (!LRC_PRODUCT_CODE.test(code)) {
      setError('Upiši šifru oblika LRC-BAB-03 prije dodavanja fotografija.')
      return
    }
    setUploading(true)
    setError(null)
    let photos = editor.input.photos
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadLrcProductImage(file, code)
        photos = [
          ...photos,
          {
            src: uploaded.src,
            frame: uploaded.frame,
            alt: { hr: '', en: '' },
            caption: { hr: '', en: '' },
          },
        ]
      }
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      patchInput({ photos, code })
      setUploading(false)
    }
  }

  function handleRemovePhoto(index: number) {
    const photo = editor?.input.photos[index]
    if (!editor || !photo) return
    setError(null)
    setEditor((current) => {
      if (!current) return current
      return {
        ...current,
        removedSrcs: current.removedSrcs.includes(photo.src)
          ? current.removedSrcs
          : [...current.removedSrcs, photo.src],
        input: { ...current.input, photos: removeLrcPhoto(current.input.photos, index) },
      }
    })
  }

  const coverIndex = editor ? lrcCoverIndex(editor.input.photos) : -1

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">LRC proizvodi</h1>
            <p className="mt-1 text-sm text-slate-600">
              Svi proizvodi iz kataloga. Novo počinje skriveno. Otvoreno oko je javno, zatvoreno oko skriva karticu i odabir u obrascu.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Novi proizvod
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            {notice ? <p className="mt-2 text-sm text-red-800">{notice}</p> : null}
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-slate-600">Učitavanje proizvoda...</p> : null}

        {!isLoading && products.length === 0 && !error ? (
          <div className="rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Katalog je prazan.</p>
          </div>
        ) : null}

        {products.length > 0 ? (
          <ul className="mb-8 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
            {products.map((product) => {
              const cover = product.photos[lrcCoverIndex(product.photos)]
              const pending = pendingCodes.has(product.code)
              return (
                <li key={product.code} className="flex flex-wrap items-center gap-4 bg-white px-4 py-3">
                  <div
                    className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md"
                    style={cover ? lrcFrameStyle(cover.frame) : undefined}
                  >
                    {cover ? (
                      <img src={cover.src} alt="" className="max-h-full max-w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{product.code}</p>
                    <p className="truncate text-sm text-slate-700">{product.title.hr || 'Bez naziva'}</p>
                    <p className="text-xs text-slate-500">{formatLrcEuro(product.retailPriceEuro)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleVisibility(product)}
                    disabled={pending}
                    aria-pressed={product.isVisible}
                    aria-label={product.isVisible ? `Sakrij ${product.code}` : `Prikaži ${product.code}`}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${
                      product.isVisible
                        ? 'border-violet-200 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {product.isVisible ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
                    {product.isVisible ? 'Javno' : 'Skriveno'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(product)}
                    className="min-h-11 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    Uredi
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {editor ? (
          <form
            className="space-y-6 rounded-xl border border-slate-200 p-4 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{editor.mode === 'create' ? 'Novi proizvod' : editor.code}</h2>
              {editor.mode === 'create' ? (
                <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <EyeOff size={18} aria-hidden />
                  Novi proizvod ostaje skriven dok ga nakon spremanja ne objaviš okom.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Šifra</span>
                <input
                  className={fieldClass}
                  value={editor.input.code}
                  disabled={editor.mode === 'edit'}
                  onChange={(event) => patchInput({ code: event.target.value.toUpperCase() })}
                  autoComplete="off"
                />
                <span className="mt-1 block text-xs text-slate-500">Oblik LRC-BAB-03. Šifra se kasnije ne mijenja.</span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Redoslijed</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={editor.input.sortOrder}
                  onChange={(event) => patchInput({ sortOrder: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Naziv (hrvatski)</span>
                <input className={fieldClass} value={editor.input.titleHr} onChange={(event) => patchInput({ titleHr: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Naziv (engleski)</span>
                <input className={fieldClass} value={editor.input.titleEn} onChange={(event) => patchInput({ titleEn: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Specifikacija (hrvatski)</span>
                <input className={fieldClass} value={editor.input.specsHr} onChange={(event) => patchInput({ specsHr: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Specifikacija (engleski)</span>
                <input className={fieldClass} value={editor.input.specsEn} onChange={(event) => patchInput({ specsEn: event.target.value })} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Opis (hrvatski)</span>
                <textarea className={fieldClass} rows={4} value={editor.input.descriptionHr} onChange={(event) => patchInput({ descriptionHr: event.target.value })} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Opis (engleski)</span>
                <textarea className={fieldClass} rows={4} value={editor.input.descriptionEn} onChange={(event) => patchInput({ descriptionEn: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Maloprodajna cijena (€)</span>
                <input className={fieldClass} inputMode="decimal" value={editor.input.retailPrice} onChange={(event) => patchInput({ retailPrice: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Bazna cijena (€)</span>
                <input className={fieldClass} inputMode="decimal" value={editor.input.basePrice} onChange={(event) => patchInput({ basePrice: event.target.value })} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Datum bazne cijene</span>
                <input className={fieldClass} value={editor.input.basePriceDate} onChange={(event) => patchInput({ basePriceDate: event.target.value })} placeholder="10. 9. 2026." />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Fotografije</h3>
                  <p className="text-xs text-slate-500">
                    Nova fotografija zadržava cijeli kadar. Boja okvira uzima se s lijevog i desnog ruba.
                  </p>
                </div>
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  {uploading ? 'Dodajem...' : 'Dodaj fotografije'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={uploading || saving}
                    onChange={(event) => {
                      void handleAddPhotos(event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>

              {editor.input.photos.length === 0 ? <p className="text-sm text-slate-500">Još nema fotografija.</p> : null}

              <ul className="space-y-4">
                {editor.input.photos.map((photo, index) => (
                  <li key={`${photo.src}-${index}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap gap-3">
                      <div
                        className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md"
                        style={lrcFrameStyle(photo.frame)}
                      >
                        <img src={photo.src} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="truncate text-xs text-slate-500">{photo.src}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            onClick={() => patchInput({ photos: moveLrcPhoto(editor.input.photos, index, -1) })}
                            disabled={index === 0}
                          >
                            Gore
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            onClick={() => patchInput({ photos: moveLrcPhoto(editor.input.photos, index, 1) })}
                            disabled={index === editor.input.photos.length - 1}
                          >
                            Dolje
                          </button>
                          <button
                            type="button"
                            className={`rounded-md border px-2 py-1 text-xs ${index === coverIndex ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200'}`}
                            aria-pressed={index === coverIndex}
                            onClick={() => patchInput({ photos: withLrcCover(editor.input.photos, index) })}
                          >
                            Naslovna
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                            disabled={saving || deleting}
                            onClick={() => handleRemovePhoto(index)}
                          >
                            Ukloni
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className={fieldClass}
                            value={photo.alt.hr}
                            placeholder="Alt tekst (hrvatski)"
                            onChange={(event) => patchPhoto(index, { ...photo, alt: { ...photo.alt, hr: event.target.value } })}
                          />
                          <input
                            className={fieldClass}
                            value={photo.alt.en}
                            placeholder="Alt text (English)"
                            onChange={(event) => patchPhoto(index, { ...photo, alt: { ...photo.alt, en: event.target.value } })}
                          />
                          <input
                            className={fieldClass}
                            value={photo.caption.hr}
                            placeholder="Natpis (hrvatski)"
                            onChange={(event) => patchPhoto(index, { ...photo, caption: { ...photo.caption, hr: event.target.value } })}
                          />
                          <input
                            className={fieldClass}
                            value={photo.caption.en}
                            placeholder="Caption (English)"
                            onChange={(event) => patchPhoto(index, { ...photo, caption: { ...photo.caption, en: event.target.value } })}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || uploading || deleting}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? 'Spremam...' : 'Spremi'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false)
                  setEditor(null)
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Zatvori
              </button>
            </div>

            {editor.mode === 'edit' ? (
              <div className="rounded-lg border border-red-200 p-4">
                {confirmDelete ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-900">
                      Trajno izbrisati proizvod „{editor.input.titleHr.trim() || 'Bez naziva'}” ({editor.code})?
                    </p>
                    <p className="text-xs text-slate-600">
                      Nestaje iz admin popisa, javnih kartica i odabira za nove upite. Raniji upiti ostaju sa spremljenim podacima.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={deleting || saving || uploading}
                        onClick={() => void handleDelete()}
                        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
                      >
                        {deleting ? 'Brišem...' : 'Trajno izbriši proizvod'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        Odustani
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
                  >
                    Trajno izbriši proizvod
                  </button>
                )}
              </div>
            ) : null}
          </form>
        ) : null}
      </section>
    </main>
  )
}
