// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  FaMapMarkedAlt,
  FaCalendarCheck,
  FaBell,
  FaMapMarkerAlt,
  FaTag,
  FaMoneyBillWave,
  FaChevronRight,
  FaPlus,
  FaComments,
  FaShareAlt,
  FaBroadcastTower,
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function Home() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [popular, setPopular] = useState([]);
  const [booking, setBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);


useEffect(() => {
  (async () => {
    setLoadingSuggestions(true);
    const { data, error } = await supabase
      .from('theVenues')
      .select('id, name, image_urls, location, rate, type, capacity_max, status')
      .eq('status', 'Active')                    // ✅ only Active venues
      .order('created_at', { ascending: false })
      .limit(8);

    if (!error) {
      setSuggestions((data || []).filter(v => v.status === 'Active'));
    }
    setLoadingSuggestions(false);
  })();
}, []);


  // ⚠️ TIP: put the route-distance call behind a serverless function (e.g. Supabase Edge Function)
  // to avoid exposing your API key. This client-side fallback uses approximate distance
  // when a route key is missing or the request fails.
  const getRouteDistance = async (fromLat, fromLng, toLat, toLng) => {
    const API_KEY = ''; // ← move to a serverless proxy; leave empty to use approx fallback
    if (!API_KEY) return Infinity;

    const url = `https://api.openrouteservice.org/v2/directions/driving-car`;
    const body = { coordinates: [[fromLng, fromLat], [toLng, toLat]] };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return Infinity;
      const meters = json?.routes?.[0]?.summary?.distance;
      return meters ? meters / 1000 : Infinity;
    } catch {
      return Infinity;
    }
  };

  useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();  // 👈 key change

    if (error) {
      console.error('Error fetching last booking:', error);
      return;
    }

    if (data) {
      setBooking(data); // user has at least 1 booking
    }
  })();
}, []);


  useEffect(() => {
    fetchNearbyVenues();
  }, []);

  // ✅ Use global auth modal instead of navigating to /login
  const handleListVenueClick = async () => {
    if (!user) {
      const res = await Swal.fire({
        icon: 'info',
        title: 'Login required',
        text: 'Please sign in to list your venue.',
        showCancelButton: true,
        confirmButtonText: 'Sign in',
        cancelButtonText: 'Cancel',
      });
      if (res.isConfirmed) {
        // Opens AuthModal via AppShell (listening for 'open-auth')
        window.dispatchEvent(new CustomEvent('open-auth'));
      }
      return;
    }
    navigate('/venue-onboarding');
  };

  const fetchNearbyVenues = () => {
    setLoadingPopular(true);

    if (!navigator.geolocation) {
      setLoadingPopular(false);
      Swal.fire({
        icon: 'warning',
        title: 'Geolocation Not Supported',
        text: 'Your browser does not support geolocation, so nearby venues cannot be displayed.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        const { data, error } = await supabase
          .from('theVenues')
          .select('id, name, image_urls, location, rate, type, capacity_max, lat, lng');

        if (error) {
          setLoadingPopular(false);
          return;
        }

        const venuesWithCoords = (data || []).filter(
          (v) => typeof v.lat === 'number' && typeof v.lng === 'number'
        );

        // 1) Cheap approximate distance to pre-filter
        const approx = venuesWithCoords
          .map(v => ({ ...v, approxKm: getDistance(latitude, longitude, v.lat, v.lng) }))
          .sort((a, b) => a.approxKm - b.approxKm)
          .slice(0, 20); // avoid hammering the route API

        // 2) Route distance only for the closest few; fallback to approx if route fails
        const promises = approx.map(async v => {
          const dist = await getRouteDistance(latitude, longitude, v.lat, v.lng);
          return { ...v, distance: Number.isFinite(dist) ? dist : v.approxKm };
        });
        const results = await Promise.all(promises);

        // 3) Present the tight top 6
        const sorted = results.sort((a, b) => a.distance - b.distance).slice(0, 5);

        setPopular(sorted);
        setLoadingPopular(false);
      },
      () => {
        setLoadingPopular(false);
        Swal.fire({
          icon: 'warning',
          title: 'Location Access Denied',
          text: 'Allow location access to see venues near you.',
        });
      }
    );
  };

  const username =
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'Guest';

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const chips = [
    'Function Hall',
    'Garden',
    'Rooftop',
    'Resort',
    'Restaurant',
    'Beachfront',
    'Ballroom',
    'Studio',
    'Conference Room',
  ];

  return (
    <div className="home-page" style={styles.screen}>
      {/* Header card — styled like Inva topbar */}
      <div className="app-header" style={styles.appHeader}>
        <div style={styles.headerMainRow}>
          <div style={styles.headerLeft}>
         
            <div style={styles.headerTitleRow}>
              <div style={styles.userGreeting}>
                <div style={styles.subtitle}>{greet}</div>
                <div style={styles.title}>Hi, {username} 👋</div>
              </div>
            </div>
            <div style={styles.headerHelper}>
              Finding the perfect venue has never been this easy. Tap Explore Venues and instantly discover places around you — or anywhere — without the hassle.
            </div>
          </div>

         
        </div>

        {/* CTA Buttons */}
        <div style={styles.ctaContainer}>
          <button
            type="button"
            onClick={() => navigate('/venues')}
            style={styles.exploreBtn}
            className="explore-btn"
            aria-label="Explore venues"
          >
            Explore Venues
          </button>

          <button
            type="button"
            onClick={handleListVenueClick}
            style={styles.listBtn}
            className="list-btn"
            aria-label="List your venue"
          >
            List Your Venue
          </button>
        </div>
      </div>

      {/* Suppliers / shortcuts — Inva-style chips */}
      <section style={styles.section}>
        <h3 style={styles.h3}>Suppliers & Tools</h3>
        <p style={styles.sectionHelper}>
          Quick shortcuts to your most-used tools while planning.
        </p>
        <div className="shortcuts-row" style={styles.shortcutsRow}>
<Shortcut
  label="Inva"
  icon={
    <img
      src="https://minftvflekxdoiubeujy.supabase.co/storage/v1/object/public/invite-photos/inva-logo.png"
      alt="Inva"
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        objectFit: 'cover',
        display: 'block'
      }}
    />
  }
  onClick={() => {
    window.location.href = 'weddinginvimaker.html';
  }}
