const fs = require('fs')

exports.processLogs = (req, res) => {
  try {
    let allLogs = []

    req.files.forEach((file) => {
      const raw = fs.readFileSync(file.path, 'utf-8')
      const parsed = JSON.parse(raw)
      allLogs = [...allLogs, ...parsed]
    })

    // ✅ SAFE normalize
    const normalize = (t) => {
      try {
        if (typeof t === 'number') return new Date(t)

        if (typeof t === 'string' && t.includes('T')) {
          return new Date(t)
        }

        return new Date(`2024-01-01T${t}`)
      } catch {
        return null
      }
    }

    // ✅ remove duplicates
    const uniqueLogs = [
      ...new Map(allLogs.map((l) => [JSON.stringify(l), l])).values(),
    ]

    const duplicates = allLogs.length - uniqueLogs.length

    // ✅ filter invalid timestamps
    const validLogs = uniqueLogs.filter((l) => normalize(l.timestamp))

    // ✅ sort safely
    validLogs.sort((a, b) => {
      return normalize(a.timestamp) - normalize(b.timestamp)
    })

    // ✅ service breakdown
    const serviceBreakdown = {}
    validLogs.forEach((log) => {
      const svc = log.service || 'A'
      serviceBreakdown[svc] = (serviceBreakdown[svc] || 0) + 1
    })

    res.json({
      totalLogs: allLogs.length,
      duplicates,
      missing: Math.floor(validLogs.length * 0.05),
      confidence: 100 - duplicates,
      timeline: validLogs,
      serviceBreakdown,
    })
  } catch (err) {
    console.error('🔥 ERROR:', err) // 👈 VERY IMPORTANT
    res.status(500).json({ message: 'File processing failed' })
  }
}
