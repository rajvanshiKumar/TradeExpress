const GENDER = { M: 'Male', F: 'Female', T: 'Transgender' };

/**
 * The Aadhaar holder's own details returned by UIDAI right after a successful OTP verification
 * (photo, name, date of birth, gender, care-of). Shown only to the person who verified; never stored in the browser.
 */
export default function AadhaarHolderCard({ holder }) {
  if (!holder || (!holder.photo && !holder.fullName)) return null;
  const rows = [
    ['Date of birth', holder.dateOfBirth],
    ['Gender', GENDER[holder.gender] || holder.gender],
    ['Care of', holder.careOf],
  ].filter(([, value]) => value);
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
      {holder.photo ? (
        <img
          src={holder.photo}
          alt={`Aadhaar photo of ${holder.fullName || 'the holder'}`}
          className="h-[72px] w-[60px] shrink-0 rounded-lg border border-emerald-200 bg-white object-cover"
        />
      ) : null}
      <div className="min-w-0 text-xs">
        {holder.fullName ? <p className="truncate font-bold text-slate-900">{holder.fullName}</p> : null}
        {rows.map(([label, value]) => (
          <p key={label} className="truncate text-slate-600">
            <span className="text-slate-500">{label}:</span> {value}
          </p>
        ))}
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">As per Aadhaar (UIDAI)</p>
      </div>
    </div>
  );
}
