import React, { useState } from 'react';
import { User, Shield, Star, Bell, Monitor, LogOut, Check, X } from 'lucide-react';
import { useAuth } from '../AuthContext';

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
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--tp-accent-muted)', border: '2px solid var(--tp-accent)' }}
              >
                <span style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{initials}</span>
              </div>
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

          {/* Notifications */}
          <SettingsSection icon={Bell} title="Notifications" description="Alert preferences">
            <div className="space-y-4">
              <ToggleRow
                label="Weekly COT alerts"
                description="Get notified when new COT data is released"
                checked={true}
                onChange={() => showSaved()}
              />
              <ToggleRow
                label="Bias changes"
                description="Alert when EdgeFinder bias changes for favorites"
                checked={true}
                onChange={() => showSaved()}
              />
              <ToggleRow
                label="Macro events"
                description="High-impact economic releases"
                checked={false}
                onChange={() => showSaved()}
              />
            </div>
          </SettingsSection>

          {/* Security */}
          <SettingsSection icon={Shield} title="Security" description="Account security settings">
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Password</div>
                <div style={{ fontSize: 11, color: C.t3 }}>Last changed: Never</div>
              </div>
              <button
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
