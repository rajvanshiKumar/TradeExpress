import { Building2, ShieldAlert, Clock } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Skeleton';
import useAuth from '../../hooks/useAuth';
import useSupplierCompany from './useSupplierCompany';

/**
 * Shows loading / missing-company / auth guard states, otherwise renders children(company, products).
 * Handles direct navigation, page refresh, expired sessions, non-supplier roles, and missing profiles.
 */
export default function SupplierGuard({ children, requireVerified = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const { company, companyProducts, loading } = useSupplierCompany();

  if (loading) {
    return (
      <div className="ts-card">
        <TableSkeleton />
      </div>
    );
  }

  // 1. Unauthenticated or expired session -> redirect to login preserving destination route
  if (!user) {
    return <Navigate to="/login" state={{ from: location?.pathname || '/supplier' }} replace />;
  }

  // 2. Suspended account
  if (user.status === 'Suspended' || user.isActive === false) {
    return (
      <div className="ts-card">
        <EmptyState
          icon={ShieldAlert}
          headingLevel={1}
          title="Account Suspended"
          text="Your supplier account is suspended. Please contact TradeExpress support for assistance."
          action={<Button to="/help" variant="outline">Contact Support</Button>}
        />
      </div>
    );
  }

  // 3. Unauthorized role (e.g. buyer attempting supplier access)
  const userRole = user.role?.toLowerCase();
  if (userRole !== 'supplier' && userRole !== 'admin' && userRole !== 'super_admin') {
    return (
      <div className="ts-card">
        <EmptyState
          icon={ShieldAlert}
          headingLevel={1}
          title="Supplier Access Required"
          text="This area is reserved for TradeExpress suppliers. You are currently signed in as a buyer."
          action={<Button to="/buyer" variant="navy">Return to Buyer Dashboard</Button>}
        />
      </div>
    );
  }

  // 4. Missing supplier profile
  if (!company) {
    return (
      <div className="ts-card">
        <EmptyState
          icon={Building2}
          headingLevel={1}
          title="Supplier Profile Setup Required"
          text="Your supplier account is active, but your business profile details are missing. Please complete your business profile to start managing products."
          action={<Button to="/supplier/profile" variant="emerald">Complete Business Profile</Button>}
        />
      </div>
    );
  }

  // 5. Verification checks if rejected or if explicit verification required
  const kycStatus = (company.kycStatus || user.kycStatus || '').toUpperCase();
  if (kycStatus === 'REJECTED') {
    return (
      <div className="ts-card">
        <EmptyState
          icon={ShieldAlert}
          headingLevel={1}
          title="Supplier Verification Rejected"
          text={`Your business verification was not approved. ${company.kycRejectionReason ? `Reason: ${company.kycRejectionReason}. ` : ''}Please review and update your verification documents.`}
          action={<Button to="/supplier/verification" variant="emerald">Review Verification</Button>}
        />
      </div>
    );
  }

  if (requireVerified && (kycStatus === 'PENDING' || kycStatus === 'NOT_SUBMITTED') && !company.isVerified) {
    return (
      <div className="ts-card">
        <EmptyState
          icon={Clock}
          headingLevel={1}
          title="Verification Required"
          text="Your supplier verification is pending review. Please verify your business details to unlock all marketplace privileges."
          action={<Button to="/supplier/verification" variant="emerald">Check Verification Status</Button>}
        />
      </div>
    );
  }

  return typeof children === 'function' ? children(company, companyProducts) : children;
}
