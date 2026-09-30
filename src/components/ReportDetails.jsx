import { useEffect, useState } from 'react'
import { ArrowRight, Check, Clock3, X } from 'lucide-react'
import { request } from '../services/api'

const reportStages = ['Report Sent', 'Report Visit', 'Solution in Progress', 'Solved']
const ratingLabels = { 1: 'Poor', 2: 'Need Improvement', 3: 'Satisfactory', 4: 'Very Good', 5: 'Excellent' }

export function ReportTimeline({ status = 'Report Sent', compact = false }) {
  const currentIndex = Math.max(0, reportStages.indexOf(status))
  return <ol className={`report-timeline ${compact ? 'compact' : ''}`} aria-label={`Report status: ${status}`}>
    {reportStages.map((stage, index) => <li key={stage} className={`${index < currentIndex ? 'complete' : ''} ${index === currentIndex ? 'current' : ''}`}>
      <span className="timeline-node">{index < currentIndex ? <Check size={11} /> : <i />}</span><span className="timeline-label">{stage}</span>{index < reportStages.length - 1 && <span className="timeline-line" />}
    </li>)}
  </ol>
}

export function ReportDetails({ reportId, user, onClose, onUpdated }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nextStatus, setNextStatus] = useState('')

  useEffect(() => {
    let active = true
    request(`/reports/${encodeURIComponent(reportId)}`).then(({ report: result }) => {
      if (active) {
        setReport(result)
        setNextStatus(result.status || 'Report Sent')
      }
    }).catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [reportId])

  async function updateStatus() {
    setBusy(true)
    setError('')
    try {
      const { report: updated } = await request(`/admin/reports/${encodeURIComponent(reportId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      const detail = await request(`/reports/${encodeURIComponent(reportId)}`)
      setReport(detail.report)
      onUpdated(updated)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="report-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="report-detail-modal" role="dialog" aria-modal="true" aria-labelledby="report-detail-title">
      <header className="detail-header"><div><p className="eyebrow">REPORT RECORD / {reportId}</p><h2 id="report-detail-title">{report ? `${report.category}${report.subcategory ? ` / ${report.subcategory}` : ''}` : 'Report details'}</h2></div><button className="icon-button" type="button" aria-label="Close report details" onClick={onClose}><X size={19} /></button></header>
      {!report && !error && <div className="detail-loading"><Clock3 size={17} /> Loading saved report…</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && <>
        <ReportTimeline status={report.status} />
        <div className="detail-metadata">
          <div><span>Department</span><strong>{report.department}</strong></div>
          <div><span>Year</span><strong>{report.year}</strong></div>
          <div><span>Sentiment</span><strong>{report.sentiment || 'Unclassified'}</strong></div>
          <div><span>Priority</span><strong>{report.priorityLevel || 'Low'}{report.priorityScore != null ? ` · ${report.priorityScore}/100` : ''}</strong></div>
          <div><span>Current status</span><strong>{report.status || 'Report Sent'}</strong></div>
          <div><span>Submitted</span><strong>{new Date(report.createdAt).toLocaleString()}</strong></div>
          <div><span>Last updated</span><strong>{new Date(report.updatedAt || report.createdAt).toLocaleString()}</strong></div>
          <div><span>Student</span><strong>{user.role === 'faculty' ? 'Anonymous Student' : report.studentName}</strong></div>
        </div>
        {report.actionLevel && report.actionLevel !== 'Monitor' && <div className="action-banner">{report.actionLevel}{report.actionRequired ? ' · action required' : ''}</div>}
        <section className="detail-answers"><h3>Submitted answers</h3>{Object.entries(report.answers || {}).length ? Object.entries(report.answers).map(([question, answer]) => <div className="detail-answer" key={question}><span>{question}</span><strong>{typeof answer === 'number' ? ratingLabels[answer] || answer : answer || '—'}</strong></div>) : <p className="detail-empty">No answers were saved on this report.</p>}</section>
        {report.comments && <section className="detail-comments"><h3>Comments</h3><p>{report.comments}</p></section>}
        {user.role === 'admin' && <div className="status-editor"><label htmlFor="report-status-select">Update timeline status</label><div><select id="report-status-select" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{reportStages.map((stage) => <option key={stage}>{stage}</option>)}</select><button className="button button-dark" type="button" onClick={updateStatus} disabled={busy || nextStatus === report.status}>{busy ? 'Saving…' : 'Save status'} <ArrowRight size={15} /></button></div></div>}
      </>}
    </section>
  </div>
}
