import { randomBytes } from 'crypto';
import { warnOnce } from '@/lib/warn-once';

type AuthSecretSource = 'AUTH_SECRET' | 'NEXTAUTH_SECRET' | 'development';

type AuthSecret = {
  value: string;
  source: AuthSecretSource;
};

let cachedSecret: AuthSecret | null = null;

const createDevFallbackSecret = () => randomBytes(32).toString('hex');

export const getAuthSecret = (): AuthSecret => {
  if (cachedSecret) {
    return cachedSecret;
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret) {
    cachedSecret = { value: authSecret, source: 'AUTH_SECRET' };
    return cachedSecret;
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (nextAuthSecret) {
    cachedSecret = { value: nextAuthSecret, source: 'NEXTAUTH_SECRET' };
    return cachedSecret;
  }

  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  const isVercelDeploy = vercelEnv === 'production' || vercelEnv === 'preview';

  warnOnce(
    'auth_secret_missing',
    'AUTH_SECRET is not set. Set AUTH_SECRET (preferred) or NEXTAUTH_SECRET in .env or Vercel env vars.',
  );

  if (isVercelDeploy) {
    throw new Error(
      'AUTH_SECRET is required on Vercel. Set AUTH_SECRET (preferred) or NEXTAUTH_SECRET for Preview/Production.',
    );
  }

  if (nodeEnv === 'development') {
    cachedSecret = { value: createDevFallbackSecret(), source: 'development' };
    return cachedSecret;
  }

  throw new Error('AUTH_SECRET is required. Set AUTH_SECRET (preferred) or NEXTAUTH_SECRET.');
};
