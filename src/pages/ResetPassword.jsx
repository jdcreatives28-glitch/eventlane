// src/pages/ResetPassword.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();

    if (!password || !confirm) {
      await Swal.fire('Missing fields', 'Please fill out both password fields.', 'warning');
      return;
    }

    if (password.length < 6) {
      await Swal.fire('Weak password', 'Password must be at least 6 characters.', 'warning');
      return;
    }

    if (password !== confirm) {
      await Swal.fire('Mismatch', 'Passwords do not match.', 'warning');
      return;
    }

    try {
      setLoading(true);

      // At this point, the recovery link already authenticated the user
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error(error);
        await Swal.fire('Error', error.message || 'Could not reset password.', 'error');
        return;
      }

      await Swal.fire('Success', 'Your password has been updated.', 'success');
      window.location.href = '/'; // or '/login' or wherever
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'Something went wrong.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f7fb',
        padding: 16,
      }}
    >
      <form
        onSubmit={handleReset}
        style={{
          background: '#ffffff',
          padding: 24,
          borderRadius: 16,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 18px 50px rgba(15,23,42,0.12)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 20, fontWeight: 800 }}>
          Reset your password
        </h1>
        <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: '#64748b' }}>
          Enter a new password for your everfuly.com account.
        </p>

        {/* New password */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            New password
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.7)',
              padding: '0 10px',
              background: '#f8fafc',
            }}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                background: 'transparent',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                marginLeft: 6,
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
            </button>
          </div>
        </label>

        {/* Confirm new password */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Confirm new password
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.7)',
              padding: '0 10px',
              background: '#f8fafc',
            }}
          >
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                background: 'transparent',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                marginLeft: 6,
              }}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px 14px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            color: '#ffffff',
            fontSize: 15,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
