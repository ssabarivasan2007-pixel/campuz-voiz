import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID } from 'node:crypto'
import { analyzeFeedback } from './analysis.js'
import {
  connectDatabase,
  createFeedback,
  createUser,
  findFaculty,
  findFeedbackBySubmissionKey,
  findUserById,
  findUserByLogin,
  listFeedback,
  listUsers,
  toPublicUser,
  updateFeedback,
} from './database.js'

const app = express()
const port = Number(process.env.PORT) || 3001
const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex')
const departments = ['CSE', 'Food Technology']
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const categories = ['Course', 'Faculty', 'Infrastructure', 'Activity', 'Monthly Pulses']

app.use(cors())
app.use(express.json({ limit: '64kb' }))

function requireAuth(roles = []) {
  return async (request, response, next) => {
    try {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
      if (!token) return response.status(401).json({ message: 'Please sign in to continue.' })
      const payload = jwt.verify(token, jwtSecret)
      const user = await findUserById(payload.sub)
      if (!user) return response.status(401).json({ message: 'Your session has expired. Please sign in again.' })
      if (roles.length && !roles.includes(user.role)) return response.status(403).json({ message: 'You do not have access to this area.' })
      request.user = user
      next()
    } catch {
      response.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
  }
}

function validateStudentContext(user, body) {
  return body.department === user.department && body.year === user.year && body.email?.trim().toLowerCase() === user.email?.toLowerCase()
}

function anonymize(report) {
  const safeReport = { ...report }
  delete safeReport.student
  delete safeReport.studentId
  delete safeReport.email
  safeReport.studentName = 'Anonymous Student'
  return safeReport
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))

app.post('/api/auth/login', async (request, response) => {
  const { loginId, password, role } = request.body ?? {}
  if (!loginId?.trim() || !password || !['student', 'faculty', 'admin'].includes(role)) {
    return response.status(400).json({ message: 'Enter your ID and password to sign in.' })
  }
  const user = await findUserByLogin(loginId.trim())
  const validPassword = user && await bcrypt.compare(password, user.passwordHash)
  if (!validPassword || user.role !== role) return response.status(401).json({ message: 'That ID or password does not match this portal.' })
  const safeUser = toPublicUser(user)
  const token = jwt.sign({ sub: safeUser.id, role: safeUser.role }, jwtSecret, { expiresIn: '8h' })
  response.json({ token, user: safeUser })
})

app.get('/api/auth/me', requireAuth(), (request, response) => response.json({ user: toPublicUser(request.user) }))

app.post('/api/reports', requireAuth(['student']), async (request, response) => {
  const body = request.body ?? {}
  const { category, subcategory, answers = {}, comments = '', submissionKey } = body
  if (!categories.includes(category) || !validateStudentContext(request.user, body)) {
    return response.status(400).json({ message: 'Check your department, year, email, and report section before submitting.' })
  }
  if (!submissionKey || typeof submissionKey !== 'string' || submissionKey.length > 80) {
    return response.status(400).json({ message: 'This submission could not be verified. Please try again.' })
  }
  if (!departments.includes(body.department) || !years.includes(body.year) || typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email)) {
    return response.status(400).json({ message: 'Please provide a valid campus profile and email.' })
  }
  if (category === 'Infrastructure' && !['WiFi', 'Laboratory'].includes(subcategory)) {
    return response.status(400).json({ message: 'Choose Wi-Fi or Laboratory for this report.' })
  }
  if (category === 'Faculty' && !(await findFaculty(body.facultyId, body.subject, body.facultyDepartment))) {
    return response.status(400).json({ message: 'That faculty, subject, and department combination is not registered.' })
  }
  if (typeof comments !== 'string' || comments.length > 1000) return response.status(400).json({ message: 'Comments must be 1,000 characters or fewer.' })
  if (category === 'Faculty' && comments.trim().split(/\s+/).filter(Boolean).length > 100) return response.status(400).json({ message: 'Faculty suggestions must be 100 words or fewer.' })
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return response.status(400).json({ message: 'Please complete the report questions.' })
  const requiredRatings = category === 'Infrastructure' ? 4 : category === 'Monthly Pulses' ? 12 : 9
  const entries = Object.entries(answers)
  const validRatings = entries.every(([, value]) => Number.isInteger(value) && value >= 1 && value <= 5)
  if (entries.length !== requiredRatings || !validRatings) return response.status(400).json({ message: `Please provide all ${requiredRatings} valid ratings.` })
  const ratings = Object.fromEntries(entries)
  const existing = await findFeedbackBySubmissionKey(submissionKey)
  if (existing) return response.status(200).json({ reportId: existing.reportId, message: 'This report was already received.' })

  const reportId = `CV-${randomUUID().slice(0, 8).toUpperCase()}`
  await createFeedback({
    reportId,
    submissionKey,
    student: request.user._id ?? request.user.id,
    studentId: request.user.loginId,
    studentName: request.user.name,
    department: request.user.department,
    year: request.user.year,
    email: request.user.email,
    category,
    subcategory,
    facultyId: category === 'Faculty' ? body.facultyId : undefined,
    subject: category === 'Faculty' ? body.subject : undefined,
    answers,
    ratings,
    comments: comments.trim(),
    sentiment: 'Unclassified',
    priorityScore: 0,
    priorityLevel: 'Low',
  })
  const allReports = await listFeedback()
  const issues = analyzeFeedback(allReports)
  for (const storedReport of allReports) {
    const relevantIssues = issues.filter((issue) => issue.category === storedReport.category && issue.subcategory === storedReport.subcategory)
    const sentiment = relevantIssues.some((issue) => issue.sentiment === 'Negative')
      ? 'Negative'
      : relevantIssues.length && relevantIssues.every((issue) => issue.sentiment === 'Positive') ? 'Positive' : 'Neutral'
    const priorityScore = relevantIssues.length ? Math.max(...relevantIssues.map((issue) => issue.priorityScore)) : 0
    const priorityLevel = priorityScore >= 70 ? 'High' : priorityScore >= 40 ? 'Medium' : 'Low'
    await updateFeedback(storedReport.reportId, { sentiment, priorityScore, priorityLevel })
  }
  response.status(201).json({ reportId, message: 'Your feedback has been received.' })
})

