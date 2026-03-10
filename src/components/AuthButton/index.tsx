'use client';
import { walletAuth } from '@/auth/wallet';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useCallback, useEffect, useRef, useState } from 'react';

export const AuthButton = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const { isInstalled } = useMiniKit();
  const hasAttemptedAuth = useRef(false);

  const doAuth = useCallback(async () => {
    if (!isInstalled || isPending) return;
    setIsPending(true);
    setError('');
    try {
      await walletAuth();
    } catch (err: any) {
      console.error('Auth error', err);
      setError(err?.message || 'Error al autenticar');
    } finally {
      setIsPending(false);
    }
  }, [isInstalled, isPending]);

  // Auto-authenticate on load
  useEffect(() => {
    if (isInstalled === true && !hasAttemptedAuth.current) {
      hasAttemptedAuth.current = true;
      doAuth();
    }
  }, [isInstalled, doAuth]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {error && (
        <div style={{
          background: 'rgba(229,62,62,0.12)',
          border: '1px solid rgba(229,62,62,0.4)',
          borderRadius: 12,
          padding: '12px 16px',
          fontSize: 13,
          color: '#fc8181',
          textAlign: 'center',
          maxWidth: 280,
        }}>
          ⚠️ {error}
        </div>
      )}
      <button
        onClick={doAuth}
        disabled={isPending}
        style={{
          background: isPending ? '#a07820' : 'linear-gradient(135deg, #f0b429, #ed8936)',
          color: '#000',
          border: 'none',
          padding: '16px 40px',
          borderRadius: 16,
          fontFamily: 'Syne, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.7 : 1,
          minWidth: 240,
        }}
      >
        {isPending ? 'Verificando...' : error ? 'Reintentar' : 'Entrar con World ID'}
      </button>
    </div>
  );
};
