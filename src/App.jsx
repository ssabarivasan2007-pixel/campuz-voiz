import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, AudioLines, Building2, ChartNoAxesCombined, ClipboardList, GraduationCap, LogOut, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { ReportForm, SuccessPage } from './components/ReportForm'
import { ReportDetails, ReportTimeline } from './components/ReportDetails'
import { UserManagement } from './components/UserManagement'
import { request } from './services/api'
import './App.css'

const Analytics = lazy(() => import('./components/Analytics').then((module) => ({ default: module.Analytics })))
const FacultyAnalytics = lazy(() => import('./components/Analytics').then((module) => ({ default: module.FacultyAnalytics })))

const portals = [
  { role: 'student', title: 'Student', detail: 'Share what is working and what could be better.', icon: GraduationCap },
  { role: 'faculty', title: 'Faculty', detail: 'Understand student feedback for your classes.', icon: UsersRound },
  { role: 'admin', title: 'Administrator', detail: 'Turn campus-wide feedback into clear priorities.', icon: ShieldCheck },
]

function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('campuz-user') || 'null'))
  const [token, setToken] = useState(() => sessionStorage.getItem('campuz-token'))
  const [loginRole, setLoginRole] = useState(null)
  const [view, setView] = useState('dashboard')
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    request('/auth/me').then(({ user: currentUser }) => {
      if (active) setUser(currentUser)
    }).catch(() => {
      sessionStorage.removeItem('campuz-token')
      sessionStorage.removeItem('campuz-user')
      if (active) { setToken(null); setUser(null) }
    })
    return () => { active = false }
  }, [token])

  async function handleLogin(event) {
    event.preventDefault()
    setBusy(true)
    setLoginError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await request('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ loginId: form.get('loginId'), password: form.get('password'), role: loginRole }),
      })
      sessionStorage.setItem('campuz-token', result.token)
      sessionStorage.setItem('campuz-user', JSON.stringify(result.user))
      setToken(result.token)
      setUser(result.user)
      setLoginRole(null)
      setView('dashboard')
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('campuz-token')
    sessionStorage.removeItem('campuz-user')
    setToken(null)
    setUser(null)
    setView('home')
    setLoginRole(null)
  }

  if (user && token) return <Workspace user={user} view={view} setView={setView} logout={logout} />
  if (loginRole) {
    const portal = portals.find((item) => item.role === loginRole)
    const Icon = portal.icon
    return (
      <main className="login-page">
        <button className="back-link" type="button" onClick={() => { setLoginRole(null); setLoginError('') }}><ArrowLeft size={17} /> Back to home</button>
        <section className="login-panel">
          <div className="login-mark"><Icon size={24} /></div>
          <p className="eyebrow">CAMPUZ VOIZ / {portal.title.toUpperCase()} PORTAL</p>
          <h1>Good to have<br />you here.</h1>
          <p className="muted">Sign in with your registered campus ID.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="login-id">{loginRole === 'student' ? 'Student ID' : loginRole === 'faculty' ? 'Faculty ID' : 'Administrator ID'}</label>
            <input id="login-id" name="loginId" autoComplete="username" placeholder={loginRole === 'admin' ? 'e.g. admin' : 'Enter your campus ID'} required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
            {loginError && <p className="form-error" role="alert">{loginError}</p>}
            <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
          </form>
          {loginRole === 'student' && <p className="login-hint">Demo IDs: <strong>20247369</strong> · <strong>20246379</strong></p>}
          {loginRole === 'faculty' && <p className="login-hint">Demo IDs: <strong>20237369</strong> · <strong>20236379</strong></p>}
          {loginRole === 'admin' && <p className="login-hint">Administrator credentials are configured on the server.</p>}
        </section>
        <div className="login-aside"><div className="aside-quote">“The best campus<br />improvements begin<br />with a conversation.”</div><span>Your voice stays yours.</span></div>
      </main>
    )
  }
  return <Landing onLogin={setLoginRole} />
}

