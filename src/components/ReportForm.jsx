import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { request } from '../services/api'

const ratingOptions = [
  { label: 'Excellent', value: 5 },
  { label: 'Very Good', value: 4 },
  { label: 'Satisfactory', value: 3 },
  { label: 'Need Improvement', value: 2 },
  { label: 'Poor', value: 1 },
]

const reports = {
  Course: {
    group: 'LEARNING EXPERIENCE',
    questions: [
      'Was the course pace comfortable?', 'Were enough examples/practical sessions provided?', 'Was the course material useful and understandable?',
      'How well did the course improve your understanding?', 'Was the syllabus covered effectively?', 'Were the concepts explained clearly?',
      'Were practical applications demonstrated sufficiently?', 'Was sufficient time provided for questions and clarification?', 'Did the course meet your learning expectations?',
    ],
  },
  Faculty: {
    group: 'TEACHING EXPERIENCE',
    questions: [
      'Did the faculty cover the syllabus effectively?', 'Was the teaching understandable?', 'Did the faculty respond to student questions?',
      'Did the faculty clear your doubts?', 'Were practical sessions implemented effectively?', 'Was the pace of teaching comfortable?',
      'Were sufficient examples provided?', 'Was the faculty approachable?', 'Did the teaching improve your understanding?',
    ],
  },
  Infrastructure: {
    group: 'CAMPUS FACILITIES',
    choices: ['WiFi', 'Laboratory'],
    questions: {
      WiFi: ['How reliable is the Wi-Fi signal across campus?', 'How reliably does Wi-Fi connect when needed?', 'How would you rate the Wi-Fi connection speed?', 'How well does Wi-Fi cover the areas you need?'],
      Laboratory: ['How reliable is the power supply in laboratories?', 'How well are laboratory systems maintained?', 'Are enough functional systems available?', 'How suitable is the laboratory for practical work?'],
    },
  },
  Activity: {
    group: 'CAMPUS LIFE',
    questions: [
      'Are sufficient extracurricular activities conducted?', 'Are technical activities conducted regularly?', 'Are students given enough opportunities to participate?',
      'Are hackathons/workshops conducted effectively?', 'Are cultural activities organized properly?', 'Are sports activities conducted adequately?',
      'Are activity announcements communicated clearly?', 'Are students encouraged to participate?', 'Are activities useful for student development?',
    ],
  },
}

const monthlySections = [
  { title: 'Course', questions: reports.Course.questions, comment: 'What should be improved?' },
  { title: 'Faculty', questions: reports.Faculty.questions, comment: 'Other suggestions/comments' },
  { title: 'Infrastructure / Wi-Fi', questions: reports.Infrastructure.questions.WiFi, comment: 'What improvement is needed for Wi-Fi?' },
  { title: 'Infrastructure / Laboratory', questions: reports.Infrastructure.questions.Laboratory, comment: 'What improvement is needed for the laboratory?' },
  { title: 'Activity', questions: reports.Activity.questions, comment: 'What improvements would you suggest?' },
]

const categories = [
  { name: 'Course', title: 'Course', description: 'Learning, materials & pace', symbol: '01' },
  { name: 'Faculty', title: 'Faculty', description: 'Teaching & student support', symbol: '02' },
  { name: 'Infrastructure', title: 'Infrastructure', description: 'Wi-Fi, labs & campus spaces', symbol: '03' },
  { name: 'Activity', title: 'Activity', description: 'Events, sports & opportunities', symbol: '04' },
]

export function RatingQuestion({ question, value, onChange, index }) {
  return <fieldset className="rating-question"><legend><span className="question-number">{String(index).padStart(2, '0')}</span>{question}</legend><div className="rating-options">{ratingOptions.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} className={`rating-option ${value === option.value ? 'selected' : ''}`} onClick={() => onChange(option.value)}><span className="rating-dot" />{option.label}</button>)}</div></fieldset>
}

