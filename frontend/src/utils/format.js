export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKm(n) {
  return Number(n).toLocaleString('en-IN') + ' km';
}

export function formatMoney(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

export const REMINDER_STATUS = {
  overdue: { label: 'Overdue', badge: 'vh-badge--danger' },
  due_soon: { label: 'Due soon', badge: 'vh-badge--warning' },
  upcoming: { label: 'Upcoming', badge: 'vh-badge--success' },
  done: { label: 'Done', badge: '' },
};

export function reminderDue(r) {
  const parts = [];
  if (r.due_date) parts.push('by ' + formatDate(r.due_date));
  if (r.due_km !== null && r.due_km !== undefined) {
    parts.push('at ' + formatKm(r.due_km) + (r.current_km !== null && r.current_km !== undefined ? ' (now ' + formatKm(r.current_km) + ')' : ''));
  }
  return parts.join(' or ');
}