require('dotenv').config()

const cors = require('cors')
const express = require('express')

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/analyze', (_req, res) => {
  res.json({ message: 'coming soon' })
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
