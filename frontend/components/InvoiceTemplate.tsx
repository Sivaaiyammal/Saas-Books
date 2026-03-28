import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface InvoiceItem {
  item_name: string;
  colour?: string;
  hsn_code?: string;
  quantity: string;
  unit_symbol?: string;
  rate: string;
  amount?: string;
  tax_percent?: string | number;
  tax_amount?: string | number;
  cgst?: string | number;
  sgst?: string | number;
  igst?: string | number;
}

interface InvoiceData {
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  billing_name?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_pincode?: string | null;
  billing_gstin?: string | null;
  party_gstin?: string | null;
  place_of_supply?: string | null;
  reference_no?: string | null;
  vehicle_no?: string | null;
  total_amount: string;
  items?: InvoiceItem[];
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  isLoading?: boolean;
  taxableValue: number;
  totalTaxAmount: number;
  businessDetails?: any;
  bankDetails?: any;
  title?: string;
}

// GST State Code Mapping
const GST_STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01',
  'himachal pradesh': '02',
  'punjab': '03',
  'chandigarh': '04',
  'uttarakhand': '05',
  'haryana': '06',
  'delhi': '07',
  'rajasthan': '08',
  'uttar pradesh': '09',
  'bihar': '10',
  'sikkim': '11',
  'arunachal pradesh': '12',
  'nagaland': '13',
  'manipur': '14',
  'mizoram': '15',
  'tripura': '16',
  'meghalaya': '17',
  'assam': '18',
  'west bengal': '19',
  'jharkhand': '20',
  'odisha': '21',
  'chhattisgarh': '22',
  'madhya pradesh': '23',
  'gujarat': '24',
  'dadra and nagar haveli': '26',
  'daman and diu': '25',
  'maharashtra': '27',
  'andhra pradesh': '37',
  'karnataka': '29',
  'goa': '30',
  'lakshadweep': '31',
  'kerala': '32',
  'tamil nadu': '33',
  'tamilnadu': '33',
  'puducherry': '34',
  'andaman and nicobar islands': '35',
  'telangana': '36',
  'ladakh': '38',
};

// Get state code from state name or place of supply
const getStateCode = (stateName?: string | null, gstin?: string | null): string => {
  // First try to get from GSTIN (first 2 digits)
  if (gstin && gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    if (/^\d{2}$/.test(code)) {
      return code;
    }
  }

  // Then try to get from state name
  if (stateName) {
    const normalized = stateName.toLowerCase().trim();
    if (GST_STATE_CODES[normalized]) {
      return GST_STATE_CODES[normalized];
    }
  }

  return '--';
};

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

  const n = Math.floor(num);
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

