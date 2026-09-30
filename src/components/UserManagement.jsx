import { startTransition, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, GraduationCap, Pencil, Plus, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { request } from '../services/api'

const idPattern = '^\\d{8}$'
const passwordPattern = '^(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9]).{8}$'

export function UserManagement() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('student')
  const [mode, setMode] = useState('directory')
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function refreshUsers() {
    const result = await request('/admin/users')
    startTransition(() => setUsers(result.users))
  }

  useEffect(() => {
    refreshUsers().catch((problem) => setError(problem.message))
  }, [])

  function openCreate(nextRole) {
    setEditing(null)
    setRole(nextRole)
    setMode(nextRole)
    setError('')
    setNotice('')
  }

  function openEdit(user) {
    setEditing(user)
    setRole(user.role)
    setMode(user.role)
    setError('')
    setNotice('')
  }

  async function saveAccount(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const account = Object.fromEntries(form.entries())
    try {
      if (editing) {
        const updates = Object.fromEntries(Object.entries(account).filter(([, value]) => value !== ''))
        delete updates.role
        await request(`/admin/users/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(updates) })
        setNotice('Account updated.')
      } else {
        await request('/admin/users', { method: 'POST', body: JSON.stringify(account) })
        setNotice('Account created.')
      }
      await refreshUsers()
      setMode('directory')
      setEditing(null)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount(user) {
    setBusy(true)
    setError('')
    try {
      await request(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      setConfirmDelete(null)
      setNotice('Account deleted.')
      await refreshUsers()
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  function cancelForm() {
    setMode('directory')
    setEditing(null)
    setError('')
    setNotice('')
  }

  return <section className="content-section user-management">
    <div className="page-heading users-heading"><div><p className="eyebrow">ADMINISTRATION / DIRECTORY</p><h1>Manage Users</h1></div>{mode === 'directory' && <button className="button button-dark" onClick={() => { setMode('choose'); setNotice('') }}><Plus size={16} /> Create Account</button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-note" role="status">{notice}</p>}
    {mode === 'choose' && <section className="account-choice"><button type="button" className="back-link" onClick={cancelForm}><ArrowLeft size={15} /> Back to users</button><h2>Choose account type</h2><div><button type="button" onClick={() => openCreate('student')}><span><GraduationIcon /></span><strong>Student Account</strong><ArrowRight size={17} /></button><button type="button" onClick={() => openCreate('faculty')}><span><UserRound size={20} /></span><strong>Faculty Account</strong><ArrowRight size={17} /></button></div></section>}
    {mode === 'student' || mode === 'faculty' ? <section className="account-editor"><button type="button" className="back-link" onClick={cancelForm}><ArrowLeft size={15} /> Back to users</button><div className="directory-heading"><UserRound size={18} /><h2>{editing ? `Edit ${role} account` : `${role === 'student' ? 'Student' : 'Faculty'} Account`}</h2></div><form className="create-user-form account-form" onSubmit={saveAccount}>
      {!editing && <input type="hidden" name="role" value={role} />}
      <label>Name<input name="name" required defaultValue={editing?.name} placeholder="Full name" /></label>
      {role === 'student' && <label>Year of pursuing<select name="year" required defaultValue={editing?.year || ''}><option value="">Select year</option>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => <option key={year}>{year}</option>)}</select></label>}
      {role === 'faculty' && <label>Core Subject<select name="subject" required defaultValue={editing?.subject || ''}><option value="">Select subject</option><option>Python</option><option>Java</option></select></label>}
      <label>Department<select name="department" required defaultValue={editing?.department || ''}><option value="">Select department</option><option>CSE</option><option>Food Technology</option></select></label>
      <label>Email<input name="email" type="email" required defaultValue={editing?.email || ''} placeholder="name@campus.edu" /></label>
      {role === 'student' && <label>Phone number<input name="phone" type="tel" required defaultValue={editing?.phone || ''} placeholder="Phone number" /></label>}
      <label>User ID<input name="loginId" inputMode="numeric" pattern={idPattern} maxLength="8" minLength="8" required defaultValue={editing?.loginId || ''} placeholder="8 digits" /></label>
      <label>Password<input name="password" type="password" pattern={passwordPattern} maxLength="8" minLength={editing ? undefined : '8'} required={!editing} placeholder={editing ? 'Leave blank to keep current' : '8 chars: upper, lower, special'} /></label>
      <p className="password-note">{editing ? 'Leave password blank to keep it unchanged.' : 'Exactly 8 characters, including uppercase, lowercase, and a special character.'} Passwords are never shown in the directory.</p>
      <button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'} <ArrowRight size={16} /></button>
    </form></section> : null}
    {mode === 'directory' && <section className="user-directory"><div className="directory-heading"><UsersRound size={18} /><h2>Campus directory</h2><span className="result-count">{users.length} ACCOUNTS</span></div>{users.map((user) => <article className="user-row" key={user.id}><span className="avatar">{user.name?.[0]}</span><div className="user-row-info"><strong>{user.name}</strong><span>{user.loginId} · {user.department || 'Administration'}{user.year ? ` · ${user.year}` : ''}{user.subject ? ` · ${user.subject}` : ''}</span></div><span className={`role-label role-${user.role}`}>{user.role}</span>{user.role !== 'admin' && <div className="user-actions"><button type="button" title="Edit account" aria-label={`Edit ${user.name}`} onClick={() => openEdit(user)}><Pencil size={15} /></button><button type="button" title="Delete account" aria-label={`Delete ${user.name}`} onClick={() => setConfirmDelete(user)}><Trash2 size={15} /></button></div>}{confirmDelete?.id === user.id && <div className="delete-confirm" role="alertdialog" aria-label={`Confirm deleting ${user.name}`}><span>Delete {user.name}?</span><button type="button" className="confirm-delete-button" disabled={busy} onClick={() => deleteAccount(user)}>Delete</button><button type="button" className="icon-button" aria-label="Cancel delete" onClick={() => setConfirmDelete(null)}><X size={14} /></button></div>}</article>)}</section>}
  </section>
}

function GraduationIcon() {
  return <GraduationCap size={20} />
}