require('dotenv').config()

const cors = require('cors')
const express = require('express')

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