const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ invoice, isLoading = false, taxableValue, totalTaxAmount, businessDetails, bankDetails, title = 'Tax Invoice' }, ref) => {
    // console.log('InvoiceTemplate - Invoice Data:', invoice);

    // Business state code for tax determination (fallback)
    const companyStateCode = businessDetails?.gstin?.substring(0, 2) || '33';
    const partyStateCode = getStateCode(invoice.billing_state || invoice.place_of_supply, invoice.party_gstin);

    // Calculate dynamic tax grouping using database values if available
    const items = invoice.items || [];
    const taxGroups: Record<number, { cgst: number; sgst: number; igst: number; total: number }> = {};
    let hasIgstData = false;

    items.forEach(item => {
      const percent = parseFloat(String(item.tax_percent || '0'));
      const itemTaxAmount = parseFloat(String(item.tax_amount || '0'));
      const itemCgst = parseFloat(String(item.cgst || '0'));
      const itemSgst = parseFloat(String(item.sgst || '0'));
      const itemIgst = parseFloat(String(item.igst || '0'));

      if (itemIgst > 0) hasIgstData = true;

      if (percent >= 0) {
        if (!taxGroups[percent]) {
          taxGroups[percent] = { cgst: 0, sgst: 0, igst: 0, total: 0 };
        }
        taxGroups[percent].cgst += itemCgst;
        taxGroups[percent].sgst += itemSgst;
        taxGroups[percent].igst += itemIgst;
        taxGroups[percent].total += itemTaxAmount;
      }
    });

    // Determine if interstate BASED ON DATA first, then fallback to state codes
    const isInterstate = hasIgstData || (partyStateCode !== '--' && partyStateCode !== companyStateCode);

    const calculatedSubtotal = items.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);
    const calculatedTotalTax = Object.values(taxGroups).reduce((acc, val) => acc + (val.total || 0), 0);
    const netAmount = Math.round(calculatedSubtotal + calculatedTotalTax);
    const roundOff = netAmount - (calculatedSubtotal + calculatedTotalTax);

    // Unified Pagination logic:
    // Last page fits only 8 items because of the large footer (Bank, QR, Totals, Signature).
    // Other pages (Continued) can fit up to 14 items with a small footer.
    const NORMAL_PAGE_CAPACITY = 13;
    const LAST_PAGE_CAPACITY = 9;

    interface PaginatedPage {
      items: InvoiceItem[];
      capacity: number;
      startIdx: number;
    }

    const paginatedPages: PaginatedPage[] = [];
    let currentIdx = 0;

    while (currentIdx < items.length) {
      const remaining = items.length - currentIdx;
      let capacity;

      if (remaining <= LAST_PAGE_CAPACITY) {
        // Fits on one last page
        capacity = LAST_PAGE_CAPACITY;
      } else if (remaining > NORMAL_PAGE_CAPACITY) {
        // More than a full continued page, take max
        capacity = NORMAL_PAGE_CAPACITY;
      } else {
        // Between 9 and 14 items. We must split to ensure the last page 
        // has space for the big footer. Take 8 now and leave the rest.
        capacity = LAST_PAGE_CAPACITY;
      }

      paginatedPages.push({
        items: items.slice(currentIdx, currentIdx + capacity),
        capacity: capacity,
        startIdx: currentIdx
      });

      currentIdx += capacity;
    }

    // Ensure at least one page exists
    if (paginatedPages.length === 0) {
      paginatedPages.push({ items: [], capacity: LAST_PAGE_CAPACITY, startIdx: 0 });
    }

    // Company Header Component
    const CompanyHeader = () => {
      const { from_trade_name, from_addr1, from_addr2, from_place, from_pincode, from_state, from_state_code, gstin, email, phone } = businessDetails || {};
      return (
        <div className="flex border-b-2 border-slate-900 min-h-[140px]">
          <div className="flex-1 p-2 border-r-2 border-slate-900">
            <div className="text-xl font-black uppercase tracking-tighter mb-2">{from_trade_name || 'Saas Books'}</div>
            <div className="space-y-1 text-black">
              <p className="text-sm">{from_addr1}{from_addr2 ? `, ${from_addr2}` : ''}</p>
              <p className="text-sm">{from_place} - {from_pincode}</p>
              {email && <p className="mt-3 text-sm font-normal">Email: <span className="font-black text-black">{email}</span></p>}
              <p className="mt-3 text-sm font-normal">State: <span className="text-sm tracking-tight uppercase">{from_state || 'Tamilnadu'}</span> &nbsp;&nbsp; Code: <span className="text-black">{from_state_code || '33'}</span></p>
            </div>
          </div>
          <div className="w-[300px] p-2 bg-slate-50/50">
            <div className="space-y-6">
              {phone && <div><p className="text-sm mb-1">Mobile No : <span className="text-sm">{phone}</span></p></div>}
              <div><p className="text-sm mb-1">GST No : <span className=" text-sm">{gstin || '-'}</span></p></div>
            </div>
          </div>
        </div>
      );
    };

    // Invoice Title Component
    const InvoiceTitle = () => (
      <div className="border-b-2 border-slate-900 py-1 text-center">
        <h2 className="text-base font-bold uppercase ">{title}</h2>
      </div>
    );

    // Billing Details Component
    const BillingDetails = () => (
      <div className="flex border-b-2 border-slate-900 min-h-[160px]">
        <div className="flex-1 p-2 border-r-2 border-slate-900">
          <p className="text-[12px] uppercase mb-1  tracking-widest">TO :</p>
          <div className="space-y-0.5">
            <h3 className="text-xl font-black uppercase mb-2">{invoice.billing_name || invoice.party_name}</h3>
            <p className="font-normal text-sm">{invoice.billing_address || 'Secondary address details unavailable.'}</p>
            <p className="font-normal text-sm">{invoice.billing_city || 'City'} - {invoice.billing_pincode || 'Pincode'}.</p>
            <div className="flex gap-10 mt-4 pt-1  border-slate-100">
              <p className="text-sm font-normal">State: <span className="text-black uppercase">{invoice.billing_state || invoice.place_of_supply || '--'}</span></p>
              <p className="text-sm font-normal">Code: <span className="text-black">{getStateCode(invoice.billing_state || invoice.place_of_supply, invoice.party_gstin)}</span></p>
            </div>
            <p className="mt-2 text-sm font-normal">GSTNo: <span className="uppercase tracking-widest">{invoice.party_gstin || '-'}</span></p>
          </div>
        </div>
        <div className="w-[350px] border text-xs">
          <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
            <span className="text-sm ">Invoice No</span>
            <span>:</span>
            <span className="font-black">{invoice.voucher_no}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
            <span className="text-sm ">Date</span>
            <span>:</span>
            <span className="font-black">{invoice.voucher_date}</span>
          </div>
          <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
            <span className="text-sm ">Place of Supply</span>
            <span>:</span>
            <span className="font-black">{invoice.place_of_supply || '--'}</span>
          </div>
          {invoice.vehicle_no && (
            <div className="grid grid-cols-[100px_10px_1fr] p-1 px-2">
              <span className="text-sm ">Vehicle No.</span>
              <span>:</span>
              <span className="font-black uppercase">{invoice.vehicle_no}</span>
            </div>
          )}
        </div>
      </div>
    );

    // Footer Component
    const InvoiceFooter = ({ isLastPage, pageIndex }: { isLastPage: boolean; pageIndex: number }) => {
      if (!isLastPage) {
        return (
          <div className="border-t-2 border-slate-900 py-3 flex items-center justify-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-12 bg-slate-200"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
                Continued to Page {pageIndex + 2}
              </p>
              <div className="h-0.5 w-12 bg-slate-200"></div>
            </div>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-[1fr_320px] border-t-2 border-slate-900 min-h-[200px] text-[11px]">
          {/* Rupees in words & Payment Details */}
          <div className="grid grid-rows-[auto_1fr] border-r-2 border-slate-900">
            {/* Rupees in words */}
            <div className="p-3 border-b-2 border-slate-900">
              <p className="mb-1 font-normal text-[12px]">Rupees in Words</p>
              <p className="font-black uppercase tracking-wider text-[12px]">
                {numberToWords(netAmount)}
              </p>
            </div>
            {/* Bank details & QR Code */}
            <div className="flex">
              <div className="flex-1 p-3 border-r border-slate-200">
                <p className="font-bold mb-2">Bank Details</p>
                {bankDetails ? (
                  <div className="grid grid-cols-[80px_10px_1fr] gap-y-1">
                    <span>Bank</span><span>:</span><span className="font-black uppercase text-xs">{bankDetails.bank_name || 'N/A'}</span>
                    <span>Branch</span><span>:</span><span className="font-black text-xs">{bankDetails.bank_branch || ''}</span>
                    <span>A/c No</span><span>:</span><span className="font-black tracking-widest text-xs">{bankDetails.account_number || 'N/A'}</span>
                    <span>IFSC</span><span>:</span><span className="font-black uppercase text-xs">{bankDetails.ifsc_code || 'N/A'}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No default bank account configured.</div>
                )}
              </div>
              <div className="w-[120px] p-3 flex flex-col items-center justify-center bg-slate-50/30">
                <QRCodeSVG
                  value={`upi://pay?pa=anushtextiles@tmb&pn=${businessDetails?.from_trade_name || 'Saas Books'}&am=${netAmount}&cu=INR`}
                  size={75}
                  level="L"
                  includeMargin={false}
                />
                <p className="mt-2 text-[8px] font-black uppercase tracking-widest text-indigo-600">Scan to Pay</p>
              </div>
            </div>
          </div>
          {/* RIGHT SIDE */}
          <div className="grid grid-rows-[auto_auto_1fr]">
            {/* Tax summary */}
            <div className="border-b-2 border-slate-900">
              <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                <span>Total Amount</span>
                <span className="text-right text-xs">{calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {Object.entries(taxGroups).sort((a, b) => Number(a[0]) - Number(b[0])).map(([percent, data]) => {
                const p = Number(percent);
                if (isInterstate) {
                  return (
                    <div key={`igst-${p}`} className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                      <span>IGST @ {p}%</span>
                      <span className="text-right text-xs">{(data.igst || data.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                } else {
                  return (
                    <React.Fragment key={`local-${p}`}>
                      <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                        <span>SGST @ {(p / 2)}%</span>
                        <span className="text-right text-xs">{(data.sgst || data.total / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs">
                        <span>CGST @ {(p / 2)}%</span>
                        <span className="text-right text-xs">{(data.cgst || data.total / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </React.Fragment>
                  );
                }
              })}

              {roundOff !== 0 && (
                <div className="grid grid-cols-[1fr_1fr] px-3 py-1 text-xs font-bold text-slate-600">
                  <span>Round Off</span>
                  <span className="text-right text-xs">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                </div>
              )}
            </div>
            {/* Net amount */}
            <div className="border-b-2 border-slate-900 px-3 py-2 font-black flex justify-between text-xs">
              <span>Net Amount</span>
              <span>₹{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {/* Signature */}
            <div className="flex flex-col justify-end items-center p-3">
              <p className="mb-8 text-xs">For <span className="font-black text-xs">{businessDetails?.from_trade_name || 'Saas Books'}</span></p>
              <p className="font-bold text-xs">Authorised Signature</p>
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        <style>
          {`
            .invoice-wrapper {
              padding: 20px 0;
            }
            .invoice-page {
              margin: 0 auto 60px auto;
              display: block;
              clear: both;
              position: relative;
            }
            .invoice-page:last-child {
              margin-bottom: 0;
            }
            .invoice-container {
              display: block;
              position: relative;
            }
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              .invoice-wrapper {
                padding: 0;
              }
              .invoice-page {
                page-break-after: always;
                page-break-inside: avoid;
                margin: 0 auto;
                display: block;
              }
              .invoice-page:last-child {
                page-break-after: auto;
              }
              .invoice-container {
                page-break-inside: avoid;
              }
              .invoice-container, .invoice-container * {
                border-color: #0f172a !important;
              }
              .invoice-container table,
              .invoice-container th,
              .invoice-container td {
                border-color: #0f172a !important;
              }
            }
          `}
        </style>
        <div ref={ref} className="invoice-wrapper">
          {paginatedPages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="invoice-page"
            >
              <div
                className="invoice-container bg-white border-2 border-slate-900 mx-auto max-w-[800px] shadow-sm text-[11px] leading-tight font-medium text-black"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {/* Company Header */}
                <CompanyHeader />

                {/* Invoice Title */}
                <InvoiceTitle />

                {/* Billing & Invoice Details */}
                <BillingDetails />

                {/* Items Table */}
                <div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-900 font-black text-[9px] text-center text-black tracking-widest">
                        <th className="py-1 border-r-2 border-slate-900 text-xs w-[50px]">S.No</th>
                        <th className="py-1 border-r-2 border-slate-900 text-xs px-5">Particulars</th>
                        <th className="py-1 border-r-2 border-slate-900 text-xs w-[80px]">Color</th>
                        <th className="py-1 border-r-2 border-slate-900 text-xs w-[80px]">HSNCode</th>
                        <th className="py-1 border-r-2 border-slate-900 text-xs w-[90px]">Weight</th>
                        <th className="py-1 border-r-2 border-slate-900 text-xs w-[70px]">Rate</th>
                        <th className="py-1 text-xs w-[100px]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="border-slate-900">
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} className="py-20 text-center">
                            <Loader2 className="animate-spin mx-auto text-black" />
                          </td>
                        </tr>
                      ) : (
                        <>
                          {page.items.map((item, i) => {
                            const globalIndex = page.startIdx + i;
                            return (
                              <tr key={globalIndex} className="text-center font-bold">
                                <td className="py-2 border-r-2 border-slate-900 align-top text-xs text-black">{globalIndex + 1}</td>
                                <td className="py-2 border-r-2 border-slate-900 text-left px-3 align-top">
                                  <div className="font-black text-xs tracking-tight uppercase">{item.item_name}</div>
                                </td>
                                <td className="py-2 border-r-2 border-slate-900 align-top uppercase text-xs">{item.colour || '--'}</td>
                                <td className="py-2 border-r-2 border-slate-900 align-top tracking-widest text-xs">{item.hsn_code || '--'}</td>
                                <td className="py-2 border-r-2 border-slate-900 align-top text-xs">
                                  {parseFloat(item.quantity).toLocaleString()} <span className="text-[10px]">{item.unit_symbol}</span>
                                </td>
                                <td className="py-2 border-r-2 border-slate-900 align-top text-xs">
                                  {parseFloat(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 align-top text-right px-5 font-black text-xs">
                                  {(parseFloat(item.quantity || '0') * parseFloat(item.rate || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Add empty rows to fill up the current page capacity */}
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

                {/* Footer with Summary */}
                <InvoiceFooter isLastPage={pageIndex === paginatedPages.length - 1} pageIndex={pageIndex} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;
