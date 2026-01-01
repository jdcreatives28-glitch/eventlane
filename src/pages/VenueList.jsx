// src/pages/VenueList.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import VenueCard from '../components/VenueCard';
import { SlidersHorizontal } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FaMapMarkedAlt, FaArrowLeft } from 'react-icons/fa';

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  ZoomControl,
  useMapEvent,
  Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../leaflet-overrides.css';
import L from 'leaflet';
import { FiMapPin, FiTag, FiUsers, FiNavigation } from 'react-icons/fi';
import ReactDOMServer from 'react-dom/server';

/* ---------- Leaflet default marker override ---------- */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ---------------- Helper: query params ---------------- */
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

/* ---------- Map helpers & hooks (embedded) ---------- */

function MapEvents({ onViewportChange }) {
  const draggingRef = useRef(false);
  const dragTimeoutRef = useRef(null);

  // User starts moving the map
  useMapEvent('movestart', () => {
    draggingRef.current = true;
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
  });

  // Movement stops: update bounds, but keep "dragging" true for a short time
  useMapEvent('moveend', (e) => {
    onViewportChange?.(e.target.getBounds());

    // Grace period so the synthetic click after drag is ignored
    dragTimeoutRef.current = setTimeout(() => {
      draggingRef.current = false;
      dragTimeoutRef.current = null;
    }, 150); // tweak if needed (100–200ms is usually enough)
  });

  useMapEvent('zoomend', (e) => {
    onViewportChange?.(e.target.getBounds());
  });

  useMapEvent('resize', (e) => {
    onViewportChange?.(e.target.getBounds());
  });

  // Custom click handler: close popup ONLY on real background clicks
  useMapEvent('click', (e) => {
    // If we just finished a drag, ignore this click
    if (draggingRef.current) return;

    const domTarget = e.originalEvent?.target;

    if (domTarget && domTarget.closest) {
      // Ignore clicks on popups, popup content, or markers
      if (
        domTarget.closest('.leaflet-popup') ||
        domTarget.closest('.venue-card') ||            // your popup card
        domTarget.closest('.leaflet-marker-pane')      // markers
      ) {
        return;
      }
    }

    // ✅ Real click on map background → close all popups
    e.target.closePopup();
  });

  // Clean up timeout when component unmounts
  React.useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  return null;
}




function useFooterHeight(defaultH = 68) {
  const [h, setH] = useState(defaultH);
  useEffect(() => {
    const SELECTORS = ['#footernav', '.mobile-footer', '.footer-nav', '.app-footer', '.bottom-nav'];
    const findFooter = () => document.querySelector(SELECTORS.join(', '));
    const measure = () => setH(findFooter()?.offsetHeight || defaultH);
    measure();
    let ro;
    const el = findFooter();
    if (el && 'ResizeObserver' in window) {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      if (ro && el) ro.unobserve(el);
    };
  }, [defaultH]);
  return h;
}

function useTopbarHeight(defaultH = 56) {
  const [h, setH] = useState(defaultH);
  useEffect(() => {
    const SELECTORS = ['.topbar', '#topbar', '.app-topbar'];
    const findTopbar = () => document.querySelector(SELECTORS.join(', '));
    const measure = () => setH(findTopbar()?.offsetHeight || defaultH);
    measure();
    let ro;
    const el = findTopbar();
    if (el && 'ResizeObserver' in window) {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      if (ro && el) ro.unobserve(el);
    };
  }, [defaultH]);
  return h;
}