function Landing({ onLogin }) {
  return (
    <main className="landing">
      <header className="landing-header">
        <a className="wordmark" href="#top"><span className="brand-symbol"><AudioLines size={18} /></span> CAMPUZ <b>VOIZ</b></a>
        <div className="header-note"><span className="status-dot" /> CAMPUS FEEDBACK, MADE ACTIONABLE</div>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>01</span> A BETTER CAMPUS, TOGETHER</p>
          <h1>Welcome to<br /><em>Campuz Voiz</em><span className="wave"> 👋</span></h1>
          <p className="hero-message">Kindly feel free to give your feedback or report an issue. Your voice helps create meaningful changes and better solutions across the campus.</p>
          <div className="hero-caption"><span className="caption-line" /> YOUR VOICE. OUR CAMPUS. BETTER TOMORROW.</div>
        </div>
        <div className="hero-photo">
          <img src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=85" alt="University campus building framed by green trees" />
          <div className="photo-note"><span><AudioLines size={17} /></span><div><strong>A CAMPUS THAT LISTENS</strong><small>EST. FOR EVERY VOICE</small></div><span className="photo-note-index">01 / 03</span></div>
        </div>
      </section>
      <section className="portal-section">
        <div className="section-heading"><div><p className="eyebrow">CHOOSE YOUR SPACE</p><h2>Where would you like to begin?</h2></div><span className="section-index">01 — 03</span></div>
        <div className="portal-grid">
          {portals.map(({ role, title, detail, icon: Icon }, index) => (
            <article className={`portal-card portal-${role}`} key={role} style={{ '--delay': `${index * 90}ms` }}>
              <div className="portal-top"><span className="portal-icon"><Icon size={21} strokeWidth={1.8} /></span><span className="portal-number">0{index + 1}</span></div>
              <h3>{title} <span>portal</span></h3>
              <p>{detail}</p>
              <button className="portal-button" type="button" onClick={() => onLogin(role)}>Continue <ArrowRight size={16} /></button>
            </article>
          ))}
        </div>
      </section>
      <footer className="landing-footer"><span>CAMPUZ VOIZ © 2026</span><span>Your Voice. Our Campus. Better Tomorrow.</span><span>BUILT TO LISTEN <AudioLines size={13} /></span></footer>
    </main>
  )
}

function Workspace({ user, view, setView, logout }) {
  const [submitted, setSubmitted] = useState(null)
  function navigate(nextView) {
    setSubmitted(null)
    setView(nextView)
  }
  const studentNav = [
    { id: 'report', label: 'Report', icon: ClipboardList },
    { id: 'pulses', label: 'Monthly pulses', icon: AudioLines },
    { id: 'status', label: 'Status bar', icon: ChartNoAxesCombined },
  ]
  const staffNav = user.role === 'admin'
    ? [{ id: 'analytics', label: 'Overview', icon: ChartNoAxesCombined }, { id: 'status', label: 'All reports', icon: ClipboardList }, { id: 'report-status', label: 'Report Status', icon: ChartNoAxesCombined }, { id: 'users', label: 'Manage users', icon: UserRound }]
    : [{ id: 'analytics', label: 'Feedback insights', icon: ChartNoAxesCombined }, { id: 'status', label: 'Anonymous reports', icon: ClipboardList }]
  const navigation = user.role === 'student' ? studentNav : staffNav

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="wordmark side-wordmark" href="#home" onClick={(event) => { event.preventDefault(); setView('dashboard') }}><span className="brand-symbol"><AudioLines size={18} /></span><span>CAMPUZ <b>VOIZ</b></span></a>
        <div className="side-rule" />
        <p className="side-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Workspace">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{view === id && <span className="nav-active-mark" />}</button>)}
        </nav>
        <div className="side-bottom">
          <div className="confidential-note"><ShieldCheck size={17} /><span>Feedback stays confidential to faculty.</span></div>
          <button className="logout-button" onClick={logout}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="topbar"><div className="breadcrumb"><span>CAMPUZ VOIZ</span><span className="crumb-divider">/</span><strong>{navigation.find((item) => item.id === view)?.label ?? 'Workspace'}</strong></div><div className="topbar-actions"><div className="profile-chip"><span className="avatar">{user.name?.[0]}</span><span className="profile-name">{user.name}<small>{user.role}</small></span><Building2 size={16} className="profile-campus-icon" /></div><button className="mobile-logout" type="button" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={17} /></button></div></header>
        {submitted ? <SuccessPage reportId={submitted} onDone={() => { setSubmitted(null); navigate('status') }} /> : <>
          {view === 'dashboard' && <Welcome user={user} onReport={() => navigate('report')} />}
          {view === 'report' && user.role === 'student' && <ReportForm key="report" user={user} initialCategory="" onSubmitted={setSubmitted} />}
          {view === 'pulses' && user.role === 'student' && <ReportForm key="pulse" user={user} initialCategory="Monthly Pulses" onSubmitted={setSubmitted} />}
          {(view === 'status' || view === 'report-status') && <StatusView key={view} user={user} reportStatus={view === 'report-status'} />}
          {view === 'analytics' && <Suspense fallback={<div className="content-section loading-state">Loading campus insights…</div>}>{user.role === 'admin' ? <Analytics /> : <FacultyAnalytics user={user} />}</Suspense>}
          {view === 'users' && user.role === 'admin' && <UserManagement />}
          {view === 'dashboard' && user.role !== 'student' && <Suspense fallback={<div className="content-section loading-state">Loading campus insights…</div>}>{user.role === 'admin' ? <Analytics /> : <FacultyAnalytics user={user} />}</Suspense>}
        </>}
      </main>
    </div>
  )
}

function Welcome({ user, onReport }) {
  if (user.role !== 'student') return null
  return <section className="welcome-block"><div><p className="eyebrow">YOUR CAMPUS, YOUR VOICE</p><h1>Welcome back,<br /><em>{user.name}</em><span className="wave">.</span></h1><p className="welcome-subtitle">How’s everything going today?</p></div><div className="welcome-actions"><button className="button button-dark" onClick={onReport}>Share feedback <ArrowRight size={17} /></button><div className="student-meta"><span>{user.department}</span><i />{user.year}</div></div></section>
}

