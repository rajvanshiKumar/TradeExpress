import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, History, Pencil, Plus, Search, ShieldCheck, Truck, UserRound, Wrench } from 'lucide-react';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import Modal from '../common/Modal';
import { TableSkeleton } from '../common/Skeleton';
import useNotifications from '../../hooks/useNotifications';
import { transportApi } from '../../api/transportApi';
import ShipmentActionModal from './ShipmentActionModal';
import { ShipmentStatus, humanize, num, when } from './transportUi';

const VEHICLE_TYPE_OPTIONS = ['MINI_TRUCK', 'LCV', 'OPEN_TRUCK', 'CLOSED_TRUCK', 'CONTAINER_20FT', 'CONTAINER_32FT', 'TRAILER', 'FLATBED', 'REEFER', 'TANKER'].map((v) => ({ value: v, label: humanize(v) }));
const BODY_OPTIONS = ['OPEN', 'CLOSED', 'CONTAINER', 'FLATBED', 'REEFER', 'TANKER'].map((v) => ({ value: v, label: humanize(v) }));
const LICENCE_OPTIONS = [
  { value: 'LMV', label: 'LMV (light motor vehicle)' },
  { value: 'TRANSPORT_LMV', label: 'Transport LMV' },
  { value: 'COMMERCIAL_HEAVY', label: 'Heavy goods vehicle (HGV / HTV)' },
  { value: 'HAZARDOUS', label: 'Hazardous goods' },
  { value: 'ODC', label: 'Over-dimensional cargo' },
];
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const STATUS_TONE = {
  AVAILABLE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ASSIGNED: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  IN_TRANSIT: 'bg-sky-50 text-sky-800 ring-sky-200',
  ON_DUTY: 'bg-sky-50 text-sky-800 ring-sky-200',
  MAINTENANCE: 'bg-amber-50 text-amber-900 ring-amber-200',
  ON_LEAVE: 'bg-amber-50 text-amber-900 ring-amber-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const Pill = ({ value }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_TONE[value] || STATUS_TONE.INACTIVE}`}>{humanize(value)}</span>;

function vehicleForm(vehicle, providers) {
  return {
    key: 'vehicle',
    label: vehicle ? 'Save truck' : 'Register truck',
    title: vehicle ? `Edit ${vehicle.vehicleNumber}` : 'Register a truck',
    size: 'lg',
    fields: [
      ...(providers ? [{ name: 'providerId', label: 'Fleet / transport provider', type: 'select', options: providers.map((p) => ({ value: p.id, label: p.name, description: p.type === 'PLATFORM' ? 'TradeExpress-owned' : 'External transporter' })), half: true, default: vehicle?.provider?.id || providers.find((p) => p.type === 'PLATFORM')?.id }] : []),
      { name: 'vehicleNumber', label: 'Registration number', type: 'text', required: true, half: true, placeholder: 'MH 12 AB 1234', default: vehicle?.vehicleNumber },
      { name: 'vehicleType', label: 'Vehicle type', type: 'select', options: VEHICLE_TYPE_OPTIONS, required: true, half: true, default: vehicle?.vehicleType },
      { name: 'bodyType', label: 'Body type', type: 'select', options: BODY_OPTIONS, half: true, default: vehicle?.bodyType },
      { name: 'make', label: 'Manufacturer', type: 'text', half: true, placeholder: 'Tata, Ashok Leyland…', default: vehicle?.make },
      { name: 'model', label: 'Model', type: 'text', half: true, default: vehicle?.model },
      { name: 'capacityKg', label: 'Max permitted load (kg)', type: 'number', required: true, half: true, default: vehicle?.capacityKg },
      { name: 'cargoVolumeCbm', label: 'Cargo volume (m³)', type: 'number', half: true, default: vehicle?.cargoVolumeCbm },
      { name: 'cargoLengthM', label: 'Cargo length (m)', type: 'number', half: true, default: vehicle?.cargoLengthM },
      { name: 'ownershipType', label: 'Ownership', type: 'select', half: true, options: [{ value: 'OWNED', label: 'Owned' }, { value: 'LEASED', label: 'Leased' }, { value: 'HIRED', label: 'Hired' }], default: vehicle?.ownershipType || 'OWNED' },
      { name: 'ownerName', label: 'Registered owner', type: 'text', half: true, default: vehicle?.ownerName },
      { name: 'rcNumber', label: 'RC number', type: 'text', required: true, half: true, default: vehicle?.rcNumber },
      { name: 'rcExpiryDate', label: 'RC valid until', type: 'date', half: true, default: dateOnly(vehicle?.rcExpiryDate) },
      { name: 'insuranceNumber', label: 'Insurance policy number', type: 'text', required: true, half: true, default: vehicle?.insuranceNumber },
      { name: 'insuranceExpiryDate', label: 'Insurance expiry', type: 'date', required: true, half: true, default: dateOnly(vehicle?.insuranceExpiryDate) },
      { name: 'fitnessExpiryDate', label: 'Fitness certificate expiry', type: 'date', half: true, default: dateOnly(vehicle?.fitnessExpiryDate) },
      { name: 'pucExpiryDate', label: 'PUC expiry', type: 'date', half: true, default: dateOnly(vehicle?.pucExpiryDate) },
      { name: 'permitNumber', label: 'Permit number', type: 'text', half: true, default: vehicle?.permitNumber },
      { name: 'permitExpiryDate', label: 'Permit expiry', type: 'date', half: true, default: dateOnly(vehicle?.permitExpiryDate) },
      { name: 'operationalNotes', label: 'Operational notes', type: 'textarea', default: vehicle?.operationalNotes },
    ],
    submit: (body) => (vehicle ? transportApi.updateVehicle(vehicle.id, body) : transportApi.createVehicle(body)),
  };
}

function driverForm(driver, providers) {
  return {
    key: 'driver',
    label: driver ? 'Save driver' : 'Register driver',
    title: driver ? `Edit ${driver.name}` : 'Register a driver',
    size: 'lg',
    fields: [
      ...(providers ? [{ name: 'providerId', label: 'Fleet / transport provider', type: 'select', options: providers.map((p) => ({ value: p.id, label: p.name })), half: true, default: driver?.provider?.id || providers.find((p) => p.type === 'PLATFORM')?.id }] : []),
      { name: 'name', label: 'Full name', type: 'text', required: true, half: true, default: driver?.name },
      { name: 'phone', label: 'Mobile number', type: 'text', required: true, half: true, placeholder: '10-digit mobile', default: driver?.phone },
      { name: 'alternatePhone', label: 'Alternate mobile', type: 'text', half: true, default: driver?.alternatePhone },
      { name: 'licenseNumber', label: 'Driving licence number', type: 'text', required: true, half: true, placeholder: 'MH14 20110012345', default: driver?.licenseNumber?.includes('•') ? undefined : driver?.licenseNumber },
      { name: 'licenseType', label: 'Authorised vehicle class', type: 'select', options: LICENCE_OPTIONS, required: true, half: true, default: driver?.licenseType },
      { name: 'licenseExpiryDate', label: 'Licence expiry', type: 'date', required: true, half: true, default: dateOnly(driver?.licenseExpiryDate) },
      { name: 'experienceYears', label: 'Experience (years)', type: 'number', half: true, default: driver?.experienceYears },
      { name: 'status', label: 'Availability', type: 'select', half: true, options: [{ value: 'AVAILABLE', label: 'Available' }, { value: 'ON_LEAVE', label: 'On leave' }, { value: 'INACTIVE', label: 'Inactive' }], default: driver ? (['ASSIGNED', 'ON_DUTY'].includes(driver.status) ? undefined : driver.status) : 'AVAILABLE' },
      { name: 'emergencyContactName', label: 'Emergency contact name', type: 'text', half: true, default: driver?.emergencyContactName },
      { name: 'emergencyContactPhone', label: 'Emergency contact number', type: 'text', half: true, default: driver?.emergencyContactPhone },
    ],
    submit: (body) => {
      const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
      return driver ? transportApi.updateDriver(driver.id, clean) : transportApi.createDriver(clean);
    },
  };
}

/**
 * Trucks or drivers for the signed-in fleet. Suppliers manage their own; Super Admin manages the TradeExpress fleet
 * and external providers (and can verify documents).
 */
export default function FleetPanel({ kind = 'vehicles', admin = false }) {
  const { showToast } = useNotifications();
  const [rows, setRows] = useState([]);
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = kind === 'vehicles' ? await transportApi.vehicles({ search }) : await transportApi.drivers({ search });
      setRows(list || []);
      if (admin && !providers) setProviders(await transportApi.providers());
    } catch (err) {
      setError(err.message || 'Could not load the fleet.');
    } finally {
      setLoading(false);
    }
  }, [kind, search, admin, providers]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const done = (message) => {
    setForm(null);
    showToast(message, 'success');
    load();
  };

  const openHistory = async (vehicle) => {
    setHistory({ vehicle, rows: null });
    try {
      setHistory({ vehicle, rows: await transportApi.vehicleHistory(vehicle.id) });
    } catch (err) {
      setHistory({ vehicle, rows: [], error: err.message });
    }
  };

  const statusAction = (vehicle) => ({
    key: 'status',
    label: 'Save availability',
    title: `Availability — ${vehicle.vehicleNumber}`,
    fields: [
      { name: 'status', label: 'Availability', type: 'select', required: true, default: ['AVAILABLE', 'MAINTENANCE', 'INACTIVE'].includes(vehicle.status) ? vehicle.status : 'AVAILABLE', options: [{ value: 'AVAILABLE', label: 'Available' }, { value: 'MAINTENANCE', label: 'Under maintenance' }, { value: 'INACTIVE', label: 'Inactive' }] },
      { name: 'notes', label: 'Maintenance notes', type: 'textarea', default: vehicle.maintenanceNotes },
    ],
    submit: (body) => transportApi.setVehicleStatus(vehicle.id, body),
  });

  const verifyAction = (row) => (kind === 'vehicles'
    ? { key: 'verify', label: 'Save verification', title: `Verify ${row.vehicleNumber}`, fields: [{ name: 'isVerified', label: 'Documents', type: 'select', required: true, options: [{ value: 'true', label: 'Verified' }, { value: 'false', label: 'Not verified' }], default: String(row.isVerified) }, { name: 'notes', label: 'Notes', type: 'textarea' }], submit: (body) => transportApi.verifyVehicle(row.id, { ...body, isVerified: body.isVerified === 'true' }) }
    : { key: 'verify', label: 'Save verification', title: `Verify ${row.name}`, intro: `Licence ${row.licenseNumber} · expires ${row.licenseExpiryDate ? new Date(row.licenseExpiryDate).toLocaleDateString('en-IN') : '—'}`, fields: [{ name: 'verificationStatus', label: 'Result', type: 'select', required: true, options: [{ value: 'VERIFIED', label: 'Verified' }, { value: 'REJECTED', label: 'Rejected' }] }, { name: 'notes', label: 'Notes (required when rejecting)', type: 'textarea' }], submit: (body) => transportApi.verifyDriver(row.id, body) });

  const Icon = kind === 'vehicles' ? Truck : UserRound;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="ts-input pl-9" placeholder={kind === 'vehicles' ? 'Search registration or vehicle ID' : 'Search name, phone or driver ID'} aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={Plus} onClick={() => setForm(kind === 'vehicles' ? vehicleForm(null, admin ? providers || [] : null) : driverForm(null, admin ? providers || [] : null))}>
          {kind === 'vehicles' ? 'Register truck' : 'Register driver'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {loading ? <TableSkeleton rows={4} /> : error ? <ErrorState title="Fleet unavailable" text={error} onRetry={load} /> : !rows.length ? (
          <EmptyState icon={Icon} title={kind === 'vehicles' ? 'No trucks registered' : 'No drivers registered'} text={kind === 'vehicles' ? 'Register a truck to assign it to your shipments.' : 'Register the drivers who are authorised to drive your trucks.'} />
        ) : kind === 'vehicles' ? (
          <div className="ts-slim-scrollbar overflow-x-auto">
            <table className="ts-table">
              <thead><tr><th>Truck</th><th>Type & capacity</th>{admin ? <th>Provider</th> : null}<th>Documents</th><th>Availability</th><th>Current shipment</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td><p className="font-mono font-bold">{v.vehicleNumber}</p><p className="text-[11px] text-muted">{v.vehicleCode}{v.make ? ` · ${v.make} ${v.model || ''}` : ''}</p></td>
                    <td className="whitespace-nowrap">{humanize(v.vehicleType)}<p className="text-[11px] text-muted">{num(v.capacityKg)} kg{v.bodyType ? ` · ${humanize(v.bodyType)}` : ''}</p></td>
                    {admin ? <td className="whitespace-nowrap text-[13px]">{v.provider?.name}</td> : null}
                    <td>
                      {v.problems.length ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700" title={v.problems.join(' ')}><AlertTriangle className="size-3.5" />{v.problems.length} problem{v.problems.length > 1 ? 's' : ''}</span> : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700"><ShieldCheck className="size-3.5" />Valid</span>}
                      <p className="text-[11px] text-muted">Insurance to {v.insuranceExpiryDate ? new Date(v.insuranceExpiryDate).toLocaleDateString('en-IN') : '—'}{v.isVerified ? ' · verified' : ''}</p>
                    </td>
                    <td><Pill value={v.status} /></td>
                    <td>{v.currentShipment ? <span className="text-[12px]"><span className="font-mono">{v.currentShipment.shipmentNumber}</span><br /><ShipmentStatus status={v.currentShipment.status} /></span> : <span className="text-[12px] text-muted">—</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {v.canEdit ? <Button size="sm" variant="outline" icon={Pencil} onClick={() => setForm(vehicleForm(v, admin ? providers || [] : null))} aria-label={`Edit ${v.vehicleNumber}`} title="Edit" /> : null}
                        {v.canEdit ? <Button size="sm" variant="outline" icon={Wrench} onClick={() => setForm(statusAction(v))} aria-label={`Availability of ${v.vehicleNumber}`} title="Availability / maintenance" /> : null}
                        <Button size="sm" variant="outline" icon={History} onClick={() => openHistory(v)} aria-label={`History of ${v.vehicleNumber}`} title="Assignment history" />
                        {admin ? <Button size="sm" variant="outline" icon={ShieldCheck} onClick={() => setForm(verifyAction(v))} aria-label={`Verify ${v.vehicleNumber}`} title="Verify documents" /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ts-slim-scrollbar overflow-x-auto">
            <table className="ts-table">
              <thead><tr><th>Driver</th><th>Licence</th>{admin ? <th>Provider</th> : null}<th>Verification</th><th>Availability</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td><p className="font-semibold">{d.name}</p><p className="text-[11px] text-muted">{d.driverCode} · {d.phone}</p></td>
                    <td className="whitespace-nowrap"><span className="font-mono text-[12px]">{d.licenseNumber}</span><p className="text-[11px] text-muted">{humanize(d.licenseType)} · to {d.licenseExpiryDate ? new Date(d.licenseExpiryDate).toLocaleDateString('en-IN') : '—'}</p>{d.problems.length ? <p className="text-[11px] font-semibold text-rose-700">{d.problems[0]}</p> : null}</td>
                    {admin ? <td className="whitespace-nowrap text-[13px]">{d.provider?.name}</td> : null}
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${d.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800' : d.verificationStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-900'}`}>{humanize(d.verificationStatus)}</span></td>
                    <td><Pill value={d.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {d.canEdit ? <Button size="sm" variant="outline" icon={Pencil} onClick={() => setForm(driverForm(d, admin ? providers || [] : null))} aria-label={`Edit ${d.name}`} title="Edit" /> : null}
                        {admin ? <Button size="sm" variant="outline" icon={ShieldCheck} onClick={() => setForm(verifyAction(d))} aria-label={`Verify ${d.name}`} title="Verify licence" /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form ? <ShipmentActionModal action={form} onClose={() => setForm(null)} onDone={() => done(`${form.label.replace(/^Save /, '').replace(/^Register /, '')} saved.`)} /> : null}

      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={history ? `Assignment history — ${history.vehicle.vehicleNumber}` : ''} size="lg">
        {!history?.rows ? <TableSkeleton rows={3} /> : !history.rows.length ? <p className="text-sm text-muted">{history.error || 'This truck has not been assigned to a shipment yet.'}</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {history.rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><span className="font-mono font-semibold">{s.shipmentNumber}</span> <span className="text-muted">· order {s.orderNumber} · {s.driverName || '—'}</span></span>
                <span className="flex items-center gap-2 text-[12px] text-muted">{when(s.dispatchedAt || s.pickupScheduledAt)}<ShipmentStatus status={s.status} /></span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
