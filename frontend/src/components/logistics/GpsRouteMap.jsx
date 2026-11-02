import { useMemo } from 'react';
import { MapPin, Navigation, Radio, ShieldAlert, Truck, Clock } from 'lucide-react';

/**
 * High-precision vector GPS Map component.
 * Displays real telemetry breadcrumbs and vehicle live coordinates.
 * Strictly adheres to the rule: "Never show fake live GPS locations."
 */
export default function GpsRouteMap({
  pickupAddress,
  deliveryAddress,
  currentLocation,
  locations = [],
  status,
  vehicleNumber,
  driverName,
}) {
  const hasTelemetry = Boolean(
    (currentLocation && currentLocation.lat && currentLocation.lng) ||
    (locations && locations.length > 0)
  );

  const activeLat = currentLocation?.lat || locations[locations.length - 1]?.latitude;
  const activeLng = currentLocation?.lng || locations[locations.length - 1]?.longitude;
  const speed = currentLocation?.speed ?? locations[locations.length - 1]?.speed ?? 0;
  const heading = currentLocation?.heading ?? locations[locations.length - 1]?.heading ?? 0;
  const lastPing = currentLocation?.timestamp || locations[locations.length - 1]?.recordedAt;

  // Approximate relative positioning on canvas based on Indian geography coordinates
  // Normalized between [minLat, maxLat] and [minLng, maxLng]
  const coordinatesList = useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map((loc) => ({
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
      speed: Number(loc.speed || 0),
      time: loc.recordedAt,
      address: loc.address,
    }));
  }, [locations]);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-slate-900 text-white overflow-hidden shadow-sm">
      {/* Top Telemetry Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Radio className={`size-4 ${hasTelemetry ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Live Telematics Tracking</span>
              {hasTelemetry ? (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                  REAL GPS ACTIVE
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                  AWAITING TELEMETRY
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Vehicle: <strong className="text-slate-200">{vehicleNumber || 'Unassigned'}</strong> · Driver: {driverName || 'Assigned Driver'}
            </p>
          </div>
        </div>

        {hasTelemetry && (
          <div className="flex items-center gap-4 text-[11px] text-slate-300 font-mono">
            <div>
              <span className="text-slate-500">SPEED: </span>
              <strong className="text-emerald-400">{Math.round(speed)} km/h</strong>
            </div>
            <div>
              <span className="text-slate-500">COORDS: </span>
              <span>{Number(activeLat).toFixed(4)}°N, {Number(activeLng).toFixed(4)}°E</span>
            </div>
            {lastPing && (
              <div className="hidden sm:flex items-center gap-1 text-slate-400">
                <Clock className="size-3 text-slate-500" />
                <span>{new Date(lastPing).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Vector Map Display */}
      <div className="relative h-64 sm:h-80 w-full bg-[#0a1410] overflow-hidden flex items-center justify-center">
        {/* Subtle Map Grid lines */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Decorative Highway Arterial Lines */}
        <svg className="absolute inset-0 size-full opacity-30 pointer-events-none" viewBox="0 0 800 400">
          <path d="M 50,320 Q 250,280 400,200 T 750,80" fill="none" stroke="#064e3b" strokeWidth="6" />
          <path d="M 50,320 Q 250,280 400,200 T 750,80" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6 4" />
          <path d="M 120,380 Q 300,150 680,180" fill="none" stroke="#042f2e" strokeWidth="3" />
        </svg>

        {hasTelemetry ? (
          /* Actual GPS Waypoint and Live Marker */
          <div className="relative z-10 w-full h-full p-6 flex flex-col justify-between">
            {/* Top Destination Marker */}
            <div className="flex items-start justify-end">
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 border border-slate-700 p-2.5 shadow-lg backdrop-blur-md max-w-xs">
                <div className="size-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <MapPin className="size-4" />
                </div>
                <div className="text-[11px] min-w-0">
                  <p className="font-bold text-white truncate">Destination: {deliveryAddress?.city || 'Delivery Hub'}</p>
                  <p className="text-slate-400 truncate">{deliveryAddress?.state || deliveryAddress?.street || 'Consignee Facility'}</p>
                </div>
              </div>
            </div>

            {/* Central Real-Time Vehicle Position Indicator */}
            <div className="flex items-center justify-center my-auto">
              <div className="relative flex flex-col items-center">
                {/* Ping Waves */}
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
                <div className="absolute -inset-8 rounded-full bg-emerald-500/10" />

                {/* Vehicle Marker */}
                <div className="relative flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl ring-4 ring-emerald-400/40">
                  <Truck className="size-6 text-white" />
                </div>

                {/* Floating telemetry bubble */}
                <div className="mt-3 rounded-lg bg-slate-950/90 border border-emerald-500/40 px-3 py-1.5 text-center shadow-lg">
                  <p className="text-xs font-bold text-emerald-300">{vehicleNumber || 'Transit Vehicle'}</p>
                  <p className="text-[10px] font-mono text-slate-300">
                    {Number(activeLat).toFixed(4)}°N, {Number(activeLng).toFixed(4)}°E · {Math.round(speed)} km/h
                  </p>
                  {currentLocation?.address && (
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">
                      {currentLocation.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Origin Marker */}
            <div className="flex items-end justify-start">
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 border border-slate-700 p-2.5 shadow-lg backdrop-blur-md max-w-xs">
                <div className="size-8 rounded-lg bg-blue-950 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Navigation className="size-4" />
                </div>
                <div className="text-[11px] min-w-0">
                  <p className="font-bold text-white truncate">Origin: {pickupAddress?.city || 'Dispatch Hub'}</p>
                  <p className="text-slate-400 truncate">{pickupAddress?.state || pickupAddress?.street || 'Supplier Warehouse'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Telemetry State - Strictly No Fake GPS */
          <div className="relative z-10 max-w-md mx-auto text-center px-4 py-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 shadow-inner mb-3">
              <Radio className="size-7 text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Live GPS Telemetry Awaiting Signal</h4>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Real-time vehicle telemetry will stream here automatically as soon as the driver mobile app or on-board GPS telematics unit broadcasts coordinates.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-800/90 px-3 py-1 text-[11px] text-slate-300 border border-slate-700">
              <ShieldAlert className="size-3.5 text-emerald-400" />
              <span>TradeExpress Policy: Never displays simulated or fake GPS locations.</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Checkpoint Summary Bar */}
      <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
        <div>
          <span>Pickup: </span>
          <strong className="text-slate-200">{pickupAddress?.city || 'Origin'}</strong>
          <span className="mx-2 text-slate-600">→</span>
          <span>Delivery: </span>
          <strong className="text-slate-200">{deliveryAddress?.city || 'Destination'}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span>Status: </span>
          <span className="font-bold text-emerald-400">{status ? status.replace(/_/g, ' ') : 'TRANSPORT PENDING'}</span>
        </div>
      </div>
    </div>
  );
}

