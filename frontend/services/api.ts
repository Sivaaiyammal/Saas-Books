
// Safely handle environment variables
const getApiBaseUrl = () => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env.VITE_API_BASE_URL || `${window.location.origin}/backend/api/v1`;
    }
  } catch (e) { }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/backend/api/v1`;
  }
  return '/backend/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

const FINANCIAL_YEAR_STORAGE_KEY = 'selected_financial_year';

export interface FinancialYearRange {
  label: string;
  startDate: string;
  endDate: string;
}

export const buildFinancialYearRange = (startYear: number): FinancialYearRange => {
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return {
    label: `${startYear}-${endYearShort}`,
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
};

export const getCurrentFinancialYearLabel = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  return buildFinancialYearRange(startYear).label;
};

export const getSelectedFinancialYearLabel = (): string => {
  const saved = localStorage.getItem(FINANCIAL_YEAR_STORAGE_KEY);
  return saved || getCurrentFinancialYearLabel();
};

export const setSelectedFinancialYearLabel = (label: string) => {
  localStorage.setItem(FINANCIAL_YEAR_STORAGE_KEY, label);
};

export const getFinancialYearRangeByLabel = (label: string): FinancialYearRange | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return null;
  const startYear = parseInt(match[1], 10);
  return buildFinancialYearRange(startYear);
};

const shouldApplyFinancialYearFilter = (endpoint: string, method: string): boolean => {
  if (method !== 'GET') return false;
  if (endpoint.includes('/auth/')) return false;
  if (endpoint.includes('/admin/')) return false;
  return true;
};

const withFinancialYearParams = (endpoint: string, method: string): string => {
  if (!shouldApplyFinancialYearFilter(endpoint, method)) return endpoint;

  const selectedFy = getSelectedFinancialYearLabel();
  const range = getFinancialYearRangeByLabel(selectedFy);
  if (!range) return endpoint;

  const [path, queryString = ''] = endpoint.split('?');
  const params = new URLSearchParams(queryString);

  if (!params.has('from_date')) {
    params.set('from_date', range.startDate);
  }
  if (!params.has('to_date')) {
    params.set('to_date', range.endDate);
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

// Token management
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const setRefreshToken = (token: string) => {
  localStorage.setItem('refresh_token', token);
};

export const getRefreshToken = () => {
  return localStorage.getItem('refresh_token');
};

export const removeRefreshToken = () => {
  localStorage.removeItem('refresh_token');
};

// Store both tokens at once
export const setTokens = (accessToken: string, refreshToken: string) => {
  setAuthToken(accessToken);
  setRefreshToken(refreshToken);
};

// Clear all tokens (logout)
export const clearTokens = () => {
  removeAuthToken();
  removeRefreshToken();
};

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

// Refresh token API call
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data?.tokens) {
      const { accessToken, refreshToken: newRefreshToken } = data.data.tokens;
      setTokens(accessToken, newRefreshToken);
      return accessToken;
    }
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
};

/**
 * Robust API Client with Token Refresh
 * - Checks for Auth Token
 * - Handles 401 Unauthorized with automatic token refresh
 * - Safely parses JSON and handles HTML error pages (404/500)
 */
export const apiClient = async (endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<any> => {
  const token = getAuthToken();
  const method = (options.method || 'GET').toUpperCase();
  const endpointWithFy = withFinancialYearParams(endpoint, method);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpointWithFy}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - Try to refresh token
    if (response.status === 401 && !_isRetry) {
      // Prevent multiple simultaneous refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;

        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          // Notify all waiting requests
          onTokenRefreshed(newToken);
          // Retry the original request with new token
          return apiClient(endpoint, options, true);
        } else {
          // Refresh failed - clear tokens and redirect to login
          clearTokens();
          window.location.href = '#/login';
          throw new Error('Session expired. Please login again.');
        }
      } else {
        // Another refresh is in progress, wait for it
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            // Retry with new token
            const newHeaders = {
              ...headers,
              'Authorization': `Bearer ${newToken}`,
            };
            fetch(`${API_BASE_URL}${endpointWithFy}`, { ...options, headers: newHeaders })
              .then(res => res.json())
              .then(resolve)
              .catch(reject);
          });
        });
      }
    }

    // If still 401 after retry, redirect to login
    if (response.status === 401 && _isRetry) {
      clearTokens();
      window.location.href = '#/login';
      throw new Error('Session expired. Please login again.');
    }

    // Get response text first to handle non-JSON errors
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      // If not JSON, it's likely an HTML error page or raw text
      data = { message: `Server error: ${response.status} ${response.statusText}` };
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your internet connection or API URL.');
    }
    throw error;
  }
};

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company_id?: number | null;
  company_name?: string | null;
  role: string;
  status: string;
  created_at: string;
  last_login: string;
  modules?: CompanyModules;
  is_saas_admin?: boolean;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: UserProfile;
    tokens?: {
      accessToken: string;
      refreshToken: string;
      tokenType: string;
      expiresIn: number;
    };
  };
}

export interface CompanyModules {
  sales_order: boolean;
  purchase_order: boolean;
  sales: boolean;
  purchase: boolean;
  payment: boolean;
  receipt: boolean;
  delivery_note: boolean;
  quotation: boolean;
}

export interface SaasPlan {
  id: number;
  code: string;
  name: string;
  amount: number;
  currency: string;
  validity_days: number;
  status: string;
  features?: any;
}

export interface SaasCompany {
  id: number;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  user_count: number;
  status: string;
  created_at: string;
  subscription_id: number | null;
  plan_id: number | null;
  subscription_status: string | null;
  payment_status: string | null;
  start_date: string | null;
  end_date: string | null;
  amount_paid: number | null;
  plan_name: string | null;
  plan_code: string | null;
  modules: CompanyModules;
}

export interface CreateCompanyRequest {
  company_name: string;
  company_email?: string;
  company_phone?: string;
  admin_name: string;
  admin_email: string;
  admin_phone?: string;
  admin_password: string;
  plan_id?: number;
  modules?: Partial<CompanyModules>;
}

interface ReceiptRequest {
  party_ledger_id: number;
  voucher_date: string;
  amount: number;
  received_in: number;
  reference_no?: string;
  narration?: string;
  tds_amount?: number;
  tds_ledger_id?: number;
  bill_adjustments?: {
    allocation_id: number;
    amount: number;
  }[];
}

interface PaymentRequest {
  party_ledger_id: number;
  voucher_date: string;
  amount: number;
  paid_from: number;
  reference_no?: string;
  narration?: string;
  tds_amount?: number;
  tds_ledger_id?: number;
  bill_adjustments?: {
    allocation_id: number;
    amount: number;
  }[];
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();
    return data;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    return data;
  },

  async getMe(): Promise<AuthResponse> {
    return apiClient('/auth/me.php');
  }
};

export const adminApi = {
  async getCompaniesOverview(): Promise<{ success: boolean; data: { companies: SaasCompany[]; plans: SaasPlan[] } }> {
    return apiClient('/admin/companies.php');
  },
  async createCompany(payload: CreateCompanyRequest): Promise<{ success: boolean; message: string; data?: { company: SaasCompany; admin_user: { id: number; name: string; email: string } } }> {
    return apiClient('/admin/companies.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async updateCompanyAccess(payload: {
    company_id: number;
    plan_id?: number;
    company_status?: 'active' | 'inactive';
    modules?: Partial<CompanyModules>;
  }): Promise<{ success: boolean; message: string; data?: { company: SaasCompany } }> {
    return apiClient('/admin/companies.php', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  async impersonateCompany(company_id: number): Promise<AuthResponse> {
    return apiClient('/admin/impersonate.php', {
      method: 'POST',
      body: JSON.stringify({ company_id }),
    });
  }
};

export const mastersApi = {
  async getLedgerGroups(): Promise<{ success: boolean; data: { groups: any[] } }> {
    return apiClient('/masters/group.php');
  },
  async getLedgersByGroup(...groupIds: number[]): Promise<{ success: boolean; data: { ledgers: any[] } }> {
    // Make parallel calls for each group and combine results
    const results = await Promise.all(
      groupIds.map(groupId => apiClient(`/masters/ledgers.php?group_id=${groupId}`))
    );

    // Combine all ledgers from all groups
    const allLedgers: any[] = [];
    for (const result of results) {
      if (result.success && result.data?.ledgers) {
        allLedgers.push(...result.data.ledgers);
      }
    }

    return {
      success: true,
      data: { ledgers: allLedgers }
    };
  },
  async createLedgerGroup(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/group.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateLedgerGroup(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/group.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteLedgerGroup(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/group.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getLedgers(): Promise<{ success: boolean; data: { ledgers: any[] } }> {
    return apiClient('/masters/ledgers.php');
  },
  async getLedgerOutstanding(ledgerId: number): Promise<{ success: boolean; data: any; message?: string }> {
    // Updated to the new endpoint specified by the user
    return apiClient(`/vouchers/receipt.php?outstanding=true&party_id=${ledgerId}`);
  },
  async createLedger(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/ledgers.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateLedger(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/ledgers.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteLedger(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/ledgers.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getStockGroups(): Promise<{ success: boolean; data: { item_groups: any[] } }> {
    return apiClient('/masters/item_group.php');
  },
  async createStockGroup(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/item_group.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateStockGroup(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/item_group.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteStockGroup(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/item_group.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getItems(page: number = 1, search?: string, limit: number = 9999): Promise<{ success: boolean; data: { items: any[]; pagination?: { total: number; page: number; limit: number; pages: number } } }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    return apiClient(`/masters/item.php?${params.toString()}`);
  },
  async getItem(id: number): Promise<{ success: boolean; data: any; message?: string }> {
    return apiClient(`/masters/item.php?id=${id}`);
  },
  async createItem(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/item.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateItem(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/item.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteItem(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/item.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getTaxes(): Promise<{ success: boolean; data: { taxes: any[] } }> {
    return apiClient('/masters/tax.php');
  },
  async createTax(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/tax.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateTax(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/tax.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteTax(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/tax.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getUnits(): Promise<{ success: boolean; data: { units: any[] } }> {
    return apiClient('/masters/unit.php');
  },
  async createUnit(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/unit.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateUnit(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/unit.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteUnit(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/unit.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getGodowns(): Promise<{ success: boolean; data: { godowns: any[] } }> {
    return apiClient('/masters/godown.php');
  },
  async createGodown(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/godown.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateGodown(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/masters/godown.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
  },
  async deleteGodown(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/masters/godown.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }
};

interface SalesVoucherItem {
  item_id: number;
  item_name: string;
  colour?: string;
  quantity: number;
  unit_id: number;
  rate: number;
  discount_amount?: number;
  tax_id: number;
  tax_percent: number;
  godown_id: number;
  description?: string;
}

interface SalesVoucherRequest {
  party_ledger_id: number;
  voucher_date: string;
  reference_no?: string;
  company_state: string;

  // Billing address details
  billing_name: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_pincode?: string;
  billing_gstin?: string;
  billing_phone?: string;

  // Consignee flag
  consignee_same_as_billing: boolean;

  // Consignee details (only when consignee_same_as_billing is false)
  consignee_name?: string;
  consignee_address?: string;
  consignee_city?: string;
  consignee_state?: string;
  consignee_pincode?: string;
  consignee_gstin?: string;
  consignee_phone?: string;

  place_of_supply?: string;
  vehicle_no?: string;
  narration?: string;
  items: SalesVoucherItem[];
}

export const vouchersApi = {
  async createSalesVoucher(data: SalesVoucherRequest): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/vouchers/sales.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getSalesVouchers(): Promise<{ success: boolean; data: { invoices: any[] } }> {
    return apiClient('/vouchers/sales.php');
  },
  async getSalesVoucher(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/sales.php?id=${id}`);
  },
  async updateSalesVoucher(id: number, data: SalesVoucherRequest): Promise<{ success: boolean; message: string }> {
    return apiClient(`/vouchers/sales.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },
  async deleteSalesVoucher(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/sales.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getDeliveryNotes(): Promise<{ success: boolean; data: { delivery_notes: any[]; pagination?: any } }> {
    return apiClient('/vouchers/delivery_note.php');
  },
  async getDeliveryNote(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/delivery_note.php?id=${id}`);
  },
  async deleteDeliveryNote(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/delivery_note.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getNextSalesVoucherNo(): Promise<{ success: boolean; message: string; data?: { next_voucher_no: string } }> {
    return apiClient('/vouchers/sales.php?next_voucher_no=true');
  },
  async getNextPurchaseVoucherNo(): Promise<{ success: boolean; message: string; data?: { next_voucher_no: string } }> {
    return apiClient('/vouchers/purchase.php?next_voucher_no=true');
  },

  async createPurchaseVoucher(data: SalesVoucherRequest): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/vouchers/purchase.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getPurchaseVouchers(): Promise<{ success: boolean; data: { invoices: any[] } }> {
    return apiClient('/vouchers/purchase.php');
  },
  async getPurchaseVoucher(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/purchase.php?id=${id}`);
  },
  async updatePurchaseVoucher(id: number, data: SalesVoucherRequest): Promise<{ success: boolean; message: string }> {
    return apiClient(`/vouchers/purchase.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },
  async deletePurchaseVoucher(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/purchase.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  // Receipt API
  async createReceipt(data: ReceiptRequest): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/vouchers/receipt.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getReceipts(): Promise<{ success: boolean; data: { receipts: any[] } }> {
    return apiClient('/vouchers/receipt.php');
  },
  async getReceipt(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/receipt.php?id=${id}`);
  },
  async deleteReceipt(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/receipt.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },

  // Payment API
  async createPayment(data: PaymentRequest): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/vouchers/payment.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getPayments(): Promise<{ success: boolean; data: { payments: any[] } }> {
    return apiClient('/vouchers/payment.php');
  },
  async getPayment(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/payment.php?id=${id}`);
  },
  async deletePayment(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/payment.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },

  // Helper to fetch pending invoices for a ledger - failing gracefully if not found
  async getPendingInvoices(ledgerId: number): Promise<{ success: boolean; data: { invoices: any[] } }> {
    try {
      return await apiClient(`/reports/pending_invoices.php?ledger_id=${ledgerId}`);
    } catch (e) {
      // Fallback if specialized report doesn't exist
      console.warn('Pending invoices endpoint not found, returning empty set.');
      return { success: false, data: { invoices: [] } };
    }
  },

  // Get outstanding bills for a party (Works for both Sales and Purchases depending on context)
  async getOutstandingBills(partyId: number): Promise<{
    success: boolean;
    message?: string;
    data: {
      bills: any[];
      total_outstanding: number;
      bill_count: number;
    }
  }> {
    try {
      return await apiClient(`/vouchers/receipt.php?outstanding=true&party_id=${partyId}`);
    } catch (e) {
      console.warn('Outstanding bills endpoint error:', e);
      return { success: false, data: { bills: [], total_outstanding: 0, bill_count: 0 } };
    }
  },

  async getLedgerStatement(ledgerId: number, startDate?: string, endDate?: string): Promise<{
    success: boolean;
    data: {
      transactions: any[];
      opening_balance: number;
      closing_balance: number;
      total_dr: number;
      total_cr: number;
    }
  }> {
    const params = new URLSearchParams({ ledger_id: String(ledgerId) });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return apiClient(`/reports/ledger_report.php?${params.toString()}`);
  },

  async getStockMovement(startDate?: string, endDate?: string, groupId?: number): Promise<{
    success: boolean;
    data: {
      items: any[];
      totals: any;
      pagination: any;
    }
  }> {
    const params = new URLSearchParams();
    if (startDate) params.append('from_date', startDate);
    if (endDate) params.append('to_date', endDate);
    if (groupId) params.append('item_group_id', String(groupId));
    return apiClient(`/reports/stock-movement.php?${params.toString()}`);
  },

  async getItemMovementDetails(itemId: number): Promise<{
    success: boolean;
    data: any;
  }> {
    return apiClient(`/reports/stock-movement.php?item_id=${itemId}`);
  },

  async getStockSummary(startDate?: string, endDate?: string, groupId?: number, page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    message?: string;
    data: {
      items: any[];
      totals: any;
      pagination: any;
    }
  }> {
    const params = new URLSearchParams();
    if (startDate) params.append('from_date', startDate);
    if (endDate) params.append('to_date', endDate);
    if (groupId) params.append('item_group_id', String(groupId));
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiClient(`/reports/stock-summary.php?${params.toString()}`);
  },
  stockConvert: (data: {
    from_items: { item_id: number; qty: number }[];
    to_items: { item_id: number; qty: number }[];
    conversion_date: string;
    narration?: string;
  }): Promise<{ success: boolean; message: string }> => {
    return apiClient('/vouchers/stock-convert.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getStockConversions(params?: { search?: string; from_date?: string; to_date?: string }): Promise<{ success: boolean; data: { conversions: any[] } }> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    const qs = query.toString();
    return apiClient(`/vouchers/stock-convert.php${qs ? '?' + qs : ''}`);
  },
  async getStockConversion(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/stock-convert.php?id=${id}`);
  },
  async deleteStockConversion(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/stock-convert.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
  async getDashboardStats(): Promise<{ success: boolean; data: any }> {
    return apiClient('/dashboard.php');
  }
};

export const settingsApi = {
  async saveGstSettings(data: any): Promise<{ success: boolean; message: string }> {
    return apiClient('/gst/ewb_settings.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getGstSettings(): Promise<{ success: boolean; data: any }> {
    try {
      return await apiClient('/gst/ewb_settings.php');
    } catch (e) {
      console.warn('Settings endpoint not found or error fetching settings:', e);
      return { success: false, data: null };
    }
  },
  async getEWayBillToken(usernameOverride?: string, passwordOverride?: string): Promise<{ success: boolean; data: any; message?: string }> {
    try {
      // 1. Fetch Settings
      const settingsRes = await this.getGstSettings();
      if (!settingsRes.success || !settingsRes.data) {
        return { success: false, data: null, message: 'Failed to fetch E-Way Bill settings (GSTIN missing).' };
      }

      const { gstin, username, ewbpwd } = settingsRes.data;

      // Use overrides if provided, otherwise fall back to fetched settings
      const finalUsername = usernameOverride || username;
      const finalPassword = passwordOverride || ewbpwd;

      if (!finalUsername || !finalPassword) {
        return { success: false, data: null, message: 'E-Way Bill Username or Password missing. Please provide them.' };
      }

      // 2. Request Access Token
      return apiClient('/gst/ewaybill_access_token.php', {
        method: 'POST',
        body: JSON.stringify({
          gstin,
          username: finalUsername,
          ewbpwd: finalPassword
        })
      });
    } catch (e) {
      console.error('Error fetching EWB token:', e);
      return { success: false, data: null, message: 'Network error while fetching token' };
    }
  },
  async generateEWayBill(data: any): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/gst/ewaybill_generate.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async cancelEWayBill(data: {
    gstin: string;
    username: string;
    authtoken: string;
    payload: {
      ewbNo: string;
      cancelRsnCode: string | number;
      cancelRmrk: string;
    }
  }): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/gst/ewaybill_cancel.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getEWayBillViewDetails(voucherId: number | string): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient(`/gst/ewaybill_view.php?voucher_id=${voucherId}`);
  }
};

export const quotationsApi = {
  async getNextQuotationNo(companyId?: number): Promise<{ success: boolean; message: string; data?: { next_voucher_no: string } }> {
    const params = new URLSearchParams();
    params.append('next_voucher_no', 'true');
    if (companyId) params.append('company_id', String(companyId));
    return apiClient(`/vouchers/quotation.php?${params.toString()}`);
  },
  async createQuotation(data: any): Promise<{ success: boolean; message: string; data?: any }> {
    return apiClient('/vouchers/quotation.php', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getQuotations(filters: any = {}): Promise<{ success: boolean; data: { quotations: any[]; pagination: any } }> {
    const params = new URLSearchParams(filters);
    return apiClient(`/vouchers/quotation.php?${params.toString()}`);
  },
  async getQuotation(id: number): Promise<{ success: boolean; data: any }> {
    return apiClient(`/vouchers/quotation.php?id=${id}`);
  },
  async updateQuotation(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return apiClient(`/vouchers/quotation.php`, {
      method: 'PUT',
      body: JSON.stringify({ id, ...data }),
    });
  },
  async deleteQuotation(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient('/vouchers/quotation.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },
};

