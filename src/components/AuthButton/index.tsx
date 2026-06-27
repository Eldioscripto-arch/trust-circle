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

  if (!isInstalled) {
    return (
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="tc-text-secondary text-sm">Esta app funciona dentro de World App.</p>
        <a
          href="https://world.org/mini-app?app_id=app_da9a97ceb52e3ad29b347c4ebfeff06f"
          style={{ background: 'linear-gradient(135deg, #f0b429, #ed8936)', color: '#000', border: 'none', padding: '16px 40px', borderRadius: 16, fontSize: 16, fontWeight: 700, textDecoration: 'none', minWidth: 240, display: 'inline-block', textAlign: 'center' }}
        >
          Abrir en World App →
        </a>
      </div>
    );
  }

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
          {error}
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
