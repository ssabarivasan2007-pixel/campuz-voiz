import { startTransition, useEffect, useState } from 'react'
import { ArrowRight, UserPlus, UsersRound } from 'lucide-react'
import { request } from '../services/api'

export function UserManagement() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('student')

  async function refreshUsers() {
    const result = await request('/admin/users')
    startTransition(() => setUsers(result.users))
  }

  useEffect(() => {
    refreshUsers().catch((problem) => setError(problem.message))
  }, [])

  async function createAccount(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const user = Object.fromEntries(form.entries())
    try {
      await request('/admin/users', { method: 'POST', body: JSON.stringify(user) })
      setNotice('Account created. Password is stored as a secure hash.')
      formElement.reset()
      await refreshUsers()
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="content-section user-management">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION / DIRECTORY</p><h1>Manage users</h1><p className="page-intro">Registered campus accounts and role access.</p></div><span className="result-count">{users.length} ACCOUNTS</span></div>
    <div className="user-layout">
      <section className="user-directory"><div className="directory-heading"><UsersRound size={18} /><h2>Campus directory</h2></div>{users.map((user) => <article className="user-row" key={user.id}><span className="avatar">{user.name?.[0]}</span><div><strong>{user.name}</strong><span>{user.loginId} · {user.department || 'Administration'}{user.year ? ` · ${user.year}` : ''}{user.subject ? ` · ${user.subject}` : ''}</span></div><span className={`role-label role-${user.role}`}>{user.role}</span></article>)}</section>
      <section className="user-create"><div className="directory-heading"><UserPlus size={18} /><h2>Add account</h2></div><form className="create-user-form" onSubmit={createAccount}>
        <label>Account type<select name="role" value={role} onChange={(event) => setRole(event.target.value)}><option value="student">Student</option><option value="faculty">Faculty</option></select></label>
        <label>Campus ID<input name="loginId" required placeholder="Enter a unique ID" /></label>
        <label>Full name<input name="name" required placeholder="Enter full name" /></label>
        <label>Department<select name="department" required><option value="">Select department</option><option>CSE</option><option>Food Technology</option></select></label>
        {role === 'student' ? <><label>Year<select name="year" required><option value="">Select year</option>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => <option key={year}>{year}</option>)}</select></label><label>Email<input name="email" type="email" required placeholder="student@campus.edu" /></label></> : <label>Subject<select name="subject" required><option value="">Select subject</option><option>Python</option><option>Java</option></select></label>}
        <label>Password<input name="password" type="password" minLength="10" required placeholder="At least 10 characters" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-note">{notice}</p>}
        <button className="button button-dark button-wide" disabled={busy}>{busy ? 'Creating…' : 'Create account'} <ArrowRight size={16} /></button>
      </form><p className="password-note">Passwords are hashed before storage and never shown in the directory.</p></section>
    </div>
  </section>
}