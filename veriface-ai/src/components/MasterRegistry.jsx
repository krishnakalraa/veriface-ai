import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function MasterRegistry({ onSelectProfileForTest }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDoc, setFilterDoc] = useState('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStatus, setImportStatus] = useState(null)
  const [importSummary, setImportSummary] = useState(null)
  const fileInputRef = useRef(null)

  const [newPerson, setNewPerson] = useState({
    id_number: '',
    full_name: '',
    dob: '2001-01-01',
    document_type: 'campus_id',
    institution_id: 'IIT-D',
    photo_reference: '',
  })
  const [insertStatus, setInsertStatus] = useState(null)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error fetching Supabase people records:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // Handle Photo Reference Upload for Single Person
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setInsertStatus('error: Select an image file for the reference face photo.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setNewPerson((prev) => ({ ...prev, photo_reference: event.target.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleAddPerson = async (e) => {
    e.preventDefault()
    if (!newPerson.photo_reference.startsWith('data:image/')) {
      setInsertStatus('error: Upload a valid reference face photo before registering this person.')
      return
    }
    setInsertStatus('saving')
    try {
      const payload = {
        id_number: newPerson.id_number.trim(),
        full_name: newPerson.full_name.trim(),
        dob: newPerson.dob,
        document_type: newPerson.document_type,
        institution_id: newPerson.institution_id ? newPerson.institution_id.trim() : null,
      }
      payload.photo_reference = newPerson.photo_reference

      const { error } = await supabase.from('people').insert([payload])
      if (error) throw error
      setInsertStatus('success')
      setShowAddModal(false)
      setNewPerson({
        id_number: '',
        full_name: '',
        dob: '2001-01-01',
        document_type: 'campus_id',
        institution_id: 'IIT-D',
        photo_reference: '',
      })
      await fetchRecords()
    } catch (err) {
      console.error('Insert error:', err)
      setInsertStatus('error: ' + err.message)
    }
  }

  const handleDeletePerson = async (id, name, idNumber) => {
    if (!window.confirm(`Are you sure you want to delete ${name} (ID: ${idNumber})?`)) return
    try {
      const { data, error } = await supabase.from('people').delete().eq('id', id).select()
      if (error) throw error
      if (!data || data.length === 0) {
        alert(
          `Row Level Security (RLS) is blocking deletes in Supabase.\n\nTo allow web app deletes, run this in your Supabase SQL Editor:\n\nALTER TABLE public.people DISABLE ROW LEVEL SECURITY;`
        )
      }
      await fetchRecords()
    } catch (err) {
      console.error('Delete error:', err)
      alert(
        `Delete failed: ${err.message}\n\nTo allow delete operations, run this in Supabase SQL Editor:\nALTER TABLE public.people DISABLE ROW LEVEL SECURITY;`
      )
    }
  }

  // Bulk Excel/CSV Import via SheetJS
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImportStatus('reading')
    setImportSummary(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (!jsonData || jsonData.length === 0) {
        setImportStatus('No data rows found in spreadsheet.')
        return
      }

      setImportStatus(`Parsed ${jsonData.length} rows. Uploading to Supabase...`)

      // Normalize row objects
      const formatted = jsonData.map((row) => ({
        id_number: String(row.id_number || row['ID Number'] || row.id || '').trim(),
        full_name: String(row.full_name || row['Full Name'] || row.name || '').trim(),
        dob: String(row.dob || row['DOB'] || row['Date of Birth'] || '2001-01-01').trim(),
        document_type: String(row.document_type || row['Document Type'] || 'campus_id').trim().toLowerCase(),
        institution_id: row.institution_id || row['Institution'] || null,
        photo_reference: String(row.photo_reference || row['Photo Reference'] || '').trim(),
      })).filter((r) => r.id_number && r.full_name)

      const eligibleRows = formatted.filter((row) => row.photo_reference.startsWith('data:image/'))
      const skippedMissingPhoto = formatted.length - eligibleRows.length

      let inserted = 0
      let errors = 0

      for (const item of eligibleRows) {
        const { error } = await supabase.from('people').upsert(item, { onConflict: 'id_number' })
        if (error) {
          console.warn('Row import error:', error)
          errors++
        } else {
          inserted++
        }
      }

      setImportSummary({ total: formatted.length, inserted, errors, skippedMissingPhoto })
      setImportStatus('success')
      await fetchRecords()
    } catch (err) {
      console.error('Spreadsheet parse error:', err)
      setImportStatus('Failed to parse file: ' + err.message)
    }
  }

  // Download Sample Excel Template
  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        id_number: '234567890123',
        full_name: 'Aarav Sharma',
        dob: '2001-03-15',
        document_type: 'campus_id',
        institution_id: 'IIT-D',
        photo_reference: '',
      },
      {
        id_number: '411445566778',
        full_name: 'Amit Kumar',
        dob: '1997-05-21',
        document_type: 'aadhaar',
        institution_id: '',
        photo_reference: '',
      },
      {
        id_number: '334455667788',
        full_name: 'Siddharth Joshi',
        dob: '1998-08-09',
        document_type: 'driving_license',
        institution_id: '',
        photo_reference: '',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(sampleData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MasterList')
    XLSX.writeFile(workbook, 'VeriFace_Master_Template.xlsx')
  }

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id_number?.includes(searchTerm) ||
      (r.institution_id && r.institution_id.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesDoc = filterDoc === 'ALL' || r.document_type === filterDoc
    return matchesSearch && matchesDoc
  })

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">🗄️ Supabase Master Registry</h2>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live PostgreSQL
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Encrypted ground-truth database ({records.length} registered profiles). Used in Layer 4 cross-checks.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchRecords}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 px-3 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-700/60 text-xs font-medium py-2 px-3 rounded-lg transition flex items-center gap-1.5"
          >
            📊 Bulk Import (Excel/CSV)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition shadow-md flex items-center gap-1.5"
          >
            ➕ Register Person
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700/80 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by ID number, Name, or Institution..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 text-slate-200 text-xs sm:text-sm rounded-lg pl-8 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500 transition"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'campus_id', 'aadhaar', 'kisan_card', 'driving_license', 'pan'].map((doc) => (
            <button
              key={doc}
              onClick={() => setFilterDoc(doc)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filterDoc === doc
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {doc === 'ALL'
                ? 'All Types'
                : doc === 'campus_id'
                ? 'Campus ID'
                : doc === 'aadhaar'
                ? 'Aadhaar'
                : doc === 'kisan_card'
                ? 'Kisan Card'
                : doc === 'driving_license'
                ? 'License'
                : 'PAN'}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-xs">Loading database records from Supabase...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No records found matching "{searchTerm}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800/90 hover:bg-slate-800 rounded-xl p-4 border border-slate-700/70 hover:border-purple-500/50 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {r.full_name}
                    </h3>
                    <p className="text-xs font-mono text-cyan-400 font-semibold mt-0.5 tracking-wider">
                      {r.id_number}
                    </p>
                  </div>
                  <span
                    className={`text-[0.65rem] uppercase px-2 py-0.5 rounded font-bold ${
                      r.document_type === 'campus_id'
                        ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                        : r.document_type === 'aadhaar'
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                        : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {r.document_type?.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1 text-[0.72rem] text-slate-400 mb-3 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date of Birth:</span>
                    <span className="text-slate-300 font-medium">{r.dob}</span>
                  </div>
                  {r.institution_id && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Institution:</span>
                      <span className="text-purple-300 font-medium">{r.institution_id}</span>
                    </div>
                  )}
                  {r.photo_reference && (
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-500">Photo Ref:</span>
                      <span className="text-emerald-400 text-[0.65rem] font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                        {r.photo_reference.startsWith('data:') ? 'Stored Biometric Photo' : r.photo_reference}
                      </span>
                    </div>
                  )}
                  {!r.photo_reference && (
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-500">Photo Ref:</span>
                      <span className="text-red-400 text-[0.65rem] font-bold">Missing biometric photo</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onSelectProfileForTest && onSelectProfileForTest(r)}
                  className="flex-1 bg-purple-950/60 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-800/80 hover:border-purple-600 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5"
                  title="Run verification pipeline test using this profile"
                >
                  <span>⚡</span> Test
                </button>
                <button
                  onClick={() => handleDeletePerson(r.id, r.full_name, r.id_number)}
                  className="bg-red-950/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 hover:border-red-600 text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center"
                  title="Delete this record from Supabase"
                >
                  🗑️
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Single Record Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-2">➕ Register Person in Supabase</h3>
              <p className="text-xs text-slate-400 mb-4">
                Adds a trusted record to Supabase. When this ID is scanned or extracted, VeriFace AI cross-checks against these values.
              </p>

              <form onSubmit={handleAddPerson} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Full Name (as on card)</label>
                  <input
                    type="text"
                    required
                    value={newPerson.full_name}
                    onChange={(e) => setNewPerson({ ...newPerson, full_name: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">ID Number (Aadhaar / Campus ID / License)</label>
                  <input
                    type="text"
                    required
                    value={newPerson.id_number}
                    onChange={(e) => setNewPerson({ ...newPerson, id_number: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="e.g. 123456789012 or IITD202401"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={newPerson.dob}
                      onChange={(e) => setNewPerson({ ...newPerson, dob: e.target.value })}
                      className="w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Document Type</label>
                    <select
                      value={newPerson.document_type}
                      onChange={(e) => setNewPerson({ ...newPerson, document_type: e.target.value })}
                      className="w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:border-purple-500"
                    >
                      <option value="campus_id">Campus ID</option>
                      <option value="aadhaar">Aadhaar</option>
                      <option value="kisan_card">Kisan Card</option>
                      <option value="driving_license">Driving License</option>
                      <option value="pan">PAN Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Institution / Issuer (Optional)</label>
                  <input
                    type="text"
                    value={newPerson.institution_id}
                    onChange={(e) => setNewPerson({ ...newPerson, institution_id: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-purple-500"
                    placeholder="e.g. IIT Delhi or RTO Delhi"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Reference Face Photo (Required)</label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={handlePhotoUpload}
                    className="w-full text-slate-400 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-900 file:text-purple-200 hover:file:bg-purple-800 cursor-pointer"
                  />
                  {newPerson.photo_reference && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={newPerson.photo_reference} alt="Preview" className="w-10 h-10 rounded object-cover border border-purple-500" />
                      <span className="text-[0.68rem] text-emerald-400">Photo attached for facial recognition</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={insertStatus === 'saving'}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 rounded-lg transition"
                  >
                    {insertStatus === 'saving' ? 'Saving...' : 'Save to Supabase'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Excel/CSV Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📊</span> Bulk Import from Excel / CSV
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Upload a spreadsheet (.xlsx or .csv) containing person records. Each row must include <code className="text-cyan-400">id_number</code>, <code className="text-cyan-400">full_name</code>, and a <code className="text-cyan-400">photo_reference</code> image data URL.
              </p>

              <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-300 font-medium">Need a starting format?</span>
                <button
                  onClick={downloadSampleTemplate}
                  className="bg-purple-900/60 hover:bg-purple-700 text-purple-200 px-3 py-1.5 rounded-lg border border-purple-700 transition flex items-center gap-1.5"
                >
                  <span>📥</span> Download Sample Template (.xlsx)
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-8 text-center bg-slate-900/40 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="text-3xl mb-2">📁</div>
                <p className="text-xs text-slate-300 font-medium mb-1">Click to browse or drop file here</p>
                <p className="text-[0.65rem] text-slate-500 mb-3">Supports Microsoft Excel (.xlsx, .xls) and CSV</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition"
                >
                  Select File
                </button>
              </div>

              {importStatus && (
                <div className="text-xs p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  {importStatus}
                  {importSummary && (
                    <div className="mt-2 text-emerald-400 font-semibold">
                      ✅ Imported {importSummary.inserted} of {importSummary.total} rows. Skipped for missing photo: {importSummary.skippedMissingPhoto}; errors: {importSummary.errors}.
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium py-2 px-4 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MasterRegistry
