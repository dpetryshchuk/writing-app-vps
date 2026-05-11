const { execSync } = require('child_process')

const repoDir = () => {
  const d = process.env.REPO_DIR
  if (!d) throw new Error('REPO_DIR env var is not set')
  return d
}

function gitPull() {
  const out = execSync('git pull', { cwd: repoDir(), encoding: 'utf8' })
  return out.trim()
}

function gitPush(message) {
  if (!message || !message.trim()) throw new Error('Commit message is required')
  execSync('git add -A', { cwd: repoDir() })
  try {
    execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: repoDir(), encoding: 'utf8' })
  } catch (e) {
    if (e.stdout && e.stdout.includes('nothing to commit')) {
      return 'Nothing to commit'
    }
    throw e
  }
  const out = execSync('git push', { cwd: repoDir(), encoding: 'utf8' })
  return out.trim()
}

module.exports = { gitPull, gitPush }
