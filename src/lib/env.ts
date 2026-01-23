let authSecretWarned = false;

export function warnOnce(message: string) {
  if (authSecretWarned) {
    return;
  }
  authSecretWarned = true;
  console.warn(message);
}

export function getAuthSecret(): string | undefined {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) {
    return secret;
  }

  const isEdgeRuntime = process.env.NEXT_RUNTIME === 'edge';
  if (isEdgeRuntime) {
    warnOnce('NEXTAUTH_SECRET is not set for edge runtime; skipping secret fallback');
    return undefined;
  }

  const devFallbackSecret = process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined;
  if (devFallbackSecret) {
    warnOnce('NEXTAUTH_SECRET is not set; using non-production fallback secret');
  } else {
    console.error('NEXTAUTH_SECRET is not set');
  }
  return devFallbackSecret;
}
