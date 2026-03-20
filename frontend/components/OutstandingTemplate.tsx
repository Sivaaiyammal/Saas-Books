import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface OutstandingBill {
    bill_no: string;
    bill_date: string;
    bill_amount: string | number;
    pending_amount: string | number;
    age_days?: number;
    voucher_no?: string;
}

interface OutstandingTemplateProps {
    ledger: {
        name: string;
        group_name?: string;
        address?: string;
        city?: string;
        pincode?: string;
        phone?: string;
        gstin?: string;
    };
    bills: OutstandingBill[];
    totalOutstanding: number;
    isLoading?: boolean;
    businessDetails?: any;
    title?: string;
}

const OutstandingTemplate = forwardRef<HTMLDivElement, OutstandingTemplateProps>(
    ({ ledger, bills, totalOutstanding, isLoading = false, businessDetails, title = 'Outstanding Statement' }, ref) => {

        // Pagination settings
        const NORMAL_PAGE_CAPACITY = 18;
        const LAST_PAGE_CAPACITY = 15;

        const paginatedPages: OutstandingBill[][] = [];
        let currentIdx = 0;

        while (currentIdx < bills.length) {
            const remaining = bills.length - currentIdx;
            let capacity;
            if (remaining <= LAST_PAGE_CAPACITY) {
                capacity = LAST_PAGE_CAPACITY;
            } else if (remaining > NORMAL_PAGE_CAPACITY) {
                capacity = NORMAL_PAGE_CAPACITY;
            } else {
                capacity = LAST_PAGE_CAPACITY;
            }
            paginatedPages.push(bills.slice(currentIdx, currentIdx + capacity));
            currentIdx += capacity;
        }

        if (paginatedPages.length === 0) {
            paginatedPages.push([]);
        }

        // Convert number to words (Indian format)
        const numberToWords = (num: number): string => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            const convert = (n: number): string => {
                if (n < 20) return a[n];
                let s = b[Math.floor(n / 10)];
                if (n % 10 > 0) s += '-' + a[n % 10];
                return s + ' ';
            };
            const n = Math.floor(Math.abs(num));
            if (n === 0) return 'Zero';
            let str = '';
            const crore = Math.floor(n / 10000000);
            const lakh = Math.floor((n / 100000) % 100);
            const thousand = Math.floor((n / 1000) % 100);
            const hundred = Math.floor((n / 100) % 10);
            const rest = n % 100;
            if (crore > 0) str += convert(crore) + 'Crore ';
            if (lakh > 0) str += convert(lakh) + 'Lakh ';
            if (thousand > 0) str += convert(thousand) + 'Thousand ';
            if (hundred > 0) str += convert(hundred) + 'Hundred ';
            if (rest > 0) str += convert(rest);
            return str.trim() + ' Rupees Only';
        };

        const CompanyHeader = () => {
            const { from_trade_name, from_addr1, from_addr2, from_place, from_pincode, gstin, mobile } = businessDetails || {};
            return (
                <div className="flex border-b-2 border-slate-900 min-h-[140px]">
                    <div className="flex-1 p-4 border-r-2 border-slate-900">
                        <div className="text-2xl font-black uppercase mb-1">{from_trade_name || 'Saas Books'}</div>
                        <div className="text-sm space-y-0.5">
                            <p>{from_addr1}, {from_addr2}</p>
                            <p>{from_place} - {from_pincode}</p>
                            <p className="mt-2">GSTIN: <span className="font-bold">{gstin || '---'}</span> | Mob: <span className="font-bold">{mobile || '---'}</span></p>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div ref={ref} className="outstanding-wrapper">
                <style>
                    {`
            .outstanding-wrapper { padding: 20px 0; }
            .outstanding-page { margin: 0 auto 60px auto; display: block; clear: both; position: relative; width: 210mm; min-height: 297mm; }
            .outstanding-page:last-child { margin-bottom: 0; }
            .outstanding-container { display: flex; flex-direction: column; min-height: 297mm; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .outstanding-wrapper { padding: 0; }
              .outstanding-page { page-break-after: always; page-break-inside: avoid; margin: 0; }
              .outstanding-container { border-color: #0f172a !important; }
            }
          `}
                </style>

                {paginatedPages.map((pageBills, pageIdx) => (
                    <div key={pageIdx} className="outstanding-page">
                        <div className="outstanding-container bg-white border-2 border-slate-900 text-black p-0 shadow-sm text-xs font-medium" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            <CompanyHeader />

                            <div className="text-center py-2 border-b-2 border-slate-900 bg-slate-50 uppercase font-black text-sm tracking-[0.2em]">{title}</div>

                            <div className="p-4 border-b-2 border-slate-900 grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Statement For:</p>
                                    <h3 className="text-xl font-black uppercase text-slate-900">{ledger.name}</h3>
                                    <div className="text-xs space-y-0.5 mt-2">
                                        <p>{ledger.address || 'Address details N/A'}</p>
                                        <p>{ledger.city} {ledger.pincode && `- ${ledger.pincode}`}</p>
                                        <p className="mt-1 font-bold">GSTIN: {ledger.gstin || '---'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block text-left p-4 bg-slate-900 text-white rounded-2xl min-w-[200px]">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Total Outstanding</p>
                                        <p className="text-3xl font-black tracking-tighter">₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-4">Date of Printing: {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="flex-1">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase bg-slate-50">
                                            <th className="p-2 border-r-2 border-slate-900 w-[50px] text-center">S.No</th>
                                            <th className="p-2 border-r-2 border-slate-900 text-center w-[120px]">Date</th>
                                            <th className="p-2 border-r-2 border-slate-900 text-center">Ref. No / Bill No</th>
                                            <th className="p-2 border-r-2 border-slate-900 text-center w-[100px]">Age (Days)</th>
                                            <th className="p-2 border-r-2 border-slate-900 text-right w-[120px]">Bill Amount</th>
                                            <th className="p-2 text-right w-[120px]">Balance Due</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
                                        ) : (
                                            <>
                                                {pageBills.map((bill, i) => {
                                                    const globalIdx = paginatedPages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + i;
                                                    return (
                                                        <tr key={i} className="border-b border-slate-200 font-bold">
                                                            <td className="p-2 border-r-2 border-slate-900 text-center">{globalIdx + 1}</td>
                                                            <td className="p-2 border-r-2 border-slate-900 text-center">{bill.bill_date}</td>
                                                            <td className="p-2 border-r-2 border-slate-900 px-4">
                                                                <div>{bill.bill_no}</div>
                                                                <div className="text-[9px] text-slate-400">Voucher: {bill.voucher_no}</div>
                                                            </td>
                                                            <td className="p-2 border-r-2 border-slate-900 text-center">
                                                                <span className={bill.age_days && bill.age_days > 30 ? 'text-rose-600' : ''}>
                                                                    {bill.age_days}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 border-r-2 border-slate-900 text-right">{parseFloat(String(bill.bill_amount)).toLocaleString()}</td>
                                                            <td className="p-2 text-right">{parseFloat(String(bill.pending_amount)).toLocaleString()}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Filler rows */}
                                                {Array.from({ length: (pageIdx === paginatedPages.length - 1 ? LAST_PAGE_CAPACITY : NORMAL_PAGE_CAPACITY) - pageBills.length }).map((_, i) => (
                                                    <tr key={`fill-${i}`} className="h-10 border-b border-slate-100/50">
                                                        <td className="border-r-2 border-slate-900"></td>
                                                        <td className="border-r-2 border-slate-900"></td>
                                                        <td className="border-r-2 border-slate-900"></td>
                                                        <td className="border-r-2 border-slate-900"></td>
                                                        <td className="border-r-2 border-slate-900"></td>
                                                        <td></td>
                                                    </tr>
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {pageIdx === paginatedPages.length - 1 && (
                                <div className="border-t-2 border-slate-900 grid grid-cols-[1fr_250px] min-h-[120px]">
                                    <div className="p-4 border-r-2 border-slate-900">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Amount in Words</p>
                                        <p className="text-sm font-black uppercase tracking-tight leading-tight">
                                            {numberToWords(totalOutstanding)}
                                        </p>
                                    </div>
                                    <div className="p-4 flex flex-col justify-end items-center">
                                        <p className="text-[10px] mb-8 uppercase font-bold text-slate-900">For {businessDetails?.from_trade_name || 'Saas Books'}</p>
                                        <p className="text-[10px] font-black border-t border-slate-900 pt-1 w-full text-center uppercase tracking-widest">Authorised Signature</p>
                                    </div>
                                </div>
                            )}

                            {pageIdx < paginatedPages.length - 1 && (
                                <div className="p-2 text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic bg-slate-50 border-t-2 border-slate-900">
                                    Continued on Page {pageIdx + 2}
                                </div>
                            )}

                            <div className="p-1 px-4 border-t border-slate-100 text-[8px] flex justify-between font-bold text-slate-400 italic">
                                <span>Software Powered by Sivaaiyammal</span>
                                <span>Page {pageIdx + 1} of {paginatedPages.length}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }
);

OutstandingTemplate.displayName = 'OutstandingTemplate';
export default OutstandingTemplate;
