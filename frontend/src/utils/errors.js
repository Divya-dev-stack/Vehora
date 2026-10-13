import { getErrorMessage } from '../services/api';

export function friendlyError(err) {
  if (err && err.isLocation) return err.message;
  const detail = err && err.response && err.response.data ? err.response.data.detail : null;
  if (err && err.response && err.response.status === 422 && Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1]) : '';
    const msg = String(first.msg || '').replace(/^Value error, /, '');
    const prefix = field && field !== 'body' ? field.replace(/_/g, ' ') + ': ' : '';
    return prefix + msg;
  }
  return getErrorMessage(err);
}