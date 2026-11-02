import { CheckCircle2, Clock, MapPin, AlertCircle, FileText, User } from 'lucide-react';

/**
 * Visual vertical milestone and audit timeline for shipments
 */
export default function ShipmentTimeline({ events = [], status }) {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500">
        <Clock className="size-6 mx-auto mb-2 text-slate-400" />
        <p>No milestone events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, eventIdx) => {
          const isLatest = eventIdx === 0;
          const isDispute = event.status === 'DELIVERY_DISPUTED';
          const isDelivered = event.status === 'DELIVERED';

          return (
            <li key={event.id || eventIdx}>
              <div className="relative pb-8">
                {eventIdx !== events.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`flex size-8 items-center justify-center rounded-full ring-4 ring-white ${
                        isDispute
                          ? 'bg-rose-500 text-white'
                          : isDelivered
                          ? 'bg-emerald-600 text-white'
                          : isLatest
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isDispute ? (
                        <AlertCircle className="size-4" aria-hidden="true" />
                      ) : isDelivered ? (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      ) : (
                        <Clock className="size-4" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {event.title || event.status.replace(/_/g, ' ')}
                      </p>
                      {event.description && (
                        <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <p className="flex items-center gap-1 text-[11px] text-emerald-800 font-medium mt-1">
                          <MapPin className="size-3" />
                          <span>{event.location}</span>
                        </p>
                      )}
                      {event.actorName && (
                        <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <User className="size-2.5" />
                          <span>Recorded by {event.actorName} ({event.actorRole || 'System'})</span>
                        </p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-[11px] text-slate-400">
                      <time dateTime={event.timestamp}>
                        {new Date(event.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

