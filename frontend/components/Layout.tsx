
import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Search,
  Bell,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  Zap,
  Loader2,
  Receipt,
  CreditCard,
  ShieldCheck,
  Building2,
  Wallet
} from 'lucide-react';
import { authApi } from '../services/api';

interface LayoutProps {
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Desktop sidebar state (Pinned or Compact)
  const [isSidebarPinned, setIsSidebarPinned] = useState(window.innerWidth >= 1024);
  // Mobile sidebar state (Open or Closed overlay)
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  // Hover expansion for compact mode
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['Masters', 'Vouchers']);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);

  // Responsive Sync
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpenMobile(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setIsSidebarOpenMobile(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userRes] = await Promise.all([authApi.getMe()]);
        if (userRes.success && userRes.data?.user) {
          setUser(userRes.data.user);
        }
      } catch (err) {
        console.error('Layout data error:', err);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifyRef.current && !notifyRef.current.contains(event.target as Node)) setIsNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]);
  };

  // Determine visual state of sidebar
  const isExpanded = isMobile ? isSidebarOpenMobile : (isSidebarPinned || isHovered);

  // Dynamic offset for content area (Desktop Only)
  const desktopMargin = isSidebarPinned ? 'lg:ml-[280px]' : 'lg:ml-[80px]';


  const navItems = [
    {
      section: 'Main', items: [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
      ]
    },
    {
      section: 'Inventory & Sales', items: [
        {
          name: 'Masters',
          icon: <Database size={18} />,
          children: [
            { name: 'Ledgers', path: '/masters/ledgers' },
            { name: 'Stock Items', path: '/masters/items' },
            { name: 'Godowns', path: '/masters/godowns' },
            { name: 'Tax', path: '/masters/tax' },
            { name: 'Units', path: '/masters/units' },
            { name: 'Stock Item Groups', path: '/masters/stock-groups' },
            { name: 'Ledger Groups', path: '/masters/ledger-groups' },
            { name: 'Stock Convert', path: '/masters/stock-convert' },
          ]
        },
        {
          name: 'Vouchers',
          icon: <FileText size={18} />,
          children: [
            { name: 'Sales', path: '/reports/sales-register' },
            { name: 'Delivery Note', path: '/reports/delivery-note-register' },
            { name: 'Sales Order', path: '/reports/sales-order-register' },
            { name: 'Purchase', path: '/reports/purchase-register' },
            { name: 'Quotations', path: '/reports/quotation-register' },
            { name: 'Payments', path: '/reports/payables' },
            { name: 'Receipts', path: '/reports/receivables' },
            // { name: 'Outstanding', path: '/reports/outstanding' },
          ]
        },
      ]
    },
    {
      section: 'Reporting', items: [
        { name: 'Reports', path: '/reports', icon: <BarChart3 size={18} /> },
      ]
    },
    {
      section: 'Quick Links', items: [
        { name: 'New Sale', path: '/vouchers/sales', icon: <Plus size={18} className="text-emerald-500" /> },
        { name: 'New Delivery Note', path: '/vouchers/delivery-note-voucher', icon: <Plus size={18} className="text-purple-500" /> },
        { name: 'New Sales Order', path: '/vouchers/sales-order', icon: <Plus size={18} className="text-orange-500" /> },
        { name: 'New Purchase', path: '/vouchers/purchase', icon: <Plus size={18} className="text-rose-500" /> },
        { name: 'New Quotation', path: '/vouchers/quotation', icon: <Plus size={18} className="text-blue-500" /> },
        { name: 'New Receipt', path: '/vouchers/receipt', icon: <Receipt size={18} className="text-indigo-500" /> },
        { name: 'New Payment', path: '/vouchers/payment', icon: <CreditCard size={18} className="text-amber-500" /> },
        { name: 'Settings', path: '/settings', icon: <Settings size={18} className="text-slate-500" /> },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 selection:bg-indigo-100 selection:text-indigo-700 font-sans w-full max-w-full">

      {/* Mobile Backdrop Overlay (Fixes mobile focus) */}
      {isMobile && isSidebarOpenMobile && (
        <div
          onClick={() => setIsSidebarOpenMobile(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
        />
      )}

      {/* Sidebar - Positioned Fixed */}
      <aside
        onMouseEnter={() => !isMobile && !isSidebarPinned && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed top-0 left-0 h-full bg-white transition-all duration-300 ease-in-out flex flex-col border-r border-slate-200 z-[110] ${isExpanded ? 'w-[280px] shadow-2xl shadow-slate-900/10' : (isMobile ? 'w-0 overflow-hidden' : 'w-[80px]')
          }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 cursor-pointer min-w-[220px]" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-lg shadow-indigo-200">
              {loadingUser ? <Loader2 size={16} className="animate-spin" /> : (user?.name?.[0] || 'A')}
            </div>
            <div className={`flex flex-col transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <span className="font-black text-lg text-slate-900 tracking-tight leading-none uppercase">SAAS BOOKS</span>
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5 whitespace-nowrap">Billing Software</span>
            </div>
          </div>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {navItems.map((section) => (
            <div key={section.section} className="space-y-1">
              <p className={`px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
                {section.section}
              </p>
              {section.items.map((item) => (
                <div key={item.name} className="space-y-1">
                  {item.path ? (
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${location.pathname === item.path
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                      {location.pathname === item.path && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full"></div>
                      )}
                      <span className={`${location.pathname === item.path ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-900'} transition-colors`}>
                        {item.icon}
                      </span>
                      <span className={`font-bold text-sm tracking-tight transition-all duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                        {item.name}
                      </span>
                    </Link>
                  ) : (
                    <div className="space-y-1">
                      <button
                        onClick={() => toggleMenu(item.name)}
                        className={`flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-xl transition-all group ${item.children?.some(c => location.pathname === c.path)
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'hover:bg-slate-50 hover:text-slate-900'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`${item.children?.some(c => location.pathname === c.path) ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-900'} transition-colors`}>
                            {item.icon}
                          </span>
                          <span className={`font-bold text-sm tracking-tight transition-all duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                            {item.name}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="transition-opacity duration-300">
                            {openMenus.includes(item.name) ? <ChevronUp size={14} className="opacity-50" /> : <ChevronDown size={14} className="opacity-50" />}
                          </div>
                        )}
                      </button>

                      {isExpanded && openMenus.includes(item.name) && (
                        <div className="pl-10 pr-2 space-y-0.5 mt-1 animate-in slide-in-from-top-1 duration-200">
                          {item.children?.map((child) => (
                            <Link
                              key={child.name}
                              to={child.path}
                              className={`block py-1.5 text-[13px] font-bold transition-all ${location.pathname === child.path
                                ? 'text-indigo-600'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className={`px-4 pb-6 mt-auto transition-all duration-300 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="bg-slate-900 rounded-[1.5rem] p-4 text-white relative overflow-hidden group shadow-xl">
            <Zap className="absolute -right-2 -bottom-2 w-12 h-12 text-indigo-500/10 group-hover:scale-110 transition-transform" />
            <p className="text-[9px] font-black text-indigo-400 mb-0.5 tracking-widest uppercase">Encryption</p>
            <p className="text-[10px] text-slate-300 mb-3 font-bold whitespace-nowrap">Node: Secure</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Fix for Right Side Overflow) */}
      <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 w-full min-w-0 max-w-full ${desktopMargin}`}>

        {/* Persistent Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-[90] sticky top-0 shrink-0 w-full">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => isMobile ? setIsSidebarOpenMobile(!isSidebarOpenMobile) : setIsSidebarPinned(!isSidebarPinned)}
              className={`p-2.5 rounded-xl hover:bg-slate-50 transition-all border border-slate-100 ${(isMobile ? isSidebarOpenMobile : isSidebarPinned) ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-slate-400'}`}
            >
              <Menu size={20} />
            </button>

            {/* Mobile Company Identity */}
            <div
              onClick={() => navigate('/')}
              className="flex items-center gap-2 lg:hidden cursor-pointer pl-1 group"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-lg shadow-indigo-100 group-active:scale-95 transition-transform">
                {user?.name?.[0] || 'A'}
              </div>
              <span className="font-black text-sm text-slate-900 tracking-tighter uppercase whitespace-nowrap">SAAS BOOKS</span>
            </div>

            <div className="relative group hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Secure System Search..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-48 md:w-[320px] text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Notifications */}
            <div className="relative" ref={notifyRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-slate-500 active:scale-95"
              >
                <Bell size={20} />
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-3 w-[300px] md:w-[360px] bg-white rounded-[2rem] border border-slate-200 shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Alerts</h3>
                    <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Clear</button>
                  </div>
                  <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">System Clear</div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-2 py-1 px-1 rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                <div className="text-right hidden md:block pr-2">
                  <p className="text-sm font-black text-slate-900 leading-none uppercase tracking-tight">
                    {loadingUser ? '...' : (user?.name || 'Admin')}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-600 border border-indigo-100 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-100 uppercase overflow-hidden">
                  {loadingUser ? <Loader2 size={16} className="animate-spin" /> : (user?.name?.[0] || 'U')}
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-[150] overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1 text-left">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{user?.email || 'admin@anutextiles.com'}</p>
                  </div>
                  <div className="px-2 pt-2 text-left">
                    <Link
                      to="/profile-settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <Settings size={16} /> Profile Settings
                    </Link>
                    <button
                      onClick={onLogout}
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-left"
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-4 md:p-8 lg:p-10 custom-scrollbar relative w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
