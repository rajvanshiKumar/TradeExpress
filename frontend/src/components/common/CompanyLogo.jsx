/** Generated monogram used as the logo of each company. */
export default function CompanyLogo({ company, size = 'md', className = '' }) {
  const sizes = { sm: 'size-9 text-xs rounded-lg', md: 'size-12 text-sm rounded-xl', lg: 'size-16 text-lg rounded-2xl', xl: 'size-20 text-xl rounded-2xl' };
  return (
    <span
      aria-hidden="true" style={{ backgroundColor: company?.color ?? '#123F25' }}
      className={`inline-flex shrink-0 items-center justify-center font-display font-extrabold tracking-wide text-white ${sizes[size]} ${className}`}
    >
      {company?.initials ?? 'TS'}
    </span>
  );
}