/>

          <Shortcut
            label="Venue Map"
            icon={<FaMapMarkedAlt size={25} />}
            onClick={() => navigate('/venue-map')}
          />
          <Shortcut
            label="Events"
            icon={<FaBroadcastTower size={25} />}
            onClick={() => navigate('/live-events-map')}
          />
{/* 
<Shortcut
  label="Suppliers"
  icon={<FaShareAlt size={22} />}
  onClick={() => {
    Swal.fire({
      title: 'Coming Soon',
      text: 'This feature is currently under development.',
      icon: 'info',
      confirmButtonText: 'OK',
    });
  }}
/>
*/}

          <Shortcut
            label="Add Venue"
            icon={<FaPlus size={22} />}
            onClick={handleListVenueClick}
          />
        </div>
      </section>



      {/* Suggested */}
      <section style={styles.section}>
        <div style={styles.rowBetween}>
          <h3 style={styles.h3}>Suggested for you</h3>
          <SeeAll onClick={() => navigate('/venues')} />
        </div>

        <div style={styles.hScroll}>
          {loadingSuggestions
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : suggestions.map((v) => (
                <VenueCard key={v.id} v={v} onClick={() => navigate(`/venues/${v.id}`)} />
              ))}
          {!loadingSuggestions && suggestions.length === 0 && (
            <div style={styles.emptyText}>No suggestions yet. Try exploring venues!</div>
          )}
        </div>
      </section>

      {/* Popular Near You */}
      <section style={styles.section}>
        <div style={styles.rowBetween}>
          <h3 style={styles.h3}>Popular near you</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/venue-map')} style={styles.nearbyBtn}>
              <FaMapMarkedAlt size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              <span style={{ verticalAlign: 'middle', fontSize: 13 }}>Map</span>
            </button>
          </div>
        </div>

        <div>
          {loadingPopular
            ? Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)
            : popular.map((v) => (
                <CompactRow key={v.id} v={v} onClick={() => navigate(`/venues/${v.id}`)} />
              ))}
          {!loadingPopular && popular.length === 0 && (
            <div style={styles.emptyText}>Nothing nearby yet. Check back soon!</div>
          )}
        </div>
      </section>

      {/* --- BENEFITS / INFO CARDS --- */}
      <section style={styles.infoSection}>
        <h2 style={styles.hiwTitle}>Everything You Need</h2>
        <p style={styles.hiwSub}>
          All your venue planning tools in one bright, modern workspace.
        </p>
        <div style={styles.infoGrid}>
          <InfoCard
            icon={<FaMapMarkerAlt size={20} />}
            title="Find Perfect Venues"
            text="Browse curated venues with real photos, details, and handy filters."
          />
          <InfoCard
            icon={<FaComments size={20} />}
            title="Direct Communication"
            text="Chat directly with venue owners for faster, more personal responses."
          />
          <InfoCard
            icon={<FaCalendarCheck size={20} />}
            title="Easy Booking"
            text="Book instantly, keep details in one place, and stay on top of RSVPs."
          />
          <InfoCard
            icon={<FaShareAlt size={20} />}
            title="Share Experiences"
            text="See real events from other couples, and share your own celebration soon."
          />
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section style={styles.howSection}>
        <h2 style={styles.hiwTitle}>How It Works</h2>
        <p style={styles.hiwSub}>Three simple steps to your next celebration.</p>

        <div style={styles.stepsGrid}>
          <Step
            n={1}
            title="Search & Filter"
            text="Use filters to find venues that match your date, budget, and vibe."
          />
          <Step
            n={2}
            title="Connect & Chat"
            text="Message owners directly, ask questions, and confirm details."
          />
          <Step
            n={3}
            title="Book & Enjoy"
            text="Secure your booking and enjoy a smooth, well-planned event day."
          />
        </div>
      </section>

      {/* Spacer for safe bottom padding before any fixed nav */}
      <div style={{ height: 24 }} />
    </div>
  );
}

