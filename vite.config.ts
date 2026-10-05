import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The security headers the deployed site sends live in vercel.json. `npm run
// preview` sends the same ones, so the built app can be checked against them
// locally. (The dev server doesn't: hot reloading needs inline scripts.)
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { headers: { key: string; value: string }[] }[]
}
// Minus the HTTPS-only parts, since the preview runs on plain http://localhost.
const securityHeaders = Object.fromEntries(
  vercel.headers[0].headers
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { headers: securityHeaders },
})
