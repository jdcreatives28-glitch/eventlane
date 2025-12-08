// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaMapMarkerAlt, FaCalendarCheck, FaInfoCircle, FaEnvelope } from 'react-icons/fa';
import { FaHouse, FaMessage, FaBullhorn } from 'react-icons/fa6';
import { useUnread } from '../context/UnreadProvider';

// 🎨 Global-quality Canva / Inva-inspired tokens (no green)
const THEME = {
  bg: '#f5f7fb',
  card: '#ffffff',
  cardSoft: '#f0f3f9',
  accent: '#635bff', // primary purple
  accent2: '#ff6ad5', // pink accent
  accentSoft: 'rgba(99,91,255,0.10)',
  accentSoftStrong: 'rgba(99,91,255,0.22)',
  text: '#0f172a',
  textMuted: '#64748b',
  borderSubtle: 'rgba(148,163,184,0.30)',
  shadow: '0 18px 45px rgba(15,23,42,0.12)',
};

function Badge({ count }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className="sidebar-badge"
      style={{
        marginLeft: 'auto',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        background: 'linear-gradient(135deg, #635bff, #ff6ad5)',
        color: '#ffffff',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
        lineHeight: 1.6,
        letterSpacing: 0.2,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { unread, bookingUnread: providerBookingUnread } = useUnread();

  const [bookingUnread, setBookingUnread] = useState(
    typeof providerBookingUnread === 'number' ? providerBookingUnread : 0
  );

  useEffect(() => {
    if (typeof providerBookingUnread === 'number') {
      setBookingUnread(providerBookingUnread);
    }
  }, [providerBookingUnread]);

  const items = [
    { label: 'Home',      icon: <FaHouse />,        path: '/' },
    { label: 'Social',    icon: <FaBullhorn />,     path: '/events' },
    { label: 'Venues',    icon: <FaMapMarkerAlt />, path: '/venues' },
    { label: 'Bookings',  icon: <FaCalendarCheck />, path: '/booking',  count: bookingUnread },
    { label: 'Messages',  icon: <FaMessage />,      path: '/messages',  count: unread },
    // ✅ New static pages for Xendit requirements
    { label: 'About Us',  icon: <FaInfoCircle />,   path: '/about' },
    { label: 'Contact',   icon: <FaEnvelope />,     path: '/contact' },
  ];

  return (
    <aside
      className="sidebar"
      aria-label="Main menu"
      style={{
        background:
          'radial-gradient(circle at top left, #fdfbff 0, #f5f7fb 40%, #e9edff 100%)',
        borderRadius: 0,
        padding: '14px 10px 16px',
        boxShadow: THEME.shadow,
        border: `1px solid ${THEME.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        maxWidth: 230,
      }}
    >
      {/* Tiny brand / section label */}
      <div
        className="sidebar-header"
        style={{
          padding: '2px 10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '.2em',
            color: THEME.textMuted,
            fontWeight: 700,
          }}
        >
          Navigation
        </span>
      </div>

      <nav
        className="sidebar-nav"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            aria-label={
              item.count && item.count > 0
                ? `${item.label} (${item.count} ${
                    item.label === 'Messages' ? 'unread' : 'updates'
                  })`
                : item.label
            }
            onClick={(e) => {
              // keep your "refresh if already on Social" behavior
              if (item.path === '/events' && pathname === '/events') {
                e.preventDefault();
                window.socialTabRefresh?.(true);
              }
            }}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <div
                className="sidebar-item"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 9px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? THEME.text : THEME.textMuted,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99,91,255,0.20), rgba(255,106,213,0.11))'
                    : 'rgba(255,255,255,0.80)',
                  border: '1px solid transparent',
                  borderLeft: 'none',
                  cursor: 'pointer',
                  transition:
                    'background .16s ease, transform .1s ease, box-shadow .18s ease, color .12s ease, border-color .12s ease',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.98)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.80)';
                  }
                }}
              >
                {/* subtle active glow ring */}
                {isActive && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: -1,
                      borderRadius: 999,
                      background:
                        'radial-gradient(circle at left, rgba(255,255,255,0.7), transparent 55%)',
                      opacity: 0.8,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                <span
                  className="sidebar-icon"
                  style={{
                    position: 'relative',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    background: isActive
                      ? 'rgba(255,255,255,0.95)'
                      : 'rgba(148,163,184,0.16)',
                    color: isActive ? THEME.accent : THEME.textMuted,
                    boxShadow: isActive
                      ? '0 0 0 1px rgba(99,91,255,0.25)'
                      : 'none',
                    zIndex: 1,
                  }}
                >
                  {item.icon}
                </span>

                <span
                  className="sidebar-label"
                  style={{
                    flex: '0 1 auto',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    zIndex: 1,
                  }}
                >
                  {item.label}
                </span>

                <div style={{ zIndex: 1 }}>
                  <Badge count={item.count || 0} />
                </div>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
