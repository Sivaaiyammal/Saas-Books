import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2, Building2, ShieldCheck, MapPin, FileBadge2, Mail, Phone } from 'lucide-react';
import { settingsApi } from '../services/api';

const Settings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [hasSavedPassword, setHasSavedPassword] = useState(false);

    const [formData, setFormData] = useState({
        from_trade_name: '',
        gstin: '',
        email: '',
        phone: '',
        from_addr1: '',
        from_addr2: '',
        from_place: '',
        from_state: '',
        from_pincode: '',
        from_state_code: '',
        username: '',
        ewbpwd: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setFetching(true);
            const response = await settingsApi.getGstSettings();
            if (response.success && response.data) {
                const incoming = response.data;
                const passwordFromApi = (incoming.ewbpwd || '').trim();
                const masked = /^\*+$/.test(passwordFromApi);

                setHasSavedPassword(masked || passwordFromApi.length > 0);
                setFormData(prev => ({
                    ...prev,
                    ...incoming,
                    ewbpwd: masked ? '' : passwordFromApi
                }));
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await settingsApi.saveGstSettings(formData);
            if (response.success) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
                if (formData.ewbpwd.trim()) {
                    setHasSavedPassword(true);
                    setFormData(prev => ({ ...prev, ewbpwd: '' }));
                }
            } else {
                setMessage({ type: 'error', text: response.message || 'Failed to save settings.' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error?.message || 'An error occurred while saving settings.' });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-8 shadow-sm">
                <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-cyan-200/40 blur-2xl" />
                <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-amber-200/40 blur-2xl" />

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">Settings</p>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Company Details</h1>
                        <p className="text-slate-600 font-bold text-sm mt-2">Manage GST profile, company address, and E-Way Bill credentials in one place.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 bg-white/80 border border-slate-200 rounded-xl px-4 py-2 self-start">
                        <ShieldCheck size={14} className="text-emerald-600" /> Secure Configuration
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
                            <Building2 size={18} className="text-cyan-700" /> Company Details
                        </h2>
                        <p className="text-slate-500 text-xs mt-1">These details are used in GST and E-Way Bill documents.</p>
                    </div>

                    <div className="p-6 md:p-8 space-y-8">
                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {message.text}
                        </div>
                    )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</label>
                                <input
                                    type="text"
                                    name="from_trade_name"
                                    value={formData.from_trade_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="e.g. Anu Textiles"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GSTIN</label>
                                <input
                                    type="text"
                                    name="gstin"
                                    value={formData.gstin}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="Enter GSTIN"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                        placeholder="company@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                                <div className="relative">
                                    <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Place</label>
                                <input
                                    type="text"
                                    name="from_place"
                                    value={formData.from_place}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="City / Town"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address Line 1</label>
                                <input
                                    type="text"
                                    name="from_addr1"
                                    value={formData.from_addr1}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="Door No, Street"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address Line 2</label>
                                <input
                                    type="text"
                                    name="from_addr2"
                                    value={formData.from_addr2}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="Area, Landmark"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">State Name</label>
                                <input
                                    type="text"
                                    name="from_state"
                                    value={formData.from_state}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                    placeholder="Tamil Nadu"
                                />
                            </div>

                            <div className="space-y-2 grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">State Code</label>
                                    <input
                                        type="text"
                                        name="from_state_code"
                                        value={formData.from_state_code}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                        placeholder="33"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pincode</label>
                                    <input
                                        type="text"
                                        name="from_pincode"
                                        value={formData.from_pincode}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                                        placeholder="641603"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} /> Save Company Details
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
                                <FileBadge2 size={18} className="text-amber-600" /> E-Way Bill Configuration
                            </h2>
                            <p className="text-slate-500 text-xs mt-1">Configure portal credentials used for token and E-Way Bill generation.</p>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-Way Bill Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    placeholder="Enter EWB username"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-Way Bill Password</label>
                                <input
                                    type="password"
                                    name="ewbpwd"
                                    value={formData.ewbpwd}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    placeholder={hasSavedPassword ? 'Leave blank to keep existing password' : 'Enter EWB password'}
                                />
                                {hasSavedPassword && !formData.ewbpwd && (
                                    <p className="text-[11px] font-bold text-slate-500">Saved password exists. You only need to enter this when updating it.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Summary</p>
                        <div className="mt-4 space-y-3 text-sm font-bold">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300">Company</span>
                                <span className="text-white text-right">{formData.from_trade_name || '--'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300">GSTIN</span>
                                <span className="text-white text-right">{formData.gstin || '--'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300">Origin</span>
                                <span className="text-white text-right">{[formData.from_place, formData.from_state].filter(Boolean).join(', ') || '--'}</span>
                            </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-700/70 text-[11px] font-bold text-slate-300 flex items-start gap-2">
                            <MapPin size={14} className="text-cyan-300 mt-0.5" />
                            These details are used as the dispatch origin in generated E-Way Bill requests.
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Settings;
