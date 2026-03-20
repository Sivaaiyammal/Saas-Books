
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
import { getAuthToken, clearTokens } from './services/api';
import SalesOrderVoucher from "./pages/SalesOrderVoucher";
import SalesOrderRegister from "./pages/reports/SalesOrderRegister";
import DeliveryNoteVoucher from "./pages/DeliveryNoteVoucher";
import DeliveryNoteRegister from "./pages/reports/DeliveryNoteRegister";
import Profile from "./pages/Profile";

const App: React.FC = () => {
  // Check for existing token on initialization
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    clearTokens();
    setIsAuthenticated(false);
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register onLogin={handleLogin} /> : <Navigate to="/" />} />

        {/* Protected Routes */}
        <Route element={isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
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
          <Route path="/vouchers/sales" element={<SalesVoucher />} />
          <Route path="/vouchers/delivery-note-voucher" element={<DeliveryNoteVoucher />} />
          <Route path="/vouchers/sales-order" element={<SalesOrderVoucher />} />
          <Route path="/vouchers/purchase" element={<PurchaseVoucher />} />
          <Route path="/vouchers/payment" element={<PaymentVoucher />} />
          <Route path="/vouchers/receipt" element={<ReceiptVoucher />} />
          <Route path="/vouchers/quotation" element={<QuotationVoucher />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/sales-register" element={<SalesRegister />} />
          <Route path="/reports/purchase-register" element={<PurchaseRegister />} />
          <Route path="/reports/quotation-register" element={<QuotationRegister />} />
          <Route path="/reports/sales-order-register" element={<SalesOrderRegister />} />
          <Route path="/reports/delivery-note-register" element={<DeliveryNoteRegister />} />
          <Route path="/reports/receivables" element={<Receivables />} />
          <Route path="/reports/payables" element={<Payables />} />
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
