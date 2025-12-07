// src/components/AuthModal.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// 🔹 Import your JSX pages/components
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';

export default function AuthModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // "terms" | "privacy" | null
  const [activeLegal, setActiveLegal] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setTab('login');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setActiveLegal(null);
    }
  }, [isOpen]);

  const handleOpenTerms = () => {
    setActiveLegal('terms');
  };

  const handleOpenPrivacy = () => {
    setActiveLegal('privacy');
  };

  const handleCloseLegal = () => {
    setActiveLegal(null);
  };

  // ---------- Forgot password ----------
  const handleForgotPassword = async () => {
    if (!email) {
      await Swal.fire(
        'Enter your email',
        'Please type your email address first so we can send the reset link.',
        'info'
      );
      return;
    }

    try {
      setLoading(true);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        console.error(resetError);
        await Swal.fire('Error', resetError.message || 'Could not send reset email.', 'error');
        return;
      }

      await Swal.fire(
        'Check your email',
        'We sent a password reset link. Open it to set a new password.',
        'info'
      );
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!email || !password || (tab === 'signup' && !confirmPassword)) {
        await Swal.fire('Missing Fields', 'All fields are required.', 'warning');
        return;
      }

      if (tab === 'signup') {
        if (password.length < 6) {
          await Swal.fire('Weak Password', 'Password must be at least 6 characters.', 'warning');
          return;
        }

        if (password !== confirmPassword) {
          await Swal.fire(
            'Password Mismatch',
            'Password and Confirm Password must match.',
            'warning'
          );
          return;
        }

        // ✅ Step 1: Check email registration status using the SQL RPC
        const { data: status, error: checkError } = await supabase.rpc('is_email_registered', {
          target_email: email,
        });

        if (checkError) {
          console.error(checkError);
          await Swal.fire('Error', 'Could not verify email. Try again.', 'error');
          return;
        }

        if (status?.exists && status?.confirmed) {
          await Swal.fire({
            icon: 'info',
            title: 'Already Registered',
            text: 'This email is already registered. Please log in instead.',
          });
          setTab('login');
          return;
        }

        if (status?.exists && !status?.confirmed) {
          await supabase.auth.resend({ type: 'signup', email });
          await Swal.fire({
            icon: 'info',
            title: 'Confirm Your Email',
            text: 'We resent the confirmation email. Please check your inbox.',
          });
          setTab('login');
          return;
        }

        // ✅ Step 2: Sign up normally
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signupError) {
          await Swal.fire({
            icon: 'error',
            title: 'Sign Up Error',
            text: signupError.message || 'Something went wrong.',
          });
          return;
        }

        if (!signupData.user?.confirmed_at) {
          await Swal.fire({
            icon: 'info',
            title: 'Almost Done',
            text: 'Check your email to confirm your account before logging in.',
          });
          return;
        }

        // ✅ User confirmed immediately
        onClose();
        setTimeout(() => {
          Swal.fire({
            icon: 'success',
            title: 'Welcome!',
            text: 'Account created successfully.',
          });
        }, 300);
      }

      if (tab === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError || !data.session) {
          setError('Incorrect email or password.');
          await Swal.fire('Login Failed', 'Incorrect email or password.', 'error');
          return;
        }

        onClose();
        setTimeout(() => {
          Swal.fire('Success', 'Logged in successfully.', 'success').then(() => {
            window.location.reload();
          });
        }, 300);
      }
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Main Auth Modal */}
      <div style={styles.overlay}>
        <div style={styles.modal}>
          {/* header */}
          <div style={styles.header}>
            <div style={styles.brandWrap}>
              <img
                src="https://minftvflekxdoiubeujy.supabase.co/storage/v1/object/public/invite-photos/everfuly-logo.png"
                alt="Everfuly logo"
                style={styles.brandLogo}
              />
              <div>
                <h2 style={styles.brand}>Eventlane.ph</h2>
                <p style={styles.brandTag}>Sign in to plan smarter events</p>
              </div>
            </div>
            <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
              &times;
            </button>
          </div>

          {/* tabs */}
          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => setTab('login')}
              style={{ ...styles.tabBtn, ...(tab === 'login' ? styles.activeTab : {}) }}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              style={{ ...styles.tabBtn, ...(tab === 'signup' ? styles.activeTab : {}) }}
            >
              Sign Up
            </button>
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              <span style={styles.labelText}>Email</span>
              <div style={styles.inputWrap}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </div>
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Password</span>
              <div style={styles.inputWrap}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tab === 'signup' ? 'Create a password' : 'Enter your password'}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </label>

            {tab === 'signup' && (
              <label style={styles.label}>
                <span style={styles.labelText}>Confirm Password</span>
                <div style={styles.inputWrap}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-type your password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    style={styles.eyeBtn}
                    aria-label={
                      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                    }
                  >
                    {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </label>
            )}

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
            </button>

            {/* 🔁 Login extra: Forgot password */}
            {tab === 'login' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                style={styles.helperLinkBtn}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}

            {/* 🔁 Signup extra: Terms & Privacy → open modal */}
            {tab === 'signup' && (
              <p style={styles.helperText}>
                By creating an account, you agree to our{' '}
                <button
                  type="button"
                  onClick={handleOpenTerms}
                  style={styles.helperLinkButton}
                >
                  Terms
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={handleOpenPrivacy}
                  style={styles.helperLinkButton}
                >
                  Privacy Policy
                </button>.
              </p>
            )}
          </form>
        </div>
      </div>

      {/* 🔒 Legal Modal (Terms / Privacy) */}
      {activeLegal && (
        <div style={styles.legalOverlay} onClick={handleCloseLegal}>
          <div
            style={styles.legalModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.legalHeader}>
              <h3 style={styles.legalTitle}>
                {activeLegal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h3>
              <button
                onClick={handleCloseLegal}
                style={styles.legalCloseBtn}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div style={styles.legalBody}>
              {activeLegal === 'terms' ? <Terms /> : <Privacy />}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

/* ---------- tokens ---------- */
const card = '#ffffff';
const cardSoft = '#f0f3f9';

const accent = '#635bff';
const text = '#0f172a';
const textMuted = '#64748b';
const borderSubtle = 'rgba(15, 23, 42, 0.08)';

const radiusLg = 18;
const radiusXl = 22;
const radiusPill = 999;

const shadowStrong = '0 18px 50px rgba(15,23,42,0.12)';

/* ---------- Styles ---------- */
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '20px 16px',
  },
  modal: {
    background:
      'radial-gradient(520px 260px at 0% 0%, rgba(99,91,255,.16), transparent 60%),' +
      'radial-gradient(480px 220px at 100% 0%, rgba(255,106,213,.16), transparent 60%),' +
      card,
    borderRadius: radiusXl,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: shadowStrong,
    border: `1px solid ${borderSubtle}`,
    animation: 'authModalFadeIn 0.24s ease-out',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    objectFit: 'cover',
    boxShadow: '0 10px 24px rgba(148,27,181,0.4)',
  },
  brand: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: text,
    margin: 0,
  },
  brandTag: {
    margin: 0,
    fontSize: 12,
    color: textMuted,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.85)',
    border: `1px solid ${borderSubtle}`,
    width: 32,
    height: 32,
    borderRadius: 999,
    cursor: 'pointer',
    color: text,
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    boxShadow: '0 6px 14px rgba(15,23,42,0.2)',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    background: 'rgba(15,23,42,0.03)',
    borderRadius: radiusPill,
    padding: 3,
    marginBottom: 16,
    border: `1px solid ${borderSubtle}`,
  },
  tabBtn: {
    padding: '9px 0',
    border: 'none',
    background: 'transparent',
    color: textMuted,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    borderRadius: radiusPill,
    transition: 'background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
  },
  activeTab: {
    background: 'linear-gradient(135deg, rgba(99,91,255,1), rgba(255,106,213,1))',
    color: '#ffffff',
    boxShadow: '0 8px 18px rgba(79,70,229,0.36)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    color: textMuted,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: 12,
    background: cardSoft,
    padding: '0 10px',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    color: text,
    padding: '10px 0',
  },
  eyeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: textMuted,
    padding: 0,
    marginLeft: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    margin: '2px 0 0',
  },
  submitBtn: {
    marginTop: 4,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    padding: '12px 14px',
    fontWeight: 800,
    borderRadius: radiusLg,
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    boxShadow: '0 12px 24px rgba(79,70,229,0.35), 0 2px 8px rgba(15,23,42,0.23)',
  },
  helperLinkBtn: {
    marginTop: 8,
    fontSize: 12,
    color: accent,
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
  },
  helperText: {
    marginTop: 8,
    fontSize: 11.5,
    color: textMuted,
    textAlign: 'center',
  },
  helperLinkButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    color: accent,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 'inherit',
  },

  /* legal modal styles */
  legalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000, // above auth overlay
    padding: '24px 16px',
  },
  legalModal: {
    background: '#ffffff',
    borderRadius: 18,
    maxWidth: 720,
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 22px 60px rgba(15,23,42,0.35)',
    padding: 20,
  },
  legalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  legalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: text,
  },
  legalCloseBtn: {
    background: 'rgba(248,250,252,0.9)',
    border: `1px solid ${borderSubtle}`,
    width: 30,
    height: 30,
    borderRadius: 999,
    cursor: 'pointer',
    color: text,
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  legalBody: {
    fontSize: 13,
    color: textMuted,
  },
};

/* ---------- One-time keyframes injection for animation ---------- */
(function ensureAuthModalKeyframes() {
  if (typeof document === 'undefined' || document.getElementById('auth-modal-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'auth-modal-keyframes';
  style.innerHTML = `
    @keyframes authModalFadeIn {
      from { opacity: 0; transform: translateY(10px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
})();
