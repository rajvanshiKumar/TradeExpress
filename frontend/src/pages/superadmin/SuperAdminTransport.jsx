import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, IndianRupee, Truck, XCircle } from 'lucide-react';
import ErrorState from '../../components/common/ErrorState';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { transportApi } from '../../api/transportApi';
import FleetPanel from '../../components/transport/FleetPanel';
import ShipmentsBoard, { useShipmentRefresh } from '../../components/transport/ShipmentsBoard';
import { IssuesPanel, ProvidersPanel, ReportsPanel, RequestsPanel } from '../../components/transport/TransportPanels';
import { StatTile, inr, num } from '../../components/transport/transportUi';

const SECTIONS = [
  { id: 'overview', label: 'Transport Overview' },
  { id: 'requests', label: 'Supplier Transport Requests' },
  { id: 'pending', label: 'Pending Truck Assignments' },
  { id: 'trucks', label: 'Truck Management' },
  { id: 'drivers', label: 'Driver Management' },
  { id: 'providers', label: 'Transport Providers' },
  { id: 'shipments', label: 'All Shipments' },
  { id: 'tracking', label: 'Shipment Tracking' },
  { id: 'issues', label: 'Delivery Issues' },
  { id: 'charges', label: 'Transport Charges' },
  { id: 'proofs', label: 'Delivery Proofs' },
  { id: 'reports', label: 'Reports & Audit Logs' },
];

/** Super Admin: Transport & Delivery Management across all suppliers. */
export default function SuperAdminTransport() {
  useDocumentTitle('Transport & Delivery — Super Admin');
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.id === params.get('section')) ? params.get('section') : (params.get('request') ? 'requests' : params.get('shipment') ? 'shipments' : 'overview');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await transportApi.overview());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the transport overview.');
    }
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useShipmentRefresh(loadOverview);

  const go = (id) => setParams({ section: id }, { replace: true });
  const counts = { requests: overview?.pendingRequests, pending: overview ? overview.awaitingTransport + overview.transportRequested : undefined, issues: overview?.openIssues };

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-black tracking-tight text-ink">Transport & Delivery Management</h1>
        <p className="mt-1 text-sm text-muted">Supplier transport requests, the TradeExpress fleet, every shipment on the platform, delivery issues and freight.</p>
      </div>

      <nav aria-label="Transport sections" className="ts-slim-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${section === s.id ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 ring-1 ring-line hover:bg-surface'}`}>
            {s.label}
            {counts[s.id] ? <span className={`rounded-full px-1.5 text-[10px] ${section === s.id ? 'bg-white/20' : 'bg-amber-100 text-amber-900'}`}>{counts[s.id]}</span> : null}
          </button>
        ))}
      </nav>

      {section === 'overview' ? (
        error ? <ErrorState title="Overview unavailable" text={error} onRetry={loadOverview} /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Shipments" value={num(overview?.total)} icon={Truck} onClick={() => go('shipments')} />
              <StatTile label="Transport requests" value={num(overview?.pendingRequests)} hint="Waiting for a truck" icon={ClipboardList} tone="amber" onClick={() => go('requests')} />
              <StatTile label="Awaiting transport" value={num(overview?.awaitingTransport)} icon={Clock} tone="amber" onClick={() => go('pending')} />
              <StatTile label="Truck assigned" value={num(overview?.truckAssigned)} icon={Truck} tone="indigo" onClick={() => go('shipments')} />
              <StatTile label="Ready for pickup" value={num(overview?.readyForPickup)} icon={Truck} tone="violet" onClick={() => go('shipments')} />
              <StatTile label="In transit" value={num(overview?.inTransit)} icon={Truck} tone="emerald" onClick={() => go('tracking')} />
              <StatTile label="Delivered" value={num(overview?.delivered)} icon={CheckCircle2} tone="emerald" onClick={() => go('proofs')} />
              <StatTile label="Delayed" value={num(overview?.delayed)} icon={AlertTriangle} tone="rose" onClick={() => go('tracking')} />
              <StatTile label="Failed / returns" value={num((overview?.failed || 0) + (overview?.returning || 0))} icon={XCircle} tone="rose" onClick={() => go('issues')} />
              <StatTile label="Freight booked" value={inr(overview?.freightCharges)} icon={IndianRupee} tone="sky" onClick={() => go('charges')} />
            </div>
            <section>
              <h2 className="mb-3 text-sm font-bold text-ink">Waiting on TradeExpress</h2>
              <RequestsPanel admin onChanged={loadOverview} />
            </section>
          </div>
        )
      ) : null}

      {section === 'requests' ? <RequestsPanel admin onChanged={loadOverview} /> : null}
      {section === 'pending' ? <ShipmentsBoard role="SUPER_ADMIN" showSupplier statusTabs={false} filters={{ status: 'AWAITING_TRANSPORT,TRANSPORT_REQUESTED' }} emptyText="Every shipment has a truck." onChanged={loadOverview} /> : null}
      {section === 'trucks' ? <FleetPanel admin kind="vehicles" /> : null}
      {section === 'drivers' ? <FleetPanel admin kind="drivers" /> : null}
      {section === 'providers' ? <ProvidersPanel /> : null}
      {section === 'shipments' ? <ShipmentsBoard role="SUPER_ADMIN" showSupplier openNumber={params.get('shipment') || ''} onChanged={loadOverview} /> : null}
      {section === 'tracking' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Shipments on the road. Locations are reported by suppliers or operations, not GPS.</p>
          <ShipmentsBoard role="SUPER_ADMIN" showSupplier statusTabs={false} filters={{ status: 'PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,DELIVERED_PENDING_CONFIRMATION,DELIVERY_FAILED,RETURN_IN_TRANSIT' }} emptyText="No shipments are on the road." onChanged={loadOverview} />
        </div>
      ) : null}
      {section === 'issues' ? <IssuesPanel admin /> : null}
      {section === 'charges' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Open a shipment and use “Freight payment” to record charges and payment.</p>
          <ShipmentsBoard role="SUPER_ADMIN" showSupplier freightColumns filters={{ status: 'TRANSPORT_ASSIGNED,PICKUP_SCHEDULED,LOADING_IN_PROGRESS,LOADED,PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,DELIVERED_PENDING_CONFIRMATION,DELIVERED,DELIVERY_FAILED,RETURN_IN_TRANSIT,RETURNED' }} statusTabs={false} emptyText="No shipments with transport booked yet." />
        </div>
      ) : null}
      {section === 'proofs' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Delivered shipments. Open one to see who received the goods, the delivery-code confirmation and any photos.</p>
          <ShipmentsBoard role="SUPER_ADMIN" showSupplier statusTabs={false} filters={{ status: 'DELIVERED' }} emptyText="No deliveries confirmed yet." />
        </div>
      ) : null}
      {section === 'reports' ? <ReportsPanel /> : null}
    </div>
  );
}
