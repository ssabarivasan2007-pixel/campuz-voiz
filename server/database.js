import 'dotenv/config'
import bcrypt from 'bcryptjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const directory = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(directory, '..', '.data', 'store.json')
let localData
let mongoMode = false

const userSchema = new mongoose.Schema({
  loginId: { type: String, unique: true, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  name: { type: String, required: true },
  department: String,
  year: String,
  email: String,
  phone: String,
  subject: String,
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true })

const feedbackSchema = new mongoose.Schema({
  reportId: { type: String, unique: true, required: true },
  submissionKey: { type: String, unique: true, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: String, required: true },
  email: { type: String, required: true },
  studentId: String,
  category: { type: String, required: true },
  subcategory: String,
  facultyId: String,
  subject: String,
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  ratings: { type: mongoose.Schema.Types.Mixed, default: {} },
  comments: String,
  sentiment: { type: String, default: 'Unclassified' },
  priorityScore: { type: Number, default: 0 },
  priorityLevel: { type: String, default: 'Low' },
  status: { type: String, enum: ['Report Sent', 'Report Visit', 'Solution in Progress', 'Solved'], default: 'Report Sent' },
  actionLevel: { type: String, default: 'Monitor' },
  actionRequired: { type: Boolean, default: false },
}, { timestamps: true })

const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true },
  alertKey: { type: String, unique: true, required: true },
  category: { type: String, required: true },
  subcategory: String,
  issue: { type: String, required: true },
  department: { type: String, required: true },
  year: String,
  facultyId: String,
  subject: String,
  matchingReportCount: { type: Number, required: true },
  relevantStudentCount: { type: Number, required: true },
  percentage: { type: Number, required: true },
  sentiment: { type: String, required: true },
  priority: { type: String, required: true },
  trend: { type: String, required: true },
  recipients: [{ name: String, email: String, role: String }],
  notificationStatus: { type: String, enum: ['Pending', 'Sending', 'Sent', 'Development Mode', 'Failed'], default: 'Pending' },
  reportingPeriod: { type: String, required: true },
  relatedReportIds: [String],
  currentStatus: { type: String, default: 'Report Sent' },
  lastNotifiedAt: Date,
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', userSchema)
const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema)
const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema)

const demoUsers = [
  { loginId: '20247369', role: 'student', name: 'Sabarivasan S', year: '3rd Year', department: 'CSE', email: '20247369@campuz.edu', password: 'Sabari@1876' },
  { loginId: '20246379', role: 'student', name: 'Siva balan V', year: '2nd Year', department: 'Food Technology', email: '20246379@campuz.edu', password: 'Siva@1876' },
  { loginId: '20237369', role: 'faculty', name: 'Srishanth P', subject: 'Python', department: 'CSE', password: 'Sri@1876' },
  { loginId: '20236379', role: 'faculty', name: 'Saravana M', subject: 'Java', department: 'Food Technology', password: 'Saravana@1876' },
]

function publicUser(user) {
  if (!user) return null
  const safeUser = { ...user }
  delete safeUser.passwordHash
  delete safeUser.password
  return { ...safeUser, id: String(user._id ?? user.id) }
}

async function writeLocal() {
  await fs.mkdir(path.dirname(dataPath), { recursive: true })
  await fs.writeFile(dataPath, JSON.stringify(localData, null, 2))
}

async function seedUsers() {
  const configuredUsers = [...demoUsers]
  if (process.env.ADMIN_PASSWORD) {
    configuredUsers.push({
      loginId: process.env.ADMIN_ID || 'admin',
      role: 'admin',
      name: process.env.ADMIN_NAME || 'Campus Administrator',
      password: process.env.ADMIN_PASSWORD,
    })
  }

  for (const entry of configuredUsers) {
    const passwordHash = await bcrypt.hash(entry.password, 12)
    const user = { ...entry, passwordHash }
    delete user.password
    if (mongoMode) {
      await User.updateOne({ loginId: user.loginId }, { $setOnInsert: user }, { upsert: true })
    } else if (!localData.users.some((existing) => existing.loginId === user.loginId)) {
      localData.users.push({ ...user, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    }
  }
  if (!mongoMode) await writeLocal()
}

export async function connectDatabase() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI)
    mongoMode = true
  } else {
    try {
      localData = JSON.parse(await fs.readFile(dataPath, 'utf8'))
    } catch {
      localData = { users: [], feedback: [] }
    }
    localData.users ??= []
    localData.feedback ??= []
    localData.alerts ??= []
  }
  await seedUsers()
  return mongoMode ? 'MongoDB' : 'local file store'
}

export async function findUserByLogin(loginId) {
  if (mongoMode) return User.findOne({ loginId }).select('+passwordHash').lean()
  return localData.users.find((user) => user.loginId === loginId) ?? null
}

export async function findUserById(id) {
  if (mongoMode) return User.findById(id).lean()
  return localData.users.find((user) => user.id === id) ?? null
}

export async function findFaculty(facultyId, subject, department) {
  if (mongoMode) return User.findOne({ loginId: facultyId, role: 'faculty', subject, department }).lean()
  return localData.users.find((user) => user.loginId === facultyId && user.role === 'faculty' && user.subject === subject && user.department === department) ?? null
}

export async function findFeedbackBySubmissionKey(submissionKey) {
  if (mongoMode) return Feedback.findOne({ submissionKey }).lean()
  return localData.feedback.find((report) => report.submissionKey === submissionKey) ?? null
}