app.get('/api/reports', requireAuth(), async (request, response) => {
  let reports = await listFeedback()
  if (request.user.role === 'student') reports = reports.filter((report) => String(report.student) === String(request.user._id ?? request.user.id))
  if (request.user.role === 'faculty') {
    reports = reports.filter((report) => report.category === 'Faculty' && report.facultyId === request.user.loginId)
    reports = reports.map(anonymize)
  }
  const { category, department, year, sentiment, priority, month } = request.query
  if (category) reports = reports.filter((report) => report.category === category)
  if (department) reports = reports.filter((report) => report.department === department)
  if (year) reports = reports.filter((report) => report.year === year)
  if (month) reports = reports.filter((report) => new Date(report.createdAt).toISOString().slice(0, 7) === month)
  if (sentiment) reports = reports.filter((report) => report.sentiment === sentiment)
  if (priority) reports = reports.filter((report) => report.priorityLevel === priority)
  const result = reports.map((report) => ({
    ...report,
    sentiment: request.user.role === 'student' ? 'Received' : report.sentiment,
    priorityScore: request.user.role === 'student' ? undefined : report.priorityScore,
  }))
  response.json({ reports: result })
})

app.get('/api/admin/analytics', requireAuth(['admin']), async (_request, response) => {
  const reports = await listFeedback()
  const issues = analyzeFeedback(reports)
  const categoriesCount = Object.fromEntries(categories.map((category) => [category, reports.filter((report) => report.category === category).length]))
  const departmentsCount = Object.fromEntries(departments.map((department) => [department, reports.filter((report) => report.department === department).length]))
  const monthly = Array.from({ length: 6 }, (_, offset) => {
    const month = new Date()
    month.setDate(1)
    month.setMonth(month.getMonth() - (5 - offset))
    const key = month.toISOString().slice(0, 7)
    return { month: month.toLocaleString('en', { month: 'short' }), count: reports.filter((report) => new Date(report.createdAt).toISOString().slice(0, 7) === key).length }
  })
  const sentiment = issues.reduce((totals, issue) => ({ ...totals, [issue.sentiment]: (totals[issue.sentiment] ?? 0) + issue.mentions }), {})
  const priorities = Object.fromEntries(['High', 'Medium', 'Low'].map((level) => [level, issues.filter((issue) => issue.priorityLevel === level).length]))
  response.json({
    totals: { feedback: reports.length, positive: sentiment.Positive ?? 0, neutral: sentiment.Neutral ?? 0, negative: sentiment.Negative ?? 0, highPriority: issues.filter((issue) => issue.priorityLevel === 'High').length },
    categories: categoriesCount,
    departments: departmentsCount,
    monthly,
    issues: issues.slice(0, 8),
    priorities,
  })
})

app.get('/api/faculty/analytics', requireAuth(['faculty']), async (request, response) => {
  const reports = (await listFeedback()).filter((report) => report.category === 'Faculty' && report.facultyId === request.user.loginId)
  const issues = analyzeFeedback(reports)
  response.json({
    count: reports.length,
    averageRating: issues.length ? Number((issues.reduce((total, issue) => total + issue.averageRating, 0) / issues.length).toFixed(1)) : null,
    issues,
    reports: reports.map(anonymize),
  })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

connectDatabase().then((storage) => {
  app.listen(port, () => console.log(`Campuz Voiz API ready on http://localhost:${port} (${storage})`))
}).catch((error) => {
  console.error('Unable to connect to the configured database.', error.message)
  process.exitCode = 1
})

app.get('/api/admin/users', requireAuth(['admin']), async (_request, response) => {
  response.json({ users: await listUsers() })
})

app.post('/api/admin/users', requireAuth(['admin']), async (request, response) => {
  const { loginId, password, role, name, department, year, email, subject } = request.body ?? {}
  if (!['student', 'faculty'].includes(role) || !loginId?.trim() || !name?.trim() || !password || password.length < 10) {
    return response.status(400).json({ message: 'Enter a role, campus ID, name, and password of at least 10 characters.' })
  }
  if (!departments.includes(department)) return response.status(400).json({ message: 'Choose a registered department.' })
  if (role === 'student' && (!years.includes(year) || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email))) {
    return response.status(400).json({ message: 'Students need a valid year and email address.' })
  }
  if (role === 'faculty' && !['Python', 'Java'].includes(subject)) return response.status(400).json({ message: 'Choose a registered faculty subject.' })
  if (await findUserByLogin(loginId.trim())) return response.status(409).json({ message: 'That campus ID is already registered.' })
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await createUser({ loginId: loginId.trim(), role, name: name.trim(), department, year: role === 'student' ? year : undefined, email: role === 'student' ? email.trim().toLowerCase() : undefined, subject: role === 'faculty' ? subject : undefined, passwordHash })
  response.status(201).json({ user })
})