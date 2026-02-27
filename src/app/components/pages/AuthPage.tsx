import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2, ArrowLeft, Check } from 'lucide-react';
import { useAuth, supabase } from '../AuthContext';

/* ── Inline SVG brand icons ── */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function DiscordIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  );
}

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const { login, register, loginWithProvider, forgotPassword, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null);

  // Detect OAuth error returned in URL (e.g. from Supabase or Google)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');
    if (oauthError) {
      setError(`Sign-in failed: ${decodeURIComponent(oauthError.replace(/\+/g, ' '))}`);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // If Supabase already has a session but auth context hasn't caught it yet
    // (race condition on first render), wait for onAuthStateChange to fire.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Session exists — auth context will update via onAuthStateChange shortly.
        // Show a transitional message so the user doesn't see a flickering login page.
        setInfo('Signing you in…');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) { setError('Email is required'); setLoading(false); return; }
        const result = await forgotPassword(email);
        if (!result.success) {
          setError(result.error || 'Failed to send reset email');
        } else {
          setInfo('Check your email for a password reset link.');
        }
        return;
      }

      if (mode === 'login') {
        const result = await login(email, password);
        if (!result.success) setError(result.error || 'Login failed');
      } else {
        if (!name.trim()) { setError('Name is required'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        const result = await register(name, email, password);
        if (!result.success) {
          setError(result.error || 'Registration failed');
        } else if (result.error) {
          // Success but email confirmation needed
          setInfo(result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.updateUser({ password: newPassword });
      if (sbError) {
        setError(sbError.message);
      } else {
        clearPasswordRecovery();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'discord') => {
    setError('');
    setInfo('');
    setOauthLoading(provider);
    try {
      const result = await loginWithProvider(provider);
      if (!result.success) setError(result.error || `${provider} login failed`);
    } finally {
      setOauthLoading(null);
    }
  };

  const switchMode = (m: AuthMode) => { setMode(m); setError(''); setInfo(''); };

  const isAnyLoading = loading || oauthLoading !== null;

  /* ─── Password Recovery Screen ──────────────────────────────────────── */
  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--tp-l0)' }}>
        <div className="w-full px-6 py-12" style={{ maxWidth: 380 }}>
          <div className="flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--tp-accent)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>T</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em' }}>TradePilot</span>
          </div>

          <div className="mb-8">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Set new password
            </h2>
            <p style={{ fontSize: 13, color: 'var(--tp-text-3)' }}>Choose a strong password for your account</p>
          </div>

          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>
                New password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  disabled={loading}
                  className="w-full rounded-lg px-3.5 py-2.5 pr-10 focus:outline-none"
                  style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tp-text-3)' }}>
                  {showNewPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                disabled={loading}
                className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none"
                style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
              />
            </div>

            {error && (
              <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <span style={{ fontSize: 12, color: 'var(--tp-bearish)' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5"
              style={{ background: loading ? 'var(--tp-l3)' : 'var(--tp-accent)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1, marginTop: 8 }}
            >
              {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <><span>Update password</span><ArrowRight style={{ width: 14, height: 14 }} /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ─── Main Auth Screen ───────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--tp-l0)' }}>
      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 flex-shrink-0"
        style={{ width: 420, background: 'var(--tp-l1)', borderRight: '1px solid var(--tp-border-subtle)' }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--tp-accent)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>T</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em' }}>TradePilot</span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.03em', color: 'var(--tp-text-1)', marginBottom: 16 }}>
            Macro-first trading intelligence.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tp-text-2)' }}>
            Institutional COT data, macro regime analysis, bias engine, and scored setups — all in one premium dashboard.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { label: 'COT Positioning', desc: 'Live CFTC data with percentile rankings' },
            { label: 'Bias Engine', desc: 'Macro-first directional framework' },
            { label: 'Top Setups', desc: '20 instruments scored in real-time' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--tp-accent)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-text-1)' }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--tp-text-3)' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full" style={{ maxWidth: 380 }}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--tp-accent)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>T</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em' }}>TradePilot</span>
          </div>

          {/* ── Forgot password mode ── */}
          {mode === 'forgot' ? (
            <>
              <div className="mb-8">
                <button
                  onClick={() => switchMode('login')}
                  className="flex items-center gap-1.5 mb-4"
                  style={{ fontSize: 12, color: 'var(--tp-text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--tp-text-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--tp-text-3)'; }}
                >
                  <ArrowLeft style={{ width: 13, height: 13 }} />
                  Back to sign in
                </button>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                  Reset password
                </h2>
                <p style={{ fontSize: 13, color: 'var(--tp-text-3)' }}>
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              {info ? (
                <div className="rounded-lg px-4 py-4 flex items-start gap-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <Check style={{ width: 16, height: 16, color: 'var(--tp-bullish)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-bullish)', marginBottom: 2 }}>Email sent</div>
                    <div style={{ fontSize: 12, color: 'var(--tp-text-2)' }}>{info}</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={loading}
                      className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none"
                      style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                      <span style={{ fontSize: 12, color: 'var(--tp-bearish)' }}>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5"
                    style={{ background: loading ? 'var(--tp-l3)' : 'var(--tp-accent)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1, marginTop: 8 }}
                  >
                    {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <><span>Send reset link</span><ArrowRight style={{ width: 14, height: 14 }} /></>}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {/* ── Login / Register mode ── */}
              <div className="mb-8">
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em', marginBottom: 6 }}>
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--tp-text-3)' }}>
                  {mode === 'login' ? 'Sign in to access your dashboard' : 'Start your free trial today'}
                </p>
              </div>

              {/* ── OAuth Buttons ── */}
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  disabled={isAnyLoading}
                  onClick={() => handleOAuth('google')}
                  className="flex-1 flex items-center justify-center gap-2.5 rounded-lg py-2.5 px-4 transition-all"
                  style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', opacity: isAnyLoading && oauthLoading !== 'google' ? 0.5 : 1, cursor: isAnyLoading ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!isAnyLoading) { e.currentTarget.style.borderColor = 'var(--tp-border-strong)'; e.currentTarget.style.background = 'var(--tp-l3)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; e.currentTarget.style.background = 'var(--tp-l2)'; }}
                >
                  {oauthLoading === 'google' ? <Loader2 style={{ width: 16, height: 16, color: 'var(--tp-text-2)' }} className="animate-spin" /> : <GoogleIcon size={16} />}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-1)' }}>Google</span>
                </button>

                <button
                  type="button"
                  disabled={isAnyLoading}
                  onClick={() => handleOAuth('discord')}
                  className="flex-1 flex items-center justify-center gap-2.5 rounded-lg py-2.5 px-4 transition-all"
                  style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', opacity: isAnyLoading && oauthLoading !== 'discord' ? 0.5 : 1, cursor: isAnyLoading ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!isAnyLoading) { e.currentTarget.style.borderColor = 'var(--tp-border-strong)'; e.currentTarget.style.background = 'var(--tp-l3)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; e.currentTarget.style.background = 'var(--tp-l2)'; }}
                >
                  {oauthLoading === 'discord' ? <Loader2 style={{ width: 16, height: 16, color: 'var(--tp-text-2)' }} className="animate-spin" /> : <span style={{ color: '#5865F2' }}><DiscordIcon size={16} /></span>}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-1)' }}>Discord</span>
                </button>
              </div>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px" style={{ background: 'var(--tp-border-subtle)' }} />
                <span style={{ fontSize: 11, color: 'var(--tp-text-3)', whiteSpace: 'nowrap' }}>or continue with email</span>
                <div className="flex-1 h-px" style={{ background: 'var(--tp-border-subtle)' }} />
              </div>

              {/* ── Email / Password Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>Full name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Doe"
                      disabled={isAnyLoading}
                      className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none"
                      style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={isAnyLoading}
                    className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none"
                    style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)' }}>Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        style={{ fontSize: 11, color: 'var(--tp-accent)' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Min. 6 characters' : 'Enter password'}
                      required
                      disabled={isAnyLoading}
                      className="w-full rounded-lg px-3.5 py-2.5 pr-10 focus:outline-none"
                      style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tp-text-3)' }}>
                      {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--tp-bearish)' }}>{error}</span>
                  </div>
                )}

                {info && (
                  <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--tp-bullish)' }}>{info}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAnyLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 transition-all"
                  style={{ background: isAnyLoading ? 'var(--tp-l3)' : 'var(--tp-accent)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: isAnyLoading ? 0.7 : 1, marginTop: 8 }}
                >
                  {loading ? (
                    <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  ) : (
                    <>{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight style={{ width: 14, height: 14 }} /></>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <span style={{ fontSize: 12, color: 'var(--tp-text-3)' }}>
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                </span>
                <button
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-accent)' }}
                >
                  {mode === 'login' ? 'Create one' : 'Sign in'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
