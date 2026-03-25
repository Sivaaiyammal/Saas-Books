
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Ledgers from './pages/masters/Ledgers';
import StockItems from './pages/masters/StockItems';
import Godowns from './pages/masters/Godowns';
import Tax from './pages/masters/Tax';
import Units from './pages/masters/Units';
import StockItemGroups from './pages/masters/StockItemGroups';
import LedgerGroups from './pages/masters/LedgerGroups';
import SalesVoucher from './pages/SalesVoucher';
import PurchaseVoucher from './pages/PurchaseVoucher';
import PaymentVoucher from './pages/PaymentVoucher';
import ReceiptVoucher from './pages/ReceiptVoucher';
import StockConvert from './pages/voucher/StockConvert';
import Reports from './pages/Reports';
import SalesRegister from './pages/reports/SalesRegister';
import PurchaseRegister from './pages/reports/PurchaseRegister';
import Receivables from './pages/reports/ReceiptRegister';
import Payables from './pages/reports/PaymentRegister';
import Outstanding from './pages/reports/OutstandingRegister';
import MovementAnalysis from './pages/reports/MovementAnalysis';
import StockSummary from './pages/reports/StockSummary';
import QuotationVoucher from './pages/QuotationVoucher';
import QuotationRegister from './pages/reports/QuotationRegister';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import SalesOrderVoucher from "./pages/SalesOrderVoucher";
import SalesOrderRegister from "./pages/reports/SalesOrderRegister";
import DeliveryNoteVoucher from "./pages/DeliveryNoteVoucher";
import DeliveryNoteRegister from "./pages/reports/DeliveryNoteRegister";
import Profile from "./pages/Profile";
import SaasAdminPanel from './pages/SaasAdminPanel';
import { authApi, getAuthToken, clearTokens } from './services/api';

type ModuleKey = 'sales_order' | 'purchase_order' | 'sales' | 'purchase' | 'payment' | 'receipt' | 'delivery_note' | 'quotation';

interface RouteGuardProps {
  element: React.ReactElement;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: any;
  moduleKey?: ModuleKey;
  requireSaasAdmin?: boolean;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ element, isAuthenticated, isLoading, currentUser, moduleKey, requireSaasAdmin }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-slate-600 font-bold">Loading access...</div>;
  }

  if (requireSaasAdmin && currentUser?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  if (moduleKey && currentUser?.role !== 'super_admin') {
    const allowed = currentUser?.modules?.[moduleKey];
    if (allowed === false) {
      return <Navigate to="/" replace />;
    }
  }

  return element;
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(!!getAuthToken());

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Sync state if token is removed externally (e.g., from api interceptor)
  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      if (!token && isAuthenticated) {
        setIsAuthenticated(false);
      }
    };

    // Check every second to handle external logout redirects
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated) {
      setCurrentUser(null);
      setIsUserLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsUserLoading(true);

    authApi.getMe()
      .then((response) => {
        if (!isMounted) return;
        setCurrentUser(response.data?.user || null);
      })
      .catch(() => {
        if (!isMounted) return;
        clearTokens();
        setCurrentUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) {
          setIsUserLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register onLogin={handleLogin} /> : <Navigate to="/" />} />

        {/* Protected Routes */}
        <Route element={isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/saas-admin" element={<RouteGuard element={<SaasAdminPanel />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} requireSaasAdmin />} />
          <Route path="/profile-settings" element={<Profile />} />
          {/* Masters */}
          <Route path="/masters/ledgers" element={<Ledgers />} />
          <Route path="/masters/items" element={<StockItems />} />
          <Route path="/masters/godowns" element={<Godowns />} />
          <Route path="/masters/tax" element={<Tax />} />
          <Route path="/masters/units" element={<Units />} />
          <Route path="/masters/stock-groups" element={<StockItemGroups />} />
          <Route path="/masters/ledger-groups" element={<LedgerGroups />} />
          <Route path="/masters/stock-convert" element={<StockConvert />} />
          {/* Vouchers */}
          <Route path="/vouchers/sales" element={<RouteGuard element={<SalesVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="sales" />} />
          <Route path="/vouchers/delivery-note-voucher" element={<RouteGuard element={<DeliveryNoteVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="delivery_note" />} />
          <Route path="/vouchers/sales-order" element={<RouteGuard element={<SalesOrderVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="sales_order" />} />
          <Route path="/vouchers/purchase" element={<RouteGuard element={<PurchaseVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="purchase" />} />
          <Route path="/vouchers/payment" element={<RouteGuard element={<PaymentVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="payment" />} />
          <Route path="/vouchers/receipt" element={<RouteGuard element={<ReceiptVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="receipt" />} />
          <Route path="/vouchers/quotation" element={<RouteGuard element={<QuotationVoucher />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="quotation" />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/sales-register" element={<RouteGuard element={<SalesRegister />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="sales" />} />
          <Route path="/reports/purchase-register" element={<RouteGuard element={<PurchaseRegister />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="purchase" />} />
          <Route path="/reports/quotation-register" element={<RouteGuard element={<QuotationRegister />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="quotation" />} />
          <Route path="/reports/sales-order-register" element={<RouteGuard element={<SalesOrderRegister />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="sales_order" />} />
          <Route path="/reports/delivery-note-register" element={<RouteGuard element={<DeliveryNoteRegister />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="delivery_note" />} />
          <Route path="/reports/receivables" element={<RouteGuard element={<Receivables />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="receipt" />} />
          <Route path="/reports/payables" element={<RouteGuard element={<Payables />} isAuthenticated={isAuthenticated} isLoading={isUserLoading} currentUser={currentUser} moduleKey="payment" />} />
          <Route path="/reports/outstanding" element={<Outstanding />} />
          <Route path="/reports/movement" element={<MovementAnalysis />} />
          <Route path="/reports/summary" element={<StockSummary />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
