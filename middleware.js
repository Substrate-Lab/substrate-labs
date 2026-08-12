// Password gate for the whole site, enforced at Vercel's edge (Basic Auth).
// The password is NOT stored here (repo is public) — it's read from the
// SITE_PASSWORD environment variable set in the Vercel project.
export const config = { matcher: '/(.*)' }

export default function middleware(request) {
  const auth = request.headers.get('authorization')
  if (auth) {
    try {
      const [, pwd] = atob(auth.split(' ')[1] || '').split(':')
      if (pwd && pwd === process.env.SITE_PASSWORD) return // correct password: let it through
    } catch {}
  }
  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Substrate"' },
  })
}
