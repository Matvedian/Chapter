import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Label } from '../components/ui'
import { useAuthStore } from '../store/auth'
import { tw } from '../lib/tokens'

const COUNTRY_CODES = [
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+1',  label: '🇺🇸 +1'  },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+41', label: '🇨🇭 +41' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+81', label: '🇯🇵 +81' },
]

export default function PhoneAuth() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [countryCode, setCountryCode] = useState('+39')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { requestOtp, verifyOtp } = useAuthStore()
  const navigate = useNavigate()

  const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await requestOtp(fullPhone)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setStep('otp')
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await verifyOtp(fullPhone, otp)
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
          <p className="text-muted mt-2 text-sm">
            {step === 'phone'
              ? 'Find your next great read — and reader.'
              : `We sent a 6-digit code to ${fullPhone}`}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-3 rounded-input border border-border bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="320 123 4567"
                  hasError={!!error}
                  className="flex-1"
                />
              </div>
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <Button type="submit" fullWidth disabled={loading || !phone}>
              {loading ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                hasError={!!error}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <Button type="submit" fullWidth disabled={loading || otp.length < 6}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>

            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
              className="w-full text-center text-muted text-sm hover:text-ink mt-2"
            >
              Wrong number? Go back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
