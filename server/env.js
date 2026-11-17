import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const ROOT = path.resolve(here, '..')
export const SERVER_DIR = here

// 加载 server/.env（不依赖 dotenv，Node 20.12+ 原生支持）
const envPath = path.join(here, '.env')
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath)
  } catch (error) {
    console.warn('[env] 读取 server/.env 失败：', error.message)
  }
}

export const config = {
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  port: Number(process.env.PORT || 8787),
  dataDir: path.join(here, 'data'),
  distDir: path.join(ROOT, 'dist'),
  clientDir: path.join(ROOT, 'client'),
}

export const hasApiKey = () =>
  Boolean(config.apiKey) && !/your-key|sk-xxx/i.test(config.apiKey)
