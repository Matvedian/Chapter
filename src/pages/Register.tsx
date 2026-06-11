import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Label } from '../components/ui'
import { useAuthStore } from '../store/auth'
import { tw } from '../lib/tokens'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { signUp } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: err, needsConfirmation } = await signUp(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else if (needsConfirmation) {
      setEmailSent(true)
    } else {
      navigate('/', { replace: true })
    }
  }

  if (emailSent) {
    return (
      <div className={`${tw.page} flex flex-col items-center justify-center px-6`}>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-display text-4xl">Chapter</h1>
          <p className="text-ink mt-6 font-medium">Check your inbox</p>
          <p className="text-muted mt-2 text-sm">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it to activate your account, then sign in.
          </p>
          <Link to="/login" className="inline-block mt-6 text-brand-ink font-medium hover:underline text-sm">
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`${tw.page} flex flex-col items-center justify-center px-6`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-display text-4xl">Chapter</h1>
          <p className="text-muted mt-2 text-sm">Your story starts here.</p>
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

          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              hasError={!!error}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-ink font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
