import nodemailer from 'nodemailer'
import { analyzeFeedback } from './analysis.js'
import {
  claimAlertNotification,
  countRelevantStudents,
  listAlerts,
  updateAlert,
  upsertAlert,
} from './database.js'
import { resolveAlertRecipients } from './notification-contacts.js'

const percentThreshold = () => Math.max(0, Number(process.env.ALERT_THRESHOLD_PERCENT) || 5)
const minimumReports = () => Math.max(1, Number(process.env.ALERT_MIN_MATCHING_REPORTS) || 3)

function issueScope(candidate, report) {
  const sameGroup = report.category === candidate.category
    && report.subcategory === candidate.subcategory
    && report.department === candidate.department
    && report.year === candidate.year
  return sameGroup && (candidate.category !== 'Faculty'
    || (report.facultyId === candidate.facultyId && report.subject === candidate.subject))
}

function issueReportIds(reports, issue) {
  const exactRatings = reports.filter((report) => Object.hasOwn(report.ratings ?? {}, issue.issue))
  return [...new Set((exactRatings.length ? exactRatings : reports).map((report) => report.reportId))]
}

function createAlertEmail(alert) {
  const section = alert.subcategory
    ? `${alert.category} → ${alert.subcategory}`
    : alert.category === 'Faculty'
      ? `Faculty → ${alert.subject} (${alert.department})`
      : alert.category
  const greeting = alert.recipients.map((recipient) => recipient.name).join(' and ')
  return {
    subject: `Action Alert: Recurring ${alert.issue} Issue Detected — Campuz Voiz`,
    text: [
      `Dear ${greeting},`,
      '',
      'Campuz Voiz has detected a recurring issue from aggregated student feedback.',
      '',
      `Section: ${section}`,
      `Issue: ${alert.issue}`,
      `Matching reports: ${alert.matchingReportCount}`,
      `Relevant students: ${alert.relevantStudentCount}`,
      `Affected percentage: ${alert.percentage}%`,
      `AI sentiment: ${alert.sentiment}`,
      `Priority: ${alert.priority}`,
      `Trend: ${alert.trend}`,
      '',
      'Recommended action:',
      'Please review the reported issue and take appropriate corrective action.',
      '',
      `Current status: ${alert.currentStatus}`,
      '',
      'This notification was generated automatically by Campuz Voiz.',
      '',
      'Regards,',
      'Campuz Voiz',
      'AI-Powered Campus Feedback System',
    ].join('\n'),
  }
}

function configuredTransport() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM } = process.env
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASSWORD || !EMAIL_FROM) return null
  const port = Number(EMAIL_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('EMAIL_PORT must be a valid TCP port.')
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
}

export class AlertNotificationService {
  async processSubmission(candidate, allReports) {
    const reportingPeriod = new Date(candidate.createdAt).toISOString().slice(0, 7)
    const scopedReports = allReports.filter((report) => issueScope(candidate, report)
      && new Date(report.createdAt).toISOString().slice(0, 7) === reportingPeriod)
    if (!scopedReports.length) return []

    const recipients = resolveAlertRecipients(candidate)
    const issues = analyzeFeedback(scopedReports)
    const alerts = []
    for (const issue of issues) {
      if (issue.sentiment !== 'Negative') continue
      const relevantStudentCount = await countRelevantStudents({ department: candidate.department, year: candidate.year })
      if (!relevantStudentCount) continue
      const threshold = Math.max(minimumReports(), Math.ceil(relevantStudentCount * percentThreshold() / 100))
      const matchingReportCount = issue.negativeCount
      if (matchingReportCount < threshold) continue

      const alertKey = [
        reportingPeriod,
        candidate.category,
        candidate.subcategory ?? '',
        candidate.department,
        candidate.year,
        candidate.category === 'Faculty' ? candidate.facultyId : '',
        issue.issue,
      ].join('::')
      const reportIds = issueReportIds(scopedReports, issue)
      const relatedReports = scopedReports.filter((report) => reportIds.includes(report.reportId))
      const currentReport = relatedReports.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0]
      const alert = await upsertAlert({
        alertKey,
        category: candidate.category,
        subcategory: candidate.subcategory || undefined,
        issue: issue.issue,
        department: candidate.department,
        year: candidate.year,
        facultyId: candidate.category === 'Faculty' ? candidate.facultyId : undefined,
        subject: candidate.category === 'Faculty' ? candidate.subject : undefined,
        matchingReportCount,
        relevantStudentCount,
        percentage: Number((matchingReportCount / relevantStudentCount * 100).toFixed(1)),
        sentiment: issue.sentiment,
        priority: issue.priorityLevel,
        trend: issue.trend,
        recipients,
        reportingPeriod,
        relatedReportIds: reportIds,
        currentStatus: currentReport?.status || 'Report Sent',
      })
      const claim = await claimAlertNotification(alertKey)
      if (claim) await this.sendOrLog(claim)
      alerts.push((await listAlerts()).find((item) => item.alertKey === alertKey) ?? alert)
    }
    return alerts
  }

  async sendOrLog(alert) {
    const email = createAlertEmail(alert)
    try {
      const transport = configuredTransport()
      if (!transport) {
        console.info(`[Campuz Voiz development email] To: ${[...new Set(alert.recipients.map((recipient) => recipient.email))].join(', ')}\nSubject: ${email.subject}\n${email.text}`)
        await updateAlert(alert.alertKey, { notificationStatus: 'Development Mode' })
        return
      }
      const uniqueRecipients = [...new Set(alert.recipients.map((recipient) => recipient.email))]
      await transport.sendMail({ from: process.env.EMAIL_FROM, to: uniqueRecipients, subject: email.subject, text: email.text })
      await updateAlert(alert.alertKey, { notificationStatus: 'Sent', lastNotifiedAt: new Date() })
    } catch (error) {
      console.error('Campuz Voiz alert email delivery failed:', error.message)
      await updateAlert(alert.alertKey, { notificationStatus: 'Failed' })
    }
  }
}

export const alertNotificationService = new AlertNotificationService()