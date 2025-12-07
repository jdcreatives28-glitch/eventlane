// src/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'guest'
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('[ProtectedRoute] getSession error:', error);
          setStatus('guest');
          return;
        }

        setStatus(data?.session ? 'authed' : 'guest');
      } catch (err) {
        console.error('[ProtectedRoute] unexpected error:', err);
        if (mounted) setStatus('guest');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div
        style={{
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: 14,
        }}
      >
        Checking your session…
      </div>
    );
  }

  if (status === 'guest') {
    // Send to /login (your AppShell opens the AuthModal on this route)
    // Preserve intended route so you can navigate back after sign-in if desired.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // status === 'authed'
  return children;
}