export async function createFeedback(report) {
  if (mongoMode) return new Feedback(report).save().then((saved) => saved.toObject())
  const saved = { ...report, _id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  localData.feedback.push(saved)
  await writeLocal()
  return saved
}

export async function listFeedback() {
  if (mongoMode) return Feedback.find().sort({ createdAt: -1 }).lean()
  return [...localData.feedback].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
}

export function toPublicUser(user) {
  return publicUser(user)
}

export async function updateFeedback(reportId, updates) {
  if (mongoMode) return Feedback.findOneAndUpdate({ reportId }, { $set: updates }, { new: true, runValidators: true }).lean()
  const report = localData.feedback.find((item) => item.reportId === reportId)
  if (!report) return null
  Object.assign(report, updates, { updatedAt: new Date().toISOString() })
  await writeLocal()
  return report
}

export async function listUsers() {
  const users = mongoMode ? await User.find().sort({ role: 1, name: 1 }).lean() : localData.users
  return users.map(publicUser)
}

export async function createUser(user) {
  if (mongoMode) return new User(user).save().then((saved) => publicUser(saved.toObject()))
  const saved = { ...user, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localData.users.push(saved)
  await writeLocal()
  return publicUser(saved)
}

export async function findFeedbackByReportId(reportId) {
  if (mongoMode) return Feedback.findOne({ reportId }).lean()
  return localData.feedback.find((report) => report.reportId === reportId) ?? null
}

export async function updateUserById(id, updates) {
  if (mongoMode) return User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean()
  const user = localData.users.find((item) => item.id === id)
  if (!user) return null
  Object.assign(user, updates, { updatedAt: new Date().toISOString() })
  await writeLocal()
  return publicUser(user)
}

export async function deleteUserById(id) {
  if (mongoMode) return User.findByIdAndDelete(id).lean()
  const index = localData.users.findIndex((item) => item.id === id)
  if (index < 0) return null
  const [user] = localData.users.splice(index, 1)
  await writeLocal()
  return publicUser(user)
}

export async function listFaculty() {
  if (mongoMode) return User.find({ role: 'faculty' }).select('loginId name subject department').sort({ name: 1 }).lean()
  return localData.users.filter((user) => user.role === 'faculty').map(({ loginId, name, subject, department }) => ({ loginId, name, subject, department }))
}

export async function countRelevantStudents({ department, year }) {
  const query = { role: 'student', department, year }
  if (mongoMode) return User.countDocuments(query)
  return localData.users.filter((user) => user.role === 'student' && user.department === department && user.year === year).length
}

export async function upsertAlert(alert) {
  const { alertKey, ...updates } = alert
  if (mongoMode) {
    try {
      return await Alert.findOneAndUpdate(
        { alertKey },
        { $set: updates, $setOnInsert: { alertId: randomUUID(), alertKey, notificationStatus: 'Pending', lastNotifiedAt: null } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      ).lean()
    } catch (error) {
      if (error.code !== 11000) throw error
      return Alert.findOneAndUpdate({ alertKey }, { $set: updates }, { new: true, runValidators: true }).lean()
    }
  }
  const existing = localData.alerts.find((item) => item.alertKey === alertKey)
  if (existing) {
    Object.assign(existing, updates, { updatedAt: new Date().toISOString() })
    await writeLocal()
    return existing
  }
  const created = { ...updates, alertKey, alertId: randomUUID(), notificationStatus: 'Pending', lastNotifiedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  localData.alerts.push(created)
  await writeLocal()
  return created
}

export async function claimAlertNotification(alertKey) {
  if (mongoMode) {
    return Alert.findOneAndUpdate(
      { alertKey, notificationStatus: 'Pending' },
      { $set: { notificationStatus: 'Sending' } },
      { new: true },
    ).lean()
  }
  const alert = localData.alerts.find((item) => item.alertKey === alertKey && item.notificationStatus === 'Pending')
  if (!alert) return null
  alert.notificationStatus = 'Sending'
  alert.updatedAt = new Date().toISOString()
  await writeLocal()
  return alert
}

export async function updateAlert(alertKey, updates) {
  if (mongoMode) return Alert.findOneAndUpdate({ alertKey }, { $set: updates }, { new: true, runValidators: true }).lean()
  const alert = localData.alerts.find((item) => item.alertKey === alertKey)
  if (!alert) return null
  Object.assign(alert, updates, { updatedAt: new Date().toISOString() })
  await writeLocal()
  return alert
}

export async function listAlerts() {
  if (mongoMode) return Alert.find().sort({ createdAt: -1 }).lean()
  return [...localData.alerts].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
}

export async function clearFeedbackAndAlerts() {
  if (mongoMode) {
    await Promise.all([Feedback.deleteMany({}), Alert.deleteMany({})])
    return
  }
  localData.feedback = []
  localData.alerts = []
  await writeLocal()
}

export async function updateAlertsForReport(reportId, status) {
  if (mongoMode) return Alert.updateMany({ relatedReportIds: reportId }, { $set: { currentStatus: status } })
  let matched = false
  for (const alert of localData.alerts) {
    if (alert.relatedReportIds?.includes(reportId)) {
      alert.currentStatus = status
      alert.updatedAt = new Date().toISOString()
      matched = true
    }
  }
  if (matched) await writeLocal()
  return matched
}