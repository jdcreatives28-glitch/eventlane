// src/components/VenueCard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { FaRegHeart, FaHeart, FaMapMarkerAlt } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/* ---------- Inva-style design tokens ---------- */
const bg = '#f5f7fb';
const bgSoft = '#ffffff';
const card = '#ffffff';
const cardSoft = '#f0f3f9';

const accent = '#6366f1';     // main purple accent
const accent2 = '#ff6ad5';    // pink
const accent3 = '#22c55e';    // green

const text = '#0f172a';
const textMuted = '#64748b';
const borderSubtle = 'rgba(15, 23, 42, 0.08)';

const radiusLg = 18;
const radiusMd = 14;
const radiusSm = 10;
const shadowSoft = '0 10px 30px rgba(15,23,42,0.08)';
const shadowMedium = '0 8px 22px rgba(15,23,42,0.10)';

const ACCENT = accent; // used for icon + price chip

export default function VenueCard({ venue, imageHeight = 220, onFavoriteChange }) {
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // slider state
  const photos = Array.isArray(venue?.image_urls) && venue.image_urls.length
    ? venue.image_urls.filter(Boolean)
    : [venue?.thumbnail || 'https://placehold.co/600x400?text=No+Image'];
  const hasMany = photos.length > 1;
  const [idx, setIdx] = useState(0);
  const startX = useRef(null);
  const deltaX = useRef(0);
  const dragging = useRef(false);

  const goTo = (i) => {
    const len = photos.length;
    const next = ((i % len) + len) % len;
    setIdx(next);
  };
  const goBy = (delta) => goTo(idx + delta);

  const onTouchStart = (e) => { startX.current = e.touches?.[0]?.clientX ?? 0; deltaX.current = 0; dragging.current = true; };
  const onTouchMove  = (e) => { if (startX.current == null) return; deltaX.current = (e.touches?.[0]?.clientX ?? 0) - startX.current; };
  const onTouchEnd   = () => {
    const threshold = 50;
    if (deltaX.current > threshold) goBy(-1);
    else if (deltaX.current < -threshold) goBy(1);
    startX.current = null; deltaX.current = 0; dragging.current = false;
  };

  // Optional mouse drag (desktop)
  const onMouseDown = (e) => { startX.current = e.clientX; dragging.current = true; };
  const onMouseMove = (e) => { if (!dragging.current || startX.current == null) return; deltaX.current = e.clientX - startX.current; };
  const onMouseUp   = () => onTouchEnd();
  const onMouseLeave = () => { if (dragging.current) onTouchEnd(); };

  // Load auth + favorite state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;

        if (user) {
          setUserId(user.id);
          const { data: existing, error } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('venue_id', venue.id)
            .maybeSingle();

          if (!error) setIsFav(!!existing);
        } else {
          setUserId(null);
          setIsFav(false);
        }
      } catch (e) {
        console.warn('Fav check failed:', e?.message || e);
      }
    })();
    return () => { mounted = false; };
  }, [venue.id]);

  // Toggle favorite (INSERT / DELETE; no upsert)
  const toggleFavorite = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (favBusy) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Please log in to favorite venues.'); return; }
    const uid = user.id;

    const next = !isFav;
    setIsFav(next);
    setFavBusy(true);

    try {
      if (next) {
        const { error } = await supabase
          .from('favorites')
          .insert([{ user_id: uid, venue_id: venue.id, earned_points: 1, action_source: 'favorite' }], { returning: 'minimal' });
        if (error && error.code !== '23505' && !/duplicate/i.test(error.message || '')) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', uid)
          .eq('venue_id', venue.id);
        if (error) throw error;
      }
      onFavoriteChange?.(venue.id, next);
    } catch (err) {
      setIsFav(!next); // revert
      console.error('Favorite toggle error:', err);
      alert('Sorry, failed to update favorite. Please try again.');
    } finally {
      setFavBusy(false);
    }
  };

  // Display helpers
  const price = venue.rate ? `₱${Number(venue.rate).toLocaleString()}` : '₱—';
  const cap = venue.capacity_max ? `${venue.capacity_max} pax` : '—';
  const type = venue.type || '—';
  const locationText = formatLocation(venue.location || venue.address || '');

  return (
    <div
      className="venue-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/venues/${venue.id}`)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/venues/${venue.id}`)}
      style={s.card}
    >
      {/* Image / Slider */}
      <div
        style={{ ...s.imgWrap, height: imageHeight }}
        onTouchStart={hasMany ? onTouchStart : undefined}
        onTouchMove={hasMany ? onTouchMove : undefined}
        onTouchEnd={hasMany ? onTouchEnd : undefined}
        onMouseDown={hasMany ? (e) => { e.preventDefault(); onMouseDown(e); } : undefined}
        onMouseMove={hasMany ? onMouseMove : undefined}
        onMouseUp={hasMany ? onMouseUp : undefined}
        onMouseLeave={hasMany ? onMouseLeave : undefined}
      >
        {!imgLoaded && (
          <div aria-hidden="true" style={s.shimmerWrap}>
            <div style={s.shimmer} />
          </div>
        )}

        <div
          className="vc-track"
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            transform: `translateX(-${idx * 100}%)`,
            transition: dragging.current ? 'none' : 'transform .35s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {photos.map((src, i) => (
            <div key={`${src}-${i}`} style={{ flex: '0 0 100%', height: '100%' }}>
              <img
                src={src}
                alt={`${venue.name} - photo ${i + 1}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                style={s.img}
              />
            </div>
          ))}
        </div>

        {/* Outline-only arrows (no circle background) */}
        {hasMany && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); goBy(-1); }}
              style={navBtnStyle('left')}
            >
              <FiChevronLeft size={28} style={chevIconStyle} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); goBy(1); }}
              style={navBtnStyle('right')}
            >
              <FiChevronRight size={28} style={chevIconStyle} />
            </button>

            {/* Small index dots */}
            <div style={dotWrapStyle}>
              {photos.map((_, i) => (
                <i key={i} style={{ ...dotStyle, opacity: i === idx ? 1 : .45 }} />
              ))}
            </div>
          </>
        )}

        {/* Favorite (glossy mini) */}
        <button
          className={`fav-btn ${isFav ? 'is-fav' : ''}`}
          onClick={toggleFavorite}
          aria-pressed={isFav}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          disabled={favBusy}
        >
          {isFav ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
        </button>
      </div>

      {/* Body */}
      <div style={s.body}>
        <h4 style={s.title}>{venue.name}</h4>

        <p style={s.meta}>
          <FaMapMarkerAlt size={13} color={ACCENT} />
          <span>{locationText}</span>
        </p>

        <div style={s.chips}>
          <span className="vc-chip" style={{ ...chipBase, ...chipAccent }}>{price}</span>
          <span className="vc-chip" style={{ ...chipBase }}>{cap}</span>
          <span className="vc-chip" style={{ ...chipBase }}>{type}</span>
        </div>
      </div>

      {/* Local CSS */}
      <style>{css}</style>
    </div>
  );
}

/* ===========================
   Styles
   =========================== */
const s = {
  card: {
    background: card,
    border: `1px solid ${borderSubtle}`,
    borderRadius: radiusLg,
    overflow: 'hidden',
    boxShadow: shadowSoft,
    cursor: 'pointer',
    outline: 'none',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform .12s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease',
  },
  imgWrap: {
    width: '100%',
    position: 'relative',
    background: '#0b1020',
  },
  shimmerWrap: {
    position: 'absolute',
    inset: 0,
    background: '#1e293b',
    overflow: 'hidden',
    zIndex: 1,
  },
  shimmer: {
    position: 'absolute',
    inset: 0,
    transform: 'translateX(-100%)',
    background: 'linear-gradient(90deg, rgba(15,23,42,0), rgba(248,250,252,.7), rgba(15,23,42,0))',
    animation: 'sk-shimmer 1.1s infinite',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  body: {
    padding: 14,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,1))',
  },
  title: {
    margin: 0,
    fontWeight: 800,
    fontSize: 16,
    lineHeight: '22px',
    color: text,
    letterSpacing: '-0.02em',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: textMuted,
    margin: '8px 0 12px',
    fontSize: 13,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chips: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
};

// Chip styles — Inva style (soft, pill, slight gloss)
const chipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 999,
  background: cardSoft,
  border: `1px solid ${borderSubtle}`,
  color: text,
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: '.03em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
};

const chipAccent = {
  borderColor: ACCENT,
  background:
    'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.4), transparent 55%),' +
    'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(129,140,248,0.24))',
  color: '#1d2748',
};

// Small location formatter (obj or string)
function formatLocation(raw) {
  if (!raw) return '—';
  if (typeof raw === 'object' && raw !== null) {
    const parts = [raw.barangay, raw.city || raw.municipality, raw.province]
      .filter(Boolean)
      .map(s => String(s).trim());
    if (parts.length) return parts.join(', ');
  }
  let s = String(raw).trim();
  s = s.replace(/\s*[|/]\s*/g, ', ');
  s = s.replace(/\s*,\s*,+/g, ', ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

/* ====== Image nav controls (outline-only arrows) ====== */
const navBtnStyle = (side) => ({
  position: 'absolute',
  top: '50%',
  [side]: 8,
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  padding: 6,
  lineHeight: 0,
  cursor: 'pointer',
  zIndex: 2,
});
const chevIconStyle = {
  color: '#ffffff',
  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.7))',
};

/* Dots under image (centered) */
const dotWrapStyle = {
  position: 'absolute',
  bottom: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 6,
  zIndex: 1,
};
const dotStyle = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: 'rgba(15,23,42,.12)',
  boxShadow: '0 0 0 1px rgba(255,255,255,.9)',
};

/* Tiny CSS for hover & states + fav-btn (Inva style) */
const css = `
@keyframes sk-shimmer { 100% { transform: translateX(100%); } }

.venue-card:hover{
  transform: translateY(-2px);
  box-shadow: 0 16px 38px rgba(15,23,42,0.15);
  border-color: rgba(129,140,248,0.55);
}

/* Favorite button — glossy, blur, purple when active */
.fav-btn{
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,0.14);
  background: rgba(15,23,42,0.55);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(248,250,252,0.9);
  box-shadow: 0 10px 28px rgba(15,23,42,0.35);
  transform-origin: center center;
  z-index: 2;
  transition: transform .1s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease, color .15s ease;
}
.fav-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(15,23,42,0.45);
}
.fav-btn:active{ transform: scale(.96); }
.fav-btn[disabled]{ pointer-events: none; opacity: .85; }

/* Favorited state: purple-pink gradient + white icon */
.fav-btn.is-fav{
  background:
    radial-gradient(circle at 0% 0%, rgba(255,255,255,0.6), transparent 55%),
    linear-gradient(135deg, ${accent}, ${accent2});
  border-color: rgba(129,140,248,0.8);
  color: #ffffff;
}

/* Chip subtle interactive feel */
.vc-chip{
  transition: transform .1s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease;
}
.vc-chip:hover{
  transform: translateY(-1px);
  border-color: rgba(148,163,184,0.9);
  box-shadow: 0 6px 16px rgba(15,23,42,0.12);
}
`;

