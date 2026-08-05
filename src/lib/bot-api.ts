const BOT_URL = process.env.BOT_API_URL || 'http://localhost:3101'
const BOT_USER = process.env.BOT_ADMIN_USER || 'admin'
const BOT_PASS = process.env.BOT_ADMIN_PASS || ''

function botAuth(): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(`${BOT_USER}:${BOT_PASS}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }
}

function botUrl(path: string) {
  return `${BOT_URL}/admin/api${path}`
}

export async function botFetch(path: string, init?: RequestInit) {
  const url = botUrl(path)
  const headers = new Headers(botAuth())
  if (init?.headers) {
    const extra = new Headers(init.headers)
    extra.forEach((v, k) => headers.set(k, v))
  }
  return fetch(url, { ...init, headers })
}
