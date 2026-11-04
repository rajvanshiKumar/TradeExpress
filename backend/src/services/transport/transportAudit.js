import { logAuditAction } from '../auditService.js';

/**
 * Audit entry for a transport action. AuditLog.targetId links to a user, so the shipment / truck / driver id is
 * recorded in details.entityId instead.
 */
export function auditTransport({ req, actorRole, action, targetId, details = {} }) {
  const extra = Array.isArray(details) ? { fields: details } : details;
  return logAuditAction({ req, actorRole: actorRole || req?.user?.role, action, resource: 'TRANSPORT', targetId: null, details: { entityId: targetId || null, ...extra } });
}
