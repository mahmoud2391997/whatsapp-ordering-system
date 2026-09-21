'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Leaf, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const misconfigured = params.get('error') === 'config';
  const [password, setPassword] = useState('');
  const [error, setError] = useState(misconfigured ? 'Set ADMIN_PASSWORD in the server environment, then reload.' : '');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Unable to sign in');
        return;
      }
      window.location.href = typeof data.next === 'string' ? data.next : '/dashboard';
    } catch {
      setError('Unable to reach the server');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-9 h-9 bg-[#25D366] rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight">Fresh Greens</p>
            <p className="text-xs text-emerald-700">Admin sign in</p>
          </div>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl h-40" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
