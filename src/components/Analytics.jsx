import { useEffect, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, AudioLines, CircleAlert, CircleCheck, CircleHelp, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { request } from '../services/api'

const sentimentColors = { Positive: '#54866d', Neutral: '#c29b4b', Negative: '#c76854' }
const categoryColors = ['#406b72', '#ce8458', '#87956a', '#b47668', '#baab76']

function useData(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request(path).then((result) => { if (active) setData(result) }).catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [path])
  return { data, error }
}

export function Analytics() {
  const { data, error } = useData('/admin/analytics')
  if (error) return <div className="content-section"><p className="form-error">{error}</p></div>
  if (!data) return <div className="content-section loading-state">Gathering campus signals…</div>
  const categoryData = Object.entries(data.categories).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0)
  const sentimentData = Object.entries({ Positive: data.totals.positive, Neutral: data.totals.neutral, Negative: data.totals.negative }).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0)
  const departmentData = Object.entries(data.departments).map(([name, value]) => ({ name, value }))
  const priorityData = Object.entries(data.priorities).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0)
  const metrics = [
    { label: 'Total feedback', value: data.totals.feedback, icon: AudioLines, accent: 'teal' },
    { label: 'Positive signals', value: data.totals.positive, icon: CircleCheck, accent: 'green' },
    { label: 'Needs attention', value: data.totals.negative, icon: CircleAlert, accent: 'coral' },
    { label: 'High-priority issues', value: data.totals.highPriority, icon: Activity, accent: 'amber' },
  ]
  return <section className="content-section analytics-section">
    <div className="page-heading"><div><p className="eyebrow">CAMPUS SIGNALS / LIVE</p><h1>Issue intelligence</h1><p className="page-intro">Patterns across student feedback, translated into action.</p></div><span className="live-pill"><i /> LIVE DATA</span></div>
    <div className="metric-grid">{metrics.map(({ label, value, icon: Icon, accent }) => <article className={`metric-card metric-${accent}`} key={label}><span className="metric-icon"><Icon size={18} /></span><span className="metric-value">{value}</span><span className="metric-label">{label}</span><span className="metric-note">Across all reporting periods</span></article>)}</div>
    <section className="priority-section"><div className="priority-heading"><div><p className="eyebrow">FEEDBACK → ISSUE → PRIORITY</p><h2>AI priority issues</h2></div><span className="rule-note"><span /> Explainable rules</span></div>
      {data.issues.length ? <div className="issue-list">{data.issues.slice(0, 5).map((issue, index) => <article className="issue-row" key={`${issue.category}-${issue.issue}`}><span className={`issue-signal ${issue.priorityLevel.toLowerCase()}`}><i /></span><span className="issue-rank">0{index + 1}</span><div className="issue-main"><strong>{issue.subcategory ? `${issue.subcategory} / ${issue.issue}` : issue.issue}</strong><span>{issue.category} · {issue.mentions} response{issue.mentions === 1 ? '' : 's'}</span></div><div className="issue-negative"><strong>{issue.negativeRate}%</strong><span>negative</span></div><div className="issue-trend">{issue.trend === 'Increasing' ? <ArrowUpRight size={17} /> : issue.trend === 'Decreasing' ? <ArrowDownRight size={17} /> : <TrendingUp size={16} />}<span>{issue.trend}</span></div><div className="issue-priority"><strong>{issue.priorityLevel}</strong><span>{issue.priorityScore} / 100</span></div></article>)}</div> : <div className="empty-inline"><CircleHelp size={18} /><span>Priority signals will appear as recurring feedback is submitted.</span></div>}
      <p className="analysis-footnote">Sentiment reflects repeated group responses, never an individual student. Priority combines frequency, severity, negative share and month-over-month trend.</p>
    </section>
    <div className="charts-grid"><ChartPanel title="Sentiment mix" eyebrow="REPEATED RESPONSE PATTERNS">{sentimentData.length ? <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={57} outerRadius={82} paddingAngle={4}>{sentimentData.map((item) => <Cell key={item.name} fill={sentimentColors[item.name]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <ChartEmpty />}{sentimentData.length > 0 && <Legend data={sentimentData} colors={sentimentData.map((item) => sentimentColors[item.name])} />}</ChartPanel>
      <ChartPanel title="Feedback by category" eyebrow="WHERE STUDENTS ARE SPEAKING">{categoryData.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={categoryData} margin={{ left: -18, right: 6, top: 14 }}><CartesianGrid vertical={false} stroke="#e9e5dc" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#777a73', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#85877f', fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{categoryData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty />}</ChartPanel>
      <ChartPanel title="Department pulse" eyebrow="CAMPUS-WIDE REACH">{departmentData.some((item) => item.value) ? <ResponsiveContainer width="100%" height={220}><BarChart data={departmentData} layout="vertical" margin={{ left: 24, right: 14 }}><CartesianGrid horizontal={false} stroke="#e9e5dc" /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#62665e', fontSize: 12 }} /><Tooltip /><Bar dataKey="value" fill="#507d75" radius={[0, 4, 4, 0]} barSize={22} /></BarChart></ResponsiveContainer> : <ChartEmpty />}</ChartPanel>
      <ChartPanel title="Monthly trend" eyebrow="SIX-MONTH VIEW">{data.monthly.some((item) => item.count) ? <ResponsiveContainer width="100%" height={220}><LineChart data={data.monthly} margin={{ left: -18, right: 7, top: 16 }}><CartesianGrid vertical={false} stroke="#e9e5dc" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#777a73', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#85877f', fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#c77655" strokeWidth={2.5} dot={{ fill: '#c77655', r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer> : <ChartEmpty />}</ChartPanel>
      <ChartPanel title="Priority distribution" eyebrow="ISSUES BY URGENCY">{priorityData.length ? <ResponsiveContainer width="100%" height={220}><BarChart data={priorityData} margin={{ left: -18, right: 6, top: 14 }}><CartesianGrid vertical={false} stroke="#e9e5dc" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#777a73', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#85877f', fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{priorityData.map((item) => <Cell key={item.name} fill={item.name === 'High' ? '#c76854' : item.name === 'Medium' ? '#c29b4b' : '#54866d'} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty />}</ChartPanel></div>
  </section>
}

function ChartPanel({ title, eyebrow, children }) { return <article className="chart-panel"><p className="eyebrow">{eyebrow}</p><h3>{title}</h3>{children}</article> }
function ChartEmpty() { return <div className="chart-empty"><span>No feedback data yet</span></div> }
function Legend({ data, colors }) { return <div className="chart-legend">{data.map((item, index) => <span key={item.name}><i style={{ background: colors[index] }} />{item.name}<b>{item.value}</b></span>)}</div> }

export function FacultyAnalytics() {
  const { data, error } = useData('/faculty/analytics')
  if (error) return <div className="content-section"><p className="form-error">{error}</p></div>
  if (!data) return <div className="content-section loading-state">Gathering class feedback…</div>
  const countNegative = data.issues.filter((issue) => issue.sentiment === 'Negative').length
  return <section className="content-section analytics-section faculty-analytics">
    <div className="page-heading"><div><p className="eyebrow">CLASSROOM SIGNALS / ANONYMOUS</p><h1>Teaching insights</h1><p className="page-intro">Student perspectives for {data.reports[0]?.department || 'your department'} · {data.reports[0]?.subject || 'your subject'}</p></div><span className="privacy-tag"><span /> IDENTITY PROTECTED</span></div>
    <div className="metric-grid faculty-metrics"><article className="metric-card metric-teal"><span className="metric-icon"><AudioLines size={18} /></span><span className="metric-value">{data.count}</span><span className="metric-label">Anonymous responses</span></article><article className="metric-card metric-amber"><span className="metric-icon"><TrendingUp size={18} /></span><span className="metric-value">{data.averageRating ?? '—'}<small>/ 5</small></span><span className="metric-label">Average rating</span></article><article className="metric-card metric-coral"><span className="metric-icon"><CircleAlert size={18} /></span><span className="metric-value">{countNegative}</span><span className="metric-label">Recurring concerns</span></article></div>
    <section className="priority-section"><div className="priority-heading"><div><p className="eyebrow">REPEATED THEMES</p><h2>Common feedback</h2></div></div>{data.issues.length ? <div className="issue-list">{data.issues.map((issue, index) => <article className="issue-row" key={issue.issue}><span className={`issue-signal ${issue.priorityLevel.toLowerCase()}`}><i /></span><span className="issue-rank">0{index + 1}</span><div className="issue-main"><strong>{issue.issue}</strong><span>{issue.mentions} anonymous response{issue.mentions === 1 ? '' : 's'} · {issue.averageRating} average</span></div><div className="issue-negative"><strong>{issue.negativeRate}%</strong><span>negative</span></div><span className={`tag tag-${issue.sentiment.toLowerCase()}`}>{issue.sentiment}</span></article>)}</div> : <div className="empty-inline"><CircleHelp size={18} /><span>Anonymous feedback themes will appear as responses are received.</span></div>}</section>
    <section className="priority-section suggestions-section"><div className="priority-heading"><div><p className="eyebrow">STUDENT VOICES</p><h2>Suggestions & comments</h2></div></div>{data.reports.filter((report) => report.comments?.trim()).length ? data.reports.filter((report) => report.comments?.trim()).slice(0, 6).map((report) => <blockquote className="suggestion-quote" key={report.reportId}><span>“</span><p>{report.comments}</p><cite>Anonymous Student · {report.department} · {report.year}</cite></blockquote>) : <div className="empty-inline">No written suggestions yet.</div>}</section>
  </section>
}