function StatusView({ user, reportStatus = false }) {
  const [reports, setReports] = useState([])
  const [filters, setFilters] = useState({})
  const [error, setError] = useState('')
  const [loadedQuery, setLoadedQuery] = useState(null)
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
  if (reportStatus) params.set('actionRequired', 'true')
  const queryString = params.toString()
  const loading = loadedQuery !== queryString
  function updateFilter(name, value) {
    setError('')
    setFilters((current) => ({ ...current, [name]: value }))
  }
  useEffect(() => {
    let active = true
    request(`/reports${queryString ? `?${queryString}` : ''}`).then(({ reports: result }) => { if (active) setReports(result) }).catch((problem) => { if (active) setError(problem.message) }).finally(() => { if (active) setLoadedQuery(queryString) })
    return () => { active = false }
  }, [queryString, refreshKey])
  useEffect(() => {
    if (user.role !== 'student') return
    const refreshTimer = setInterval(() => setRefreshKey((key) => key + 1), 10000)
    return () => clearInterval(refreshTimer)
  }, [user.role])

  return <section className="content-section status-section">
    <div className="page-heading"><div><p className="eyebrow">{user.role === 'student' ? 'YOUR SUBMISSIONS' : reportStatus ? 'MONITOR / ACTION REQUIRED' : 'FEEDBACK ARCHIVE'}</p><h1>{user.role === 'student' ? 'Status bar' : reportStatus ? 'Report Status' : 'Reports'}</h1><p className="page-intro">{user.role === 'faculty' ? 'Student identities are hidden in every report.' : reportStatus ? 'Review open reports, priority and progress.' : 'A clear view of the voices shaping campus.'}</p></div><span className="result-count">{reports.length} REPORTS</span></div>
    <div className="filter-row">
      {user.role !== 'faculty' && <select aria-label="Filter by category" value={filters.category || ''} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{['Course', 'Faculty', 'Infrastructure', 'Activity', 'Monthly Pulses'].map((item) => <option key={item}>{item}</option>)}</select>}
      {user.role !== 'student' && <>{user.role === 'admin' && <select aria-label="Filter by department" value={filters.department || ''} onChange={(event) => updateFilter('department', event.target.value)}><option value="">All departments</option><option>CSE</option><option>Food Technology</option></select>}<select aria-label="Filter by year" value={filters.year || ''} onChange={(event) => updateFilter('year', event.target.value)}><option value="">All years</option>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((item) => <option key={item}>{item}</option>)}</select><input type="month" aria-label="Filter by month" value={filters.month || ''} onChange={(event) => updateFilter('month', event.target.value)} />{user.role === 'admin' && <><select aria-label="Filter by sentiment" value={filters.sentiment || ''} onChange={(event) => updateFilter('sentiment', event.target.value)}><option value="">All sentiment</option><option>Positive</option><option>Neutral</option><option>Negative</option></select><select aria-label="Filter by priority" value={filters.priority || ''} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select></>}</>}
    </div>
    {error && <p className="form-error">{error}</p>}
    <div className="report-list">{loading ? <div className="empty-state">Loading reports…</div> : reports.length === 0 ? <div className="empty-state"><span className="empty-icon"><ClipboardList size={24} /></span><h3>No reports yet</h3><p>When feedback is submitted, it will appear here.</p></div> : reports.map((report) => <button type="button" className={`report-row report-row-button ${report.actionRequired && ['Infrastructure', 'Activity'].includes(report.category) ? 'action-required' : ''}`} key={report.reportId} onClick={() => setSelectedReportId(report.reportId)}><span className="report-category-icon"><ClipboardList size={19} /></span><span className="report-row-main"><span className="report-title-line"><strong>{report.category}{report.subcategory ? ` · ${report.subcategory}` : ''}</strong><span className="report-id">{report.reportId}</span></span><span className="report-meta-line">{report.studentName} · {report.department} · {report.year}{user.role === 'admin' && report.email ? ` · ${report.email}` : ''}</span><span className="report-meta-line">{report.status || 'Report Sent'}{report.actionLevel && report.actionLevel !== 'Monitor' ? ` · ${report.actionLevel}` : ''}</span></span><span className="report-row-date">{new Date(report.createdAt).toLocaleString()}</span><span className={`tag tag-${(report.sentiment || 'received').toLowerCase()}`}>{report.sentiment || 'Received'}</span><span className={`priority-chip ${(report.priorityLevel || 'Low').toLowerCase()}`}>{report.priorityLevel || 'Low'} priority</span>{reportStatus && <span className="row-timeline"><ReportTimeline status={report.status} compact /></span>}</button>)}</div>
    {selectedReportId && <ReportDetails reportId={selectedReportId} user={user} onClose={() => setSelectedReportId(null)} onUpdated={() => setRefreshKey((key) => key + 1)} />}
  </section>
}

export default App
