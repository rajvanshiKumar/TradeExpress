import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bookmark, Clock, MapPin, MessageSquare } from 'lucide-react';
import Button from '../common/Button';
import Image from '../common/Image';
import CompanyLogo from '../common/CompanyLogo';
import Rating from '../common/Rating';
import VerificationBadge from '../common/VerificationBadge';
import useProducts from '../../hooks/useProducts';
import useWishlist from '../../hooks/useWishlist';
import useAuth from '../../hooks/useAuth';
import useContactSupplier from '../../hooks/useContactSupplier';

export function SaveSupplierButton({ company, className = '' }) {
  const { isSupplierSaved, toggleSupplier } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = user ? isSupplierSaved(company.id) : false;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toggleSupplier(company);
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    toggleSupplier(company);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${company.name} from saved suppliers` : `Save ${company.name}`}
      title={user ? (saved ? 'Remove from saved suppliers' : 'Save supplier') : 'Log in to save supplier'}
      className={`inline-flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-navy-900/5 backdrop-blur transition-all hover:scale-105 hover:ring-brand-500 ${saved ? 'text-brand-600' : 'text-navy-900'} ${className}`}
    >
      <Bookmark className={`size-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}

export default function SupplierCard({ company }) {
  const { products } = useProducts();
  const contact = useContactSupplier();
  const navigate = useNavigate();
  const listed = products.filter((product) => product.companyId === company.id && product.status === 'Active');
  const href = `/suppliers/${company.slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card ring-1 ring-navy-900/[0.06] transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-brand-500/40">
      <div className="relative h-28 overflow-hidden bg-navy-900">
        <Image photo={company.cover} illustration={company.coverIllustration ?? 'cover-default'} width={720} height={240} alt="" className="size-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 to-transparent" aria-hidden="true" />
        <SaveSupplierButton company={company} className="absolute right-3 top-3" />
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-7 flex items-end gap-3">
          <CompanyLogo company={company} size="lg" className="ring-4 ring-white" />
          <div className="mb-1 min-w-0"><VerificationBadge company={company} /></div>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold leading-snug"><Link to={href} className="hover:text-brand-600">{company.name}</Link></h3>
        <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{company.flag} {company.city ? `${company.city}, ` : ''}{company.country}</p>
        <div className="mt-2"><Rating value={company.rating} count={company.reviewCount} /></div>

        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-ivory p-3 text-center text-[0.75rem]">
          <div><dt className="text-muted">Type</dt><dd className="mt-0.5 truncate font-semibold text-navy-900">{company.businessType}</dd></div>
          <div className="border-x border-navy-900/[0.08]"><dt className="text-muted">Since</dt><dd className="mt-0.5 font-semibold text-navy-900">{company.established}</dd></div>
          <div><dt className="text-muted">Products</dt><dd className="mt-0.5 font-semibold text-navy-900">{listed.length}</dd></div>
        </dl>

        {listed.length ? (
          <ul className="mt-4 flex gap-2" aria-label={`Products from ${company.name}`}>
            {listed.slice(0, 4).map((product) => (
              <li key={product.id} className="min-w-0 flex-1">
                <Link to={`/products/${product.slug}`} title={product.name} className="block overflow-hidden rounded-xl bg-ivory ring-1 ring-navy-900/5">
                  <Image photo={product.photo} illustration={product.illustration} width={180} height={180} alt={product.name} className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-105" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" aria-hidden="true" />Typical response: {company.responseTime}</p>

        <div className="mt-auto flex flex-col gap-2 pt-4 xs:flex-row">
          <Button variant="navy" size="sm" className="flex-1" onClick={() => navigate(href)}>View Company</Button>
          <Button variant="outline" size="sm" icon={MessageSquare} className="flex-1" onClick={() => contact(company)}>Contact Supplier</Button>
        </div>
      </div>
    </article>
  );
}
