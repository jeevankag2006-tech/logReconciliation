const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })

const { processLogs } = require('../controllers/logs.controller')

// upload multiple files
router.post('/upload', upload.array('files'), processLogs)

module.exports = router
