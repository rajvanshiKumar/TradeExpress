import { Building2 } from 'lucide-react';
import SupplierCard from './SupplierCard';
import EmptyState from '../common/EmptyState';
import Skeleton from '../common/Skeleton';

const GRID = 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3';

export default function SupplierGrid({ companies, loading = false, columns = GRID, emptyAction }) {
  if (loading && !companies?.length) {
    return (
      <div className={columns} role="status" aria-label="Loading suppliers">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="ts-card space-y-3 p-5" aria-hidden="true">
            <div className="flex gap-3"><Skeleton className="size-16 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!companies.length) return <div className="ts-card"><EmptyState icon={Building2} title="No suppliers found" text="Try a different search or remove some filters." action={emptyAction} /></div>;
  return <div className={columns}>{companies.map((company) => <SupplierCard key={company.id} company={company} />)}</div>;
}
