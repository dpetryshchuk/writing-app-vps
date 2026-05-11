const fs = require('fs')
const path = require('path')

const contentDir = () => {
  const d = process.env.CONTENT_DIR
  if (!d) throw new Error('CONTENT_DIR env var is not set')
  return d
}

function assertSafe(...parts) {
  for (const p of parts) {
    if (typeof p !== 'string' || p.includes('..') || path.isAbsolute(p)) {
      throw new Error(`Invalid path component: ${p}`)
    }
  }
}

function listFolders() {
  const dir = contentDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

function createFolder(name) {
  assertSafe(name)
  const fp = path.join(contentDir(), name)
  if (fs.existsSync(fp)) throw new Error('Folder already exists')
  fs.mkdirSync(fp, { recursive: true })
}

function renameFolder(oldName, newName) {
  assertSafe(oldName, newName)
  const src = path.join(contentDir(), oldName)
  const dest = path.join(contentDir(), newName)
  if (!fs.existsSync(src)) throw new Error('Not found')
  if (fs.existsSync(dest)) throw new Error('Target already exists')
  fs.renameSync(src, dest)
}

function deleteFolder(name) {
  assertSafe(name)
  const fp = path.join(contentDir(), name)
  if (!fs.existsSync(fp)) throw new Error('Not found')
  const files = fs.readdirSync(fp)
  if (files.length > 0) throw new Error('Folder is not empty')
  fs.rmdirSync(fp)
}

module.exports = { listFolders, createFolder, renameFolder, deleteFolder }
