// src/components/Topbar.jsx
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  FaUser,
  FaHeart,
  FaSignOutAlt,
  FaTools,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaChartBar,
  FaListAlt,
  FaBars,
  FaInfoCircle,
  FaEnvelope,
} from 'react-icons/fa';
import NeutralAvatar from './NeutralAvatar';
import ProfileAvatarUploader from './ProfileAvatarUploader';

const AVATAR_BUCKET = 'avatars';

function colorForId(uid = '') {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function pickAvatarKey(p) {
  if (!p) return null;
  return (
    p.avatar_url ||
    p.avatarUrl ||
    p.avatar ||
    p.photo_url ||
    p.image_url ||
    p.profile_pic ||
    p.image ||
    null
  );
}

function resolveUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value; // already a URL
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(value);
  return data?.publicUrl || null;
}

/** Minimal modal (portal) */
function Modal({ isOpen, onClose, title, children, width = 560 }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div
      style={modalStyles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div
        style={{ ...modalStyles.card, maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>{title}</h3>
          <button
            style={modalStyles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>
        <div style={modalStyles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

// helpers for username
const sanitizeUsername = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);

const isValidUsername = (v) => /^[a-z][a-z0-9_]{2,19}$/.test(v); // 3-20 chars, starts w/ letter

export default function Topbar({ onLoginClick }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarVersion, setAvatarVersion] = useState(0); // for cache-busting

  const [open, setOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // username editor state
  const [formUsername, setFormUsername] = useState('');
  const [unameStatus, setUnameStatus] = useState('idle'); // idle | checking | ok | taken | invalid | error
  const [unameMsg, setUnameMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const menuRef = useRef(null);
  const navigate = useNavigate();

  // 🔹 Track mobile vs desktop (for hamburger vs inline links)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth
  useEffect(() => {
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setUser(user || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // Load profile on user change
  useEffect(() => {
    (async () => {
      if (!user?.id) {
        setProfile(null);
        setAvatarUrl(null);
        setAvatarVersion(0);
        return;
      }

      let res = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (res.error || !res.data) {
        res = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      }
      const data = res.data || null;
      setProfile(data);

      // avatar
      const picked = pickAvatarKey(data);
      const resolved = resolveUrl(picked);
      setAvatarUrl(resolved);
      setAvatarVersion((v) => v + 1); // force fresh fetch

      // username field init
      const initialUname =
        data?.username ||
        user?.user_metadata?.username ||
        (user?.email ? user.email.split('@')[0] : '');
      setFormUsername(sanitizeUsername(initialUname));
      setUnameStatus('idle');
      setUnameMsg('');
    })();
  }, [user?.id]);

  // React to global avatar updates (e.g., ProfileAvatarUploader anywhere)
  useEffect(() => {
    const onAvatarUpdated = (e) => {
      const { userId, url, version } = e.detail || {};
      if (!user?.id || userId !== user.id) return;
      setAvatarUrl(url || null);
      setAvatarVersion(version || Date.now());
    };
    window.addEventListener('avatar:updated', onAvatarUpdated);
    return () => window.removeEventListener('avatar:updated', onAvatarUpdated);
  }, [user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const username =
    profile?.username ||
    user?.user_metadata?.username ||
    (user?.email ? user.email.split('@')[0] : 'Guest');

  // Debounced username uniqueness check (exact, case-insensitive by sanitizing)
  useEffect(() => {
    if (!user?.id) return;
    const val = sanitizeUsername(formUsername);
    if (!val) {
      setUnameStatus('idle');
      setUnameMsg('');
      return;
    }
    if (!isValidUsername(val)) {
      setUnameStatus('invalid');
      setUnameMsg(
        '3–20 chars, letters/numbers/underscore, start with a letter.'
      );
      return;
    }

    // If unchanged vs current profile value, it's ok
    const current = (profile?.username || '').toLowerCase();
    if (val === current) {
      setUnameStatus('ok');
      setUnameMsg('');
      return;
    }

    let alive = true;
    setUnameStatus('checking');
    setUnameMsg('Checking availability…');
    const t = setTimeout(async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('username', val) // exact match (we sanitize to lowercase)
          .neq('id', user.id);
        if (!alive) return;
        if (error) {
          setUnameStatus('error');
          setUnameMsg('Error checking username.');
          return;
        }
        if ((count || 0) > 0) {
          setUnameStatus('taken');
          setUnameMsg('Username is already taken.');
        } else {
          setUnameStatus('ok');
          setUnameMsg('');
        }
      } catch {
        if (alive) {
          setUnameStatus('error');
          setUnameMsg('Error checking username.');
        }
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [formUsername, user?.id, profile?.username]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return console.error('Logout failed:', error.message);
    setOpen(false);
    navigate('/');
    window.location.reload();
  };

  const openProfileModal = () => {
    if (!user) return onLoginClick?.();
    setOpen(false);
    setShowProfileModal(true);
  };

  const saveUsername = async () => {
    const val = sanitizeUsername(formUsername);
    if (!user?.id || !isValidUsername(val) || unameStatus !== 'ok') return;
    setSaving(true);
    try {
      // 1) persist to profiles
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ username: val })
        .eq('id', user.id);
      if (updErr) throw updErr;

      // 2) also update auth user_metadata.username for consistency
      await supabase.auth
        .updateUser({ data: { username: val } })
        .catch(() => {});

      // 3) update local
      setProfile((p) => ({ ...(p || {}), username: val }));
      setUnameStatus('ok');
      setUnameMsg('Saved!');
    } catch (e) {
      setUnameStatus('error');
      setUnameMsg(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleUsernameBlur = async () => {
    const val = sanitizeUsername(formUsername);
    if (!user?.id) return;

    // No change? Do nothing.
    const current = (profile?.username || '').toLowerCase();
    if (val === current) return;

    // Basic validation feedback
    if (!isValidUsername(val)) {
      setUnameStatus('invalid');
      setUnameMsg(
        '3–20 chars, letters/numbers/underscore, start with a letter.'
      );
      return;
    }

    // If debounced check is still running, wait a tick and try again
    if (unameStatus === 'checking') {
      setTimeout(handleUsernameBlur, 250);
      return;
    }

    // Only save when availability is OK
    if (unameStatus === 'ok') {
      await saveUsername();
    }
  };

  const handleUsernameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const avatarBg = colorForId(user?.id || username || 'guest');

  return (
    <div className="topbar" style={styles.topbar}>
      {/* Brand + logo */}
      <button
        type="button"
        style={styles.brandWrap}
        onClick={() => navigate('/')}
      >
        <img
          src="https://minftvflekxdoiubeujy.supabase.co/storage/v1/object/public/invite-photos/everfuly-logo.png"
          alt="Everfuly logo"
          style={styles.brandLogo}
        />
        <h1 className="brand" style={styles.brand}>
          Eventlane.ph
        </h1>
      </button>

      <div style={{ flexGrow: 1 }} />

      {/* Right side */}
      <div ref={menuRef} style={styles.userWrap}>
        {user ? (
          <>
            {/* Logged-in: username + avatar + dropdown */}
            <button
              type="button"
              style={styles.userBtn}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span style={{ marginRight: 0, color: '#344054' }}>
                {username || 'Guest'}
              </span>
              <NeutralAvatar
                size={32}
                src={avatarUrl}
                cacheKey={avatarVersion} // ← forces image refresh after uploads
                seed={user?.id || username}
                bg={avatarBg}
                title={username}
                initialsFrom={username}
              />
            </button>

            {open && (
              <div role="menu" style={styles.dropdown}>
                <button role="menuitem" style={styles.item} onClick={openProfileModal}>
                  <FaUser style={styles.icon} /> Profile
                </button>
                <button
                  role="menuitem"
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    navigate('/manager');
                  }}
                >
                  <FaChartBar style={styles.icon} /> Venue Manager
                </button>

                <button
                  role="menuitem"
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    navigate('/my-listings');
                  }}
                >
                  <FaListAlt style={styles.icon} /> My Listings
                </button>

                <button
                  role="menuitem"
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    navigate('/favorites');
                  }}
                >
                  <FaHeart style={styles.icon} /> Favorites
                </button>

                {/* About Us + Contact inside logged-in dropdown */}
                <div style={styles.hr} />
                <button
                  role="menuitem"
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    navigate('/about');
                  }}
                >
                  <FaInfoCircle style={styles.icon} /> About Us
                </button>
                <button
                  role="menuitem"
                  style={styles.item}
                  onClick={() => {
                    setOpen(false);
                    navigate('/contact');
                  }}
                >
                  <FaEnvelope style={styles.icon} /> Contact
                </button>

                <div style={styles.hr} />
                <button
                  role="menuitem"
                  style={{ ...styles.item, color: '#B42318' }}
                  onClick={handleLogout}
                >
                  <FaSignOutAlt style={styles.icon} /> Logout
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 🔹 Logged out: Mobile = hamburger menu, Desktop = inline buttons */}
            {isMobile ? (
              <>
                <button
                  type="button"
                  style={styles.menuBtn}
                  onClick={() => setOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  <FaBars style={{ fontSize: 18, color: '#4B5563' }} />
                </button>

                {open && (
                  <div role="menu" style={styles.dropdown}>
                    <button
                      role="menuitem"
                      style={styles.item}
                      onClick={() => {
                        setOpen(false);
                        navigate('/about');
                      }}
                    >
                      <FaInfoCircle style={styles.icon} /> About Us
                    </button>
                    <button
                      role="menuitem"
                      style={styles.item}
                      onClick={() => {
                        setOpen(false);
                        navigate('/contact');
                      }}
                    >
                      <FaEnvelope style={styles.icon} /> Contact
                    </button>
                    <div style={styles.hr} />
                    <button
                      role="menuitem"
                      style={styles.item}
                      onClick={() => {
                        setOpen(false);
                        if (onLoginClick) {
                          onLoginClick();
                        } else {
                          navigate('/login');
                        }
                      }}
                    >
                      <FaUser style={styles.icon} /> Login
                    </button>
                  </div>
                )}
              </>
            ) : (
              // 💻 Desktop: show About, Contact, Login inline (no hamburger)
              <div style={styles.desktopLinksWrap}>
                
                <button
                  type="button"
                  style={styles.desktopLoginBtn}
                  onClick={() => {
                    if (onLoginClick) {
                      onLoginClick();
                    } else {
                      navigate('/login');
                    }
                  }}
                >
                  <FaUser style={{ fontSize: 14 }} />
                  <span>Login</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Modal: Avatar + Username */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Edit Profile"
        width={600}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Avatar uploader */}
          <ProfileAvatarUploader
            userId={user?.id}
            username={username}
            onUploaded={(baseUrl) => {
              // Keep a stable URL; use version bump to refresh
              const v = Date.now();
              setAvatarUrl(baseUrl);
              setAvatarVersion(v);
              window.dispatchEvent(
                new CustomEvent('avatar:updated', {
                  detail: { userId: user?.id, url: baseUrl, version: v }
                })
              );
            }}
          />

          {/* Username editor */}
          <div style={{ display: 'grid', gap: 6 }}>
            <label
              style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}
            >
              Username
            </label>

            <input
              value={formUsername}
              onChange={(e) =>
                setFormUsername(sanitizeUsername(e.target.value))
              }
              onBlur={handleUsernameBlur} // ← auto-save on blur
              onKeyDown={handleUsernameKeyDown} // ← Enter to blur (saves)
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #E5E7EB',
                outline: 'none',
                fontSize: 15
              }}
            />

            {/* status line */}
            <div style={{ minHeight: 20, fontSize: 13 }}>
              {unameStatus === 'checking' && <span>Checking availability…</span>}
              {unameStatus === 'invalid' && (
                <span style={{ color: '#B91C1C' }}>
                  {unameMsg || 'Invalid username.'}
                </span>
              )}
              {unameStatus === 'taken' && (
                <span style={{ color: '#B91C1C' }}>
                  {unameMsg || 'Username is already taken.'}
                </span>
              )}
              {unameStatus === 'ok' && unameMsg === 'Saved!' && (
                <span style={{ color: '#16A34A' }}>Saved!</span>
              )}
              {unameStatus === 'error' && (
                <span style={{ color: '#B91C1C' }}>
                  {unameMsg || 'Error'}
                </span>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* styles */
const styles = {
  topbar: {
    padding: '12px 20px',
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 50
  },

  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer'
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    objectFit: 'cover'
  },
  brand: {
    cursor: 'pointer',
    fontSize: 20,
    margin: 0,
    lineHeight: 1.2,
    fontWeight: 800,
    letterSpacing: '0.2px',
    backgroundImage:
      'linear-gradient(135deg, rgb(99, 102, 241), rgb(139, 92, 246))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },

  userWrap: { position: 'relative' },

  userBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    fontSize: 16,
    color: '#0F172A'
  },

  // Mobile hamburger button
  menuBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    cursor: 'pointer',
    padding: 0,
  },

  // Desktop inline links container
  desktopLinksWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  desktopLinkBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '6px 8px',
    fontSize: 14,
    color: '#4B5563',
    borderRadius: 999,
    fontWeight: 500,
  },

  desktopLoginBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    cursor: 'pointer',
    fontSize: 14,
    color: '#111827',
    fontWeight: 500
  },

  dropdown: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    minWidth: 200,
    background: '#ffffff',
    border: '1px solid #EEF2F7',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
    padding: 8,
    zIndex: 100
  },
  item: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 8,
    color: '#111827',
    textAlign: 'left',
    fontSize: '14px'
  },
  icon: { opacity: 0.9, color: '#4B5563' },
  hr: { height: 1, background: '#E5E7EB', margin: '6px 8px' }
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1000
  },
  card: {
    width: '100%',
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #E5E7EB'
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#0F172A'
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 18,
    padding: 6,
    color: '#6B7280'
  },
  body: { padding: 16 }
};
