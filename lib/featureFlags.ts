export const isAdminUIEnabled = (): boolean =>
  process.env.FEATURE_ADMIN_UI === '1';

export const isAdminUIEnabledClient = (): boolean =>
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FEATURE_ADMIN_UI === '1';
