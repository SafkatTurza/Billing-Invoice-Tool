import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ls, KEYS } from '../lib/storage.js'
import { useApp } from './AppContext.jsx'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_ASSET_SETTINGS,
  newAsset,
  commitAssetSeq,
  previewAssetId,
  historyEntry,
  activeAssignment,
  findCategory,
  findSub,
  EVENT,
} from '../lib/assets.js'
import { uid } from '../lib/format.js'

const AssetContext = createContext(null)
export function useAssets() {
  const ctx = useContext(AssetContext)
  if (!ctx) throw new Error('useAssets must be used within AssetProvider')
  return ctx
}

export function AssetProvider({ children }) {
  const { currentUser, addAudit, notify, company } = useApp()

  const [assets, setAssets] = useState(() => ls.get(KEYS.assets, []))
  const [categories, setCategories] = useState(() => ls.get(KEYS.assetCategories, null) || DEFAULT_CATEGORIES)
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_ASSET_SETTINGS, ...ls.get(KEYS.assetSettings, {}) }))

  useEffect(() => {
    ls.set(KEYS.assets, assets)
  }, [assets])
  useEffect(() => {
    ls.set(KEYS.assetCategories, categories)
  }, [categories])
  useEffect(() => {
    ls.set(KEYS.assetSettings, settings)
  }, [settings])

  const saveSettings = useCallback((patch) => setSettings((prev) => ({ ...prev, ...patch })), [])
  const warnDays = Number(settings.warrantyWarnDays) || 30

  // Preview the next Asset ID for a subcategory code (pure — no reservation).
  const previewId = useCallback(
    (subCode) => previewAssetId(company, subCode, assets, settings.counters),
    [company, assets, settings.counters],
  )

  // ── Create / edit ─────────────────────────────────────────────────────────
  // First save reserves the permanent Asset ID (never reused) and stamps the
  // creation history event. Editing an existing asset never touches its ID or
  // its history except to append an "edited" entry.
  const saveAsset = useCallback(
    (draft) => {
      const now = new Date().toISOString()
      let saved
      const exists = assets.some((a) => a.id === draft.id)
      if (exists) {
        saved = { ...draft, updatedAt: now }
        setAssets((prev) => prev.map((a) => (a.id === draft.id ? saved : a)))
        addAudit('Asset edited', draft.assetId || draft.name, draft.name)
      } else {
        // Reserve the ID from the subcategory code unless the user typed their own.
        const sub = findSub(categories, draft.categoryId, draft.subId)
        const code = draft.catCode || sub?.code || 'OTH'
        let assetId = (draft.assetId || '').trim()
        if (!assetId) {
          // Auto-ID: preview (scans live records + counters) then reserve exactly
          // that number — no over-reserve, so sequences stay gap-free.
          assetId = previewAssetId(company, code, assets, settings.counters)
          const res = commitAssetSeq(code, assets, settings.counters)
          setSettings((prev) => ({ ...prev, counters: { ...prev.counters, [res.code]: res.seq } }))
        }
        // Manual ID: don't touch the counter. The saved asset carries the ID in
        // the array, and every future previewAssetId scans the array for the max,
        // so a higher manual number is honoured without leaving a gap.
        saved = {
          ...draft,
          assetId,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser?.id || null,
          createdByName: currentUser?.fullName || 'Unknown',
          history: [
            historyEntry(EVENT.CREATED, currentUser, {
              note: `${draft.name} registered`,
              newStatus: draft.status,
              newCondition: draft.condition,
            }),
            ...(draft.purchase?.tracked
              ? [historyEntry(EVENT.PURCHASED, currentUser, {
                  date: draft.purchase.date || undefined,
                  cost: Number(draft.purchase.amount) || 0,
                  currency: draft.purchase.currency,
                  note: draft.purchase.vendorName ? `Supplied by ${draft.purchase.vendorName}` : 'Purchase recorded',
                })]
              : []),
          ],
        }
        setAssets((prev) => [saved, ...prev])
        addAudit('Asset created', assetId, draft.name)
      }
      return saved
    },
    [assets, categories, settings.counters, company, currentUser, addAudit],
  )

  // Generic mutation: apply `fn(asset) → patch`, append a history event, audit.
  const mutate = useCallback(
    (id, buildPatch, eventBuilder, auditAction) => {
      let result = null
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a
          const patch = buildPatch(a) || {}
          const evt = eventBuilder ? eventBuilder(a, patch) : null
          result = {
            ...a,
            ...patch,
            updatedAt: new Date().toISOString(),
            history: evt ? [...(a.history || []), evt] : a.history,
          }
          return result
        }),
      )
      const target = result?.assetId || id
      if (auditAction) addAudit(auditAction, target, result?.name || '')
      return result
    },
    [addAudit],
  )

  // ── Assignment / transfer / return (§10) ────────────────────────────────────
  const assignAsset = useCallback(
    (id, payload) =>
      mutate(
        id,
        (a) => {
          const assignment = {
            id: uid(),
            status: 'active',
            employeeId: payload.employeeId || '',
            empId: payload.empId || '',
            name: payload.name || '',
            department: payload.department || '',
            designation: payload.designation || '',
            workType: payload.workType || '',
            assignDate: payload.assignDate,
            conditionAtAssign: payload.conditionAtAssign || a.condition,
            accessories: payload.accessories || '',
            expectedReturn: payload.expectedReturn || '',
            note: payload.note || '',
            assignedBy: currentUser?.fullName || '',
            approvalRef: payload.approvalRef || '',
          }
          return {
            assignments: [...(a.assignments || []), assignment],
            status: 'Assigned',
            custodyType: 'Employee',
            custodianEmployeeId: payload.employeeId || '',
            custodianEmpId: payload.empId || '',
            custodianName: payload.name || '',
            location: payload.workType === 'Remote' ? 'Remote Employee' : payload.location || a.location,
          }
        },
        (a) =>
          historyEntry(EVENT.ASSIGNED, currentUser, {
            date: payload.assignDate,
            to: payload.name || payload.empId,
            prevStatus: a.status,
            newStatus: 'Assigned',
            note: payload.note || `Assigned to ${payload.name || payload.empId}`,
          }),
        'Asset assigned',
      ),
    [mutate, currentUser],
  )

  // Return: close the active assignment, back to Available (or captured damage).
  const returnAsset = useCallback(
    (id, payload) =>
      mutate(
        id,
        (a) => {
          const assignments = (a.assignments || []).map((asg) =>
            asg.status === 'active'
              ? {
                  ...asg,
                  status: 'returned',
                  returnDate: payload.returnDate,
                  returnedBy: payload.returnedBy || asg.name,
                  receivedBy: payload.receivedBy || currentUser?.fullName || '',
                  conditionAtReturn: payload.conditionAtReturn || '',
                  missingAccessories: payload.missingAccessories || '',
                  damageFound: payload.damageFound || '',
                  returnNote: payload.note || '',
                }
              : asg,
          )
          const damaged = !!payload.damageFound
          return {
            assignments,
            status: 'Available',
            custodyType: payload.toStorage === false ? a.custodyType : 'Storage',
            custodianEmployeeId: '',
            custodianEmpId: '',
            custodianName: '',
            location: 'Storage',
            condition: payload.conditionAtReturn || a.condition,
            ...(damaged
              ? {
                  damages: [
                    ...(a.damages || []),
                    {
                      id: uid(),
                      date: payload.returnDate,
                      reportedBy: payload.receivedBy || currentUser?.fullName || '',
                      description: payload.damageFound,
                      condition: payload.conditionAtReturn || 'Damaged',
                      location: 'Storage',
                      action: '',
                    },
                  ],
                }
              : {}),
          }
        },
        (a) => {
          const asg = activeAssignment(a)
          return historyEntry(EVENT.RETURNED, currentUser, {
            date: payload.returnDate,
            from: asg?.name || asg?.empId,
            prevStatus: a.status,
            newStatus: 'Available',
            newCondition: payload.conditionAtReturn || undefined,
            note: payload.note || (payload.damageFound ? `Returned with damage: ${payload.damageFound}` : 'Returned to storage'),
          })
        },
        'Asset returned',
      ),
    [mutate, currentUser],
  )

  // Transfer = return-from-current + assign-to-next in one motion, preserving
  // the previous assignment in history (never overwritten, §9).
  const transferAsset = useCallback(
    (id, payload) =>
      mutate(
        id,
        (a) => {
          const assignments = (a.assignments || []).map((asg) =>
            asg.status === 'active'
              ? { ...asg, status: 'transferred', returnDate: payload.assignDate, receivedBy: currentUser?.fullName || '' }
              : asg,
          )
          assignments.push({
            id: uid(),
            status: 'active',
            employeeId: payload.employeeId || '',
            empId: payload.empId || '',
            name: payload.name || '',
            department: payload.department || '',
            designation: payload.designation || '',
            workType: payload.workType || '',
            assignDate: payload.assignDate,
            conditionAtAssign: payload.conditionAtAssign || a.condition,
            accessories: payload.accessories || '',
            expectedReturn: payload.expectedReturn || '',
            note: payload.note || '',
            assignedBy: currentUser?.fullName || '',
            approvalRef: payload.approvalRef || '',
          })
          return {
            assignments,
            status: 'Assigned',
            custodyType: 'Employee',
            custodianEmployeeId: payload.employeeId || '',
            custodianEmpId: payload.empId || '',
            custodianName: payload.name || '',
            location: payload.workType === 'Remote' ? 'Remote Employee' : a.location,
          }
        },
        (a) => {
          const asg = activeAssignment(a)
          return historyEntry(EVENT.TRANSFERRED, currentUser, {
            date: payload.assignDate,
            from: asg?.name || asg?.empId,
            to: payload.name || payload.empId,
            note: payload.note || `Transferred to ${payload.name || payload.empId}`,
          })
        },
        'Asset transferred',
      ),
    [mutate, currentUser],
  )

  // ── Common / office custody (§11) ──────────────────────────────────────────
  const setCustody = useCallback(
    (id, payload) =>
      mutate(
        id,
        () => ({
          usage: payload.usage,
          custodyType: payload.custodyType,
          custodianDept: payload.custodianDept || '',
          custodianTeam: payload.custodianTeam || '',
          custodianProject: payload.custodianProject || '',
          custodianName: payload.custodianName || '',
          location: payload.location,
          locationRoom: payload.locationRoom || '',
          status: payload.status || 'In Use',
        }),
        (a) =>
          historyEntry(EVENT.CUSTODIAN, currentUser, {
            prevLocation: a.location,
            newLocation: payload.location,
            note: payload.note || `Custody set to ${payload.custodyType}`,
          }),
        'Asset custody changed',
      ),
    [mutate, currentUser],
  )

  // ── Status / condition / location primitives ───────────────────────────────
  const changeStatus = useCallback(
    (id, status, note) =>
      mutate(
        id,
        () => ({ status }),
        (a) => historyEntry(EVENT.STATUS, currentUser, { prevStatus: a.status, newStatus: status, note: note || '' }),
        'Asset status changed',
      ),
    [mutate, currentUser],
  )
  const changeCondition = useCallback(
    (id, condition, note) =>
      mutate(
        id,
        () => ({ condition }),
        (a) => historyEntry(EVENT.CONDITION, currentUser, { prevCondition: a.condition, newCondition: condition, note: note || '' }),
        'Asset condition changed',
      ),
    [mutate, currentUser],
  )

  // ── Damage (§17) ───────────────────────────────────────────────────────────
  const recordDamage = useCallback(
    (id, payload) =>
      mutate(
        id,
        (a) => ({
          damages: [...(a.damages || []), { id: uid(), ...payload }],
          condition: payload.condition || 'Damaged',
          ...(payload.action === 'Mark Unusable' ? { condition: 'Unusable' } : {}),
        }),
        (a) =>
          historyEntry(EVENT.DAMAGE, currentUser, {
            date: payload.date,
            prevCondition: a.condition,
            newCondition: payload.condition || 'Damaged',
            note: payload.description || 'Damage reported',
          }),
        'Asset damage reported',
      ),
    [mutate, currentUser],
  )

  // ── Repair & maintenance (§18) ─────────────────────────────────────────────
  const recordRepair = useCallback(
    (id, payload) =>
      mutate(
        id,
        (a) => {
          const repair = { id: uid(), ...payload }
          // A completed repair returns the asset to service; if still out, keep
          // it Under Repair.
          const done = !!payload.returnedDate || payload.result
          const nextStatus = done ? (activeAssignment(a) ? 'Assigned' : 'Available') : 'Under Repair'
          return {
            repairs: [...(a.repairs || []), repair],
            status: nextStatus,
            ...(done && payload.resultCondition ? { condition: payload.resultCondition } : {}),
          }
        },
        (a) =>
          historyEntry(payload.returnedDate || payload.result ? EVENT.REPAIR_DONE : EVENT.REPAIR_SENT, currentUser, {
            date: payload.date,
            cost: Number(payload.companyCost) || 0,
            currency: payload.currency || 'BDT',
            note:
              (payload.result ? `${payload.result} — ` : '') +
              (payload.issue || 'Repair') +
              (payload.warrantyClaim ? ' (warranty claim)' : ''),
          }),
        'Asset repair recorded',
      ),
    [mutate, currentUser],
  )

  // ── Warranty extension (§16) — never silently resets warranty ───────────────
  const extendWarranty = useCallback(
    (id, { newEnd, reason, date }) =>
      mutate(
        id,
        (a) => ({
          warranty: {
            ...a.warranty,
            endDate: newEnd,
            extensions: [...(a.warranty?.extensions || []), { prevEnd: a.warranty?.endDate || '', newEnd, reason, date }],
          },
        }),
        (a) =>
          historyEntry(EVENT.WARRANTY_EXT, currentUser, {
            date,
            from: a.warranty?.endDate || '—',
            to: newEnd,
            note: reason || 'Warranty extended',
          }),
        'Asset warranty extended',
      ),
    [mutate, currentUser],
  )

  // ── Missing / lost / recovered (§21) — record never deleted ─────────────────
  const reportIncident = useCallback(
    (id, payload) => {
      const type = payload.type // 'Missing' | 'Lost' | 'Recovered'
      const evtType = type === 'Lost' ? EVENT.LOST : type === 'Recovered' ? EVENT.RECOVERED : EVENT.MISSING
      return mutate(
        id,
        (a) => ({
          incidents: [...(a.incidents || []), { id: uid(), ...payload }],
          status: type === 'Recovered' ? 'Available' : type,
          ...(type === 'Recovered' ? { location: 'Storage', custodyType: 'Storage' } : {}),
        }),
        (a) =>
          historyEntry(evtType, currentUser, {
            date: payload.dateReported,
            prevStatus: a.status,
            newStatus: type === 'Recovered' ? 'Available' : type,
            note: payload.description || type,
          }),
        `Asset reported ${type.toLowerCase()}`,
      )
    },
    [mutate, currentUser],
  )

  // ── Disposal / write-off (§22) — asset stays permanently searchable ─────────
  const disposeAsset = useCallback(
    (id, payload) => {
      const status = payload.type === 'Sold' ? 'Sold' : payload.type === 'Written Off' ? 'Written Off' : 'Disposed'
      const evtType = payload.type === 'Sold' ? EVENT.SOLD : payload.type === 'Written Off' ? EVENT.WRITEOFF : EVENT.DISPOSED
      return mutate(
        id,
        () => ({ disposal: { ...payload }, status }),
        (a) =>
          historyEntry(evtType, currentUser, {
            date: payload.date,
            prevStatus: a.status,
            newStatus: status,
            cost: Number(payload.value) || 0,
            currency: payload.currency || 'BDT',
            note: payload.reason || `${payload.type}`,
          }),
        `Asset ${status.toLowerCase()}`,
      )
    },
    [mutate, currentUser],
  )

  // ── Categories (§3) — configurable, no code change needed ───────────────────
  const saveCategory = useCallback((cat) => {
    setCategories((prev) => {
      const i = prev.findIndex((c) => c.id === cat.id)
      if (i >= 0) {
        const c = [...prev]
        c[i] = cat
        return c
      }
      return [...prev, { ...cat, id: cat.id || 'cat-' + uid() }]
    })
  }, [])
  const deleteCategory = useCallback((id) => setCategories((prev) => prev.filter((c) => c.id !== id)), [])

  // ── Saved register views (§25) ──────────────────────────────────────────────
  const saveView = useCallback((name, filter) => {
    const view = { id: 'view-' + uid(), name, filter }
    setSettings((prev) => ({ ...prev, savedViews: [...(prev.savedViews || []), view] }))
    return view
  }, [])
  const deleteView = useCallback((id) => {
    setSettings((prev) => ({ ...prev, savedViews: (prev.savedViews || []).filter((v) => v.id !== id) }))
  }, [])

  const getAsset = useCallback((id) => assets.find((a) => a.id === id) || null, [assets])

  const value = {
    assets,
    categories,
    settings,
    warnDays,
    saveSettings,
    previewId,
    getAsset,
    saveAsset,
    assignAsset,
    returnAsset,
    transferAsset,
    setCustody,
    changeStatus,
    changeCondition,
    recordDamage,
    recordRepair,
    extendWarranty,
    reportIncident,
    disposeAsset,
    saveCategory,
    deleteCategory,
    saveView,
    deleteView,
    findCategory: (catId) => findCategory(categories, catId),
    findSub: (catId, subId) => findSub(categories, catId, subId),
  }
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>
}
