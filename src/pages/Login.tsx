import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Label } from '../components/ui'
import { useAuthStore } from '../store/auth'
import { tw } from '../lib/tokens'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className={`${tw.page} flex flex-col items-center justify-center px-6`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-display text-4xl">Chapter</h1>
          <p className="text-muted mt-2 text-sm">Find your next great read — and reader.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              hasError={!!error}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              hasError={!!error}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          No account?{' '}
          <Link to="/register" className="text-brand-ink font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
