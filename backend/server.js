const express = require('express')
const cors = require('cors')
const logRoutes = require('../backend/src/routes/logs.route')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/logs', logRoutes)

const PORT = 8000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
