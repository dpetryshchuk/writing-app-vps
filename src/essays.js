const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')

const contentDir = () => process.env.CONTENT_DIR

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

function essayPath(folder, slug) {
  return path.join(contentDir(), folder, `${slug}.md`)
}

function listEssays() {
  const dir = contentDir()
  if (!fs.existsSync(dir)) return []
  const folders = fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  const essays = []
  for (const folder of folders) {
    const folderPath = path.join(dir, folder)
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      const raw = fs.readFileSync(path.join(folderPath, file), 'utf8')
      const { data } = matter(raw)
      essays.push({ folder, slug, ...data })
    }
  }
  return essays
}

function readEssay(folder, slug) {
  const fp = essayPath(folder, slug)
  if (!fs.existsSync(fp)) return null
  const raw = fs.readFileSync(fp, 'utf8')
  const { data, content } = matter(raw)
  return { folder, slug, frontmatter: data, body: content.trim() }
}

function writeEssay(folder, slug, frontmatter, body) {
  const fp = essayPath(folder, slug)
  const raw = matter.stringify(body, frontmatter)
  fs.writeFileSync(fp, raw, 'utf8')
}

function createEssay(folder, title) {
  const slug = slugify(title)
  const dir = path.join(contentDir(), folder)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const fp = path.join(dir, `${slug}.md`)
  if (fs.existsSync(fp)) throw new Error(`Essay already exists: ${folder}/${slug}`)
  const frontmatter = {
    title,
    date: new Date().toISOString().slice(0, 10),
    tags: [],
    description: '',
    status: 'in-progress',
  }
  fs.writeFileSync(fp, matter.stringify('', frontmatter), 'utf8')
  return { folder, slug, frontmatter }
}

function deleteEssay(folder, slug) {
  const fp = essayPath(folder, slug)
  if (!fs.existsSync(fp)) throw new Error('Not found')
  fs.unlinkSync(fp)
}

function moveEssay(folder, slug, targetFolder) {
  const src = essayPath(folder, slug)
  if (!fs.existsSync(src)) throw new Error('Not found')
  const targetDir = path.join(contentDir(), targetFolder)
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
  const dest = path.join(targetDir, `${slug}.md`)
  fs.renameSync(src, dest)
}

module.exports = { listEssays, readEssay, writeEssay, createEssay, deleteEssay, moveEssay }
