const clamp = (number, minimum, maximum) => Math.min(maximum, Math.max(minimum, number))

function configuredWeight(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function analyzeFeedback(reports) {
  const groups = new Map()
  const commentTopics = [
    [/wi[\s-]?fi|internet|network|connectivity/i, 'Wi-Fi reliability'],
    [/laborator|\blab\b|computer system/i, 'Laboratory systems'],
    [/faculty|teacher|teaching|classroom/i, 'Teaching & support'],
    [/course|syllabus|learning material|pace/i, 'Course experience'],
    [/activit|event|sport|workshop|hackathon/i, 'Campus activities'],
  ]
  for (const report of reports) {
    for (const [question, rawRating] of Object.entries(report.ratings ?? {})) {
      const rating = Number(rawRating)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue
      const key = [report.category, report.subcategory ?? '', question].join('|')
      const group = groups.get(key) ?? { category: report.category, subcategory: report.subcategory, issue: question, ratings: [], current: 0, previous: 0 }
      group.ratings.push(rating)
      const date = new Date(report.createdAt)
      const now = new Date()
      const sameMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      if (sameMonth) group.current += 1
      else if (date.getMonth() === previousMonth.getMonth() && date.getFullYear() === previousMonth.getFullYear()) group.previous += 1
      groups.set(key, group)
    }
    const comment = report.comments?.trim()
    if (comment) {
      const topic = commentTopics.find(([pattern]) => pattern.test(comment))?.[1]
      if (topic) {
        const key = [report.category, report.subcategory ?? '', topic].join('|')
        const group = groups.get(key) ?? { category: report.category, subcategory: report.subcategory, issue: topic, ratings: [], current: 0, previous: 0 }
        const negative = /\b(bad|poor|slow|broken|issue|problem|fail|not|need|lack|difficult|improve)\b/i.test(comment)
        const positive = /\b(good|great|excellent|helpful|reliable|smooth|enjoy)\b/i.test(comment)
        group.ratings.push(negative ? 1 : positive ? 5 : 3)
        const date = new Date(report.createdAt)
        const now = new Date()
        const sameMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        if (sameMonth) group.current += 1
        else if (date.getMonth() === previousMonth.getMonth() && date.getFullYear() === previousMonth.getFullYear()) group.previous += 1
        groups.set(key, group)
      }
    }
  }

  const negativeThreshold = Math.max(1, Number(process.env.AI_NEGATIVE_THRESHOLD) || 3)
  const positiveThreshold = Math.max(1, Number(process.env.AI_POSITIVE_THRESHOLD) || 3)
  const weights = [
    configuredWeight('PRIORITY_FREQUENCY_WEIGHT', 35),
    configuredWeight('PRIORITY_SEVERITY_WEIGHT', 25),
    configuredWeight('PRIORITY_NEGATIVE_WEIGHT', 25),
    configuredWeight('PRIORITY_TREND_WEIGHT', 15),
  ]
  const weightTotal = weights.reduce((total, weight) => total + weight, 0) || 1

  return [...groups.values()].map((group) => {
    const mentions = group.ratings.length
    const negativeCount = group.ratings.filter((rating) => rating <= 2).length
    const positiveCount = group.ratings.filter((rating) => rating >= 4).length
    const averageRating = group.ratings.reduce((total, rating) => total + rating, 0) / mentions
    const negativeRate = negativeCount / mentions
    const sentiment = negativeCount >= negativeThreshold
      ? 'Negative'
      : positiveCount >= positiveThreshold && positiveCount / mentions > 0.5 && negativeCount < negativeThreshold
        ? 'Positive'
        : 'Neutral'
    const trendValue = group.previous === 0
      ? (group.current > 0 ? 100 : 0)
      : clamp(((group.current - group.previous) / group.previous) * 100, -100, 100)
    const factors = [
      Math.min(100, mentions / 25 * 100),
      (6 - averageRating) / 5 * 100,
      negativeRate * 100,
      (trendValue + 100) / 2,
    ]
    const priorityScore = Math.round(factors.reduce((total, factor, index) => total + factor * weights[index], 0) / weightTotal)
    const priorityLevel = priorityScore >= 70 ? 'High' : priorityScore >= 40 ? 'Medium' : 'Low'
    return {
      category: group.category,
      subcategory: group.subcategory,
      issue: group.issue,
      mentions,
      negativeRate: Math.round(negativeRate * 100),
      averageRating: Number(averageRating.toFixed(1)),
      sentiment,
      priorityScore,
      priorityLevel,
      trend: group.previous === 0 && group.current > 0 ? 'New' : trendValue > 10 ? 'Increasing' : trendValue < -10 ? 'Decreasing' : 'Stable',
    }
  }).sort((left, right) => right.priorityScore - left.priorityScore)
}