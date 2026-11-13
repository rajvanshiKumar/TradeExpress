import { useState } from 'react';

/**
 * A country's flag as a small image: Windows shows flag emoji as letters, so an image is the only way every buyer sees
 * the flag. If the image cannot load, the country code is shown instead.
 */
export default function CountryFlag({ code, className = '' }) {
  const [failed, setFailed] = useState(false);
  const lower = String(code || '').toLowerCase();
  if (!lower || failed) {
    return (
      <span className={`inline-flex h-3.5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-navy-100 text-[0.5625rem] font-bold text-navy-900 ${className}`} aria-hidden="true">
        {String(code || '').toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${lower}.png`}
      srcSet={`https://flagcdn.com/w80/${lower}.png 2x`}
      width="20"
      height="15"
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`h-3.5 w-5 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.08)] ${className}`}
    />
  );
}
