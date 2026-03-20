import React, { useState, useEffect } from 'react';
import { Truck, X, CheckCircle2, Printer, Eye, Loader2, Check } from 'lucide-react';
import { settingsApi } from '../services/api';

interface EWayBillComponentProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any | null;
    businessDetails: any;
    onSuccess: () => void;
    onPrintEwb: () => void;
    onViewEwb: (invoice: any) => void;
    onCancelEwb: () => void;
}

const EWayBillComponent: React.FC<EWayBillComponentProps> = ({
    isOpen,
    onClose,
    invoice,
    businessDetails,
    onSuccess,
    onPrintEwb,
    onViewEwb,
    onCancelEwb
}) => {
    const [ewbLoading, setEwbLoading] = useState(false);
    const [ewbFormData, setEwbFormData] = useState({
        vehicle_no: '',
        trans_distance: '',
        trans_mode: '1',
        vehicle_type: 'R',
        ewb_username: '',
        ewb_pwd: '',
        transporter_id: '',
        transporter_name: '',
        trans_doc_no: '',
        trans_doc_date: ''
    });

    useEffect(() => {
        if (isOpen && invoice) {
            setEwbFormData({
                vehicle_no: '',
                trans_distance: '',
                trans_mode: '1',
                vehicle_type: 'R',
                ewb_username: businessDetails?.username || '',
                ewb_pwd: '',
                transporter_id: '',
                transporter_name: '',
                trans_doc_no: '',
                trans_doc_date: ''
            });
        }
    }, [isOpen, invoice, businessDetails]);

    if (!isOpen || !invoice) return null;

    const handleGenerateEwb = async () => {
        setEwbLoading(true);
        try {
            if (!ewbFormData.ewb_username || !ewbFormData.ewb_pwd) {
                alert('Please enter E-Way Bill Username and Password');
                setEwbLoading(false);
                return;
            }

            const tokenRes = await settingsApi.getEWayBillToken(ewbFormData.ewb_username, ewbFormData.ewb_pwd);

            let authToken = tokenRes.data?.auth_token;
            if (!authToken && tokenRes.data?.provider_response?.authtoken) {
                authToken = tokenRes.data.provider_response.authtoken;
            }

            if (!tokenRes.success || !authToken) {
                alert('Failed to get E-Way Bill Access Token: ' + (tokenRes.message || 'Unknown error'));
                setEwbLoading(false);
                return;
            }

            const payload = {
                voucher_id: invoice.id,
                vehicle_no: ewbFormData.vehicle_no,
                trans_distance: ewbFormData.trans_distance,
                trans_mode: ewbFormData.trans_mode,
                vehicle_type: ewbFormData.vehicle_type,
                transporter_id: ewbFormData.transporter_id,
                transporter_name: ewbFormData.transporter_name,
                trans_doc_no: ewbFormData.trans_doc_no,
                trans_doc_date: ewbFormData.trans_doc_date,
                access_token: authToken
            };

            const generateRes = await settingsApi.generateEWayBill(payload);
            if (generateRes.success) {
                alert('E-Way Bill Generated Successfully!');
                onClose();
                onSuccess();
            } else {
                alert('Failed to generate E-Way Bill: ' + (generateRes.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('EWB Generation Error:', error);
            const errorMessage = error.message || (typeof error === 'string' ? error : 'Unknown error');
            alert(`E-Way Bill Generation Failed:\n${errorMessage}`);
        } finally {
            setEwbLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto w-full h-[100dvh]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in duration-200 mt-auto mb-auto md:my-8 relative">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-indigo-600" size={20} />
                        E-Way Bill Details
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Generated E-Way Bill Status */}
                    {invoice.ewaybill?.status === 'generated' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 flex-shrink-0">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-emerald-900 font-black uppercase text-xs tracking-wider truncate">E-Way Bill Generated</h4>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                        <p className="text-sm font-bold text-emerald-700 truncate">
                                            No: <span className="font-mono text-emerald-900 text-base sm:text-lg">{invoice.ewaybill?.ewb_no || 'N/A'}</span>
                                        </p>
                                        <p className="text-xs sm:text-sm font-bold text-emerald-700 truncate">
                                            Date: <span className="text-emerald-900">{invoice.ewaybill?.ewb_date || 'N/A'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-2 md:mt-0">
                                <button
                                    onClick={onPrintEwb}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <Printer size={16} /> Print
                                </button>
                                <button
                                    onClick={() => onViewEwb(invoice)}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <Eye size={16} /> Preview
                                </button>
                                <button
                                    onClick={onCancelEwb}
                                    className="w-full sm:w-auto px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                >
                                    <X size={16} /> Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Consignor & Consignee */}
                    {invoice.ewaybill?.status !== 'generated' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                {/* Consignor (From) */}
                                <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                    <h4 className="text-sm font-black text-slate-700 uppercase border-b border-slate-200 pb-2 mb-2">Consignor Details (From)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-1 sm:gap-2 text-xs">
                                        <span className="font-semibold text-slate-500">Mailing Name:</span>
                                        <span className="font-bold text-slate-800 break-words">{businessDetails?.from_trade_name || 'N/A'}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">GSTIN/UIN:</span>
                                        <span className="font-bold text-slate-800 break-words">{businessDetails?.gstin || 'N/A'}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">State:</span>
                                        <span className="font-bold text-slate-800 break-words">{businessDetails?.from_state || 'N/A'}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">Address:</span>
                                        <span className="text-slate-700 break-words">{businessDetails?.from_addr1 || 'N/A'},{businessDetails?.from_addr2}, {businessDetails?.from_place} - {businessDetails?.from_pincode}</span>
                                    </div>
                                </div>

                                {/* Consignee (To) */}
                                <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                    <h4 className="text-sm font-black text-slate-700 uppercase border-b border-slate-200 pb-2 mb-2">Consignee Details (To)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-1 sm:gap-2 text-xs">
                                        <span className="font-semibold text-slate-500">Mailing Name:</span>
                                        <span className="font-bold text-slate-800 break-words">{invoice.consignee_name || invoice.billing_name || invoice.party_name}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">GSTIN/UIN:</span>
                                        <span className="font-bold text-slate-800 break-words">{invoice.consignee_gstin || invoice.billing_gstin || invoice.party_gstin || 'N/A'}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">State:</span>
                                        <span className="font-bold text-slate-800 break-words">{invoice.consignee_state || invoice.billing_state || 'N/A'}</span>

                                        <span className="font-semibold text-slate-500 mt-2 sm:mt-0">Address:</span>
                                        <span className="text-slate-700 break-words">
                                            {invoice.consignee_address || invoice.billing_address || 'N/A'},<br />
                                            {invoice.consignee_city || invoice.billing_city} - {invoice.consignee_pincode || invoice.billing_pincode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Transport Details */}
                            <div className="mt-6 md:mt-0">
                                <h4 className="text-sm font-black text-slate-700 uppercase border-b border-slate-200 pb-2 mb-4">Transport Details</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Distance (km)</label>
                                        <input
                                            type="number"
                                            placeholder="Pin to Pin Distance"
                                            value={ewbFormData.trans_distance}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, trans_distance: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Transporter Name</label>
                                        <input
                                            type="text"
                                            placeholder="Transporter Name"
                                            value={ewbFormData.transporter_name}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, transporter_name: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Transporter ID</label>
                                        <input
                                            type="text"
                                            placeholder="Transporter ID"
                                            value={ewbFormData.transporter_id}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, transporter_id: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Part B Details */}
                            <div className="mt-6 md:mt-0">
                                <h4 className="text-sm font-black text-slate-700 uppercase border-b border-slate-200 pb-2 mb-4">Part B Details</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Mode</label>
                                        <select
                                            value={ewbFormData.trans_mode}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, trans_mode: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        >
                                            <option value="1">Road</option>
                                            <option value="2">Rail</option>
                                            <option value="3">Air</option>
                                            <option value="4">Ship</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vehicle No / Type</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Vehicle No"
                                                value={ewbFormData.vehicle_no}
                                                onChange={(e) => setEwbFormData({ ...ewbFormData, vehicle_no: e.target.value.toUpperCase() })}
                                                className="w-2/3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                            />
                                            <select
                                                value={ewbFormData.vehicle_type}
                                                onChange={(e) => setEwbFormData({ ...ewbFormData, vehicle_type: e.target.value })}
                                                className="w-1/3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                            >
                                                <option value="R">Reg</option>
                                                <option value="O">ODC</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Doc/Lading/RR/AirWay No</label>
                                        <input
                                            type="text"
                                            placeholder="Doc No"
                                            value={ewbFormData.trans_doc_no}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, trans_doc_no: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                                        <input
                                            type="date"
                                            value={ewbFormData.trans_doc_date}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, trans_doc_date: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* API Credentials Section */}
                            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 mt-6 lg:mt-0">
                                <h4 className="text-xs font-black text-indigo-800 uppercase mb-3">API Credentials</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-indigo-500 uppercase">EWB Username</label>
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            value={ewbFormData.ewb_username || ''}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, ewb_username: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-indigo-500 uppercase">EWB Password</label>
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            value={ewbFormData.ewb_pwd || ''}
                                            onChange={(e) => setEwbFormData({ ...ewbFormData, ewb_pwd: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-slate-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
                    >
                        Close
                    </button>
                    {invoice.ewaybill?.status !== 'generated' && (
                        <button
                            onClick={handleGenerateEwb}
                            disabled={ewbLoading}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {ewbLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                            Generate E-Way Bill
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EWayBillComponent;
