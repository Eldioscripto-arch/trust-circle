import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { signIn } from 'next-auth/react';
import { getNewNonces } from './server-helpers';

export const walletAuth = async () => {
  // PASO 1 — Wallet auth
  const { nonce, signedNonce } = await getNewNonces();

  const result = await MiniKit.commandsAsync.walletAuth({
    nonce,
    expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
    statement: `Authenticate (${crypto.randomUUID().replace(/-/g, '')}).`,
  });

  if (!result) throw new Error('No response from wallet auth');
  if (result.finalPayload.status !== 'success') {
    console.error('Wallet auth failed', result.finalPayload.error_code);
    return;
  }

  // PASO 2 — Sign in NextAuth
  await signIn('credentials', {
    redirect: false,
    nonce,
    signedNonce,
    finalPayloadJson: JSON.stringify(result.finalPayload),
  });

  const wallet = result.finalPayload.address.toLowerCase();

  // PASO 3 — World ID verify SIEMPRE (biométrico, no depende del dispositivo)
  const { finalPayload: verifyPayload } = await MiniKit.commandsAsync.verify({
    action: 'join-circle-v1',
    signal: wallet,
    verification_level: VerificationLevel.Orb,
  });

  if (verifyPayload.status !== 'success') {
    // Si cancela World ID, no puede entrar
    throw new Error('World ID verification required to use Trust Circle');
  }

  // PASO 4 — Guardar verificación en backend
  const verifyRes = await fetch('/api/verify-world-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet,
      proof: verifyPayload.proof,
      merkle_root: verifyPayload.merkle_root,
      nullifier_hash: verifyPayload.nullifier_hash,
      verification_level: verifyPayload.verification_level,
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || 'World ID verification failed');
  }

  window.location.href = '/';
};
