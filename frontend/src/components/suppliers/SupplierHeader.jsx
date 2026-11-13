import { Clock, MapPin, Users } from 'lucide-react';
import Image from '../common/Image';
import CompanyLogo from '../common/CompanyLogo';
import VerificationBadge from '../common/VerificationBadge';
import { SaveSupplierButton } from './SupplierCard';

/** Cover image and identity block at the top of a supplier profile. */
export default function SupplierHeader({ company, productCount }) {
  return (
    <section className="ts-card overflow-hidden">
      <div className="relative h-36 bg-navy-900 sm:h-52">
        <Image photo={company.cover} illustration={company.coverIllustration ?? 'cover-default'} width={1600} height={480} eager alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 to-transparent" aria-hidden="true" />
        <div className="absolute right-3 top-3 flex items-center gap-2"><VerificationBadge company={company} size="md" className="bg-white/95" /><SaveSupplierButton company={company} /></div>
      </div>
      <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
        <div className="-mt-9 flex flex-wrap items-end gap-4">
          <CompanyLogo company={company} size="xl" className="ring-4 ring-white" />
          <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:pt-10">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{company.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{company.flag} {company.city}, {company.country}</span>
              <span>{company.businessType}</span>
              <span>{company.industry}</span>
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-5 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Established</dt><dd className="mt-1 font-semibold text-ink">{company.established}</dd></div>
          <div><dt className="flex items-center gap-1 text-muted"><Users className="size-3.5" aria-hidden="true" />Employees</dt><dd className="mt-1 font-semibold text-ink">{company.employees}</dd></div>
          <div><dt className="flex items-center gap-1 text-muted"><Clock className="size-3.5" aria-hidden="true" />Response time</dt><dd className="mt-1 font-semibold text-ink">{company.responseTime}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">{productCount} products listed. Response times and company details are self-reported and not independently verified.</p>
      </div>
    </section>
  );
}
