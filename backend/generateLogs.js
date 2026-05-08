const fs = require('fs')

const services = ['A', 'B', 'C']
const events = [
  'user.login',
  'payment.init',
  'order.create',
  'db.query',
  'api.request',
  'cache.hit',
  'queue.push',
]

const logs = []

for (let i = 0; i < 1000; i++) {
  const baseTime = new Date(2024, 0, 1, 9, 0, 0)
  baseTime.setSeconds(baseTime.getSeconds() + i)

  let timestamp

  // 🔥 Different timestamp formats
  const type = Math.random()

  if (type < 0.3) {
    timestamp = baseTime.toTimeString().slice(0, 8) // HH:mm:ss
  } else if (type < 0.6) {
    timestamp = baseTime.toISOString() // ISO format
  } else {
    timestamp = baseTime.getTime() // UNIX timestamp
  }

  const log = {
    timestamp,
    service: services[Math.floor(Math.random() * services.length)],
    event: events[Math.floor(Math.random() * events.length)],
  }

  logs.push(log)

  // 🔥 Add duplicate logs (10%)
  if (Math.random() < 0.1) {
    logs.push(log)
  }

  // 🔥 Add out-of-order logs (10%)
  if (Math.random() < 0.1) {
    const pastTime = new Date(baseTime.getTime() - 5000)
    logs.push({
      ...log,
      timestamp: pastTime.toTimeString().slice(0, 8),
    })
  }

  // 🔥 Missing events simulation (skip some logs)
  if (Math.random() < 0.05) {
    continue
  }
}

fs.writeFileSync('serviceA.json', JSON.stringify(logs, null, 2))

console.log('🔥 Advanced 1000 logs generated')
