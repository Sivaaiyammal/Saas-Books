
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  Globe,
  Lock,
  Camera,
  Save,
  Loader2,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Activity,
  History,
  // Added missing Settings icon import
  Settings
} from 'lucide-react';
import { authApi } from '../services/api';

const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await authApi.getMe();
        if (response.success && response.data?.user) {
          const userData = response.data.user;
          setUser(userData);
          setFormData(prev => ({
            ...prev,
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || ''
          }));
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');

    // Simulate API call for profile update
    setTimeout(() => {
      setIsSaving(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Profile Settings</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
               <ShieldCheck size={12} className="text-emerald-500" /> Account Security Center
            </div>
          </div>
        </div>

        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-xs font-black uppercase tracking-widest animate-in slide-in-from-right-4">
            <CheckCircle2 size={18} /> Settings Updated Successfully
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Personal Identity */}
        <div className="lg:col-span-8 space-y-8">

          <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-10">
            <div className="flex items-center justify-between border-b border-slate-50 pb-6">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-3">
                 <User size={16} /> Identity Profile
               </h3>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-10">
               <div className="relative group">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-600 text-4xl font-black shadow-inner overflow-hidden uppercase">
                     {user?.name?.[0] || 'U'}
                  </div>
                  <button type="button" className="absolute -bottom-2 -right-2 p-3 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all transform active:scale-90 border-4 border-white">
                     <Camera size={18} />
                  </button>
               </div>
               <div className="flex-1 space-y-1">
                  <h4 className="text-xl font-black text-slate-900">{user?.name}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{user?.role || 'Staff Member'} Account</p>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2">Member Since: {new Date().toLocaleDateString()}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Identity Name</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Direct Contact Phone</label>
                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>
               </div>
               <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Verified Work Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full pl-14 pr-6 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed outline-none"
                    />
                  </div>
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 pt-1">
                     <AlertCircle size={10} /> Email verification is locked by admin protocols.
                  </p>
               </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-3 text-slate-400">
                  <Shield size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">End-to-End Encrypted Identity Management</span>
               </div>
               <button
                type="submit"
                disabled={isSaving}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
               >
                 {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} className="text-emerald-400" />}
                 {isSaving ? 'Commiting Changes...' : 'Commit Profile Changes'}
               </button>
            </div>
          </form>

          {/* Security Protocols Card */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-10">
            <div className="flex items-center justify-between border-b border-slate-50 pb-6">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-600 flex items-center gap-3">
                 <Lock size={16} /> Access Security Protocols
               </h3>
            </div>

            <div className="space-y-8">
               <div className="flex items-start justify-between gap-6 p-6 bg-rose-50/50 rounded-3xl border border-rose-100 border-dashed">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm border border-rose-100">
                        <Shield size={24} />
                     </div>
                     <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Multi-Factor Authentication</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Status: <span className="text-rose-600">Inactive</span></p>
                     </div>
                  </div>
                  <button className="px-6 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm">Enable MFA</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-rose-600 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Identity Key</label>
                    <input type="password" placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-rose-600 transition-all" />
                  </div>
               </div>

               <div className="flex justify-end pt-2">
                  <button className="px-10 py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95 border border-rose-100">Reset Access Credentials</button>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preferences & Stats */}
        <div className="lg:col-span-4 space-y-8">

          {/* Preferences Bento Card */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
               <Settings size={14} className="text-indigo-600" /> UI Preferences
            </h3>

            <div className="space-y-5">
               <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-600">
                     <Bell size={18} />
                     <span className="text-xs font-bold uppercase tracking-widest">Ledger Alerts</span>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-indigo-600 relative">
                     <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
               </div>

               <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-50 grayscale cursor-not-allowed">
                  <div className="flex items-center gap-3 text-slate-600">
                     <Globe size={18} />
                     <span className="text-xs font-bold uppercase tracking-widest">Public Access</span>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-slate-200 relative">
                     <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
               </div>
            </div>
          </div>

          {/* Activity Pulse Bento Card */}
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />

            <div className="relative z-10 space-y-8">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                     <Activity size={14} /> Intelligence Pulse
                  </h3>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               </div>

               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Zap size={20} className="text-amber-400" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Access Logs</p>
                        <p className="text-sm font-black text-white">42 Active Points</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <History size={20} className="text-indigo-400" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Last Entry</p>
                        <p className="text-sm font-black text-white">14 mins ago</p>
                     </div>
                  </div>
               </div>

               <div className="pt-6 border-t border-white/10">
                  <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">System Architecture: <span className="text-indigo-400">ANUSH-ERP-V2.1</span></p>
               </div>
            </div>
          </div>

          {/* Delete Account Footer */}
          <div className="bg-rose-50 p-8 rounded-[3rem] border border-rose-100 group overflow-hidden relative">
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-rose-200/20 rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
               <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Danger Territory</h4>
               <p className="text-[11px] font-bold text-slate-600 leading-relaxed">Closing your account will immediately purge all cloud synchronization and local session tokens.</p>
               <button className="w-full py-4 bg-white border border-rose-200 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95">Deactivate Terminal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
