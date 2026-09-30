import 'dotenv/config'
import bcrypt from 'bcryptjs'
import fs from 'node:fs/promises'
import path from 'node:path'
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
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', userSchema)
const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema)

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
  if (mongoMode) return Feedback.updateOne({ reportId }, { $set: updates })
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