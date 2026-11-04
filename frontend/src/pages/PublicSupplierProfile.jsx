import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, CalendarDays, Mail, MapPin, MessageSquare, Package, Phone, UserRound } from 'lucide-react';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Image from '../components/common/Image';
import { PageSkeleton } from '../components/common/Skeleton';
import { VerificationBadge } from '../components/suppliers/SupplierDocumentParts';
import useContactSupplier from '../hooks/useContactSupplier';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getPublicSupplier, publicAssetUrl } from '../services/supplierDocumentApi';
import formatCurrency from '../utils/formatCurrency';

const STATUS_PANEL = {
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-900',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-900',
  SUSPENDED: 'border-slate-300 bg-slate-100 text-slate-800',
};

/** The page a supplier's QR code opens. Shows only permitted business information. */
export default function PublicSupplierProfile() {
  const { supplierCode } = useParams();
  const contact = useContactSupplier();
  const [state, setState] = useState({ loading: true, profile: null, error: '', notFound: false });
  const [category, setCategory] = useState('');
  useDocumentTitle(state.profile?.businessName || 'Supplier profile');

  const load = useCallback(async () => {
    setState({ loading: true, profile: null, error: '', notFound: false });
    try {
      setState({ loading: false, profile: await getPublicSupplier(supplierCode), error: '', notFound: false });
    } catch (error) {
      setState({ loading: false, profile: null, error: error.message, notFound: error.status === 404 });
    }
  }, [supplierCode]);

  useEffect(() => {
    load();
  }, [load]);

  const { profile } = state;
  const visibleProducts = useMemo(
    () => (profile?.products || []).filter((product) => !category || product.categorySlug === category),
    [profile, category],
  );

  if (state.loading) return <PageSkeleton />;
  if (state.notFound) {
    return (
      <div className="ts-container py-12">
        <div className="ts-card">
          <EmptyState
            icon={Building2}
            headingLevel={1}
            title="Supplier not found"
            text="This QR code or link does not match a TradeExpress supplier. Please check it with the supplier."
            action={<Button to="/suppliers" variant="navy">Browse suppliers</Button>}
          />
        </div>
      </div>
    );
  }
  if (state.error) return <div className="ts-container py-12"><div className="ts-card"><ErrorState text={state.error} onRetry={load} /></div></div>;

  const contactSupplier = () => contact({ id: null, supplierId: profile.contactId, name: profile.businessName });
  const details = [
    { icon: MapPin, label: 'Location', value: profile.location },
    { icon: Building2, label: 'Business type', value: profile.businessType },
    { icon: CalendarDays, label: 'Established', value: profile.yearEstablished },
    { icon: MapPin, label: 'Business address', value: profile.businessAddress },
    { icon: Phone, label: 'Business phone', value: profile.businessPhone },
    { icon: Mail, label: 'Business email', value: profile.businessEmail },
  ].filter((row) => row.value);

  return (
    <div className="ts-container space-y-6 py-6 sm:py-8">
      <section className="ts-card p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-emerald-700 bg-slate-50">
              {profile.photoUrl
                ? <img src={publicAssetUrl(profile.photoUrl)} alt={`Representative of ${profile.businessName}`} className="h-full w-full object-cover" />
                : <UserRound className="size-9 text-slate-300" aria-hidden="true" />}
            </div>
            {profile.logoUrl ? <Image src={profile.logoUrl} alt={`${profile.businessName} logo`} className="size-16 rounded-xl border border-slate-200 object-contain" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-navy-900 [overflow-wrap:anywhere] sm:text-3xl">{profile.businessName}</h1>
              <VerificationBadge status={profile.verificationStatus} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600">Supplier ID: <span className="font-semibold text-slate-900">{profile.supplierId}</span></p>
            {profile.description ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">{profile.description}</p> : null}
            {profile.canContact ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {profile.productCount > 0 ? <a href="#supplier-products" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy-900 px-5 text-sm font-semibold text-white hover:bg-navy-800"><Package className="size-4" aria-hidden="true" />View Products</a> : null}
                <Button type="button" variant="outline" icon={MessageSquare} onClick={contactSupplier}>Contact Supplier</Button>
              </div>
            ) : null}
          </div>
        </div>
        <p className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${STATUS_PANEL[profile.verificationStatus]}`} role="status">
          {profile.statusMessage}
        </p>
        {details.length ? (
          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Icon className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {profile.canContact ? (
        <section id="supplier-products" aria-labelledby="supplier-products-heading" className="scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="supplier-products-heading" className="text-xl font-bold text-navy-900">
              Listed Products <span className="text-sm font-medium text-slate-500">({profile.productCount})</span>
            </h2>
          </div>
          {profile.categories.length ? (
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {[{ slug: '', name: 'All categories' }, ...profile.categories].map((item) => (
                <button
                  key={item.slug || 'all'}
                  type="button"
                  aria-pressed={category === item.slug}
                  onClick={() => setCategory(item.slug)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${category === item.slug ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-800 ring-slate-200 hover:ring-navy-900/40'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
          {visibleProducts.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <Link key={product.id} to={`/products/${product.slug}`} className="ts-card group overflow-hidden transition hover:-translate-y-0.5">
                  <Image photo={product.photo} category={product.categorySlug} width={480} height={360} alt={product.name} className="aspect-[4/3] w-full object-cover" />
                  <div className="p-3">
                    {product.categoryName ? <p className="text-[11px] font-medium text-slate-500">{product.categoryName}</p> : null}
                    <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-navy-900 group-hover:underline">{product.name}</h3>
                    <p className="mt-1 text-sm font-bold text-emerald-800">{formatCurrency(product.price)} <span className="text-xs font-medium text-slate-500">/ {product.unit}</span></p>
                    <p className="text-xs text-slate-500">MOQ {product.moq} {product.unit}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="ts-card"><EmptyState icon={Package} title="No products listed yet" text="This supplier has not listed any products so far." /></div>
          )}
        </section>
      ) : null}
    </div>
  );
}
