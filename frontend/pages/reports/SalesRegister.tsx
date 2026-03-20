
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import printJS from 'print-js';
import {
  FileText,
  Printer,
  Calendar,
  ArrowLeft,
  Search,
  Filter,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  FileDown,
  Check,
  X,
  Trash2,
  Edit2,
  RotateCcw,
  ChevronDown,
  Eye,
  Building2,
  Phone,
  MapPin,
  Hash,
  Truck,
  TriangleAlert,
  Loader2,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Package,
  Plus,
  SlidersHorizontal,
  Download,
  ShieldCheck,
  Zap,
  ZapOff,
  Navigation,
  MoreVertical
} from 'lucide-react';
import { vouchersApi, settingsApi, mastersApi } from '../../services/api';
import InvoiceTemplate from '../../components/InvoiceTemplate';
import EWayBillTemplate from '../../components/EWayBillTemplate';
import EWayBillComponent from '../../components/EWayBillComponent';

interface SalesInvoice {
  id: number;
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  party_gstin: string | null;
  billing_name: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  billing_gstin: string | null;
  billing_phone: string | null;
  consignee_same_as_billing: number;
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_city: string | null;
  consignee_state: string | null;
  consignee_pincode: string | null;
  consignee_gstin: string | null;
  consignee_phone: string | null;
  place_of_supply: string | null;
  total_amount: string;
  narration: string | null;
  status: string;
  item_count: number;
  reference_no: string | null;
  created_at: string;
  einvoice?: {
    status: 'not_generated' | 'generated' | 'failed';
    irn: string | null;
    ack_no: string | null;
    ack_date: string | null;
  };
  ewaybill?: {
    status: 'not_generated' | 'generated' | 'failed';
    ewb_no: string | null;
    ewb_date: string | null;
  };
  items?: any[];
}

