import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { AccountAvatar, AccountCard, DetailRow } from './AccountUi';
import { removeAccountAvatar, updateAccountProfile, uploadAccountAvatar } from '../../services/accountApi';

/** My Profile: name, photo and (for buyers) company and city. Email and phone change only through verified flows. */
export default function AccountProfileSection({ settings, role, onUpdated }) {
  const { profile } = settings;
  const [values, setValues] = useState({ name: profile.name || '', company: profile.company || '', city: profile.city || '' });
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  const set = (field) => (event) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
    setMessage(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    const name = values.name.replace(/\s+/g, ' ').trim();
    if (name.length < 2) {
      setMessage({ type: 'error', text: 'Full name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const changes = { name };
      if (role === 'buyer') changes.company = values.company;
      if (role !== 'super_admin') changes.city = values.city;
      const updated = await updateAccountProfile(changes);
      onUpdated(updated);
      setMessage({ type: 'success', text: 'Your profile has been updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Your profile could not be updated.' });
    } finally {
      setSaving(false);
    }
  };

  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || photoBusy) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Profile photos must be 2 MB or smaller.' });
      return;
    }
    setPhotoBusy(true);
    setMessage(null);
    try {
      onUpdated(await uploadAccountAvatar(file));
      setMessage({ type: 'success', text: 'Your profile photo has been updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'The photo could not be uploaded.' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      onUpdated(await removeAccountAvatar());
      setMessage({ type: 'success', text: 'Your profile photo has been removed.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'The photo could not be removed.' });
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {message ? (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'bg-danger-50 text-danger' : 'bg-success-50 text-success'}`}>
          {message.text}
        </p>
      ) : null}

      <AccountCard title="Profile photo" description="PNG, JPG or WEBP, up to 2 MB.">
        <div className="flex flex-wrap items-center gap-4">
          <AccountAvatar name={profile.name} avatarUrl={profile.avatarUrl} />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={choosePhoto} aria-label="Choose a profile photo" />
            <Button variant="outline" size="sm" icon={Camera} loading={photoBusy} onClick={() => fileRef.current?.click()}>
              {profile.avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {profile.avatarUrl ? (
              <Button variant="ghost" size="sm" icon={Trash2} disabled={photoBusy} onClick={removePhoto}>Remove</Button>
            ) : null}
          </div>
        </div>
      </AccountCard>

      <AccountCard title="Personal details">
        <form onSubmit={save} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="account-name" label="Full name" required autoComplete="name" value={values.name} onChange={set('name')} maxLength={80} wrapperClassName="sm:col-span-2" />
          {role === 'buyer' ? (
            <Input id="account-company" label="Business name (optional)" autoComplete="organization" value={values.company} onChange={set('company')} maxLength={120} />
          ) : null}
          {role !== 'super_admin' ? (
            <Input id="account-city" label="City (optional)" autoComplete="address-level2" value={values.city} onChange={set('city')} maxLength={80} />
          ) : null}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={saving}>Save changes</Button>
          </div>
        </form>
      </AccountCard>

      <AccountCard title="Contact details" description="Your email and phone number are changed through verified steps to keep your account safe.">
        <dl>
          <DetailRow label="Email address">{profile.maskedEmail}</DetailRow>
          <DetailRow label="Phone number">{profile.maskedPhone || null}</DetailRow>
          {role === 'supplier' ? <DetailRow label="Company name">{profile.company ? `${profile.company} (managed in Business Verification)` : null}</DetailRow> : null}
        </dl>
      </AccountCard>
    </div>
  );
}
