import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QuotationCharge {
    charge_name: string;
    amount: number | string;
}

interface QuotationItem {
    item_name: string;
    colour?: string;
    count?: string;
    dia?: string;
    gsm?: string;
    quantity: string | number;
    unit_symbol?: string;
    rate: string | number;
    amount?: string | number;
    discount_percent?: string | number;
    discount_amount?: string | number;
}

interface QuotationData {
    voucher_no: string;
    voucher_date: string;
    party_name: string;
    billing_name?: string | null;
    billing_address?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_pincode?: string | null;
    billing_phone?: string | null;
    reference_no?: string | null;
    narration?: string | null;
    total_amount?: string | number;
    round_off?: string | number;
    charges?: QuotationCharge[];
    items?: QuotationItem[];
}

interface QuotationTemplateProps {
    quotation: QuotationData;
    isLoading?: boolean;
    businessDetails?: any;
    bankDetails?: any;
    title?: string;
}

// Convert number to words (Indian format)
export const numberToWords = (num: number): string => {
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

const QuotationTemplate = forwardRef<HTMLDivElement, QuotationTemplateProps>(
    ({ quotation, isLoading = false, businessDetails, bankDetails, title = 'Quotation' }, ref) => {

        const items = quotation.items || [];
        const charges = quotation.charges || [];

        const subtotal = items.reduce((acc, item) => acc + (parseFloat(String(item.quantity)) * parseFloat(String(item.rate)) - parseFloat(String(item.discount_amount || 0))), 0);
        const chargesTotal = charges.reduce((acc, charge) => acc + parseFloat(String(charge.amount || 0)), 0);
        const roundOff = parseFloat(String(quotation.round_off || 0));
        const netAmount = Math.round(subtotal + chargesTotal + roundOff);

        // Pagination logic (matching InvoiceTemplate)
        const NORMAL_PAGE_CAPACITY = 13;
        const LAST_PAGE_CAPACITY = 9;

        interface PaginatedPage {
            items: QuotationItem[];
            capacity: number;
            startIdx: number;
        }

        const paginatedPages: PaginatedPage[] = [];
        let currentIdx = 0;

        while (currentIdx < items.length) {
            const remaining = items.length - currentIdx;
            let capacity;
            if (remaining <= LAST_PAGE_CAPACITY) {
                capacity = LAST_PAGE_CAPACITY;
            } else if (remaining > NORMAL_PAGE_CAPACITY) {
                capacity = NORMAL_PAGE_CAPACITY;
            } else {
                capacity = LAST_PAGE_CAPACITY;
            }

            paginatedPages.push({
                items: items.slice(currentIdx, currentIdx + capacity),
                capacity: capacity,
                startIdx: currentIdx
            });
            currentIdx += capacity;
        }

        if (paginatedPages.length === 0) {
            paginatedPages.push({ items: [], capacity: LAST_PAGE_CAPACITY, startIdx: 0 });
        }

        const CompanyHeader = () => {
            const { from_trade_name, from_addr1, from_addr2, from_place, from_pincode, gstin, mobile } = businessDetails || {};
            return (
                <div className="flex border-b-2 border-slate-900 min-h-[140px]">
                    <div className="flex-1 p-2 border-r-2 border-slate-900">
                        <div className="text-xl font-black uppercase tracking-tighter mb-2">{from_trade_name || 'Saas Books'}</div>
                        <div className="space-y-1 text-black">
                            <p className="text-sm">{from_addr1}, {from_addr2}</p>
                            <p className="text-sm">{from_place} - {from_pincode}</p>
                            <p className="mt-3 text-sm font-normal">State: <span className="text-sm tracking-tight uppercase">Tamilnadu</span> &nbsp;&nbsp; Code: <span className="text-black">33</span></p>
                        </div>
                    </div>
                    <div className="w-[300px] p-2 bg-slate-50/50">
                        <div className="space-y-6">
                            <div><p className="text-sm mb-1">Mobile No : <span className=" text-sm">+91 {mobile || '99948 60932'}</span></p></div>
                            <div><p className="text-sm mb-1">GST No : <span className=" text-sm">{gstin || '33EWLPS7428M1ZP'}</span></p></div>
                        </div>
                    </div>
                </div>
            );
        };

        const TemplateTitle = () => (
            <div className="border-b-2 border-slate-900 py-1 text-center">
                <h2 className="text-base font-bold uppercase ">{title}</h2>
            </div>
        );

        const BillingDetails = () => (
            <div className="flex border-b-2 border-slate-900 min-h-[160px]">
                <div className="flex-1 p-2 border-r-2 border-slate-900">
                    <p className="text-[12px] uppercase mb-1  tracking-widest">TO :</p>
                    <div className="space-y-0.5">
                        <h3 className="text-xl font-black uppercase mb-2">{quotation.billing_name || quotation.party_name}</h3>
                        <p className="font-normal text-sm">{quotation.billing_address || 'Address details unavailable.'}</p>
                        <p className="font-normal text-sm">{quotation.billing_city || 'City'} - {quotation.billing_pincode || 'Pincode'}.</p>
                        <div className="flex gap-10 mt-4 pt-1">
                            <p className="text-sm font-normal">State: <span className="text-black uppercase">{quotation.billing_state || '--'}</span></p>
                        </div>
                    </div>
                </div>
                <div className="w-[350px] border text-xs">
                    <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
                        <span className="text-sm">Quotation No</span>
                        <span>:</span>
                        <span className="font-black">{quotation.voucher_no}</span>
                    </div>
                    <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
                        <span className="text-sm">Date</span>
                        <span>:</span>
                        <span className="font-black">{quotation.voucher_date}</span>
                    </div>
                    {quotation.reference_no && (
                        <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
                            <span className="text-sm">Ref. No</span>
                            <span>:</span>
                            <span className="font-black">{quotation.reference_no}</span>
                        </div>
                    )}
                </div>
            </div>
        );

        const TemplateFooter = ({ isLastPage, pageIndex }: { isLastPage: boolean; pageIndex: number }) => {
            if (!isLastPage) {
                return (
                    <div className="border-t-2 border-slate-900 py-3 flex items-center justify-center bg-slate-50/50">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
                            Continued to Page {pageIndex + 2}
                        </p>
                    </div>
                );
            }
            return (
                <div className="grid grid-cols-[1fr_320px] border-t-2 border-slate-900 min-h-[200px] text-[11px]">
                    <div className="grid grid-rows-[auto_1fr] border-r-2 border-slate-900">
                        <div className="p-3 border-b-2 border-slate-900">
                            <p className="mb-1 font-normal text-[12px]">Amount in Words</p>
                            <p className="font-black uppercase tracking-wider text-[12px]">
                                {numberToWords(netAmount)}
                            </p>
                        </div>
                        <div className="flex">
                            <div className="flex-1 p-3 border-r border-slate-200">
                                <p className="font-bold mb-2">Terms & Conditions</p>
                                <div className="text-[10px] space-y-1">
                                    <p>1. Prices are valid for 7 days.</p>
                                    <p>2. Subject to product availability.</p>
                                    <p>3. Delivery within 2-3 working days.</p>
                                </div>
                            </div>
                            <div className="w-[120px] p-3 flex flex-col items-center justify-center bg-slate-50/30">
                                <QRCodeSVG
                                    value={`Quotation:${quotation.voucher_no}|Net:${netAmount}`}
                                    size={75}
                                />
                                <p className="mt-2 text-[8px] font-black uppercase tracking-widest text-indigo-600">Quotation QR</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-rows-[auto_auto_1fr]">
                        <div className="border-b-2 border-slate-900">
                            <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                                <span>Subject Total</span>
                                <span className="text-right text-xs">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {charges.map((charge, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                                    <span>{charge.charge_name}</span>
                                    <span className="text-right text-xs">{parseFloat(String(charge.amount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                            {roundOff !== 0 && (
                                <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs font-bold text-slate-600">
                                    <span>Round Off</span>
                                    <span className="text-right text-xs">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        <div className="border-b-2 border-slate-900 px-3 py-2 font-black flex justify-between text-xs">
                            <span>Total Value</span>
                            <span>₹{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col justify-end items-center p-3">
                            <p className="mb-8 text-xs">For <span className="font-black text-xs">{businessDetails?.from_trade_name || 'Saas Books'}</span></p>
                            <p className="font-bold text-xs">Authorised Signature</p>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div ref={ref} className="invoice-wrapper">
                <style>
                    {`
            .invoice-wrapper { padding: 20px 0; }
            .invoice-page { margin: 0 auto 60px auto; display: block; clear: both; position: relative; }
            .invoice-page:last-child { margin-bottom: 0; }
            .invoice-container { display: block; position: relative; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .invoice-wrapper { padding: 0; }
              .invoice-page { page-break-after: always; page-break-inside: avoid; margin: 0 auto; display: block; }
              .invoice-page:last-child { page-break-after: auto; }
              .invoice-container { page-break-inside: avoid; border-color: #0f172a !important; }
            }
          `}
                </style>
                {paginatedPages.map((page, pageIndex) => (
                    <div key={pageIndex} className="invoice-page">
                        <div
                            className="invoice-container bg-white border-2 border-slate-900 mx-auto max-w-[800px] shadow-sm text-[11px] leading-tight font-medium text-black"
                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                        >
                            <CompanyHeader />
                            <TemplateTitle />
                            <BillingDetails />
                            <div>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-900 font-black text-[9px] text-center text-black tracking-widest">
                                            <th className="py-1 border-r-2 border-slate-900 text-xs w-[50px]">S.No</th>
                                            <th className="py-1 border-r-2 border-slate-900 text-xs px-5">Description</th>
                                            <th className="py-1 border-r-2 border-slate-900 text-xs w-[80px]">Color</th>
                                            <th className="py-1 border-r-2 border-slate-900 text-xs w-[90px]">Qty</th>
                                            <th className="py-1 border-r-2 border-slate-900 text-xs w-[70px]">Rate</th>
                                            <th className="py-1 border-r-2 border-slate-900 text-xs w-[80px]">Discount</th>
                                            <th className="py-1 text-xs w-[100px]">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-black" /></td></tr>
                                        ) : (
                                            <>
                                                {page.items.map((item, i) => {
                                                    const globalIndex = page.startIdx + i;
                                                    return (
                                                        <tr key={globalIndex} className="text-center font-bold">
                                                            <td className="py-2 border-r-2 border-slate-900 align-top text-xs">{globalIndex + 1}</td>
                                                            <td className="py-2 border-r-2 border-slate-900 text-left px-3 align-top">
                                                                <div className="font-black text-xs uppercase">{item.item_name}</div>
                                                                {(item.gsm || item.dia || item.count) && (
                                                                    <div className="text-[10px] text-slate-500 mt-1 font-medium flex gap-2">
                                                                        {item.gsm && <span>GSM: {item.gsm}</span>}
                                                                        {item.dia && <span>DIA: {item.dia}</span>}
                                                                        {item.count && <span>COUNT: {item.count}</span>}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="py-2 border-r-2 border-slate-900 align-top uppercase text-xs">{item.colour || '--'}</td>
                                                            <td className="py-2 border-r-2 border-slate-900 align-top text-xs">
                                                                {parseFloat(String(item.quantity)).toLocaleString()} <span className="text-[10px]">{item.unit_symbol}</span>
                                                            </td>
                                                            <td className="py-2 border-r-2 border-slate-900 align-top text-xs">
                                                                {parseFloat(String(item.rate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-2 border-r-2 border-slate-900 align-top text-xs text-rose-600">
                                                                {parseFloat(String(item.discount_amount || 0)) > 0 ? parseFloat(String(item.discount_amount)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--'}
                                                            </td>
                                                            <td className="py-2 align-top text-right px-5 font-black text-xs">
                                                                {(parseFloat(String(item.quantity || '0')) * parseFloat(String(item.rate || '0')) - parseFloat(String(item.discount_amount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {Array.from({ length: Math.max(0, page.capacity - page.items.length) }).map((_, i) => (
                                                    <tr key={`pad-${pageIndex}-${i}`} className="h-10">
                                                        <td className="border-r-2 border-slate-900"></td>
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
                            <TemplateFooter isLastPage={pageIndex === paginatedPages.length - 1} pageIndex={pageIndex} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }
);

QuotationTemplate.displayName = 'QuotationTemplate';
export default QuotationTemplate;
