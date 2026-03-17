/**
 * Generates an HMAC-SHA256 hash using Web Crypto API (Browser compatible).
 */
export const hashNonce = async ({ nonce }: { nonce: string }) => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(process.env.NEXT_PUBLIC_HMAC_SECRET_KEY || 'default_key');
  const data = encoder.encode(nonce);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