function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width:${breakpoint}px)`);

    const handler = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);

    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);

  return isDesktop;
}

/* --- data helpers --- */
const imagesFrom = (img) => {
  if (Array.isArray(img)) return img.filter(Boolean);
  if (typeof img === 'string') {
    try {
      const arr = JSON.parse(img);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {}
  }
  return [];
};
const firstImage = (img) =>
  imagesFrom(img)[0] || 'https://placehold.co/800x500?text=Venue';

const R = 6371; // Earth's radius in kilometers
const kmBetween = (aLat, aLng, bLat, bLng) => {
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const gmapsUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

const userIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.25), 0 0 0 2px #fff;"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/* ---------------- Main component ---------------- */

export default function VenueList() {
  const query = useQuery();
  const navigate = useNavigate();

  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Filters from URL
  const [search, setSearch] = useState(query.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(query.get('type') || '');
  const [priceFilter, setPriceFilter] = useState(query.get('price') || '');
  const [capacityFilter, setCapacityFilter] = useState(query.get('capacity') || '');

  const [regionId, setRegionId] = useState(query.get('region_id') || '');
  const [provinceId, setProvinceId] = useState(query.get('province_id') || '');
  const [cityId, setCityId] = useState(query.get('city_id') || '');

  // Dropdown data + loaders
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  const [provinces, setProvinces] = useState([]);
  const [provincesLoading, setProvincesLoading] = useState(false);

  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [hasInteractedWithFilter, setHasInteractedWithFilter] = useState(false);
  const [debounced, setDebounced] = useState(search);

  const [userCoords, setUserCoords] = useState(null);

  const isDesktop = useIsDesktop(1024);

  const [mapBounds, setMapBounds] = useState(null);
  const [hoveredVenueId, setHoveredVenueId] = useState(null);

  const mapRef = useRef(null);
 

  const footerH = useFooterHeight(68);
  const topbarH = useTopbarHeight(56);

  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);

  // Ask for location once
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserCoords(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // Mobile: open inline full-screen map instead of navigating
  const openMapNearMe = () => {
    setIsMobileMapOpen(true);
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (priceFilter) params.set('price', priceFilter);
    if (capacityFilter) params.set('capacity', capacityFilter);
    if (search) params.set('search', search);
    if (regionId) params.set('region_id', regionId);
    if (provinceId) params.set('province_id', provinceId);
    if (cityId) params.set('city_id', cityId);
    navigate({ search: params.toString() }, { replace: true });
  }, [typeFilter, priceFilter, capacityFilter, search, regionId, provinceId, cityId, navigate]);

  /* ---------------- Load master data for dropdowns ---------------- */

  // 1) Regions
  useEffect(() => {
    let alive = true;
    (async () => {
      setRegionsLoading(true);
      const { data, error } = await supabase
        .from('ph_regions')
        .select('id, name, short_name')
        .order('name', { ascending: true });

      if (!alive) return;
      if (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Failed to load regions' });
        setRegions([]);
      } else {
        setRegions(data || []);
      }
      setRegionsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Provinces when region changes
  useEffect(() => {
    let alive = true;
    if (!regionId) {
      setProvinces([]);
      setProvinceId('');
      setCities([]);
      setCityId('');
      return;
    }
    (async () => {
      setProvincesLoading(true);
      const { data, error } = await supabase
        .from('ph_provinces')
        .select('id, name')
        .eq('region_id', regionId)
        .order('name', { ascending: true });

      if (!alive) return;
      if (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Failed to load provinces' });
        setProvinces([]);
      } else {
        setProvinces(data || []);
      }
      setProvincesLoading(false);

      setProvinceId(prev => (data?.some(d => d.id === prev) ? prev : ''));
      setCityId('');
      setCities([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  // 3) Cities when province changes
  useEffect(() => {
    let alive = true;
    if (!provinceId) {
      setCities([]);
      setCityId('');
      return;
    }
    (async () => {
      setCitiesLoading(true);
      const { data, error } = await supabase
        .from('ph_cities_muns')
        .select('id, name, kind')
        .eq('province_id', provinceId)
        .order('name', { ascending: true });

      if (!alive) return;
      if (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Failed to load cities/municipalities' });
        setCities([]);
      } else {
        setCities(data || []);
      }
      setCitiesLoading(false);

      setCityId(prev => (data?.some(d => d.id === prev) ? prev : ''));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId]);

  /* ---------------- Load venues (ALL active, no region filter) ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from('v_thevenues')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error) {
        console.error(error);
        setErr('Failed to load venues. Please try again.');
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to load venues. Please try again later.',
        });
      } else {
        const normalized = (data || []).map((v) => {
          const city = v.city_name || v.city || '';
          const province = v.province_name || v.province || '';
          const region = v.region_short_name || v.region_name || v.region || '';

          const locationFromParts = [v.barangay || v.brgy || '', city, province]
            .filter(Boolean)
            .join(', ');

          const displayLocation =
            v.location || v.address || locationFromParts || region || '';

          return {
            ...v,
            location: displayLocation,
            displayLocation,
            thumbnail:
              Array.isArray(v.image_urls) && v.image_urls.length
                ? v.image_urls[0]
                : v.cover_url || null,
          };
        });
        setVenues(normalized);
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []); // ← only once, all venues

  const filteredVenues = useMemo(() => {
    const term = debounced.trim().toLowerCase();

    return venues.filter((v) => {
      const categorySource = [
        v.event_categories,
        v.event_types,
        v.event_type,
        v.category,
        v.suitable_for,
        v.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // search by event category/tags
      const matchesSearch = !term || categorySource.includes(term);

      const matchesType = !typeFilter || v.type === typeFilter;

      const rate = Number(v.rate) || 0;
      const matchesPrice =
        !priceFilter ||
        (priceFilter === '1-10000' && rate <= 10000) ||
        (priceFilter === '10001-30000' && rate > 10000 && rate <= 30000) ||
        (priceFilter === '30001-' && rate > 30000);

      const cap = Number(v.capacity_max) || 0;
      const matchesCapacity =
        !capacityFilter ||
        (capacityFilter === '10-50' && cap >= 10 && cap <= 50) ||
        (capacityFilter === '51-150' && cap >= 51 && cap <= 150) ||
        (capacityFilter === '151-250' && cap >= 151 && cap <= 250) ||
        (capacityFilter === '251-350' && cap >= 251 && cap <= 350) ||
        (capacityFilter === '351-' && cap >= 351);

      // ✅ NEW: location filters applied client-side
      const matchesRegion = !regionId || v.region_id === regionId;
      const matchesProvince = !provinceId || v.province_id === provinceId;
      const matchesCity = !cityId || v.city_id === cityId;

      return (
        matchesSearch &&
        matchesType &&
        matchesPrice &&
        matchesCapacity &&
        matchesRegion &&
        matchesProvince &&
        matchesCity
      );
    });
  }, [
    venues,
    debounced,
    typeFilter,
    priceFilter,
    capacityFilter,
    regionId,
    provinceId,
    cityId,
  ]);

  /* ---------------- Venue list (search + filters only) ---------------- */
  const venuesForList = filteredVenues;

  /* ---------------- Filter button glow ---------------- */
  const shouldGlow =
    !loading &&
    !err &&
    filteredVenues.length === 0 &&
    !hasInteractedWithFilter &&
    !search &&
    !typeFilter && !priceFilter && !capacityFilter &&
    !regionId && !provinceId && !cityId;

  /* ---------------- Handlers ---------------- */
  const handlePickRegion = (id) => {
    setRegionId(id);
    setProvinceId('');
    setCityId('');
  };
  const handlePickProvince = (id) => {
    setProvinceId(id);
    setCityId('');
  };
  const handlePickCity = (id) => {
    setCityId(id);
  };

  const mapFilters = {
    type: typeFilter || '',
    price: priceFilter || '',
    capacity: capacityFilter || '',
    regionId: regionId || '',
    provinceId: provinceId || '',
    cityId: cityId || '',
    search: search || '',
  };

  const { mapCenter, mapZoom, mapKey } = useMemo(() => {
    // Prefer the first venue actually shown in the list
    const sourceForCenter =
      filteredVenues && filteredVenues.length > 0
        ? filteredVenues
        : venues; // fallback: first venue in the region

    if (sourceForCenter && sourceForCenter.length > 0) {
      const first = sourceForCenter[0];
      const lat = Number(first.lat);
      const lng = Number(first.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          mapCenter: [lat, lng],
          mapZoom: regionId ? 9 : 10,
          mapKey: `region-${regionId || 'all'}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        };
      }
    }

    // Fallback: whole PH
    return {
      mapCenter: [12.8797, 121.774],
      mapZoom: 6,
      mapKey: 'default-ph',
    };
  }, [filteredVenues, venues, regionId]);

  /* ---------- marker + popup helpers ---------- */

  const chip = (icon, text) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#f8fafc',
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid #e5e7eb',
      }}
    >
      {icon} {text}
    </span>
  );

  const outlineBtn = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    color: '#0f172a',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const primaryBtn = {
    background: '#2563eb',
    border: '1px solid #1d4ed8',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
  };

  const renderMap = (keySuffix = '') => (
<MapContainer
  key={`${mapKey}${keySuffix}`}
  center={mapCenter}
  zoom={mapZoom}
  style={{ height: '100%', width: '100%' }}
  zoomControl={false}
  attributionControl={false}
  preferCanvas={true}
  closePopupOnClick={false}   // ✅ we’ll handle closing manually
  whenCreated={(map) => {
    mapRef.current = map;
    try {
      setMapBounds(map.getBounds());
    } catch {}
  }}
>

<MapEvents
  onViewportChange={(b) => {
    setMapBounds(b);
  }}
/>


      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="topright" />

      {/* My location */}
      {userCoords && (
        <>
          <Marker
            position={[userCoords.lat, userCoords.lng]}
            icon={userIcon}
          />
          <Circle
            center={[userCoords.lat, userCoords.lng]}
            radius={120}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.08,
              weight: 1,
            }}
          />
        </>
      )}

