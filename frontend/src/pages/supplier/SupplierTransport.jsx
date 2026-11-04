import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, PackagePlus, Truck, XCircle } from 'lucide-react';
import Button from '../../components/common/Button';
import ErrorState from '../../components/common/ErrorState';
import Tabs from '../../components/common/Tabs';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useNotifications from '../../hooks/useNotifications';
import { transportApi } from '../../api/transportApi';
import CreateShipmentModal from '../../components/transport/CreateShipmentModal';
import FleetPanel from '../../components/transport/FleetPanel';
import ShipmentsBoard, { useShipmentRefresh } from '../../components/transport/ShipmentsBoard';
import { RequestsPanel } from '../../components/transport/TransportPanels';
import { StatTile, num } from '../../components/transport/transportUi';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'trucks', label: 'My Trucks' },
  { id: 'requests', label: 'Transport Requests' },
  { id: 'shipments', label: 'Shipment Management' },
  { id: 'history', label: 'Tracking History' },
];

/** Supplier: Transport & Delivery Management. */
export default function SupplierTransport() {
  useDocumentTitle('Transport & Delivery — Supplier Portal');
  const { showToast } = useNotifications();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : (params.get('shipment') ? 'shipments' : 'overview');
  const orderParam = params.get('order') || '';
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(Boolean(orderParam));
  const [fleetKind, setFleetKind] = useState('vehicles');
  const [boardKey, setBoardKey] = useState(0);
  const [boardFilter, setBoardFilter] = useState({});

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await transportApi.overview());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load transport overview.');
    }
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useShipmentRefresh(loadOverview);

  const go = (id, extra = {}) => {
    const next = new URLSearchParams();
    next.set('tab', id);
    Object.entries(extra).forEach(([k, v]) => v && next.set(k, v));
    setParams(next, { replace: true });
  };
  const showShipments = (status = '') => { setBoardFilter(status ? { status } : {}); setBoardKey((k) => k + 1); go('shipments'); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-black tracking-tight text-ink sm:text-2xl">Transport & Delivery Management</h1>
          <p className="mt-1 text-sm text-muted">Arrange trucks for confirmed orders, load and dispatch, and follow every shipment to the buyer.</p>
        </div>
        <Button icon={PackagePlus} onClick={() => setCreating(true)}>Create shipment</Button>
      </div>

      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'requests' && overview?.pendingRequests ? overview.pendingRequests : undefined }))} active={tab} onChange={(id) => go(id)} idPrefix="transport" />

      {tab === 'overview' ? (
        error ? <ErrorState title="Overview unavailable" text={error} onRetry={loadOverview} /> : (
          <div className="space-y-5">
            {overview?.shippableOrders ? (
              <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center">
                <p className="text-sm text-emerald-950"><span className="font-bold">{overview.shippableOrders} confirmed order{overview.shippableOrders === 1 ? '' : 's'}</span> {overview.shippableOrders === 1 ? 'has' : 'have'} goods waiting for a shipment.</p>
                <Button size="sm" icon={PackagePlus} onClick={() => setCreating(true)}>Create shipment</Button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Total shipments" value={num(overview?.total)} icon={Truck} onClick={() => showShipments('')} />
              <StatTile label="Awaiting transport" value={num(overview?.awaitingTransport)} icon={Clock} tone="amber" onClick={() => showShipments('AWAITING_TRANSPORT')} />
              <StatTile label="Transport requested" value={num(overview?.transportRequested)} icon={ClipboardList} tone="sky" onClick={() => go('requests')} />
              <StatTile label="Truck assigned" value={num(overview?.truckAssigned)} icon={Truck} tone="indigo" onClick={() => showShipments('TRANSPORT_ASSIGNED,PICKUP_SCHEDULED')} />
              <StatTile label="Ready for pickup" value={num(overview?.readyForPickup)} hint="Scheduled, loading or loaded" icon={PackagePlus} tone="violet" onClick={() => showShipments('PICKUP_SCHEDULED,LOADING_IN_PROGRESS,LOADED')} />
              <StatTile label="In transit" value={num(overview?.inTransit)} icon={Truck} tone="emerald" onClick={() => showShipments('PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,DELIVERED_PENDING_CONFIRMATION')} />
              <StatTile label="Delivered" value={num(overview?.delivered)} icon={CheckCircle2} tone="emerald" onClick={() => showShipments('DELIVERED')} />
              <StatTile label="Delayed" value={num(overview?.delayed)} hint="Past the expected delivery" icon={AlertTriangle} tone="rose" onClick={() => { setBoardFilter({ delayed: 'true' }); setBoardKey((k) => k + 1); go('shipments'); }} />
              <StatTile label="Failed deliveries" value={num(overview?.failed)} icon={XCircle} tone="rose" onClick={() => showShipments('DELIVERY_FAILED')} />
              <StatTile label="Open issues" value={num(overview?.openIssues)} icon={AlertTriangle} tone="amber" />
            </div>
            <section>
              <h2 className="mb-3 text-sm font-bold text-ink">Shipments needing your action</h2>
              <ShipmentsBoard role="SUPPLIER" filters={{ status: 'AWAITING_TRANSPORT,TRANSPORT_ASSIGNED,PICKUP_SCHEDULED,LOADING_IN_PROGRESS,LOADED,DELIVERY_FAILED,RETURN_IN_TRANSIT' }} statusTabs={false} emptyText="Nothing to do right now." onChanged={loadOverview} />
            </section>
          </div>
        )
      ) : null}

      {tab === 'trucks' ? (
        <div className="space-y-4">
          <Tabs variant="pill" tabs={[{ id: 'vehicles', label: 'Trucks' }, { id: 'drivers', label: 'Drivers' }]} active={fleetKind} onChange={setFleetKind} idPrefix="fleet" />
          <FleetPanel key={fleetKind} kind={fleetKind} />
        </div>
      ) : null}

      {tab === 'requests' ? <RequestsPanel onChanged={loadOverview} /> : null}

      {tab === 'shipments' ? <ShipmentsBoard key={boardKey} role="SUPPLIER" filters={boardFilter} openNumber={params.get('shipment') || ''} onChanged={loadOverview} /> : null}

      {tab === 'history' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Dispatched and completed shipments. Open one to see its verified tracking timeline.</p>
          <ShipmentsBoard role="SUPPLIER" filters={{ status: 'PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,DELIVERED_PENDING_CONFIRMATION,DELIVERED,DELIVERY_FAILED,RETURN_IN_TRANSIT,RETURNED' }} statusTabs={false} />
        </div>
      ) : null}

      <CreateShipmentModal
        open={creating}
        initialOrder={orderParam}
        onClose={() => setCreating(false)}
        onCreated={(shipment) => {
          setCreating(false);
          showToast(`Shipment ${shipment.shipmentNumber} created. Assign a truck or request one from TradeExpress.`, 'success');
          loadOverview();
          go('shipments', { shipment: shipment.shipmentNumber });
          setBoardFilter({});
          setBoardKey((k) => k + 1);
        }}
      />
    </div>
  );
}
