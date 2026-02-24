import React, { useState } from 'react';
import { User, Shield, Star, Bell, Monitor, LogOut, Check, X, Wifi, Loader2, Database, Eye, EyeOff } from 'lucide-react';
import { useAuth, supabase } from '../AuthContext';
import { PROVIDERS_ENABLED } from '../../engine/config';
import { useTradePilotData } from '../../engine/dataService';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)',
};

export default function AccountPage() {
  const { user, updateUser, logout } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [saved, setSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (!user) return null;

  const handleSaveName = () => {
    if (nameValue.trim()) {
      updateUser({ name: nameValue.trim() });
      setEditingName(false);
      showSaved();
    }
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const planBadge = {
    free: { label: 'Free', color: C.t3, bg: C.l3 },
    pro: { label: 'Pro', color: C.accent, bg: 'rgba(91,108,255,0.1)' },
    enterprise: { label: 'Enterprise', color: C.bullish, bg: 'rgba(52,211,153,0.1)' },
  }[user.plan];

  const notif = user.settings.notifications;

  return (
    <div className="p-5 md:p-8 lg:p-10">
      {/* Saved toast */}
      {saved && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg"
          style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-bullish)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          <Check style={{ width: 14, height: 14, color: C.bullish }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: C.bullish }}>Settings saved</span>
        </div>
      )}

      {/* Change password modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => { setShowPasswordModal(false); showSaved(); }}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: C.t1, marginBottom: 4 }}>
          Account
        </h1>
        <p style={{ fontSize: 13, color: C.t2 }}>Manage your profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: Profile card */}
        <div>
          <div className="rounded-xl p-6" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-20 h-20 rounded-full mb-4 object-cover"
                  style={{ border: '2px solid var(--tp-accent)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'var(--tp-accent-muted)', border: '2px solid var(--tp-accent)' }}
                >
                  <span style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{initials}</span>
                </div>
              )}
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    className="rounded-md px-2.5 py-1 focus:outline-none text-center"
                    style={{ background: C.l3, border: `1px solid ${C.border}`, color: C.t1, fontSize: 14, fontWeight: 600, width: 160 }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 rounded" style={{ color: C.bullish }}>
                    <Check style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded" style={{ color: C.bearish }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNameValue(user.name); setEditingName(true); }}
                  style={{ fontSize: 16, fontWeight: 600, color: C.t1 }}
                >
                  {user.name}
                </button>
              )}
              <span style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{user.email}</span>
            </div>

            {/* Plan + Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: C.t3 }}>Plan</span>
                <span
                  className="rounded-md px-2.5 py-0.5"
                  style={{ fontSize: 11, fontWeight: 600, color: planBadge.color, background: planBadge.bg }}
                >
                  {planBadge.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: C.t3 }}>Member since</span>
                <span style={{ fontSize: 12, color: C.t2 }}>{memberSince}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: C.t3 }}>Favorites</span>
                <span style={{ fontSize: 12, color: C.t2 }}>{user.favorites.length} assets</span>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors"
            style={{ background: C.l2, border: `1px solid ${C.borderSubtle}`, color: C.bearish, fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.l2; e.currentTarget.style.borderColor = C.borderSubtle; }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Sign out
          </button>
        </div>

        {/* Right: Settings sections */}
        <div className="space-y-5">
          {/* Favorites */}
          <SettingsSection icon={Star} title="Watchlist" description="Your favorited instruments">
            {user.favorites.length === 0 ? (
              <p style={{ fontSize: 12, color: C.t3 }}>No favorites yet. Star instruments in Top Setups to add them here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.favorites.map(f => (
                  <span
                    key={f}
                    className="rounded-md px-3 py-1.5"
                    style={{ fontSize: 12, fontWeight: 500, color: C.t1, background: C.l3, border: `1px solid ${C.borderSubtle}` }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* Preferences */}
          <SettingsSection icon={Monitor} title="Preferences" description="Display and data preferences">
            <div className="space-y-4">
              <ToggleRow
                label="Compact mode"
                description="Reduce spacing in data tables"
                checked={user.settings.compactMode}
                onChange={v => { updateUser({ settings: { ...user.settings, compactMode: v } }); showSaved(); }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Data source</div>
                  <div style={{ fontSize: 11, color: C.t3 }}>Fallback mode for COT data</div>
                </div>
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borderSubtle}` }}>
                  {(['live', 'mock'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => { updateUser({ settings: { ...user.settings, dataSource: opt } }); showSaved(); }}
                      className="px-3 py-1.5 transition-colors"
                      style={{
                        fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: user.settings.dataSource === opt ? 'var(--tp-accent-muted)' : 'transparent',
                        color: user.settings.dataSource === opt ? C.accent : C.t3,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Data Sources */}
          <DataSourcesPanel />

          {/* Notifications */}
          <SettingsSection icon={Bell} title="Notifications" description="Alert preferences">
            <div className="space-y-4">
              <ToggleRow
                label="Weekly COT alerts"
                description="Get notified when new COT data is released"
                checked={notif.weeklyCot}
                onChange={v => {
                  updateUser({ settings: { ...user.settings, notifications: { ...notif, weeklyCot: v } } });
                  showSaved();
                }}
              />
              <ToggleRow
                label="Bias changes"
                description="Alert when TradePilot bias changes for favorites"
                checked={notif.biasChanges}
                onChange={v => {
                  updateUser({ settings: { ...user.settings, notifications: { ...notif, biasChanges: v } } });
                  showSaved();
                }}
              />
              <ToggleRow
                label="Macro events"
                description="High-impact economic releases"
                checked={notif.macroEvents}
                onChange={v => {
                  updateUser({ settings: { ...user.settings, notifications: { ...notif, macroEvents: v } } });
                  showSaved();
                }}
              />
            </div>
          </SettingsSection>

          {/* Security */}
          <SettingsSection icon={Shield} title="Security" description="Account security settings">
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Password</div>
                <div style={{ fontSize: 11, color: C.t3 }}>Update your account password</div>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="rounded-lg px-3.5 py-1.5 transition-colors"
                style={{ fontSize: 12, fontWeight: 500, color: C.accent, background: 'var(--tp-accent-muted)', border: '1px solid transparent' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                Change password
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

/* ─── Change Password Modal ─────────────────────────────────────────────────── */
function ChangePasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl p-6 w-full relative"
        style={{ maxWidth: 400, background: 'var(--tp-l2)', border: '1px solid var(--tp-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md transition-colors"
          style={{ color: 'var(--tp-text-3)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--tp-l3)'; e.currentTarget.style.color = 'var(--tp-text-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tp-text-3)'; }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        <div className="mb-6">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Change password
          </h3>
          <p style={{ fontSize: 12, color: 'var(--tp-text-3)' }}>
            Choose a strong password (min. 6 characters)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                disabled={loading}
                className="w-full rounded-lg px-3.5 py-2.5 pr-10 focus:outline-none"
                style={{ background: 'var(--tp-l3)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tp-text-3)' }}>
                {showNew ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-2)', display: 'block', marginBottom: 6 }}>
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                disabled={loading}
                className="w-full rounded-lg px-3.5 py-2.5 pr-10 focus:outline-none"
                style={{ background: 'var(--tp-l3)', border: '1px solid var(--tp-border)', color: 'var(--tp-text-1)', fontSize: 13 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--tp-accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--tp-border)'; }}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tp-text-3)' }}>
                {showConfirm ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <span style={{ fontSize: 12, color: 'var(--tp-bearish)' }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg py-2.5 transition-colors"
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-text-2)', background: 'var(--tp-l3)', border: '1px solid var(--tp-border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 transition-colors"
              style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: loading ? 'var(--tp-l3)' : 'var(--tp-accent)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Reusable sub-components ─────────────────────────────────────────────── */

function SettingsSection({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon style={{ width: 15, height: 15, color: C.t3 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{title}</div>
          <div style={{ fontSize: 11, color: C.t3 }}>{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function DataSourcesPanel() {
  const { data, loading } = useTradePilotData();

  const sources: { name: string; status: 'live' | 'mock' | 'loading'; detail: string }[] = [
    {
      name: 'COT (CFTC)',
      status: loading ? 'loading' : 'live',
      detail: 'CFTC SODA API — no key required',
    },
    {
      name: 'US Macro (FRED)',
      status: loading ? 'loading' : PROVIDERS_ENABLED.fred ? 'live' : 'mock',
      detail: PROVIDERS_ENABLED.fred ? 'FRED API connected' : 'Set VITE_FRED_API_KEY in .env',
    },
    {
      name: 'Price & Technicals',
      status: loading ? 'loading' : PROVIDERS_ENABLED.twelveData ? 'live' : 'mock',
      detail: PROVIDERS_ENABLED.twelveData ? 'TwelveData API connected' : 'Set VITE_TWELVE_DATA_API_KEY in .env',
    },
    {
      name: 'Retail Sentiment',
      status: loading ? 'loading' : 'live',
      detail: 'Myfxbook community outlook — no key required',
    },
    {
      name: 'Interest Rates',
      status: loading ? 'loading' : 'live',
      detail: 'FRED (US) + Updated 2025 data (non-US)',
    },
    {
      name: 'Scoring Engine',
      status: loading ? 'loading' : data ? 'live' : 'mock',
      detail: data ? `${Object.keys(data.scorecards).length} assets scored` : 'Waiting for data...',
    },
  ];

  const liveCount = sources.filter(s => s.status === 'live').length;
  const totalCount = sources.length;

  return (
    <SettingsSection icon={Database} title="Data Sources" description="Live provider status">
      <div className="space-y-2.5">
        {/* Summary bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.t3 }} />
            ) : (
              <Wifi className="w-3.5 h-3.5" style={{ color: liveCount === totalCount ? C.bullish : C.accent }} />
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: loading ? C.t3 : C.t1 }}>
              {loading ? 'Connecting...' : `${liveCount}/${totalCount} providers live`}
            </span>
          </div>
          {data && (
            <span style={{ fontSize: 10, color: C.t3 }}>
              Updated: {new Date(data.computedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Provider rows */}
        {sources.map(src => (
          <div key={src.name} className="flex items-center justify-between py-1.5">
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>{src.name}</div>
              <div style={{ fontSize: 10, color: C.t3 }}>{src.detail}</div>
            </div>
            <span
              className="rounded-md px-2 py-0.5"
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: src.status === 'live' ? C.bullish : src.status === 'loading' ? C.t3 : C.bearish,
                background: src.status === 'live'
                  ? 'rgba(52,211,153,0.1)'
                  : src.status === 'loading'
                  ? C.l3
                  : 'rgba(248,113,113,0.1)',
              }}
            >
              {src.status === 'loading' ? 'LOADING' : src.status === 'live' ? 'LIVE' : 'MOCK'}
            </span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.t3 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative rounded-full transition-colors"
        style={{
          width: 36, height: 20,
          background: checked ? 'var(--tp-accent)' : 'var(--tp-l3)',
          border: `1px solid ${checked ? 'var(--tp-accent)' : C.borderSubtle}`,
        }}
      >
        <div
          className="absolute top-0.5 rounded-full transition-all"
          style={{
            width: 14, height: 14,
            left: checked ? 18 : 2,
            background: '#fff',
          }}
        />
      </button>
    </div>
  );
}
