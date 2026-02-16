import React, { useState } from 'react';
import { LayoutDashboard, TrendingUp, FileText, Zap, Menu, X, Star, Target, User } from 'lucide-react';
import Overview from './components/pages/Overview';
import COTPositioning from './components/pages/COTPositioning';
import Fundamentals from './components/pages/Fundamentals';
import BiasEngine from './components/pages/BiasEngine';
import TopSetups from './components/pages/TopSetups';
import AssetProfile from './components/pages/AssetProfile';

type Page = 'overview' | 'cot' | 'fundamentals' | 'bias' | 'setups' | 'profile';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { id: 'overview' as Page, label: 'Overview', icon: LayoutDashboard },
    { id: 'profile' as Page, label: 'Asset Profile', icon: User },
    { id: 'setups' as Page, label: 'Top Setups', icon: Target },
    { id: 'cot' as Page, label: 'COT Positioning', icon: TrendingUp },
    { id: 'fundamentals' as Page, label: 'Fundamentals', icon: FileText },
    { id: 'bias' as Page, label: 'Bias Engine', icon: Zap },
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <Overview />;
      case 'profile':
        return <AssetProfile />;
      case 'setups':
        return <TopSetups />;
      case 'cot':
        return <COTPositioning />;
      case 'fundamentals':
        return <Fundamentals />;
      case 'bias':
        return <BiasEngine />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="flex h-screen bg-[#14161C] text-[#E6E9F0] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-56'
        } bg-[#14161C] border-r border-[#242830] transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1E2433]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-[#4C6FFF]" />
              <span className="font-semibold text-lg">TradePilot</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-[#141823] rounded-md transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-md transition-all ${
                  isActive
                    ? 'bg-[#141823] text-[#4C6FFF]'
                    : 'text-[#9AA1B2] hover:bg-[#141823] hover:text-[#E6E9F0]'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}