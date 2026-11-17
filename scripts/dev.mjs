/**
 * 一条命令同时启动前后端（开发模式）。
 * 前端：Vite (http://localhost:5173)
 * 后端：Express API (http://localhost:8787)
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const children = []

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  child.on('exit', (code) => {
    console.log(`[${name}] 退出，code=${code}`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

let closing = false
function shutdown(code) {
  if (closing) return
  closing = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  setTimeout(() => process.exit(code), 300)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('▶ 启动 API 服务 (8787) 与前端 (5173) ...')
run('api', process.execPath, ['--watch', path.join(root, 'server', 'index.js')])
run('web', process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')])