{venues.map((venue) => {
  const isHovered = hoveredVenueId === venue.id;
  const imgSrc = firstImage(venue.image_urls);

  const pinSvg = ReactDOMServer.renderToString(
    <FiMapPin size={30} color="#6366f1" />
  );

  const markerHtml = `
    <div class="venue-marker-icon react-pin ${
      isHovered ? 'is-hovered' : ''
    }">
      ${pinSvg}
    </div>
  `;

  const markerIcon = L.divIcon({
    html: markerHtml,
    className: '',
    iconAnchor: [16, 32],
  });

  const distanceKm = userCoords
    ? kmBetween(
        userCoords.lat,
        userCoords.lng,
        Number(venue.lat),
        Number(venue.lng)
      )
    : null;

  return (
    <Marker
      key={venue.id}
      position={[venue.lat, venue.lng]}
      icon={markerIcon}
      eventHandlers={{
        click: () => {
          // 1) move map to this marker
          if (mapRef.current) {
            const map = mapRef.current;
            const currentZoom = map.getZoom();
            const targetZoom = currentZoom < 13 ? 13 : currentZoom; // adjust if you want closer/farther
            map.flyTo([venue.lat, venue.lng], targetZoom, {
              duration: 0.35,
            });
          }
          // 2) Leaflet will still open the popup from this same click
        },
      }}
    >
<Popup
  position={[venue.lat, venue.lng]}
  autoPan={false}
  keepInView={false}
  closeButton={false}
  className="venue-popup"
  offset={[0, -2]}
>

        <div
          className="venue-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 280,
            maxWidth: 'calc(100vw - 24px)',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 28px rgba(2,6,23,.16)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ✅ no need for custom × button now, built-in close is enough */}

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 140,
              background: '#000',
              overflow: 'hidden',
            }}
          >
            <img
              src={imgSrc}
              alt={venue.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                background: '#000',
                display: 'block',
                userSelect: 'none',
              }}
              loading="lazy"
              draggable={false}
            />
          </div>

          <div style={{ padding: '10px 12px 12px' }}>
            <h4
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={venue.name}
            >
              {venue.name}
            </h4>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 8,
                color: '#475569',
                fontSize: 13.5,
              }}
            >
              {venue.location &&
                chip(<FiMapPin size={12} />, venue.location)}
              {venue.type &&
                chip(<FiTag size={12} />, venue.type)}
              {Number.isFinite(venue.capacity_max) &&
                chip(
                  <FiUsers size={12} />,
                  `Up to ${venue.capacity_max}`
                )}
              {Number.isFinite(distanceKm) &&
                chip(
                  <FiNavigation size={12} />,
                  `${distanceKm.toFixed(1)} km`
                )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderTop: '1px solid #eef2f7',
              background: '#f9fafb',
            }}
          >
            {typeof venue.rate === 'number' ? (
              <div
                style={{
                  fontWeight: 800,
                  color: '#0f172a',
                  fontSize: 12,
                }}
              >
                ₱{Number(venue.rate).toLocaleString()}
              </div>
            ) : (
              <div />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={gmapsUrl(venue.lat, venue.lng)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={outlineBtn}
              >
                Directions
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/venues/${venue.id}`);
                }}
                style={primaryBtn}
              >
                View
              </button>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
})}

    </MapContainer>
  );

  /* ---------------- Render ---------------- */

  return (
    <div style={styles.container}>
      <div className="vl-layout">
        {/* LEFT: Venue list */}
        <div className="vl-list-pane">
          {/* Search + Filter toggle */}
          <div style={styles.searchToggleBar}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event type (wedding, birthday, debut…)"
              style={styles.searchInput}
            />

            <button
              onClick={() => {
                setHasInteractedWithFilter(true);
                setShowFilters(prev => !prev);
              }}
              className="filter-knob-btn"
              style={shouldGlow ? styles.glowPulse : undefined}
              title={showFilters ? 'Hide filters' : 'Show filters'}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
              type="button"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div style={styles.filterRow} className="filter-row">
              {/* Price */}
              <div className="select-wrap">
                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  style={styles.pathSelect}
                  title="Price"
                >
                  <option value="">Any price</option>
                  <option value="1-10000">₱1–10K</option>
                  <option value="10001-30000">₱10K–30K</option>
                  <option value="30001-">₱30K+</option>
                </select>
              </div>

              {/* Capacity */}
              <div className="select-wrap">
                <select
                  value={capacityFilter}
                  onChange={(e) => setCapacityFilter(e.target.value)}
                  style={styles.pathSelect}
                  title="Capacity"
                >
                  <option value="">Any capacity</option>
                  <option value="10-50">10–50</option>
                  <option value="51-150">51–150</option>
                  <option value="151-250">151–250</option>
                  <option value="251-350">251–350</option>
                  <option value="351-">351+</option>
                </select>
              </div>

              {/* Type */}
              <div className="select-wrap">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={styles.pathSelect}
                  title="Type"
                >
                  <option value="">All types</option>
                  <option value="Function Hall">Function Hall</option>
                  <option value="Garden">Garden</option>
                  <option value="Rooftop">Rooftop</option>
                  <option value="Resort">Resort</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Beachfront">Beachfront</option>
                  <option value="Event Tent">Event Tent</option>
                  <option value="Ballroom">Ballroom</option>
                  <option value="Clubhouse">Clubhouse</option>
                  <option value="Auditorium">Auditorium</option>
                  <option value="Studio">Studio</option>
                  <option value="Conference Room">Conference Room</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>
          )}

          {/* Location row */}
          <div style={styles.pathRow} className="path-row">
            {/* Region */}
            <div className="select-wrap">
              <select
                value={regionId}
                onChange={(e) => handlePickRegion(e.target.value)}
                style={styles.pathSelect}
                disabled={regionsLoading || regions.length === 0}
                title="Region"
              >
                <option value="">{regionsLoading ? 'Loading regions…' : 'Region'}</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.short_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Province */}
            <div className="select-wrap">
              <select
                value={provinceId}
                onChange={(e) => handlePickProvince(e.target.value)}
                style={styles.pathSelect}
                disabled={!regionId || provincesLoading}
                title="Province"
              >
                <option value="">
                  {!regionId
                    ? 'Province'
                    : provincesLoading
                    ? 'Loading provinces…'
                    : provinces.length
                    ? 'Province'
                    : 'No provinces'}
                </option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* City/Municipality */}
            <div className="select-wrap">
              <select
                value={cityId}
                onChange={(e) => handlePickCity(e.target.value)}
                style={styles.pathSelect}
                disabled={!provinceId || citiesLoading}
                title="City/Municipality"
              >
                <option value="">
                  {!provinceId
                    ? 'City/Municipality'
                    : citiesLoading
                    ? 'Loading cities…'
                    : cities.length
                    ? 'City/Municipality'
                    : 'No cities'}
                </option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ Scrollable content */}
          <div className="vl-list-scroll">
            {loading && (
              <div style={styles.venueGrid}>
                <VenueGridSkeleton count={8} />
              </div>
            )}

            {err && !loading && (
              <p style={{ color: 'crimson', textAlign: 'center', marginTop: 20 }}>{err}</p>
            )}

            {!loading && !err && venuesForList.length === 0 && (
              <div style={styles.emptyResultsBox}>
                <p style={styles.emptyResultsText}>
                  <strong>No results found.</strong> Try broadening your search or changing the filters.
                </p>
              </div>
            )}

            {!loading && !err && venuesForList.length > 0 && (
              <div style={styles.venueGrid}>
                {venuesForList.map((venue) => (
                  <div
                    key={venue.id}
                    onMouseEnter={() => setHoveredVenueId(venue.id)}
                    onMouseLeave={() => setHoveredVenueId(null)}
                  >
                    <VenueCard venue={venue} imageHeight={220} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: embedded map (desktop only, now inline) */}
        {isDesktop && (
          <div className="vl-map-pane">
            {renderMap('-desktop')}
          </div>
        )}
      </div>

      {/* MOBILE: full-screen map overlay using the same MapContainer */}
      {!isDesktop && isMobileMapOpen && (
        <div className="vl-mobile-map-shell">
          <div className="vl-mobile-map-header">
            <button
              type="button"
              className="vl-mobile-map-back"
              onClick={() => setIsMobileMapOpen(false)}
            >
              <FaArrowLeft size={16} />
            </button>
            <span className="vl-mobile-map-title">Map view</span>
          </div>
          <div className="vl-mobile-map-body">
            {renderMap('-mobile')}
          </div>
        </div>
      )}

      {/* Floating "Open Map" button (mobile only, hidden when map is open) */}
      {!isDesktop && !isMobileMapOpen && (
        <button
          type="button"
          className="vl-fab-open-map"
          onClick={openMapNearMe}
          title="Open Map"
          aria-label="Open Map"
        >
          <FaMapMarkedAlt style={{ marginRight: 8 }} />
          Open Map
        </button>
      )}

      <StyleOnce />
    </div>
  );
}

/* ---------------- Skeleton Components ---------------- */

function VenueGridSkeleton({ count = 8 }) {
  injectSkeletonCSS();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-card">
          <div className="sk-img" />
          <div className="sk-line w-80" />
          <div className="sk-line w-60" />
        </div>
      ))}
    </>
  );
}

let __skeletonCSSInjected = false;
function injectSkeletonCSS() {
  if (__skeletonCSSInjected) return;
  const style = document.createElement('style');
  style.innerHTML = `
    .sk-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 12px;
      box-shadow: 0 10px 30px rgba(15,23,42,0.05);
      display: flex;
      flex-direction: column;
      gap: 10px;
      border: 1px solid rgba(15,23,42,0.04);
    }
    .sk-img, .sk-line {
      position: relative;
      overflow: hidden;
      background: #e2e8f0;
      border-radius: 12px;
    }
    .sk-img {
      width: 100%;
      aspect-ratio: 16 / 11;
    }
    .sk-line { height: 12px; }
    .sk-line.w-80 { width: 80%; }
    .sk-line.w-60 { width: 60%; }

    .sk-img::after, .sk-line::after {
      content: "";
      position: absolute; inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.7), rgba(255,255,255,0));
      animation: sk-shimmer 1.15s infinite;
    }
    @keyframes sk-shimmer { 100% { transform: translateX(100%); } }

    .select-wrap{ position: relative; width: 100%; }
    .select-wrap::after{
      content: "";
      position: absolute;
      pointer-events: none;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 12px; height: 12px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      opacity: .9;
    }
    .select-wrap:has(select:focus)::after{
      filter: drop-shadow(0 0 0.5px rgba(0,0,0,.2));
      opacity: 1;
    }
    .select-wrap select:disabled{
      background-color: #f8fafc;
      color: #94a3b8;
      border-color: #e2e8f0;
    }
    .select-wrap:has(select:disabled)::after{
      opacity: .5;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }

    .select-wrap select:focus{
      box-shadow: 0 0 0 2px rgba(99,102,241,.18);
      border-color: #6366f1;
    }
    @media (prefers-reduced-motion: reduce) {
      .sk-img::after, .sk-line::after { animation: none; }
    }

    .vl-fab-open-map{
      position: fixed;
      left: 50%;
      right: auto;
      bottom: calc(16px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 40;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 999px;
      border: 1px solid rgba(52,211,153,.25);
      background: #6366f1;
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(15,23,42,.28);
      transition:
        transform .08s ease,
        filter .15s ease,
        box-shadow .2s ease,
        bottom .18s ease;
    }

    .vl-fab-open-map:hover{
      filter: brightness(1.04);
      transform: translateX(-50%) translateY(-1px);
    }
    .vl-fab-open-map:active{
      transform: translateX(-50%) translateY(0);
    }

    .footer-visible .vl-fab-open-map{
      bottom: calc(16px + 72px + env(safe-area-inset-bottom));
    }
    @media (min-width: 1024px){
      .footer-visible .vl-fab-open-map{
        bottom: calc(16px + 56px + env(safe-area-inset-bottom));
      }
      .vl-fab-open-map{
        display: none;
      }
    }

    .vl-layout{
      width: 100%;
      margin: 0;
    }

    @media (min-width: 1024px){
      .vl-layout{
        width: 100%;
        margin: 0;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
        gap: 18px;
        align-items: flex-start;
      }

      /* Shell: header + filters + location + scroll area */
      .vl-list-pane{
        min-width: 0;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 120px);
      }

      /* ✅ Only this scrolls */
      .vl-list-scroll{
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
      }

      /* Sticky map on the right */
      .vl-map-pane{
        min-width: 0;
        border-radius: 18px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 16px 40px rgba(15,23,42,0.20);
        border: 1px solid rgba(148,163,184,0.35);
        position: sticky;
        top: 80px;
        height: calc(100vh - 120px);
        align-self: flex-start;
      }
    }

    @media (max-width: 1023.98px){
      .vl-map-pane{
        display: none;
      }
    }
  `;
  document.head.appendChild(style);
  __skeletonCSSInjected = true;
}

(function injectVenueMapMarkerCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('venue-map-marker-anim-css')) return;

  const style = document.createElement('style');
  style.id = 'venue-map-marker-anim-css';
  style.textContent = `
    .venue-marker-icon{
      position: relative;
      display: inline-block;
      transform-origin: bottom center;
      transition: transform .18s ease-out, filter .18s ease-out;
    }

    .venue-marker-icon.react-pin svg{
      filter: drop-shadow(0 10px 18px rgba(15,23,42,0.45));
      transform: translateY(-2px);
    }

    .venue-marker-icon.react-pin.is-hovered svg{
      filter: drop-shadow(0 12px 22px rgba(34,197,94,0.6));
    }

    .venue-marker-icon.is-hovered{
      animation: vm-bounce 1s ease-out infinite;
      filter: drop-shadow(0 8px 14px rgba(15,23,42,0.35));
    }

    .venue-marker-icon.is-hovered::after{
      content:"";
      position:absolute;
      left:50%;
      bottom: -4px;
      width: 44px;
      height: 44px;
      border-radius:999px;
      transform: translateX(-50%);
      border: 2px solid rgba(99,102,241,0.28);
      box-shadow: 0 0 0 0 rgba(99,102,241,0.25);
      opacity: 0;
      pointer-events:none;
      animation: vm-pulse 1.4s ease-out infinite;
    }

    @keyframes vm-bounce{
      0%   { transform: translateY(0) scale(1); }
      35%  { transform: translateY(-8px) scale(1.02); }
      100% { transform: translateY(0) scale(1); }
    }

    @keyframes vm-pulse{
      0%   { opacity: 0.6; transform: translateX(-50%) scale(0.7); box-shadow: 0 0 0 0 rgba(99,102,241,0.25); }
      70%  { opacity: 0;   transform: translateX(-50%) scale(1.15); box-shadow: 0 0 0 14px rgba(99,102,241,0); }
      100% { opacity: 0;   transform: translateX(-50%) scale(1.15); box-shadow: 0 0 0 18px rgba(99,102,241,0); }
    }
  `;
  document.head.appendChild(style);
})();

/* ---------------- Styles (Inva-style theme) ---------------- */

const bg = '#f5f7fb';
const card = '#ffffff';
const borderSubtle = 'rgba(15, 23, 42, 0.08)';

const accent = '#635bff';
const text = '#0f172a';
const textMuted = '#64748b';

const radiusLg = 18;
const radiusSm = 10;
const shadowSoft = '0 10px 30px rgba(15,23,42,0.08)';
const shadowMedium = '0 8px 22px rgba(15,23,42,0.10)';

const accentColor = accent;
const textDark = text;
const textMedium = textMuted;

const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px 16px 96px',
    boxSizing: 'border-box',
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    color: text,
    background: `
      radial-gradient(1200px 700px at 10% -10%, #e9e7ff 0%, transparent 60%),
      radial-gradient(1000px 600px at 110% 0%, #ffe4f3 0%, transparent 55%),
      ${bg}
    `,
  },

  searchToggleBar: {
    width: '100%',
    margin: '0 0 10px',
    padding: 10,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.92)',
    border: `1px solid ${borderSubtle}`,
    boxShadow: shadowSoft,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  searchInput: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: radiusLg,
    border: `1px solid rgba(148,163,184,0.35)`,
    fontSize: 14.5,
    color: textDark,
    background: '#ffffff',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  },
  glowPulse: {
    animation: 'glow 1.5s infinite alternate',
  },

  filterRow: {
    width: '100%',
    margin: '0 0 10px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },

  pathRow: {
    width: '100%',
    margin: '0 0 10px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  },

  pathSelect: {
    width: '100%',
    border: `1px solid rgba(148,163,184,0.45)`,
    background: card,
    color: text,
    borderRadius: radiusSm,
    padding: '10px 40px 10px 12px',
    fontSize: 13.5,
    cursor: 'pointer',
    outline: 'none',
    minHeight: 44,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  },

  venueGrid: {
    width: '100%',
    margin: '4px 0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 18,
    paddingTop: 6,
  },

  emptyResultsBox: {
    width: '100%',
    margin: '24px 0 0',
    background: card,
    padding: '18px 18px 16px',
    borderRadius: radiusLg,
    textAlign: 'center',
    color: textMedium,
    fontSize: 14,
    boxShadow: shadowSoft,
    border: `1px solid ${borderSubtle}`,
  },

  emptyResultsText: { margin: 0, fontWeight: 500 },
};

/* ---------------- Style injection (keyframes, responsive) ---------------- */
(function injectKeyframes() {
  if (typeof document === 'undefined' || document.getElementById('venue-list-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'venue-list-keyframes';
  style.innerHTML = `
    @keyframes glow {
      from { box-shadow: 0 4px 12px ${shadowMedium}; }
      to { box-shadow: 0 0 15px 5px ${accentColor}33; }
    }
    input[type="text"]::placeholder { color: ${textMedium}; opacity: 0.8; }
    input[type="text"]:focus, select:focus {
      outline: none;
      border-color: ${accentColor};
      box-shadow: 0 0 0 1px ${accentColor}22;
      background-color: #ffffff;
    }
  `;
  document.head.appendChild(style);
})();

function StyleOnce() {
  useEffect(() => {
    if (document.getElementById('venue-list-responsive')) return;
    const style = document.createElement('style');
    style.id = 'venue-list-responsive';
    style.textContent = `
      .filter-row{
        display:flex;
        flex-direction:column;
        gap:8px;
        margin-bottom:6px;
      }
      @media (min-width: 900px){
        .filter-row{
          flex-direction:row;
          align-items:center;
        }
      }

      .filter-knob-btn{
        border:none;
        background:#ffffff;
        color:#0f172a;
        border-radius:999px;
        width:44px; height:44px;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer;
        border: 1px solid rgba(148,163,184,0.45);
        box-shadow: 0 8px 18px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
        transition: transform .15s ease, box-shadow .15s ease, border-color .2s ease, background .2s ease, color .2s ease;
      }
      .filter-knob-btn:hover{
        transform: translateY(-1px);
        border-color:#cbd5e1;
        background:#ffffff;
        box-shadow: 0 10px 22px rgba(15,23,42,0.14);
      }
      .filter-knob-btn:active{
        transform: scale(.98);
        box-shadow: 0 4px 12px rgba(15,23,42,0.18);
      }

      @media (max-width: 768px){
        .path-row{
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 1023.98px){
        .vl-mobile-map-shell{
          position: fixed;
          inset: 0;
          z-index: 60;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
        }
        .vl-mobile-map-header{
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #ffffff;
          border-bottom: 1px solid rgba(148,163,184,0.4);
          box-shadow: 0 4px 10px rgba(15,23,42,0.06);
        }
        .vl-mobile-map-back{
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          cursor: pointer;
        }
        .vl-mobile-map-title{
          font-weight: 700;
          font-size: 15px;
          color: #0f172a;
        }
        .vl-mobile-map-body{
          flex: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}
