// Page-lifetime memory only: survives route changes, resets on browser reload.
// Keep selections separate for accounts that use the same browser tab.
const selectedRoles = new Map<string, string>();

export const getSelectedChatRole = (userId: string) => selectedRoles.get(userId);

export function rememberChatRole(userId: string, role: string) {
  selectedRoles.set(userId, role);
}

export function forgetChatRole(userId: string, role: string) {
  if (selectedRoles.get(userId) === role) selectedRoles.delete(userId);
}
