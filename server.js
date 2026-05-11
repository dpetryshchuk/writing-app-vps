require('dotenv').config()
const express = require('express')
const path = require('path')
const { listEssays, readEssay, writeEssay, createEssay, deleteEssay, moveEssay } = require('./src/essays')
const { listFolders, createFolder, renameFolder, deleteFolder } = require('./src/folders')
const { gitPull, gitPush } = require('./src/git')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

function ok(res, data) { res.json({ ok: true, ...data }) }
function err(res, e, status = 400) { res.status(status).json({ ok: false, error: e.message }) }

// Essays
app.get('/api/essays', (req, res) => {
  try { ok(res, { essays: listEssays() }) } catch (e) { err(res, e) }
})
app.get('/api/essays/:folder/:slug', (req, res) => {
  try {
    const essay = readEssay(req.params.folder, req.params.slug)
    if (!essay) return res.status(404).json({ ok: false, error: 'Not found' })
    ok(res, { essay })
  } catch (e) { err(res, e) }
})
app.put('/api/essays/:folder/:slug', (req, res) => {
  try {
    const { frontmatter, body } = req.body
    writeEssay(req.params.folder, req.params.slug, frontmatter, body)
    ok(res, {})
  } catch (e) { err(res, e) }
})
app.post('/api/essays', (req, res) => {
  try {
    const { folder, title } = req.body
    if (!folder || !title) return err(res, new Error('folder and title required'))
    const essay = createEssay(folder, title)
    ok(res, { essay })
  } catch (e) { err(res, e) }
})
app.delete('/api/essays/:folder/:slug', (req, res) => {
  try { deleteEssay(req.params.folder, req.params.slug); ok(res, {}) } catch (e) { err(res, e) }
})
app.patch('/api/essays/:folder/:slug/move', (req, res) => {
  try {
    const { folder: targetFolder } = req.body
    moveEssay(req.params.folder, req.params.slug, targetFolder)
    ok(res, {})
  } catch (e) { err(res, e) }
})

// Folders
app.get('/api/folders', (req, res) => {
  try { ok(res, { folders: listFolders() }) } catch (e) { err(res, e) }
})
app.post('/api/folders', (req, res) => {
  try { createFolder(req.body.name); ok(res, {}) } catch (e) { err(res, e) }
})
app.patch('/api/folders/:folder', (req, res) => {
  try { renameFolder(req.params.folder, req.body.name); ok(res, {}) } catch (e) { err(res, e) }
})
app.delete('/api/folders/:folder', (req, res) => {
  try { deleteFolder(req.params.folder); ok(res, {}) } catch (e) { err(res, e) }
})

// Git
app.post('/api/git/pull', async (req, res) => {
  try { const out = gitPull(); ok(res, { output: out }) } catch (e) { err(res, e) }
})
app.post('/api/git/push', async (req, res) => {
  try { const out = gitPush(req.body.message); ok(res, { output: out }) } catch (e) { err(res, e) }
})

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 4112
app.listen(PORT, () => console.log(`writing-app on ${PORT}`))
