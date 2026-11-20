/* Social media links a buyer adds at signup. The server checks them again; this only gives instant feedback. */

export const MAX_SOCIAL_LINKS = 10;

const PLATFORMS = [
  ['instagram.com', 'Instagram'], ['facebook.com', 'Facebook'], ['fb.com', 'Facebook'], ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'], ['linkedin.com', 'LinkedIn'], ['x.com', 'X'], ['twitter.com', 'X'], ['wa.me', 'WhatsApp'],
  ['whatsapp.com', 'WhatsApp'], ['t.me', 'Telegram'], ['pinterest.com', 'Pinterest'], ['indiamart.com', 'IndiaMART'],
  ['justdial.com', 'Justdial'], ['google.com', 'Google'], ['g.page', 'Google'],
];

export function socialPlatform(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  const match = PLATFORMS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return match ? match[1] : 'Website';
}

/** { url, platform } for a typed link (https:// is added when missing), or null when it is not a valid web link. */
export function parseSocialLink(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.href.length > 500) return null;
    return { url: url.href, platform: socialPlatform(url.hostname) };
  } catch {
    return null;
  }
}
