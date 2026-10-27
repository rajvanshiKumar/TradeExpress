import { Building2 } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Skeleton';
import useSupplierCompany from './useSupplierCompany';

/** Shows loading / missing-company states, otherwise renders children(company, products). */
export default function SupplierGuard({ children }) {
  const { company, companyProducts, loading } = useSupplierCompany();
  if (loading) return <div className="ts-card"><TableSkeleton /></div>;
  if (!company) {
    return (
      <div className="ts-card">
        <EmptyState icon={Building2} headingLevel={1} title="No company profile found" text="This supplier account is not linked to a company in this browser. Reset the sample data or register a new supplier account." action={<Button to="/register?role=supplier" variant="navy">Register a supplier</Button>} />
      </div>
    );
  }
  return children(company, companyProducts);
}
