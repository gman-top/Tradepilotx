import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, TrendingUp, FileText, Zap, Target, User,
  ChevronLeft, Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { useIsMobile } from './components/ui/use-mobile';
import { AuthProvider, useAuth } from './components/AuthContext';
import AuthPage from './components/pages/AuthPage';
import Overview from './components/pages/Overview';
import COTPositioning from './components/pages/COTPositioning';
import Fundamentals from './components/pages/Fundamentals';
import BiasEngine from './components/pages/BiasEngine';
import TopSetups from './components/pages/TopSetups';
import AssetProfile from './components/pages/AssetProfile';
import AccountPage from './components/pages/AccountPage';

type Page = 'overview' | 'cot' | 'fundamentals' | 'bias' | 'setups' | 'profile' | 'account';

const NAV_SECTIONS = [
  {
    label: 'Dashboard',
    items: [
      { id: 'overview' as Page, label: 'Overview', short: 'Home', icon: LayoutDashboard },
      { id: 'profile' as Page, label: 'Asset Profile', short: 'Profile', icon: User },
      { id: 'setups' as Page, label: 'Top Setups', short: 'Setups', icon: Target },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'cot' as Page, label: 'COT Positioning', short: 'COT', icon: TrendingUp },
      { id: 'fundamentals' as Page, label: 'Fundamentals', short: 'Macro', icon: FileText },
      { id: 'bias' as Page, label: 'Bias Engine', short: 'Bias', icon: Zap },
    ],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap(s => s.items);

/* Full-width pages that don't get padded wrapper */
const FULL_WIDTH_PAGES: Page[] = ['cot', 'profile'];

function AppShell() {
  const { user, isLoading, logout } = useAuth();
  const [activePage, setActivePage] = useState<Page>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--tp-l1)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--tp-accent)' }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>T</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em' }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <Overview />;
      case 'profile': return <AssetProfile />;
      case 'setups': return <TopSetups />;
      case 'cot': return <COTPositioning />;
      case 'fundamentals': return <Fundamentals />;
      case 'bias': return <BiasEngine />;
      case 'account': return <AccountPage />;
      default: return <Overview />;
    }
  };

  const isFullWidth = FULL_WIDTH_PAGES.includes(activePage);

  const initials = (user?.name ?? 'T')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  /* ─── MOBILE ─────────────────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--tp-l1)', color: 'var(--tp-text-1)' }}>
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-4 flex-shrink-0"
          style={{ height: 52, background: 'var(--tp-l0)', borderBottom: '1px solid var(--tp-border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--tp-accent)' }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>T</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--tp-text-1)' }}>
              TradePilot
            </span>
          </div>
          <button
            onClick={() => setActivePage('account')}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: activePage === 'account' ? 'var(--tp-accent)' : 'var(--tp-accent-muted)',
              border: activePage === 'account' ? '2px solid var(--tp-accent)' : '1px solid var(--tp-border-subtle)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: activePage === 'account' ? '#fff' : 'var(--tp-accent)' }}>
              {initials}
            </span>
          </button>
        </header>

        <main className="flex-1 overflow-auto">{renderPage()}</main>

        {/* Bottom tabs */}
        <nav
          className="flex items-stretch flex-shrink-0"
          style={{
            background: 'var(--tp-l0)',
            borderTop: '1px solid var(--tp-border-subtle)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors relative"
                style={{ minHeight: 56, padding: '8px 0 6px' }}
              >
                {active && (
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                    style={{ width: 20, height: 2, background: 'var(--tp-accent)' }}
                  />
                )}
                <Icon
                  style={{
                    width: 18, height: 18,
                    color: active ? 'var(--tp-accent)' : 'var(--tp-text-3)',
                    strokeWidth: active ? 2.2 : 1.5,
                  }}
                />
                <span style={{
                  fontSize: 9, fontWeight: active ? 600 : 400,
                  color: active ? 'var(--tp-accent)' : 'var(--tp-text-3)',
                  letterSpacing: '0.03em',
                }}>
                  {item.short}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  /* ─── DESKTOP ────────────────────────────────────────────────────────── */
  const sidebarWidth = collapsed ? 60 : 224;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--tp-l1)', color: 'var(--tp-text-1)' }}>
      {/* ═══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-200 ease-out"
        style={{
          width: sidebarWidth,
          background: 'var(--tp-l0)',
          borderRight: '1px solid var(--tp-border-subtle)',
        }}
      >
        {/* Logo area */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ height: 56, padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid var(--tp-border-subtle)' }}
        >
          {collapsed ? (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto cursor-pointer"
              style={{ background: 'var(--tp-accent)' }}
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>T</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--tp-accent)' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>T</span>
                </div>
                <div className="min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tp-text-1)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                    TradePilot
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--tp-text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Macro Dashboard
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0"
                style={{ color: 'var(--tp-text-3)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--tp-text-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tp-text-3)'; }}
                title="Collapse sidebar"
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label} className={si > 0 ? 'mt-5' : ''}>
              {/* Section label */}
              {!collapsed && (
                <div className="px-2.5 mb-1.5">
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && si > 0 && (
                <div className="mx-2 mb-2" style={{ height: 1, background: 'var(--tp-border-subtle)' }} />
              )}

              {/* Items */}
              <div className="space-y-[1px]">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className="w-full flex items-center gap-2.5 rounded-lg transition-all duration-100 relative group"
                      style={{
                        padding: collapsed ? '8px 0' : '8px 10px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? 'var(--tp-accent-muted)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = active ? 'var(--tp-accent-muted)' : 'transparent'; }}
                      title={collapsed ? item.label : undefined}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                          style={{ width: 3, height: 16, background: 'var(--tp-accent)' }}
                        />
                      )}
                      <Icon style={{
                        width: 16, height: 16,
                        color: active ? 'var(--tp-accent)' : 'var(--tp-text-3)',
                        strokeWidth: active ? 2 : 1.5,
                        flexShrink: 0,
                      }} />
                      {!collapsed && (
                        <span style={{
                          fontSize: 13,
                          fontWeight: active ? 500 : 400,
                          color: active ? 'var(--tp-text-1)' : 'var(--tp-text-2)',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom area: user */}
        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--tp-border-subtle)' }}>
          {/* User section */}
          <div className="relative px-2 py-3" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 rounded-lg transition-colors"
              style={{
                padding: collapsed ? '8px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: userMenuOpen || activePage === 'account' ? 'var(--tp-accent-muted)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!userMenuOpen && activePage !== 'account') e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={e => {
                if (!userMenuOpen && activePage !== 'account') e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--tp-accent-muted)', border: '1.5px solid var(--tp-accent)' }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tp-accent)' }}>{initials}</span>
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tp-text-1)', lineHeight: 1.2 }} className="truncate">
                      {user?.name ?? 'Guest'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--tp-text-3)' }} className="truncate">
                      {user ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) + ' plan' : ''}
                    </div>
                  </div>
                  <ChevronDown
                    style={{
                      width: 12, height: 12, color: 'var(--tp-text-3)', flexShrink: 0,
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms ease',
                    }}
                  />
                </>
              )}
            </button>

            {/* User dropdown menu */}
            {userMenuOpen && (
              <div
                className="absolute bottom-full left-2 right-2 mb-1 rounded-lg overflow-hidden"
                style={{
                  background: 'var(--tp-l2)',
                  border: '1px solid var(--tp-border)',
                  boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
                  zIndex: 50,
                  ...(collapsed ? { left: -4, right: 'auto', width: 200 } : {}),
                }}
              >
                {/* User info header */}
                <div className="px-3.5 py-3" style={{ borderBottom: '1px solid var(--tp-border-subtle)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tp-text-1)' }}>{user?.name ?? 'Guest'}</div>
                  <div style={{ fontSize: 11, color: 'var(--tp-text-3)' }}>{user?.email ?? ''}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setActivePage('account'); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--tp-l3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Settings style={{ width: 14, height: 14, color: 'var(--tp-text-3)' }} />
                    <span style={{ fontSize: 12, color: 'var(--tp-text-2)' }}>Account settings</span>
                  </button>
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut style={{ width: 14, height: 14, color: 'var(--tp-bearish)' }} />
                    <span style={{ fontSize: 12, color: 'var(--tp-bearish)' }}>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}