const SalesRegister: React.FC = () => {
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const ewbPrintRef = useRef<HTMLDivElement>(null);
  const bulkPrintRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterParty, setFilterParty] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>(['Posted', 'Draft']);

  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const partyDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<SalesInvoice | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [bulkInvoicesData, setBulkInvoicesData] = useState<SalesInvoice[]>([]);
  const [businessDetails, setBusinessDetails] = useState<any>(null);
  const [defaultBank, setDefaultBank] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // E-Way Bill State
  const [isEwbModalOpen, setIsEwbModalOpen] = useState(false);
  const [selectedInvoiceForEwb, setSelectedInvoiceForEwb] = useState<SalesInvoice | null>(null);
  const [ewbResponseData, setEwbResponseData] = useState<any>(null);
  const [isEwbPreviewModalOpen, setIsEwbPreviewModalOpen] = useState(false);
  const [ewbViewLoading, setEwbViewLoading] = useState(false);
  const [viewEwbFullData, setViewEwbFullData] = useState<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(event.target as Node)) {
        setIsPartyDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await vouchersApi.getSalesVouchers();
      if (response.success && response.data?.invoices) {
        // Transform API response to match interface structure
        const transformedInvoices = response.data.invoices.map((inv: any) => ({
          ...inv,
          einvoice: {
            status: inv.einvoice_status as 'not_generated' | 'generated' | 'failed',
            irn: inv.irn || null,
            ack_no: inv.ack_no || null,
            ack_date: inv.ack_date || null,
          },
          ewaybill: {
            status: inv.ewaybill_status as 'not_generated' | 'generated' | 'failed',
            ewb_no: inv.ewb_no || null,
            ewb_date: inv.ewb_date || null,
            api_response: inv.ewaybill_api_response || null,
          },
        }));
        setInvoices(transformedInvoices);
      } else {
        setError('Failed to load sales register data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const fetchSettings = async () => {
      try {
        const [settingsRes, ledgersRes] = await Promise.all([
          settingsApi.getGstSettings(),
          mastersApi.getLedgers()
        ]);

        if (settingsRes.success && settingsRes.data) {
          setBusinessDetails(settingsRes.data);
        }

        if (ledgersRes.success && ledgersRes.data && ledgersRes.data.ledgers) {
          const bank = ledgersRes.data.ledgers.find((l: any) => l.group_name === 'Bank Accounts' && (l.is_default_bank === 1 || l.is_default_bank === true || l.is_default_bank === '1'));
          if (bank) setDefaultBank(bank);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);

  const allParties = useMemo(() => ['All', ...new Set(invoices.map(d => d.party_name).filter(Boolean))], [invoices]);

  const filteredPartyList = useMemo(() => {
    if (!partySearchQuery) return allParties;
    return allParties.filter(p => p.toLowerCase().includes(partySearchQuery.toLowerCase()));
  }, [partySearchQuery, allParties]);

  const filteredSalesData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter(item => {
      const vNo = (item.voucher_no || '').toLowerCase();
      const pName = (item.party_name || '').toLowerCase();
      const matchesSearch = vNo.includes(term) || pName.includes(term);
      const matchesParty = filterParty === 'All' || item.party_name === filterParty;
      const itemDate = new Date(item.voucher_date).getTime();
      const matchesStartDate = !startDate || itemDate >= new Date(startDate).getTime();
      const matchesEndDate = !endDate || itemDate <= new Date(endDate).getTime();
      const matchesStatus = filterStatus.length === 0 || filterStatus.some(s => s.toLowerCase() === (item.status || '').toLowerCase());
      return matchesSearch && matchesParty && matchesStartDate && matchesEndDate && matchesStatus;
    });
  }, [invoices, searchTerm, filterParty, startDate, endDate, filterStatus]);

  const totalFilteredAmount = useMemo(() => {
    return filteredSalesData.reduce((acc, curr) => acc + parseFloat(curr.total_amount || '0'), 0);
  }, [filteredSalesData]);

  const resetFilters = () => {
    setFilterParty('All');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setPartySearchQuery('');
    setFilterStatus(['Posted', 'Draft']);
  };

  const toggleStatusFilter = (status: string) => {
    setFilterStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleSelectBill = (voucherNo: string) => {
    setSelectedBills(prev =>
      prev.includes(voucherNo) ? prev.filter(b => b !== voucherNo) : [...prev, voucherNo]
    );
  };

  const toggleSelectAll = () => {
    if (selectedBills.length === filteredSalesData.length && filteredSalesData.length > 0) {
      setSelectedBills([]);
    } else {
      setSelectedBills(filteredSalesData.map(b => b.voucher_no));
    }
  };



  const openEwbModal = (invoice: SalesInvoice) => {
    setSelectedInvoiceForEwb(invoice);
    console.log('E-Way Bill Modal Opened', { invoice, businessDetails });
    setEwbResponseData(invoice.ewaybill);
    setIsEwbModalOpen(true);
  };


  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('2');
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelUsername, setCancelUsername] = useState('');
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancelEwb = async () => {
    if (!selectedInvoiceForEwb || !selectedInvoiceForEwb.ewaybill?.ewb_no) return;

    setCancelLoading(true);
    try {
      // 1. Get Token (using credentials from form or settings)
      // Note: The main modal might be open with credentials filled, or we might need to rely on settings if credentials aren't in state
      // Since we are in the "View Mode", the form data might be empty. We should try to use businessDetails if ewbFormData is empty.
      const username = cancelUsername || businessDetails?.username || '';
      const password = cancelPassword || '';

      if (!username || !password) {
        alert('Please enter Username and Password for verification');
        setCancelLoading(false);
        return;
      }

      const tokenRes = await settingsApi.getEWayBillToken(username, password);

      let authToken = tokenRes.data?.auth_token;
      if (!authToken && tokenRes.data?.provider_response?.authtoken) {
        authToken = tokenRes.data.provider_response.authtoken;
      }
      if (!authToken && tokenRes.data?.provider_response?.auth_token) {
        authToken = tokenRes.data.provider_response.auth_token;
      }

      if (!tokenRes.success || !authToken) {
        alert('Failed to get E-Way Bill Access Token: ' + (tokenRes.message || 'Token missing in response. Please check settings.'));
        setCancelLoading(false);
        return;
      }

      // 2. Cancel EWB
      const payload = {
        gstin: businessDetails?.gstin || '',
        username: username,
        authtoken: authToken,
        payload: {
          ewbNo: selectedInvoiceForEwb.ewaybill.ewb_no,
          cancelRsnCode: cancelReason,
          cancelRmrk: cancelRemark
        }
      };

      console.log('Cancelling EWB with payload:', payload);

      const res = await settingsApi.cancelEWayBill(payload);

      if (res.success) {
        // success toast is not available directly, using alert for now or just relying on UI update
        // We can add a toast notification system later or use a simple alert

        alert('E-Way Bill Cancelled Successfully');
        setIsCancelModalOpen(false);
        setIsEwbModalOpen(false);
        fetchInvoices(); // Refresh list to show updated status
      } else {
        alert('Cancellation Failed: ' + res.message);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || String(error) || 'Unknown error';
      alert('Cancellation Error: ' + msg);
    } finally {
      setCancelLoading(false);
    }
  };


  const handleView = async (bill: SalesInvoice) => {
    setSelectedVoucher(bill);
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);

    try {
      const res = await vouchersApi.getSalesVoucher(bill.id);
      if (res.success && res.data) {
        // Transform API response to match interface structure
        const transformedVoucher = {
          ...bill,
          ...res.data,
          items: res.data.items || [],
          einvoice: {
            status: res.data.einvoice_status as 'not_generated' | 'generated' | 'failed',
            irn: res.data.irn || null,
            ack_no: res.data.ack_no || null,
            ack_date: res.data.ack_date || null,
          },
          ewaybill: {
            status: res.data.ewaybill_status as 'not_generated' | 'generated' | 'failed',
            ewb_no: res.data.ewb_no || null,
            ewb_date: res.data.ewb_date || null,
          },
        };
        setSelectedVoucher(transformedVoucher);
      }
    } catch (err) {
      console.error('Failed to load voucher details', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEdit = async (bill: SalesInvoice) => {
    setOpenMenuId(null);
    try {
      const res = await vouchersApi.getSalesVoucher(bill.id);
      if (res.success && res.data) {
        // Transform API response to match interface structure
        const transformedVoucher = {
          ...bill,
          ...res.data,
          items: res.data.items || [],
          einvoice: {
            status: res.data.einvoice_status as 'not_generated' | 'generated' | 'failed',
            irn: res.data.irn || null,
            ack_no: res.data.ack_no || null,
            ack_date: res.data.ack_date || null,
          },
          ewaybill: {
            status: res.data.ewaybill_status as 'not_generated' | 'generated' | 'failed',
            ewb_no: res.data.ewb_no || null,
            ewb_date: res.data.ewb_date || null,
          },
        };
        navigate('/vouchers/sales', {
          state: {
            editVoucher: transformedVoucher
          }
        });
      }
    } catch (err) {
      console.error('Failed to load voucher for edit', err);
    }
  };

  const handleDeleteClick = (bill: SalesInvoice) => {
    setOpenMenuId(null);
    setSelectedVoucher(bill);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedVoucher) return;
    setIsDeleting(true);
    try {
      const response = await vouchersApi.deleteSalesVoucher(selectedVoucher.id);
      if (response.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== selectedVoucher.id));
        setIsDeleteModalOpen(false);
        setSelectedVoucher(null);
      } else {
        alert(response.message || 'Deletion failed.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    if (!invoiceRef.current) return;

    printJS({
      printable: invoiceRef.current.innerHTML,
      type: 'raw-html',
      style: `
        @page { margin: 0 !important; }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { padding: 0; font-family: "Times New Roman", Times, serif; color: black; }
        .invoice-wrapper { padding: 0; }
        .invoice-page { page-break-after: always; page-break-inside: avoid; margin: 0 auto; width: 190mm; display: block; padding-top: 10mm; padding-bottom: 10mm; }
        .invoice-page:last-child { page-break-after: auto; }
        .invoice-container { background: white; border: 2px solid #0f172a; width: 100%; margin: 0 auto; font-size: 11px; line-height: 1.25; font-weight: 500; color: black; display: block; position: relative; page-break-inside: avoid; }
        .border-2.border-slate-900 { border: 2px solid #0f172a; }
        .border-t-2.border-slate-900 { border-top: 2px solid #0f172a; }
        .border-b-2.border-slate-900 { border-bottom: 2px solid #0f172a; }
        .border-r-2.border-slate-900 { border-right: 2px solid #0f172a; }
        .bg-white { background-color: white; }
        .bg-slate-50 { background-color: #f8fafc; }
        .bg-slate-50\\/50 { background-color: rgba(248, 250, 252, 0.5); }
        .text-black { color: black; }
        .text-xl { font-size: 1.25rem; }
        .text-base { font-size: 1rem; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-\\[9px\\] { font-size: 9px; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-\\[11px\\] { font-size: 11px; }
        .text-\\[12px\\] { font-size: 12px; }
        .font-black { font-weight: 900; }
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 500; }
        .font-normal { font-weight: 400; }
        .uppercase { text-transform: uppercase; }
        .tracking-tight { letter-spacing: -0.025em; }
        .tracking-tighter { letter-spacing: -0.05em; }
        .tracking-wider { letter-spacing: 0.05em; }
        .tracking-widest { letter-spacing: 0.1em; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .flex { display: flex; }
        .flex-1 { flex: 1 1 0%; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .items-end { align-items: flex-end; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .gap-1 { gap: 0.25rem; }
        .gap-10 { gap: 2.5rem; }
        .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .p-1 { padding: 0.25rem; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .pt-1 { padding-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .w-full { width: 100%; }
        .w-\\[50px\\] { width: 50px; }
        .w-\\[70px\\] { width: 70px; }
        .w-\\[80px\\] { width: 80px; }
        .w-\\[90px\\] { width: 90px; }
        .w-\\[100px\\] { width: 100px; }
        .w-\\[300px\\] { width: 300px; }
        .w-\\[350px\\] { width: 350px; }
        .max-w-\\[800px\\] { max-width: 800px; }
        .min-h-\\[140px\\] { min-height: 140px; }
        .min-h-\\[160px\\] { min-height: 160px; }
        .min-h-\\[200px\\] { min-height: 200px; }
        .h-10 { height: 2.5rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .align-top { vertical-align: top; }
        .grid { display: grid; }
        .grid-cols-\\[80px_10px_1fr\\] { grid-template-columns: 80px 10px 1fr; }
        .grid-cols-\\[100px_10px_1fr\\] { grid-template-columns: 100px 10px 1fr; }
        .grid-cols-\\[1fr_1fr\\] { grid-template-columns: 1fr 1fr; }
        .grid-cols-\\[1fr_320px\\] { grid-template-columns: 1fr 320px; }
        .grid-rows-\\[1fr_1fr\\] { grid-template-rows: 1fr 1fr; }
        .grid-rows-\\[auto_auto_1fr\\] { grid-template-rows: auto auto 1fr; }
        .gap-y-1 { row-gap: 0.25rem; }
        table { width: 100%; border-collapse: collapse; }
        th.border-r-2, td.border-r-2 { border-right: 2px solid #0f172a; }
        tr.border-b-2 { border-bottom: 2px solid #0f172a; }
        tbody.border-slate-900 td { border-color: #0f172a; }
      `,
      scanStyles: false
    });
  };

  const fetchEwbDetails = async (invoiceId: number) => {
    setEwbViewLoading(true);
    setViewEwbFullData(null);
    try {
      const res = await settingsApi.getEWayBillViewDetails(invoiceId);
      if (res.success && res.data) {
        setViewEwbFullData(res.data);
        // console.log('E-Way Bill Details Fetched', res.data);
        return res.data;
      } else {
        console.warn('EWB details API failed, using fallback', res.message);
        const fallbackData = {
          header: {
            ewb_no: selectedInvoiceForEwb?.ewaybill?.ewb_no,
            ewb_date: selectedInvoiceForEwb?.ewaybill?.ewb_date,
            status: selectedInvoiceForEwb?.ewaybill?.status
          },
          part_a: {
            supplier_gstin: businessDetails?.gstin,
            supplier_name: businessDetails?.from_trade_name,
            document_no: selectedInvoiceForEwb?.voucher_no,
            document_date: selectedInvoiceForEwb?.voucher_date,
            value_of_goods: selectedInvoiceForEwb?.total_amount
          },
          part_b: []
        };
        setViewEwbFullData(fallbackData);
        return fallbackData;
      }
    } catch (err) {
      console.error('Error fetching EWB details:', err);
      return null;
    } finally {
      setEwbViewLoading(false);
    }
  };

  const handlePrintEwb = async (invoice?: SalesInvoice) => {
    const targetInvoice = invoice || selectedInvoiceForEwb;
    if (!targetInvoice) return;

    // Fetch details if not already loaded for this invoice
    let data = viewEwbFullData;
    if (!data || data.part_a?.document_no !== targetInvoice.voucher_no) {
      data = await fetchEwbDetails(targetInvoice.id);
    }

    if (!data) return;

    // Small delay to ensure the hidden template is rendered with new data
    setTimeout(() => {
      if (!ewbPrintRef.current) return;
      printJS({
        printable: ewbPrintRef.current.innerHTML,
        type: 'raw-html',
        style: `
          @page { margin: 0 !important; }
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { padding: 0; font-family: "Times New Roman", Times, serif; color: black; }
          .ewb-print-container { width: 190mm; margin: 0 auto; padding: 10mm 0; }
          .ewb-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .ewb-table th, .ewb-table td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 12px; }
          .ewb-section-header { background-color: #e0e0e0; font-weight: bold; padding: 4px 8px; font-size: 12px; border: 1px solid #333; border-bottom: none; }
          .part-b-table th { background-color: #f2f2f2; text-align: center; }
          .ewb-qr-wrapper { display: flex; justify-content: center; margin-bottom: 15px; }
          .ewb-barcode-wrapper { display: flex; flex-direction: column; align-items: center; margin-top: 20px; }
        `,
        scanStyles: false
      });
    }, 150);
  };

  const handleViewEwb = async (invoice: SalesInvoice) => {
    setSelectedInvoiceForEwb(invoice);
    setIsEwbPreviewModalOpen(true);
    await fetchEwbDetails(invoice.id);
  };

  const handleDownloadPDF = () => {
    if (!invoiceRef.current || !selectedVoucher) return;
    const element = invoiceRef.current;
    // @ts-ignore
    html2pdf().from(element).set({
      margin: 10,
      filename: `INV_${selectedVoucher.voucher_no}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
  };

  const handleBulkExport = async () => {
    if (selectedBills.length === 0) return;

    setIsBulkExporting(true);
    try {
      const selectedInvoices = invoices.filter(inv => selectedBills.includes(inv.voucher_no));
      const detailedInvoices = await Promise.all(
        selectedInvoices.map(async (inv) => {
          const res = await vouchersApi.getSalesVoucher(inv.id);
          if (res.success && res.data) {
            return {
              ...inv,
              ...res.data,
              items: res.data.items || [],
            };
          }
          return inv;
        })
      );

      // Business state code for tax determination
      const companyStateCode = businessDetails?.gstin?.substring(0, 2) || '33';

      // Create CSV content with items and GST details
      const headers = [
        'Date', 'Voucher No', 'Party Name', 'GSTIN', 'Item Name', 'HSN',
        'Qty', 'Rate', 'Itemamount', 'GST Percentage', 'Cgst', 'Sgst',
        'Igst', 'Total Invoice Amount', 'Status'
      ];
      const rows: any[] = [];

      detailedInvoices.forEach(inv => {
        const partyStateCode = inv.party_gstin?.substring(0, 2) || companyStateCode;
        const isInterstate = partyStateCode !== companyStateCode;

        if (inv.items && inv.items.length > 0) {
          inv.items.forEach((item: any) => {
            const qty = parseFloat(item.quantity || '0');
            const rate = parseFloat(item.rate || '0');
            const itemAmount = qty * rate;
            const taxAmount = parseFloat(item.tax_amount || '0');
            const taxPercent = parseFloat(item.tax_percent || '0');

            let cgst = 0, sgst = 0, igst = 0;
            if (isInterstate) {
              igst = taxAmount;
            } else {
              cgst = taxAmount / 2;
              sgst = taxAmount / 2;
            }

            rows.push([
              inv.voucher_date,
              inv.voucher_no,
              inv.party_name,
              inv.party_gstin || '',
              item.item_name || '',
              item.hsn_code || '',
              qty,
              rate,
              itemAmount.toFixed(2),
              taxPercent,
              cgst.toFixed(2),
              sgst.toFixed(2),
              igst.toFixed(2),
              inv.total_amount,
              inv.status
            ]);
          });
        } else {
          // Fallback if no items found
          rows.push([
            inv.voucher_date,
            inv.voucher_no,
            inv.party_name,
            inv.party_gstin || '',
            'NO ITEMS',
            '',
            '0',
            '0',
            '0.00',
            '0',
            '0.00',
            '0.00',
            '0.00',
            inv.total_amount,
            inv.status
          ]);
        }
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_export_gst_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Bulk export error:', error);
      alert('Failed to fetch invoice items for export');
    } finally {
      setIsBulkExporting(false);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedBills.length === 0) return;

    setIsBulkPrinting(true);
    try {
      const selectedInvoices = invoices.filter(inv => selectedBills.includes(inv.voucher_no));
      const detailedInvoices = await Promise.all(
        selectedInvoices.map(async (inv) => {
          const res = await vouchersApi.getSalesVoucher(inv.id);
          if (res.success && res.data) {
            return {
              ...inv,
              ...res.data,
              items: res.data.items || [],
            };
          }
          return inv;
        })
      );

      setBulkInvoicesData(detailedInvoices);

      // Give time for state update and rendering
      setTimeout(() => {
        if (bulkPrintRef.current) {
          printJS({
            printable: bulkPrintRef.current.innerHTML,
            type: 'raw-html',
            style: `
              * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { padding: 0; font-family: "Times New Roman", Times, serif; color: black; }
              .invoice-wrapper { padding: 0; }
              .invoice-page { page-break-after: always; page-break-inside: avoid; margin: 0 auto; display: block; }
              .invoice-page:last-child { page-break-after: auto; }
              .invoice-container { background: white; border: 2px solid #0f172a; max-width: 800px; margin: 0 auto; font-size: 11px; line-height: 1.25; font-weight: 500; color: black; display: block; position: relative; page-break-inside: avoid; }
              .border-2.border-slate-900 { border: 2px solid #0f172a; }
              .border-t-2.border-slate-900 { border-top: 2px solid #0f172a; }
              .border-b-2.border-slate-900 { border-bottom: 2px solid #0f172a; }
              .border-r-2.border-slate-900 { border-right: 2px solid #0f172a; }
              .bg-white { background-color: white; }
              .bg-slate-50 { background-color: #f8fafc; }
              .bg-slate-50\\/50 { background-color: rgba(248, 250, 252, 0.5); }
              .text-black { color: black; }
              .text-xl { font-size: 1.25rem; }
              .text-base { font-size: 1rem; }
              .text-sm { font-size: 0.875rem; }
              .text-xs { font-size: 0.75rem; }
              .text-\\[9px\\] { font-size: 9px; }
              .text-\\[10px\\] { font-size: 10px; }
              .text-\\[11px\\] { font-size: 11px; }
              .text-\\[12px\\] { font-size: 12px; }
              .font-black { font-weight: 900; }
              .font-bold { font-weight: 700; }
              .font-medium { font-weight: 500; }
              .font-normal { font-weight: 400; }
              .uppercase { text-transform: uppercase; }
              .tracking-tight { letter-spacing: -0.025em; }
              .tracking-tighter { letter-spacing: -0.05em; }
              .tracking-wider { letter-spacing: 0.05em; }
              .tracking-widest { letter-spacing: 0.1em; }
              .text-center { text-align: center; }
              .text-left { text-align: left; }
              .text-right { text-align: right; }
              .flex { display: flex; }
              .flex-1 { flex: 1 1 0%; }
              .flex-col { flex-direction: column; }
              .items-center { align-items: center; }
              .items-end { align-items: flex-end; }
              .justify-between { justify-content: space-between; }
              .justify-end { justify-content: flex-end; }
              .gap-1 { gap: 0.25rem; }
              .gap-10 { gap: 2.5rem; }
              .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
              .space-y-1 > * + * { margin-top: 0.25rem; }
              .space-y-6 > * + * { margin-top: 1.5rem; }
              .p-1 { padding: 0.25rem; }
              .p-2 { padding: 0.5rem; }
              .p-3 { padding: 0.75rem; }
              .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
              .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
              .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
              .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
              .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
              .pt-1 { padding-top: 0.25rem; }
              .mt-2 { margin-top: 0.5rem; }
              .mt-4 { margin-top: 1rem; }
              .mb-1 { margin-bottom: 0.25rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .mb-8 { margin-bottom: 2rem; }
              .w-full { width: 100%; }
              .w-\\[50px\\] { width: 50px; }
              .w-\\[70px\\] { width: 70px; }
              .w-\\[80px\\] { width: 80px; }
              .w-\\[90px\\] { width: 90px; }
              .w-\\[100px\\] { width: 100px; }
              .w-\\[300px\\] { width: 300px; }
              .w-\\[350px\\] { width: 350px; }
              .max-w-\\[800px\\] { max-width: 800px; }
              .min-h-\\[140px\\] { min-height: 140px; }
              .min-h-\\[160px\\] { min-height: 160px; }
              .min-h-\\[200px\\] { min-height: 200px; }
              .h-10 { height: 2.5rem; }
              .mx-auto { margin-left: auto; margin-right: auto; }
              .align-top { vertical-align: top; }
              .grid { display: grid; }
              .grid-cols-\\[80px_10px_1fr\\] { grid-template-columns: 80px 10px 1fr; }
              .grid-cols-\\[100px_10px_1fr\\] { grid-template-columns: 100px 10px 1fr; }
              .grid-cols-\\[1fr_1fr\\] { grid-template-columns: 1fr 1fr; }
              .grid-cols-\\[1fr_320px\\] { grid-template-columns: 1fr 320px; }
              .grid-rows-\\[1fr_1fr\\] { grid-template-rows: 1fr 1fr; }
              .grid-rows-\\[auto_auto_1fr\\] { grid-template-rows: auto auto 1fr; }
              .gap-y-1 { row-gap: 0.25rem; }
              table { width: 100%; border-collapse: collapse; }
              th.border-r-2, td.border-r-2 { border-right: 2px solid #0f172a; }
              tr.border-b-2 { border-bottom: 2px solid #0f172a; }
              tbody.border-slate-900 td { border-color: #0f172a; }
            `
          });
        }
        setIsBulkPrinting(false);
      }, 500);

    } catch (error) {
      console.error('Bulk fetch error:', error);
      alert('Failed to fetch invoice details for printing');
      setIsBulkPrinting(false);
    }
  };

  const handleGenerateEInvoice = async (voucherId: number) => {
    try {
      const response = await fetch(`/gst/einvoice_generate.php?voucher_id=${voucherId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('E-Invoice generated successfully!');
          // Refresh the sales data to show the updated E-Invoice status
          fetchInvoices();
        } else {
          alert(data.message || 'Failed to generate E-Invoice');
        }
      } else {
        alert('Error generating E-Invoice');
      }
    } catch (err) {
      console.error('E-Invoice generation error:', err);
      alert('Failed to generate E-Invoice');
    }
  };

  const handleGenerateEWayBill = async (voucherId: number) => {
    try {
      const response = await fetch(`/gst/ewaybill_generate.php?voucher_id=${voucherId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('E-Way Bill generated successfully!');
          // Refresh the sales data to show the updated E-Way Bill status
          fetchInvoices();
        } else {
          alert(data.message || 'Failed to generate E-Way Bill');
        }
      } else {
        alert('Error generating E-Way Bill');
      }
    } catch (err) {
      console.error('E-Way Bill generation error:', err);
      alert('Failed to generate E-Way Bill');
    }
  };

  const taxableValue = useMemo(() => {
    if (!selectedVoucher?.items) return 0;
    return selectedVoucher.items.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0);
  }, [selectedVoucher]);

  const totalTaxAmount = useMemo(() => {
    if (!selectedVoucher?.items) return 0;
    return selectedVoucher.items.reduce((acc, item) => acc + parseFloat(item.tax_amount || '0'), 0);
  }, [selectedVoucher]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-24 px-4 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/reports')}
            className="p-4 bg-white border border-slate-200 rounded-[1.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Sales</h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={12} className="text-emerald-500" /> Secure Financial Audit
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchInvoices} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:rotate-180 duration-500">
            <RotateCcw size={20} />
          </button>
          {/* <button className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
            <Printer size={18} /> Batch Print
          </button> */}
          <button onClick={() => navigate('/vouchers/sales')} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 transform">
            <Plus size={20} /> New Entry
          </button>
        </div>
      </div>

      {/* Desktop Analytics Bento Grid */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        <div className="md:col-span-2 glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex items-center gap-6 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voucher ID or Client Name..."
              autoComplete="off"
              className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-4 border rounded-[1.5rem] transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 shadow-sm'}`}>
            <Filter size={24} />
          </button>
        </div>

        <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100/50 flex items-center justify-between group hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Total Sales</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
          <div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Invoices</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tighter">{filteredSalesData.length}</h3>
          </div>
          <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Analytics Bento Grid */}
      <div className="grid lg:hidden grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 glass-panel p-5 rounded-[2rem] shadow-xl shadow-slate-200/40 flex items-center gap-3 border-white/50">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Voucher ID..."
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-3 border rounded-2xl transition-all transform active:scale-90 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 shadow-sm'}`}>
            <Filter size={20} />
          </button>
        </div>

        <div className="bg-emerald-50/50 p-5 rounded-[2rem] border border-emerald-100/50 flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em]">Total Sales</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</h3>
          </div>
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100/50 flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Invoices</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 tracking-tighter">{filteredSalesData.length}</h3>
          </div>
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* Advanced Filter Reveal */}
      {showFilters && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 animate-in slide-in-from-top-6 duration-500">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <SlidersHorizontal size={20} />
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Advanced Filter Controls</h4>
            </div>
            <button onClick={resetFilters} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 px-4 py-2 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all">Reset All Parameters</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3 relative" ref={partyDropdownRef}>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Client / Ledger Account</label>
              <div onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)} className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold flex justify-between items-center cursor-pointer hover:border-indigo-300 transition-all">
                <span className={filterParty === 'All' ? 'text-slate-400' : 'text-slate-900'}>{filterParty}</span>
                <ChevronDown size={20} className="text-slate-400" />
              </div>
              {isPartyDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <input
                    type="text"
                    placeholder="Type to filter list..."
                    value={partySearchQuery}
                    onChange={(e) => setPartySearchQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs mb-3 outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-300 transition-all"
                  />
                  <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                    {filteredPartyList.map(p => (
                      <button key={p} onClick={() => { setFilterParty(p); setIsPartyDropdownOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${filterParty === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all" />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-4 block">Bill Status</label>
            <div className="flex flex-wrap gap-3">
              {['Posted', 'Draft', 'Cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${filterStatus.includes(status)
                    ? status === 'Cancelled'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-100'
                      : status === 'Draft'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-100'
                        : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Table Interface */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/30 overflow-hidden bento-item">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto overflow-visible">
          <table className="w-full text-left table-fixed min-w-[1200px]">
            <thead className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] border-b border-slate-100">
              <tr>
                <th className="px-8 py-8 w-[80px] text-center">
                  <button onClick={toggleSelectAll} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${selectedBills.length === filteredSalesData.length && filteredSalesData.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                    {selectedBills.length > 0 && <Check size={14} className="text-white mx-auto stroke-[4]" />}
                  </button>
                </th>
                <th className="px-4 py-8 w-[120px]">Date</th>
                <th className="px-4 py-8 w-[180px]">Voucher Ref</th>
                <th className="px-4 py-8 w-[300px]">Party Identity</th>
                <th className="px-4 py-8 w-[80px] text-center">E-Inv</th>
                <th className="px-4 py-8 w-[80px] text-center">E-Way</th>
                <th className="px-4 py-8 w-[120px] text-right">Net Value</th>
                <th className="px-4 py-8 w-[130px] text-center">Status</th>
                <th className="px-8 py-8 w-[90px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={9} className="py-40 text-center"><div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-600" size={48} /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading...</p></div></td></tr>
              ) : filteredSalesData.length === 0 ? (
                <tr><td colSpan={9} className="py-40 text-center"><div className="flex flex-col items-center gap-4 text-slate-300"><Search size={64} /><p className="text-sm font-bold text-slate-400">No transactions match your current search criteria.</p><button onClick={resetFilters} className="mt-4 px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">Clear All Filters</button></div></td></tr>
              ) : filteredSalesData.map((bill) => {
                const isSelected = selectedBills.includes(bill.voucher_no);
                const isMenuOpen = openMenuId === bill.id;
                return (
                  <tr
                    key={bill.id}
                    onClick={() => handleView(bill)}
                    className={`hover:bg-indigo-50/30 transition-all group cursor-pointer relative ${isSelected ? 'bg-indigo-50/60' : ''}`}
                  >
                    <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelectBill(bill.voucher_no)} className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-100 bg-white group-hover:border-indigo-200'}`}>
                        {isSelected && <Check size={14} className="text-white mx-auto stroke-[4]" />}
                      </button>
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 tracking-tight">{new Date(bill.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(bill.voucher_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-black tracking-widest rounded-lg border border-indigo-100 shadow-sm">{bill.voucher_no}</span>
                    </td>
                    <td className="px-4 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner uppercase">{(bill.party_name || 'U')[0]}</div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate" title={bill.party_name}>{bill.party_name}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter truncate">GST: {bill.party_gstin || 'UNREGISTERED'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {bill.einvoice?.status === 'generated' && bill.einvoice?.irn ? (
                          <div className="flex flex-col items-center">
                            <Zap size={16} className="text-emerald-500 fill-emerald-50" />
                            <span className="text-[8px] font-black uppercase mt-1 text-emerald-600">Generated</span>
                            <span className="text-[7px] font-bold text-emerald-600 mt-0.5 bg-emerald-50 px-2 py-0.5 rounded max-w-[90px] truncate" title={bill.einvoice.irn}>{bill.einvoice.irn}</span>
                          </div>
                        ) : bill.einvoice?.status === 'failed' ? (
                          <div className="flex flex-col items-center">
                            <AlertCircle size={16} className="text-red-500" />
                            <span className="text-[8px] font-black uppercase mt-1 text-red-600">Failed</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateEInvoice(bill.id);
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-amber-50 transition-all group"
                            title="Click to generate E-Invoice"
                          >
                            <ZapOff size={16} className="text-slate-300 group-hover:text-amber-500" />
                            <span className="text-[7px] font-black uppercase text-slate-400 group-hover:text-amber-600">Generate</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {bill.ewaybill?.status === 'generated' && bill.ewaybill?.ewb_no ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEwbModal(bill);
                            }}
                            className="flex flex-col items-center group cursor-pointer"
                            title="Click to view E-Way Bill Details"
                          >
                            <Navigation size={16} className="text-indigo-500 fill-indigo-50 rotate-45 group-hover:scale-110 transition-transform" />
                            <span className="text-[8px] font-black uppercase mt-1 text-indigo-600">Generated</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[7px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded max-w-[70px] truncate" title={bill.ewaybill.ewb_no}>{bill.ewaybill.ewb_no}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewEwb(bill);
                                }}
                                className="p-1 bg-white border border-indigo-100 rounded text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Quick View"
                              >
                                <Eye size={10} />
                              </button>
                            </div>
                          </button>
                        ) : bill.ewaybill?.status === 'failed' ? (
                          <div className="flex flex-col items-center">
                            <AlertCircle size={16} className="text-red-500" />
                            <span className="text-[8px] font-black uppercase mt-1 text-red-600">Failed</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEwbModal(bill);
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-indigo-50 transition-all group"
                            title="Click to generate E-Way Bill"
                          >
                            <Navigation size={16} className="text-slate-300 group-hover:text-indigo-500 rotate-45" />
                            <span className="text-[7px] font-black uppercase text-slate-400 group-hover:text-indigo-600">Generate</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-900">₹{parseFloat(bill.total_amount || '0').toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Incl. GST</span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${bill.status?.toLowerCase() === 'posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : bill.status?.toLowerCase() === 'draft' ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : bill.status?.toLowerCase() === 'cancelled' ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>{bill.status}</span>
                    </td>

                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 transition-all transform group-hover:translate-x-0 sm:translate-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(bill); }}
                          className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(bill); }}
                          className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet Cards */}
        <div className="block lg:hidden p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : filteredSalesData.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              No invoices found
            </div>
          ) : (
            filteredSalesData.map((bill) => (
              <div
                key={bill.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                onClick={() => handleView(bill)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {bill.party_name}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {bill.voucher_no}
                    </p>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${bill.status?.toLowerCase() === 'posted' ? 'bg-emerald-50 text-emerald-600'
                    : bill.status?.toLowerCase() === 'draft' ? 'bg-amber-50 text-amber-600'
                      : bill.status?.toLowerCase() === 'cancelled' ? 'bg-rose-50 text-rose-600'
                        : 'bg-slate-50 text-slate-500'
                    }`}>
                    {bill.status}
                  </span>
                </div>

                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Date</span>
                  <span>{new Date(bill.voucher_date).toLocaleDateString()}</span>
                </div>

                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Total</span>
                  <span className="text-slate-900 font-black">
                    ₹{parseFloat(bill.total_amount).toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(bill); }}
                    className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-white hover:bg-indigo-600 transition-all active:scale-90"
                  >
                    <Edit2 size={16} />
                  </button>

                  {bill.ewaybill?.status === 'generated' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEwbModal(bill);
                      }}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-sm hover:text-indigo-600 hover:bg-indigo-100 transition-all group flex items-center gap-2 max-w-[140px]"
                      title="View E-Way Bill Details"
                    >
                      <Navigation size={16} className="text-indigo-500 fill-indigo-100 rotate-45 group-hover:scale-110 transition-transform flex-shrink-0" />
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEwb(bill);
                        }}
                        className="p-1 rounded-lg bg-white border border-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex-shrink-0 ml-auto"
                      >
                        <Eye size={12} />
                      </div>
                    </button>
                  ) : bill.ewaybill?.status === 'failed' ? (
                    <div className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm flex items-center gap-2">
                      <AlertCircle size={16} />
                      <span className="text-[10px] font-black uppercase">Failed</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEwbModal(bill);
                      }}
                      className="p-2.5 text-slate-400 bg-slate-50/50 border border-slate-200 rounded-xl shadow-sm hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-100 transition-all active:scale-90 group"
                      title="Generate E-Way Bill"
                    >
                      <Navigation size={16} className="rotate-45 group-hover:scale-110 transition-transform" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEwbModal(bill);
                    }}
                    className="p-2.5 text-amber-500 bg-amber-50/50 border border-amber-100 rounded-xl shadow-sm hover:text-white hover:bg-amber-600 transition-all active:scale-90"
                  >
                    <ZapOff size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(bill); }}
                    className="p-2.5 text-rose-500 bg-rose-50/50 border border-rose-100 rounded-xl shadow-sm hover:text-white hover:bg-rose-600 transition-all active:scale-90"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>
              </div>
            ))
          )}
        </div>

        {/* E-Way Bill Generation Modal */}
        <EWayBillComponent
          isOpen={isEwbModalOpen}
          onClose={() => setIsEwbModalOpen(false)}
          invoice={selectedInvoiceForEwb}
          businessDetails={businessDetails}
          onSuccess={() => fetchInvoices()}
          onPrintEwb={() => handlePrintEwb()}
          onViewEwb={(invoice) => handleViewEwb(invoice)}
          onCancelEwb={() => {
            setIsEwbModalOpen(false);
            setCancelReason('2');
            setCancelRemark('');
            setCancelUsername(businessDetails?.username || '');
            setCancelPassword('');
            setIsCancelModalOpen(true);
          }}
        />

        {/* Cancel E-Way Bill Confirmation Modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800">Cancel E-Way Bill</h3>
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="1">Due to Breakage</option>
                    <option value="2">Due to Transporter Change</option>
                    <option value="3">Others</option>
                    <option value="4">Order Cancelled</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remark</label>
                  <textarea
                    value={cancelRemark}
                    onChange={(e) => setCancelRemark(e.target.value)}
                    placeholder="Enter cancellation remark..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EWB Username</label>
                  <input
                    type="text"
                    value={cancelUsername}
                    onChange={(e) => setCancelUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EWB Password</label>
                  <input
                    type="password"
                    value={cancelPassword}
                    onChange={(e) => setCancelPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-wider transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleCancelEwb}
                  disabled={cancelLoading}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-rose-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* E-Way Bill Preview Modal */}
        {isEwbPreviewModalOpen && selectedInvoiceForEwb && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg" onClick={() => setIsEwbPreviewModalOpen(false)} />
            <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-100">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">E-Way Bill Preview</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {selectedInvoiceForEwb.ewaybill?.ewb_no || "Draft Mode"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { handlePrintEwb(); }}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                  >
                    <Printer size={16} /> Print EWB
                  </button>
                  <button
                    onClick={() => setIsEwbPreviewModalOpen(false)}
                    className="p-3 text-slate-400 hover:text-rose-500 transition-all ml-4 bg-slate-50 rounded-2xl"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-[800px] mx-auto min-h-[400px] flex flex-col items-center justify-center">
                  {ewbViewLoading ? (
                    <div className="flex flex-col items-center gap-4 py-20">
                      <Loader2 size={48} className="text-indigo-600 animate-spin" />
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Fetching Reality...</p>
                    </div>
                  ) : viewEwbFullData ? (
                    <EWayBillTemplate
                      invoice={selectedInvoiceForEwb}
                      businessDetails={businessDetails}
                      ewbData={viewEwbFullData}
                    />
                  ) : (
                    <div className="text-center py-20">
                      <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
                      <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Failed to Load Details</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-white flex justify-end z-20">
                <button
                  onClick={() => setIsEwbPreviewModalOpen(false)}
                  className="px-10 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all active:scale-95 bg-slate-50 rounded-[1.5rem]"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Summary Footer */}
        {/* Desktop View */}
        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 hidden lg:flex">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Total Turnover</span>
              <span className="text-3xl font-black tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</span>
            </div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Entry Density</span>
              <span className="text-xl font-black">{filteredSalesData.length} <span className="text-xs opacity-50">Vouchers</span></span>
            </div>
          </div>
        </div>
        {/* Mobile View */}

        <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 md:flex lg:hidden">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Total Turnover</span>
              <span className="text-3xl font-black tracking-tighter">₹{totalFilteredAmount.toLocaleString()}</span>
            </div>
            <div className="h-10 w-px bg-white/10 hidden md:block" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Entry Density</span>
              <span className="text-xl font-black">{filteredSalesData.length} <span className="text-xs opacity-50">Vouchers</span></span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Export CSV</button>
          </div>
        </div>




        {/* Floating Bulk Actions Overlay */}
        {
          selectedBills.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-[1000px] bg-slate-900 rounded-[3rem] p-6 shadow-2xl z-50 animate-in slide-in-from-bottom-12 duration-500 flex items-center justify-between border border-white/10 backdrop-blur-2xl bg-opacity-95">
              <div className="flex items-center gap-8 pl-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-2xl shadow-indigo-500/40">{selectedBills.length}</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Records Selected</span>
                    <button onClick={() => setSelectedBills([])} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1 hover:text-indigo-300 transition-colors">Deselect All</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkPrint}
                  disabled={isBulkPrinting}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all flex items-center gap-2 border border-white/5 disabled:opacity-50"
                >
                  {isBulkPrinting ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Printer size={18} className="text-indigo-400" />}
                  Bulk Print
                </button>
                <button
                  onClick={handleBulkExport}
                  disabled={isBulkExporting}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all flex items-center gap-2 border border-white/5 disabled:opacity-50"
                >
                  {isBulkExporting ? <Loader2 size={18} className="animate-spin text-emerald-400" /> : <FileDown size={18} className="text-emerald-400" />}
                  Export Data
                </button>
              </div>
            </div>
          )
        }

        {/* Invoice View Modal - Premium Template */}
        {
          isViewModalOpen && selectedVoucher && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-8 animate-in fade-in duration-300">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-lg" onClick={() => setIsViewModalOpen(false)} />
              <div className="relative w-full h-full sm:h-auto max-w-5xl bg-white sm:rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[95vh] animate-in zoom-in-95 duration-300">
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white sticky top-0 z-20">
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 flex-shrink-0">
                        <FileText size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest">Sales Voucher View</h2>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedVoucher.voucher_no}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsViewModalOpen(false)} className="p-2 sm:hidden text-slate-400 hover:text-rose-500 transition-all bg-slate-50 rounded-xl">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 text-slate-600 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 whitespace-nowrap">
                      <Printer size={14} className="sm:w-4 sm:h-4" /> Print
                    </button>
                    <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 whitespace-nowrap">
                      <FileDown size={14} className="sm:w-4 sm:h-4" /> Save PDF
                    </button>
                    <button onClick={() => setIsViewModalOpen(false)} className="hidden sm:block p-3 text-slate-400 hover:text-rose-500 transition-all ml-2 bg-slate-50 rounded-2xl flex-shrink-0">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50/30 p-2 sm:p-10">
                  <style>
                    {`
                      .invoice-zoom-wrapper { zoom: 1; }
                      @media (max-width: 639px) {
                        .invoice-zoom-wrapper { zoom: 0.45; }
                      }
                    `}
                  </style>
                  <div className="invoice-zoom-wrapper w-[800px] mx-auto bg-white shadow-sm my-2 sm:my-0">
                    <InvoiceTemplate
                      ref={invoiceRef}
                      invoice={selectedVoucher}
                      isLoading={isLoadingDetails}
                      taxableValue={taxableValue}
                      totalTaxAmount={totalTaxAmount}
                      businessDetails={businessDetails}
                      bankDetails={defaultBank}
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-3 sm:gap-4 z-20 pb-safe">
                  <button onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto px-6 sm:px-16 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-[1.5rem] text-[10px] sm:text-[10px] font-black uppercase tracking-widest shadow-xl sm:shadow-2xl shadow-slate-900/30 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">Close</button>
                  <div className="hidden sm:block flex-1" />
                  <button onClick={() => { setIsViewModalOpen(false); if (selectedVoucher) handleEdit(selectedVoucher); }} className="w-full sm:w-auto px-6 sm:px-12 py-3 sm:py-4 bg-slate-100 text-slate-700 rounded-xl sm:rounded-[1.5rem] text-[10px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-sm">Edit</button>
                  {/* <button onClick={handlePrint} className="w-full sm:w-auto px-6 sm:px-16 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-[1.5rem] text-[10px] sm:text-[10px] font-black uppercase tracking-widest shadow-xl sm:shadow-2xl shadow-slate-900/30 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Printer size={16} className="sm:w-5 sm:h-5" /> Final Output
                  </button> */}
                </div>
              </div>
            </div>
          )
        }

        {/* Hidden E-Way Bill Template for Printing */}
        <div style={{ display: 'none' }}>
          <EWayBillTemplate
            ref={ewbPrintRef}
            invoice={selectedInvoiceForEwb}
            businessDetails={businessDetails}
            ewbData={viewEwbFullData}
          />
        </div>

        {/* Hidden Bulk Print Container */}
        <div style={{ display: 'none' }}>
          <div ref={bulkPrintRef}>
            {bulkInvoicesData.map((inv) => (
              <div key={inv.id} className="invoice-page">
                <InvoiceTemplate
                  invoice={inv}
                  taxableValue={inv.items?.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.rate)), 0) || 0}
                  totalTaxAmount={inv.items?.reduce((acc: number, item: any) => acc + parseFloat(item.tax_amount || '0'), 0) || 0}
                  businessDetails={businessDetails}
                  bankDetails={defaultBank}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        {isDeleteModalOpen && selectedVoucher && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-300 p-12 text-center space-y-8">
              <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-rose-100">
                <TriangleAlert size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Erase Record?</h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed px-4">
                  Permanently remove voucher <span className="text-indigo-600 font-black">#{selectedVoucher.voucher_no}</span>?
                  This action is destructive and cannot be undone.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="w-full py-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-rose-600/30 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                  Confirm Permanent Erasure
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  Discard Deletion
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesRegister;
