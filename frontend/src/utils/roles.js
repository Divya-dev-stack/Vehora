export const ROLE_HOME = {
  user: '/dashboard',
  mechanic: '/mechanic',
  admin: '/admin',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}
