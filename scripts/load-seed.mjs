/**
 * 载入离线演示数据（无需 API Key 也能查看完整产品效果）。
 *
 *   npm run demo:data
 *
 * 数据来自 seed/ 目录，包含若干份已生成的试卷与作答记录，
 * 用于评委在没有模型 Key 的情况下快速了解产品形态。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const seedDir = path.join(root, 'seed')
const dataDir = path.join(root, 'server', 'data')

if (!fs.existsSync(seedDir)) {
  console.error('找不到 seed/ 目录')
  process.exit(1)
}

fs.mkdirSync(dataDir, { recursive: true })

let copied = 0
for (const file of fs.readdirSync(seedDir)) {
  if (!file.endsWith('.json')) continue
  fs.copyFileSync(path.join(seedDir, file), path.join(dataDir, file))
  copied += 1
  console.log(`  · ${file}`)
}

console.log('')
console.log(`✓ 已载入 ${copied} 个演示数据文件 → server/data/`)
console.log('  启动服务后即可浏览示例试卷与学情报告（无需 API Key）')
console.log('  注意：生成新试卷与 AI 批改仍需配置 DEEPSEEK_API_KEY')