/* ---------- Small UI Parts ---------- */

function Shortcut({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.shortcut}>
      <div style={{ marginBottom: 6 }}>{icon}</div>
      <div style={styles.shortcutLabel}>{label}</div>
    </button>
  );
}

function SeeAll({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.seeAll}>
      See all <FaChevronRight size={11} />
    </button>
  );
}

function VenueCard({ v, onClick }) {
  const img = v.image_urls?.[0] || 'https://placehold.co/600x400?text=No+Photo';
  return (
    <button type="button" onClick={onClick} style={styles.card}>
      <div style={styles.cardImgWrap}>
        <img src={img} alt={v.name} style={styles.cardImg} loading="lazy" />
        {typeof v.rate === 'number' && (
          <div style={styles.badge}>
            <FaMoneyBillWave size={11} /> ₱{Number(v.rate).toLocaleString()}
          </div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle} title={v.name}>
          {v.name}
        </div>
        <div style={styles.metaRow}>
          <span style={styles.metaItem}>
            <FaMapMarkerAlt size={11} /> {v.location || '—'}
          </span>
          <span style={styles.metaItem}>
            <FaTag size={11} /> {v.type || '—'}
          </span>
        </div>
      </div>
    </button>
  );
}

function CompactRow({ v, onClick }) {
  const img = v.image_urls?.[0] || 'https://placehold.co/120x90?text=No+Photo';
  return (
    <button type="button" onClick={onClick} style={styles.rowCard}>
      <img src={img} alt={v.name} style={styles.rowImg} loading="lazy" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.rowTitle} title={v.name}>
          {v.name}
        </div>
        <div style={styles.rowMeta}>
          <FaMapMarkerAlt size={11} /> <span>{v.location || '—'}</span>
        </div>
        <div style={styles.rowMeta}>
          <FaTag size={11} /> <span>{v.type || '—'}</span>
        </div>
        {typeof v.distance === 'number' && (
          <div style={styles.rowMeta}>📍 {v.distance.toFixed(1)} km away</div>
        )}
      </div>
      <div style={styles.rowPriceWrap}>
        {typeof v.rate === 'number' ? (
          <span style={styles.rowPrice}>₱{Number(v.rate).toLocaleString()}</span>
        ) : (
          <span style={styles.rowPrice}>—</span>
        )}
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.cardImgWrap, background: '#e5e7f5' }}>
        <div style={styles.shimmer} />
      </div>
      <div style={styles.cardBody}>
        <div style={{ ...styles.skelLine, width: '70%' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ ...styles.skelPill, width: 80 }} />
          <div style={{ ...styles.skelPill, width: 70 }} />
        </div>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div style={styles.rowCard}>
      <div style={{ ...styles.rowImg, background: '#e5e7f5', position: 'relative', overflow: 'hidden' }}>
        <div style={styles.shimmer} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...styles.skelLine, width: '60%' }} />
        <div style={{ ...styles.skelLine, width: '40%', marginTop: 6 }} />
        <div style={{ ...styles.skelLine, width: '35%', marginTop: 6 }} />
      </div>
      <div style={styles.rowPriceWrap}>
        <div style={{ ...styles.skelLine, width: 60 }} />
      </div>
    </div>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <div style={styles.infoCard}>
      <span style={styles.infoIcon}>{icon}</span>
      <div>
        <h4 style={styles.infoTitle}>{title}</h4>
        <p style={styles.infoText}>{text}</p>
      </div>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div style={styles.stepCard}>
      <div style={styles.stepBadge}>{n}</div>
      <h4 style={styles.stepTitle}>{title}</h4>
      <p style={styles.stepText}>{text}</p>
    </div>
  );
}