export function ReportForm({ user, initialCategory, onSubmitted }) {
  const [category, setCategory] = useState(initialCategory)
  const [subcategory, setSubcategory] = useState('')
  const [answers, setAnswers] = useState({})
  const [pulseComments, setPulseComments] = useState({})
  const [comments, setComments] = useState('')
  const [profile, setProfile] = useState({ department: user.department, year: user.year, email: user.email })
  const [faculty, setFaculty] = useState({ facultyId: '', subject: '', facultyDepartment: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [submissionKey] = useState(() => crypto.randomUUID())
  const [facultyOptions, setFacultyOptions] = useState([])

  useEffect(() => {
    if (category !== 'Faculty') return
    let active = true
    request('/faculty/options').then(({ faculty }) => { if (active) setFacultyOptions(faculty) }).catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [category])

  function chooseCategory(next) { setCategory(next); setSubcategory(''); setAnswers({}); setError('') }

  const survey = reports[category]
  const questionGroups = category === 'Infrastructure'
    ? (subcategory ? [{ title: subcategory === 'WiFi' ? 'WI-FI' : 'LABORATORY', questions: survey.questions[subcategory] }] : [])
    : category === 'Monthly Pulses'
      ? monthlySections
      : survey?.questions ? [{ title: survey.group, questions: survey.questions }] : []
  const totalQuestions = questionGroups.reduce((sum, group) => sum + group.questions.length, 0)
  const answered = Object.keys(answers).length
  const profileValid = profile.department === user.department && profile.year === user.year && profile.email.trim().toLowerCase() === user.email?.toLowerCase()
  const commentsWords = comments.trim() ? comments.trim().split(/\s+/).length : 0

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!profileValid) { setError('Your department, year, and email must match your registered student profile.'); return }
    if (answered < totalQuestions) { setError(`Please rate all ${totalQuestions} questions before submitting.`); return }
    if (category === 'Infrastructure' && !subcategory) { setError('Choose Wi-Fi or Laboratory to continue.'); return }
    if (category === 'Faculty' && (!faculty.facultyId || !faculty.subject || !faculty.facultyDepartment)) { setError('Select the faculty, subject, and department for this report.'); return }
    if (category === 'Faculty' && commentsWords > 100) { setError('Please keep faculty suggestions within 100 words.'); return }
    setBusy(true)
    try {
      const monthlyAnswers = category === 'Monthly Pulses'
        ? { ...answers, ...Object.fromEntries(monthlySections.map((section) => [section.comment, pulseComments[section.comment] ?? ''])) }
        : answers
      const submittedComments = category === 'Monthly Pulses'
        ? monthlySections.map((section) => pulseComments[section.comment] ? `${section.comment}: ${pulseComments[section.comment]}` : '').filter(Boolean).join('\n')
        : comments
      const result = await request('/reports', {
        method: 'POST',
        body: JSON.stringify({ ...profile, ...faculty, category, subcategory, answers: monthlyAnswers, ratings: answers, comments: submittedComments, submissionKey }),
      })
      onSubmitted(result.reportId)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="content-section form-section">
    {!category ? <>
      <div className="page-heading"><div><p className="eyebrow">MAKE SOMETHING BETTER</p><h1>What’s on your mind?</h1><p className="page-intro">Choose a topic. Every thoughtful note moves us forward.</p></div><span className="step-count">01 <i /> 02</span></div>
      <div className="category-grid">{categories.map((item) => <button type="button" className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}><span className="category-symbol">{item.symbol}</span><span className="category-name">{item.title}</span><span className="category-description">{item.description}</span><ArrowRight className="category-arrow" size={19} /></button>)}</div>
      <div className="privacy-banner"><ShieldCheck size={18} /><span><strong>Your feedback is treated confidentially.</strong> Your identity will not be exposed to faculty while reviewing feedback.</span></div>
    </> : <form className="survey-form" onSubmit={submit}>
      <button type="button" className="back-link form-back" onClick={() => chooseCategory('')}><ArrowLeft size={16} /> All report types</button>
      <div className="page-heading form-heading"><div><p className="eyebrow">{category === 'Monthly Pulses' ? 'A QUICK CAMPUS CHECK-IN' : `REPORT / ${category.toUpperCase()}`}</p><h1>{category === 'Monthly Pulses' ? 'Your monthly pulse' : `${category} feedback`}</h1><p className="page-intro">Your perspective helps us focus on what matters.</p></div><span className="step-count">02 <i /> 02</span></div>
      <div className="profile-fields">
        <label>Department<select value={profile.department} onChange={(event) => setProfile({ ...profile, department: event.target.value })}><option>CSE</option><option>Food Technology</option></select></label>
        <label>Year of pursuing<select value={profile.year} onChange={(event) => setProfile({ ...profile, year: event.target.value })}>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="email-field">Student email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required /></label>
      </div>
      {!profileValid && <p className="inline-warning">These details need to match your registered student profile.</p>}
      {category === 'Infrastructure' && <div className="subtype-selector"><span>CHOOSE A FACILITY</span><div>{survey.choices.map((choice) => <button type="button" key={choice} className={subcategory === choice ? 'selected' : ''} onClick={() => { setSubcategory(choice); setAnswers({}) }}>{choice === 'WiFi' ? 'Wi-Fi' : choice}</button>)}</div></div>}
      {category === 'Faculty' && <div className="faculty-fields"><label>Faculty<select value={faculty.facultyId} onChange={(event) => { const facultyId = event.target.value; const selected = facultyOptions.find((option) => option.id === facultyId); setFaculty({ facultyId, subject: selected?.subject || '', facultyDepartment: selected?.department || '' }) }} required><option value="">{facultyOptions.length ? 'Select faculty' : 'Loading faculty…'}</option>{facultyOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Subject<input value={faculty.subject} readOnly aria-readonly="true" placeholder="Selected faculty subject" /></label><label>Department<input value={faculty.facultyDepartment} readOnly aria-readonly="true" placeholder="Selected faculty department" /></label></div>}
      {questionGroups.map((group) => <div className="question-group" key={group.title}><p className="eyebrow">{group.title}</p>{group.questions.map((question, index) => <RatingQuestion key={question} question={question} index={index + 1} value={answers[question]} onChange={(value) => setAnswers({ ...answers, [question]: value })} />)}{category === 'Monthly Pulses' && <label className="comments-field monthly-comment">{group.comment}<textarea value={pulseComments[group.comment] ?? ''} onChange={(event) => setPulseComments({ ...pulseComments, [group.comment]: event.target.value })} maxLength={150} rows={2} placeholder="Optional" /></label>}</div>)}
      {category !== 'Infrastructure' || subcategory ? <label className="comments-field">{category === 'Faculty' ? 'Other suggestions / comments' : category === 'Infrastructure' ? 'What improvement is needed?' : category === 'Activity' ? 'What improvements would you suggest?' : 'What should be improved?'}<textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={category === 'Faculty' ? 700 : 1000} rows={4} placeholder="Share a little more, if you’d like…" /><span className="field-footnote">{category === 'Faculty' ? `${commentsWords}/100 words` : `${comments.length}/1,000 characters`} · Optional</span></label> : null}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="submit-row"><span>{answered} of {totalQuestions} ratings completed</span><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Sending…' : category === 'Course' ? 'Submit Course Feedback' : category === 'Monthly Pulses' ? 'Submit monthly pulse' : 'Submit feedback'} <ArrowRight size={17} /></button></div>
    </form>}
  </section>
}

export function SuccessPage({ reportId, onDone }) {
  return <section className="success-page"><div className="success-mark"><Check size={31} /></div><p className="eyebrow">YOUR VOICE IS IN</p><h1>Thank you for<br /><em>your feedback!</em></h1><p>Your voice matters. Let’s wait for the change to begin.</p><span className="success-report-id">REFERENCE / {reportId}</span><button className="button button-dark" onClick={onDone}>View submission status <ArrowRight size={17} /></button></section>
}