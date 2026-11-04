import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import CustomSelect from '../common/CustomSelect';
import { transportApi, uploadTransportFile } from '../../api/transportApi';
import { FormError, FormField, num, toLocalInput } from './transportUi';

/**
 * One form for every shipment step. `action.fields` describes the inputs; the modal builds the request body and
 * calls `action.submit(body)`. Field types: text, number, datetime, textarea, select, vehicle, driver,
 * loadingItems, deliveryItems, file, otp.
 */
export default function ShipmentActionModal({ action, shipment, viewerRole, onClose, onDone }) {
  const [values, setValues] = useState({});
  const [fleet, setFleet] = useState({ vehicles: [], drivers: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fields = useMemo(() => action?.fields || [], [action]);
  const needsFleet = fields.some((f) => f.type === 'vehicle' || f.type === 'driver');

  useEffect(() => {
    if (!action) return;
    const initial = {};
    for (const f of fields) {
      if (f.default !== undefined) initial[f.name] = f.type === 'datetime' ? toLocalInput(f.default) : f.default;
      if (f.type === 'loadingItems') initial[f.name] = Object.fromEntries((shipment?.items || []).map((i) => [i.id, i.quantity]));
      if (f.type === 'deliveryItems') initial[f.name] = Object.fromEntries((shipment?.items || []).map((i) => [i.id, { received: i.loadedQuantity ?? i.quantity, damaged: 0 }]));
    }
    setValues(initial);
    setError('');
  }, [action, fields, shipment]);

  useEffect(() => {
    if (!action || !needsFleet) return;
    let alive = true;
    Promise.all([transportApi.vehicles(), transportApi.drivers()])
      .then(([vehicles, drivers]) => { if (alive) setFleet({ vehicles: vehicles || [], drivers: drivers || [] }); })
      .catch((err) => { if (alive) setError(err.message || 'Could not load trucks and drivers.'); });
    return () => { alive = false; };
  }, [action, needsFleet]);

  if (!action) return null;
  const set = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const buildBody = () => {
    const body = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === 'datetime') body[f.name] = v ? new Date(v).toISOString() : undefined;
      else if (f.type === 'loadingItems') body.items = Object.entries(v || {}).map(([shipmentItemId, loadedQuantity]) => ({ shipmentItemId, loadedQuantity: Number(loadedQuantity) }));
      else if (f.type === 'deliveryItems') body.items = Object.entries(v || {}).map(([shipmentItemId, row]) => ({ shipmentItemId, receivedQuantity: Number(row.received), damagedQuantity: Number(row.damaged || 0) }));
      else if (f.type === 'file') {
        if (v?.url) {
          if (f.as === 'documents') body.documents = [{ fileUrl: v.url, fileName: v.name, title: f.docTitle || 'Document', docType: f.docType || 'OTHER' }];
          else if (f.as === 'photoUrls') body.photoUrls = [v.url];
          else { body.fileUrl = v.url; body.fileName = v.name; }
        }
      } else body[f.name] = v;
    }
    return body;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || uploading) return;
    for (const f of fields) {
      if (f.required && (values[f.name] === undefined || values[f.name] === '' || values[f.name] === null)) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const result = await action.submit(buildBody());
      onDone?.(result, action);
    } catch (err) {
      setError(err.message || 'This step could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (name, file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadTransportFile(file);
      if (!url) throw new Error('Upload failed.');
      set(name, { url, name: file.name });
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const vehicleOptions = fleet.vehicles.map((v) => ({
    value: v.id,
    label: `${v.vehicleNumber} · ${v.vehicleType.replace(/_/g, ' ').toLowerCase()} · ${num(v.capacityKg)} kg`,
    description: v.problems?.length ? `Not usable: ${v.problems[0]}` : `${v.provider?.name || ''} · ${v.status.toLowerCase()}`,
  }));
  const driverOptions = fleet.drivers.map((d) => ({
    value: d.id,
    label: `${d.name} · ${d.phone}`,
    description: d.problems?.length ? `Not usable: ${d.problems[0]}` : `${d.licenseType?.replace(/_/g, ' ').toLowerCase()} · ${d.verificationStatus.toLowerCase()} · ${d.status.toLowerCase().replace('_', ' ')}`,
  }));

  const renderField = (f) => {
    const id = `ship-${action.key}-${f.name}`;
    const common = { id, className: 'ts-input', value: values[f.name] ?? '', onChange: (e) => set(f.name, e.target.value), required: f.required };
    switch (f.type) {
      case 'textarea':
        return <textarea {...common} rows={3} maxLength={f.max || 1000} placeholder={f.placeholder} />;
      case 'number':
        return <input {...common} type="number" min={f.min ?? 0} max={f.maxValue} step={f.step || 'any'} placeholder={f.placeholder} />;
      case 'datetime':
        return <input {...common} type="datetime-local" />;
      case 'date':
        return <input {...common} type="date" />;
      case 'otp':
        return <input {...common} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="6-digit code" onChange={(e) => set(f.name, e.target.value.replace(/\D/g, '').slice(0, 6))} className="ts-input font-mono text-lg tracking-[0.4em]" />;
      case 'select':
        return <CustomSelect id={id} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} options={f.options} placeholder={f.placeholder || 'Choose'} searchable={false} />;
      case 'vehicle':
        return <CustomSelect id={id} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} options={vehicleOptions} placeholder={fleet.vehicles.length ? 'Choose a truck' : 'No trucks registered yet'} />;
      case 'driver':
        return <CustomSelect id={id} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} options={driverOptions} placeholder={fleet.drivers.length ? 'Choose a driver' : 'No drivers registered yet'} />;
      case 'file':
        return (
          <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:bg-surface">
            <Upload className="size-4" />
            <span className="truncate">{uploading ? 'Uploading…' : values[f.name]?.name || 'Choose a file (PDF or image)'}</span>
            <input id={id} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => upload(f.name, e.target.files?.[0])} />
          </label>
        );
      case 'loadingItems':
        return (
          <div className="space-y-2">
            {(shipment?.items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{item.productName} <span className="text-muted">(planned {num(item.quantity)} {item.unit})</span></span>
                <input type="number" min={0} max={item.quantity} aria-label={`Loaded quantity for ${item.productName}`} className="ts-input w-28 text-right" value={values[f.name]?.[item.id] ?? ''} onChange={(e) => set(f.name, { ...values[f.name], [item.id]: e.target.value })} />
              </div>
            ))}
          </div>
        );
      case 'deliveryItems':
        return (
          <div className="space-y-2">
            {(shipment?.items || []).map((item) => {
              const row = values[f.name]?.[item.id] || {};
              const shipped = item.loadedQuantity ?? item.quantity;
              const missing = Math.max(0, shipped - Number(row.received || 0) - Number(row.damaged || 0));
              const setRow = (patch) => set(f.name, { ...values[f.name], [item.id]: { ...row, ...patch } });
              return (
                <div key={item.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <p className="font-semibold">{item.productName} <span className="font-normal text-muted">· shipped {num(shipped)} {item.unit}</span></p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[12px] text-muted">Received good<input type="number" min={0} max={shipped} className="ts-input mt-1" value={row.received ?? ''} onChange={(e) => setRow({ received: e.target.value })} /></label>
                    <label className="text-[12px] text-muted">Damaged<input type="number" min={0} max={shipped} className="ts-input mt-1" value={row.damaged ?? ''} onChange={(e) => setRow({ damaged: e.target.value })} /></label>
                    <div className="text-[12px] text-muted">Missing<p className={`mt-1 rounded-xl px-3 py-2 font-bold ${missing ? 'bg-rose-50 text-rose-700' : 'bg-surface text-ink'}`}>{missing}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      default:
        return <input {...common} type="text" maxLength={f.max || 200} placeholder={f.placeholder} />;
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={action.title || action.label} description={action.description} size={action.size || 'md'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {action.intro ? <div className="rounded-xl bg-surface px-3 py-2.5 text-sm text-muted">{action.intro}</div> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <FormField key={f.name} id={`ship-${action.key}-${f.name}`} label={f.label} required={f.required} hint={f.hint} className={f.half ? '' : 'sm:col-span-2'}>
              {renderField(f)}
            </FormField>
          ))}
        </div>
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={action.danger ? 'danger' : 'primary'} loading={busy} disabled={busy || uploading}>{action.confirmLabel || action.label}</Button>
        </div>
        {viewerRole === 'BUYER' && action.key === 'confirm-delivery' ? <p className="text-[12px] text-muted">Only confirm after checking the goods. The code was emailed to you when the truck arrived.</p> : null}
      </form>
    </Modal>
  );
}