/* ---------- Helpers ---------- */
// Haversine (km)
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---------- Styles (Inva-style theme) ---------- */
const bg = '#f5f7fb';
const bgSoft = '#ffffff';
const card = '#ffffff';
const cardSoft = '#f0f3f9';

const accent = '#635bff';
const accent2 = '#ff6ad5';
const accent3 = '#22c55e';

const text = '#0f172a';
const textMuted = '#64748b';
const borderSubtle = 'rgba(15, 23, 42, 0.08)';

const radiusLg = 18;
const radiusXl = 24;
const shadowSoft = '0 10px 30px rgba(15,23,42,0.08)';
const shadowStrong = '0 18px 50px rgba(15,23,42,0.12)';
const radiusPill = 999;

const styles = {
  screen: {
    minHeight: '100vh',
    padding: '20px 16px 96px',
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    color: text,
    background: `
      radial-gradient(1200px 700px at 10% -10%, #e9e7ff 0%, transparent 60%),
      radial-gradient(1000px 600px at 110% 0%, #ffe4f3 0%, transparent 55%),
      ${bg}
    `,
  },

  // Header card (like editor-topbar)
  appHeader: {
    maxWidth: 1120,
    margin: '0 auto 18px',
    padding: 18,
    borderRadius: 22,
    background:
      'radial-gradient(600px 260px at 0% 0%, rgba(99,91,255,.18), transparent 60%),' +
      'radial-gradient(520px 240px at 100% 0%, rgba(255,106,213,.16), transparent 60%),' +
      'radial-gradient(520px 240px at 50% 120%, rgba(34,197,94,.10), transparent 60%),' +
      bgSoft,
    border: `1px solid ${borderSubtle}`,
    boxShadow: shadowStrong,
    position: 'relative',
    overflow: 'hidden',
  },
  headerMainRow: {
    display: 'grid',
    gridTemplateColumns: '1.8fr auto',
    gap: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  appBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '5px 10px',
    borderRadius: radiusPill,
    background: 'rgba(15,23,42,0.86)',
    color: '#f9fafb',
    boxShadow: '0 8px 18px rgba(15,23,42,0.35)',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userGreeting: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  subtitle: {
    fontSize: 13,
    color: textMuted,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#0b1220',
  },
  headerHelper: {
    fontSize: 13,
    color: textMuted,
    marginTop: 4,
    padding: '6px 8px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.75)',
    border: '1px dashed rgba(15,23,42,0.06)',
    width: 'fit-content',
    maxWidth: '100%',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
    minWidth: 0,
  },
  profileButton: {
    background: '#ffffff',
    border: `1px solid ${borderSubtle}`,
    width: 40,
    height: 40,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f172a',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(15,23,42,0.18)',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: radiusPill,
    border: '1px solid rgba(34,197,94,0.25)',
    background: 'rgba(34,197,94,0.10)',
    color: '#0b7a39',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: '#22c55e',
  },

  // Sections / cards (like editor-section)
  section: {
    maxWidth: 1120,
    margin: '0 auto 14px',
    padding: '14px 14px 12px',
    borderRadius: 16,
    background: card,
    border: `1px solid ${borderSubtle}`,
    boxShadow: shadowSoft,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionHelper: {
    fontSize: 12,
    color: textMuted,
    marginTop: 2,
  },
  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  h3: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.13em',
    color: textMuted,
  },
  seeAll: {
    background: '#ffffff',
    borderRadius: 999,
    border: `1px solid ${borderSubtle}`,
    padding: '6px 11px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    color: '#4f46e5',
    boxShadow: '0 6px 14px rgba(15,23,42,0.07)',
  },

  // Chips row
  chipsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingTop: 4,
    paddingBottom: 4,
    WebkitOverflowScrolling: 'touch',
  },
  chip: {
    background: cardSoft,
    borderRadius: 999,
    border: `1px solid ${borderSubtle}`,
    padding: '7px 13px',
    fontSize: 13,
    fontWeight: 600,
    color: text,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },

  // Horizontal scroll cards
  hScroll: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 10,
    WebkitOverflowScrolling: 'touch',
  },

  // Venue card
  card: {
    minWidth: 210,
    maxWidth: 240,
    background: card,
    borderRadius: radiusLg,
    border: `1px solid ${borderSubtle}`,
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: shadowSoft,
    flexShrink: 0,
    padding: 0,
  },
  cardImgWrap: {
    position: 'relative',
    width: '100%',
    height: 136,
    overflow: 'hidden',
    background: '#0b0f14',
  },
  cardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    background: 'rgba(15,23,42,0.96)',
    color: '#f9fafb',
    fontSize: 12,
    padding: '6px 11px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 10px 24px rgba(15,23,42,0.45)',
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: 700,
    color: text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
  },
  metaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 6,
    fontSize: 12,
    color: textMuted,
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },

  // Popular rows
  rowCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    background: card,
    borderRadius: radiusLg,
    border: `1px solid ${borderSubtle}`,
    marginBottom: 10,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: shadowSoft,
  },
  rowImg: {
    width: 94,
    height: 70,
    objectFit: 'cover',
    borderRadius: 14,
    flexShrink: 0,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: 700,
    color: text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  rowPriceWrap: {
    marginLeft: 'auto',
    marginRight: 2,
  },
  rowPrice: {
    background: 'rgba(99,91,255,0.10)',
    color: '#312e81',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  emptyText: {
    color: textMuted,
    fontSize: 13,
    padding: '6px 0 2px',
    textAlign: 'center',
  },

  // Skeleton shimmer
  shimmer: {
    width: '150%',
    height: '100%',
    background:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.8) 50%, rgba(255,255,255,0) 100%)',
    animation: 'shimmer 1.2s infinite',
  },
  skelLine: {
    height: 12,
    borderRadius: 999,
    background: '#e2e8f0',
  },
  skelPill: {
    height: 10,
    borderRadius: 999,
    background: '#e2e8f0',
  },

  // Shortcuts (Suppliers)
  shortcutsRow: {
    display: 'flex',
    gap: 10,
    marginTop: 10,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 6,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  shortcut: {
    background: cardSoft,
    borderRadius: 16,
    border: `1px solid ${borderSubtle}`,
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    textAlign: 'center',
    color: accent,
    cursor: 'pointer',
    flexShrink: 0,
    width: 96,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    display: 'block',
  },

  // CTA buttons
  ctaContainer: {
    marginTop: 10,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 10,
    alignItems: 'center',
  },
  exploreBtn: {
    width: '100%',
    borderRadius: radiusLg,
    border: 'none',
    padding: '14px 16px',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    background:
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    boxShadow:
      '0 12px 24px rgba(79,70,229,0.35), 0 2px 8px rgba(15,23,42,0.23)',
  },
  listBtn: {
    width: '100%',
    borderRadius: radiusLg,
    padding: '14px 16px',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    border: '1.5px dashed rgba(99,91,255,0.6)',
    background: 'rgba(255,255,255,0.92)',
    color: '#4338ca',
    boxShadow: '0 8px 18px rgba(15,23,42,0.10)',
  },

  // Info / Benefits
  infoSection: {
    maxWidth: 1120,
    margin: '0 auto 14px',
    padding: '14px 14px 10px',
    borderRadius: 16,
    background: card,
    border: `1px solid ${borderSubtle}`,
    boxShadow: shadowSoft,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    marginTop: 10,
  },
  infoCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    background: cardSoft,
    border: `1px solid ${borderSubtle}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#ffffff',
    background:
      'linear-gradient(135deg, rgba(99,91,255,1), rgba(255,106,213,1))',
    boxShadow: '0 10px 22px rgba(148,27,181,0.35)',
  },
  infoTitle: {
    margin: '2px 0 4px',
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: text,
  },
  infoText: {
    margin: 0,
    color: textMuted,
    fontSize: 14,
    lineHeight: 1.55,
  },

  // How it works
  howSection: {
    maxWidth: 1120,
    margin: '0 auto 18px',
    padding: '16px 14px 18px',
    borderRadius: 16,
    background: card,
    border: `1px solid ${borderSubtle}`,
    boxShadow: shadowSoft,
  },
  hiwTitle: {
    textAlign: 'center',
    margin: '0 0 4px',
    fontSize: 'clamp(20px, 4.2vw, 30px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: text,
  },
  hiwSub: {
    textAlign: 'center',
    margin: '0 0 14px',
    color: textMuted,
    fontSize: 14.5,
  },
  stepsGrid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    marginTop: 4,
  },
  stepCard: {
    textAlign: 'center',
    background: cardSoft,
    border: `1px solid ${borderSubtle}`,
    borderRadius: 16,
    padding: '18px 14px 20px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  },
  stepBadge: {
    width: 60,
    height: 60,
    borderRadius: 999,
    margin: '0 auto 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.5), transparent 60%),' +
      'linear-gradient(135deg, #6366f1, #ec4899)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 22,
    boxShadow: '0 14px 30px rgba(148,27,181,0.4)',
  },
  stepTitle: {
    margin: '0 0 6px',
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: text,
  },
  stepText: {
    margin: 0,
    color: textMuted,
    fontSize: 14,
    lineHeight: 1.6,
  },

  // Map button
  nearbyBtn: {
    background: '#ffffff',
    color: '#4f46e5',
    borderRadius: 999,
    border: `1px solid ${borderSubtle}`,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
  },
};

/* --------- One-time CSS injections --------- */
(function ensureKeyframes() {
  const id = 'home-shimmer-keyframes';
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.innerHTML = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .shortcuts-row::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
})();

(function injectGlobalCSS() {
  if (typeof document === 'undefined' || document.getElementById('home-global-css')) return;
  const styleElement = document.createElement('style');
  styleElement.id = 'home-global-css';
  styleElement.textContent = `
    .app-header button { outline: none; }
    .explore-btn:hover {
      transform: translateY(-1px);
      filter: saturate(1.03);
    }
    .list-btn:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,0.98);
    }
    .explore-btn:active,
    .list-btn:active {
      transform: translateY(0);
    }
  `;
  document.head.append(styleElement);
})();
