const { execSync } = require('child_process')

const repoDir = () => process.env.REPO_DIR

function gitPull() {
  const out = execSync('git pull', { cwd: repoDir(), encoding: 'utf8' })
  return out.trim()
}

function gitPush(message) {
  if (!message || !message.trim()) throw new Error('Commit message is required')
  execSync('git add -A', { cwd: repoDir() })
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: repoDir() })
  const out = execSync('git push', { cwd: repoDir(), encoding: 'utf8' })
  return out.trim()
}

module.exports = { gitPull, gitPush }
