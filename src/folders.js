const fs = require('fs')
const path = require('path')

const contentDir = () => process.env.CONTENT_DIR

function listFolders() {
  const dir = contentDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

function createFolder(name) {
  const fp = path.join(contentDir(), name)
  if (fs.existsSync(fp)) throw new Error('Folder already exists')
  fs.mkdirSync(fp, { recursive: true })
}

function renameFolder(oldName, newName) {
  const src = path.join(contentDir(), oldName)
  const dest = path.join(contentDir(), newName)
  if (!fs.existsSync(src)) throw new Error('Not found')
  if (fs.existsSync(dest)) throw new Error('Target already exists')
  fs.renameSync(src, dest)
}

function deleteFolder(name) {
  const fp = path.join(contentDir(), name)
  if (!fs.existsSync(fp)) throw new Error('Not found')
  const files = fs.readdirSync(fp)
  if (files.length > 0) throw new Error('Folder is not empty')
  fs.rmdirSync(fp)
}

module.exports = { listFolders, createFolder, renameFolder, deleteFolder }
