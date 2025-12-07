// src/pages/VenueDetails.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  FaMapMarkerAlt,
  FaMoneyBillAlt,
  FaUsers,
  FaTag,
  FaHeart,
  FaShareAlt,
  FaRegHeart,
} from 'react-icons/fa';
import { FaMessage, FaCalendarCheck } from 'react-icons/fa6';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ChatModal from '../components/ChatModal';
import VenueOnboardingForm from '../components/VenueOnboardingForm';
import { FiEdit2, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi';

/* ===========================
   THEME + STYLE INJECTION (scoped)
   =========================== */
const ACCENT = '#6366f1'; // Inva-style purple

(function ensureVenueDetailsCSS() {
  const id = 'venue-details-css-pro';
  if (document.getElementById(id)) return;
  const css = `
  :root{
    --vd-accent: ${ACCENT};
    --vd-accent-08: rgba(99,102,241,.08);
    --vd-accent-14: rgba(99,102,241,.14);
    --vd-accent-22: rgba(99,102,241,.22);
    --vd-text: #0f172a;
    --vd-muted: #64748b;
    --vd-border: #E7EEF5;
    --vd-surface: #ffffff;
    --vd-bg: #f5f7fb;
    --vd-radius: 14px;
    --vd-radius-sm: 10px;
    --vd-shadow-1: 0 14px 40px rgba(15,23,42,0.10);
  }

  /* Hide global footers only on this page */
  .no-footernav .footer-nav,
  .no-footernav .bottom-nav {
    display: none !important;
  }

/* Always show topbar on desktop */
@media (min-width: 1024px) {
  .topbar {
    display: flex !important;
    position: sticky;
    top: 0;
    z-index: 60;
    background: #ffffff;
  }
}


  .venue-details-page{
   
    color: var(--vd-text);
    -webkit-font-smoothing: antialiased;
    padding: 16px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
    min-height: 100vh;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
  }

  .vd-grid{
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    column-gap: 22px;
    row-gap: 10px;
  }

  @media (min-width: 1024px){
    .vd-grid{
      grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.9fr);
      align-items: flex-start;
      padding-top: 6px;
    }
  }

  .vd-main{
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vd-aside{
    margin-top: 4px;
  }

  @media (max-width: 1023px){
    .vd-aside{
      display: none;
    }
  }

  /* Header row */
  .page-head{
    grid-column: 1 / -1;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:6px;
  }

  .back-btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:42px;
    height:42px;
    border-radius:12px;
    background:#ffffff;
    border:1px solid var(--vd-border);
    box-shadow: 0 6px 20px rgba(15,23,42,.06);
    cursor:pointer;
    transition: transform .12s ease, box-shadow .2s ease, border-color .2s ease;
  }

  .back-btn:hover{
    transform: translateY(-1px);
    box-shadow: 0 10px 26px rgba(15,23,42,.14);
    border-color: rgba(148,163,184,0.9);
  }

  .vd-head-actions{
    display:flex;
    align-items:center;
    gap:8px;
  }

  .icon-btn{
    width:42px;
    height:42px;
    border-radius:12px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border:1px solid var(--vd-border);
    background:#ffffff;
    cursor:pointer;
    transition: transform .12s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease;
  }

  .icon-btn:hover{
    transform: translateY(-1px);
    box-shadow: var(--vd-shadow-1);
    border-color: rgba(148,163,184,0.8);
    background: linear-gradient(180deg, #ffffff, #f9fafb);
  }

  /* Header pill buttons (Edit / Publish) */
  .vd-head-pill{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    padding:8px 14px;
    border-radius:999px;
    font-size:12px;
    font-weight:700;
    border:1px solid var(--vd-border);
    background:#ffffff;
    color:#0f172a;
    cursor:pointer;
    transition:
      transform .08s ease,
      box-shadow .18s ease,
      background .18s ease,
      border-color .18s ease,
      color .18s ease;
  }

  .vd-head-pill-primary{
    background:linear-gradient(135deg,#6366f1,#4f46e5);
    color:#ffffff;
    border-color:rgba(79,70,229,0.8);
    box-shadow:0 10px 26px rgba(79,70,229,0.45);
  }

  .vd-head-pill-outline{
    background:rgba(255,255,255,0.96);
    color:var(--vd-accent);
    border-color:rgba(129,140,248,0.7);
  }

  .vd-head-pill:hover:not(:disabled){
    transform:translateY(-1px);
    box-shadow:0 10px 26px rgba(15,23,42,0.16);
  }

  .vd-head-pill-primary:hover:not(:disabled){
    box-shadow:0 14px 32px rgba(79,70,229,0.55);
  }

  .vd-head-pill:disabled{
    opacity:.7;
    cursor:default;
    box-shadow:none;
    transform:none;
  }

  /* Hero / Gallery */
  .vd-hero{
    position: relative;
    border-radius: var(--vd-radius);
    overflow: hidden;
    border: 1px solid var(--vd-border);
    box-shadow: var(--vd-shadow-1);
  }

  .vd-hero .slider{
    border: 0;
    box-shadow: none;
    border-radius: 0;
  }

  .vd-hero .slider-arrow{
    width: 38px;
    height: 38px;
    font-size: 22px;
    background: rgba(15,23,42,.75);
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.18);
    display:flex;
    align-items:center;
    justify-content:center;
  }

  .vd-hero-overlay{
    pointer-events:none;
    position:absolute;
    inset:0;
    background:
      linear-gradient(to top, rgba(15,23,42,.65), transparent 35%),
      linear-gradient(to bottom, rgba(15,23,42,.3), transparent 30%);
  }

  .vd-hero-top{
    position:absolute;
    top:10px;
    left:10px;
    right:10px;
    display:flex;
    justify-content:space-between;
    gap:8px;
    pointer-events:none;
    z-index: 5;
  }

  .vd-hero-top .left,
  .vd-hero-top .right{
    display:flex;
    gap:8px;
    pointer-events:auto;
  }

  .vd-hero-ctas .btn-ghost{
    padding:9px 12px;
    border-radius:999px;
    font-weight:700;
    font-size:13px;
    border:1px solid rgba(255,255,255,.7);
    color:#e5e7eb;
    background: rgba(15,23,42,.55);
    backdrop-filter: blur(12px);
    display:inline-flex;
    align-items:center;
    gap:8px;
    box-shadow: 0 12px 30px rgba(15,23,42,.40);
  }

  .vd-hero-ctas .btn-ghost svg{
    font-size: 14px;
  }

  .vd-hero-count{
    position:absolute;
    right:10px;
    bottom:10px;
    padding:6px 10px;
    border-radius:999px;
    font-weight:700;
    font-size:12px;
    color:#f9fafb;
    background: rgba(15,23,42,.75);
    border:1px solid rgba(148,163,184,.75);
    backdrop-filter: blur(10px);
    z-index: 4;
  }

  .vd-progress{
    position:absolute;
    left:0;
    right:0;
    bottom:0;
    height:3px;
    background: rgba(148,163,184,.4);
    z-index: 4;
  }

  .vd-progress > i{
    display:block;
    height:100%;
    width:0;
    background: linear-gradient(90deg, #6366f1, #a855f7);
    opacity:.95;
    transition: width .35s ease;
  }

  /* Title + meta */
  .venue-title{
    font-size: 24px;
    font-weight: 900;
    margin: 14px 2px 4px;
    letter-spacing:.25px;
    color:#0f172a;
  }

  @media (min-width: 768px){
    .venue-title{
      font-size: 28px;
    }
  }

  .vd-meta-row{
    display:flex;
    align-items:flex-start;
    gap:10px;
    color: var(--vd-muted);
    font-size: 14px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .meta-sub{
    color: var(--vd-muted);
    font-size: 12px;
  }

  /* Quick facts */
  .detail-card{
    margin-top: 12px;
    padding: 14px 14px 8px;
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #E7EEF5;
    
  }

  .detail-row{
    display: grid;
    grid-template-columns: 40px 1fr;
    align-items: start;
    gap: 10px;
    padding: 10px 6px;
    border-radius: 12px;
  }

  .detail-row + .detail-row{
    margin-top: 2px;
  }

  .detail-ico{
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--vd-accent);
    background:
      radial-gradient(100% 100% at 50% 0%,
        rgba(99,102,241,.22) 0%,
        rgba(99,102,241,.10) 40%,
        rgba(129,140,248,.06) 100%);
    box-shadow:
      inset 0 0 0 1px rgba(129,140,248,.32),
      0 6px 18px rgba(15,23,42,0.12);
  }

  .detail-row > div{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    line-height: 1.5;
    font-size: 15px;
    color: var(--vd-text);
  }

  .detail-row > div > strong{
    display: block;
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--vd-muted);
  }

  /* Map */
  .vd-map{
    height: 320px;
    border-radius: 14px;
    overflow:hidden;
    border: 1px solid var(--vd-border);
    box-shadow: var(--vd-shadow-1);
  }

  /* Sticky booking card (desktop) */
  .vd-aside-card{
    position: sticky;
    top: 14px;
    background:#ffffff;
    border:1px solid var(--vd-border);
    border-radius: 18px;
    padding: 14px 14px 12px;
    
  }

  .vd-price{
    display:flex;
    align-items:baseline;
    gap:10px;
    margin-bottom: 8px;
  }

  .vd-price .amount{
    font-size: 20px;
    font-weight: 900;
    color: var(--vd-accent);
  }

  .vd-cta-stack{
    display:flex;
    flex-direction:column;
    gap:8px;
  }

  .btn-primary,
  .btn-outline{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    border-radius: 12px;
    padding: 11px 13px;
    font-weight: 800;
    font-size: 14px;
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      transform .08s ease,
      filter .15s ease,
      box-shadow .2s ease,
      background .2s ease,
      border-color .2s ease,
      color .2s ease;
  }

  .btn-primary{
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #ffffff;
    box-shadow: 0 10px 26px var(--vd-accent-22);
  }

  .btn-primary:hover{
    filter: brightness(1.04);
    transform: translateY(-1px);
    box-shadow: 0 14px 32px rgba(79,70,229,0.45);
  }

  .btn-outline{
    background:#ffffff;
    color: var(--vd-accent);
    border-color: var(--vd-accent);
  }

  .btn-outline:hover{
    background: var(--vd-accent-08);
    transform: translateY(-1px);
    box-shadow: 0 10px 26px rgba(15,23,42,0.14);
  }

  /* Thumbnails */
  .thumbs{
    display:flex;
    gap:8px;
    margin-top:10px;
    padding: 5px;
    overflow-x:auto;
    -webkit-overflow-scrolling: touch;
  }

  .thumb{
    width: 80px;
    height: 58px;
    border-radius: 10px;
    overflow:hidden;
    border: 2px solid transparent;
    cursor: pointer;
    flex-shrink:0;
    background: #e5e7eb;
  }

  .thumb img{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }

  .thumb.active{
    border-color: var(--vd-accent);
  }

  /* Sticky Footer CTA (mobile only) */
  .vd-sticky-cta{
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: linear-gradient(to top, #ffffff, rgba(255,255,255,0.95) 55%, rgba(255,255,255,0));
    z-index: 999;
  }

  .vd-sticky-cta .cta-bar{
    display:flex;
    gap:8px;
    background:#ffffff;
    border:1px solid var(--vd-border);
    border-radius: 16px;
    padding: 8px;
    box-shadow: var(--vd-shadow-1);
    max-width: 1180px;
    margin: 0 auto;
  }

  @media (min-width: 1024px){
    .vd-sticky-cta{
      display: none !important;
    }
  }

  /* Favorite button */
  @keyframes fav-pop {
    0%   { transform: scale(0.85); }
    60%  { transform: scale(1.12); }
    100% { transform: scale(1); }
  }

  @keyframes fav-ping {
    0%   { opacity: 0.7; transform: scale(0.8); }
    70%  { opacity: 0.25; transform: scale(1.2); }
    100% { opacity: 0; transform: scale(1.4); }
  }

  .fav-btn{
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,0.14);
    background: rgba(15,23,42,0.60);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(248,250,252,0.9);
    box-shadow: 0 14px 32px rgba(15,23,42,0.60);
    transition:
      transform .1s ease,
      box-shadow .2s ease,
      background .2s ease,
      color .2s ease,
      border-color .2s ease;
  }

  .fav-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 40px rgba(15,23,42,0.70);
  }

  .fav-btn:active {
    transform: scale(.96);
  }

  .fav-btn:focus {
    outline: none;
    box-shadow:
      0 0 0 3px rgba(99,102,241,0.38),
      0 10px 26px rgba(15,23,42,0.55);
  }

  .fav-btn.is-fav{
    background:
      radial-gradient(circle at 0% 0%, rgba(255,255,255,0.7), transparent 55%),
      linear-gradient(135deg, #6366f1, #ff6ad5);
    color: #ffffff;
    border-color: rgba(129,140,248,0.9);
    box-shadow:
      0 16px 40px rgba(88,28,135,0.55),
      0 0 0 1px rgba(129,140,248,0.55) inset;
  }

  .fav-btn.is-fav:hover {
    box-shadow:
      0 20px 46px rgba(88,28,135,0.65),
      0 0 0 1px rgba(129,140,248,0.7) inset;
  }

  .fav-btn.pop {
    animation: fav-pop .34s ease-out;
    position: relative;
  }

  .fav-btn.pop::after{
    content:"";
    position:absolute;
    inset:-5px;
    border-radius:999px;
    border:2px solid rgba(99,102,241,0.65);
    animation: fav-ping .38s ease-out forwards;
    pointer-events:none;
  }

  /* Editorial sections */
  .vd-section{
    margin-top: 10px;
    background: #ffffff;
    border: 1px solid #E7EEF5;
    border-radius: 16px;
    padding: 16px 16px 14px;
  
  }

  .vd-section h4{
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 800;
    color: #111827;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .venue-details-page .vd-section ul{
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  @media (min-width: 900px){
    .venue-details-page .vd-section ul{
      grid-template-columns: 1fr 1fr;
      column-gap: 22px;
    }
  }

  .venue-details-page .vd-section ul li{
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #334155;
    font-size: 14px;
    line-height: 1.7;
  }

  .venue-details-page .vd-section ul li::before{
    content: "";
    flex: 0 0 8px;
    height: 8px;
    border-radius: 999px;
    margin-top: 8px;
    background: ${ACCENT};
    box-shadow: 0 0 0 3px rgba(99,102,241,.18);
  }

  .chip-row{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip{
    display: inline-flex;
    align-items: center;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(99,102,241,.06);
    border: 1px solid rgba(129,140,248,.28);
    color: #111827;
    font-weight: 700;
    font-size: 11px;
    line-height: 1;
    transition:
      transform .08s ease,
      background .2s ease,
      border-color .2s ease,
      box-shadow .2s ease;
  }

  .chip:hover{
    transform: translateY(-1px);
    background: rgba(99,102,241,.12);
    border-color: rgba(129,140,248,.6);
    box-shadow: 0 10px 22px rgba(15,23,42,0.18);
  }

  .vd-notice{
    display: block;
    background:
      radial-gradient(circle at 0% 0%, rgba(255,255,255,0.65), transparent 50%),
      linear-gradient(180deg, rgba(99,102,241,.09), rgba(129,140,248,.04));
    border: 1px solid rgba(129,140,248,.4);
    border-radius: 12px;
    padding: 12px 14px;
    color: #111827;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.55;
    letter-spacing: .15px;
  }

  /* Gallery Modal */
  .vd-gallery-overlay{
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,.75);
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
  }

  .vd-gallery-modal{
    background: #ffffff;
    border-radius: 18px;
    width: min(1200px, 96vw);
    max-height: 90vh;
    border: 1px solid #E7EEF5;
    box-shadow: 0 20px 46px rgba(15,23,42,0.30);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .vd-gallery-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding: 14px 16px;
    border-bottom: 1px solid #f0f3f7;
  }

  .vd-gallery-title{
    font-weight: 900;
    font-size: 18px;
    color: #1f2937;
    letter-spacing: .2px;
  }

  .vd-gallery-close{
    border: 1px solid #e6e9ef;
    background: #ffffff;
    border-radius: 10px;
    padding: 6px 10px;
    cursor: pointer;
  }

  .vd-gallery-body{
    padding: 14px;
    overflow: auto;
  }

  .vd-gallery-grid{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .vd-gallery-item{
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 10px;
    overflow: hidden;
    background:#020617;
    cursor: zoom-in;
    border: 0;
    padding:0;
    transition: transform .1s ease, box-shadow .15s ease, border-color .15s ease;
  }

  .vd-gallery-item img{
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center;
  }

  .vd-gallery-item:hover{
    transform: translateY(-1px);
    box-shadow: 0 16px 32px rgba(15,23,42,0.28);
  }

  /* Simple spinner */
  @keyframes spin{
    to { transform: rotate(360deg); }
  }

  .spin{
    animation: spin .9s linear infinite;
  }

  /* ========= Loading skeleton ========= */
  .vd-loading-shell{
    max-width:1180px;
    margin:0 auto;
  }

  .vd-skeleton-hero,
  .vd-skeleton-card,
  .vd-skeleton-title,
  .vd-skeleton-text,
  .vd-skeleton-aside{
    border-radius:16px;
    background: linear-gradient(90deg,#e5e7eb 0%,#f3f4f6 45%,#e5e7eb 100%);
    background-size: 200% 100%;
    animation: vd-shimmer 1.2s infinite;
  }

  .vd-skeleton-hero{
    height: clamp(220px, 32vw, 340px);
    margin-bottom: 12px;
  }

  .vd-skeleton-title{
    height: 26px;
    width: 60%;
    margin: 8px 2px;
  }

  .vd-skeleton-text{
    height: 14px;
    width: 40%;
    margin: 4px 2px 12px;
  }

  .vd-skeleton-card{
    height: 140px;
  }

  .vd-skeleton-aside{
    height: 180px;
    border-radius:18px;
  }

  @keyframes vd-shimmer{
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  `;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
})();

/* Hide FooterNav/bottom-nav on this page only */
function useHideFooterNav() {
  useEffect(() => {
    document.body.classList.add('no-footernav');
    return () => document.body.classList.remove('no-footernav');
  }, []);
}

/* ===========================
   Leaflet Marker Icon Fix
   =========================== */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* -------- View tracking helpers -------- */
function getAnonId() {
  try {
    const k = 'fv_anon_id';
    let v = localStorage.getItem(k);
    if (!v) {
      v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

function todayKey(venueId) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `viewed:${venueId}:${yyyy}-${mm}-${dd}`;
}

/* Icons in quick facts */
const ICON = {
  location: <FaMapMarkerAlt color={ACCENT} size={16} />,
  price: <FaMoneyBillAlt color={ACCENT} size={16} />,
  capacity: <FaUsers color={ACCENT} size={16} />,
  type: <FaTag color={ACCENT} size={16} />,
};

/* ===========================
   Fullscreen Image Viewer
   =========================== */
const FullscreenImage = ({ photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const startX = useRef(null);
  const dragOffset = useRef(0);
  const isDragging = useRef(false);
  const [currentTranslateX, setCurrentTranslateX] = useState(0);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const pinchMidpoint = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false);

  const panLast = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);

  const lastTap = useRef(0);
  const containerRef = useRef(null);

  const MAX_SCALE = 4;
  const MIN_SCALE = 1;
  const SWIPE_THRESHOLD = 50;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const resetZoom = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const goTo = useCallback(
    (i) => {
      const len = photos.length;
      const next = ((i % len) + len) % len;
      setCurrentIndex(next);
      setCurrentTranslateX(0);
      isDragging.current = false;
      resetZoom();
    },
    [photos.length]
  );

  const goBy = useCallback(
    (delta) => goTo(currentIndex + delta),
    [currentIndex, goTo]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (scale === 1) {
        if (e.key === 'ArrowLeft') goBy(-1);
        if (e.key === 'ArrowRight') goBy(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scale, goBy, onClose]);

  const getTouch = (e, idx = 0) => e.touches?.[idx] ?? e.changedTouches?.[idx];
  const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const midpoint = (a, b) => ({
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  });

  const clampPan = useCallback((nextScale, nextTx, nextTy) => {
    const el = containerRef.current;
    if (!el) return { tx: nextTx, ty: nextTy };
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const boundX = (cw * (nextScale - 1)) / 2;
    const boundY = (ch * (nextScale - 1)) / 2;
    return {
      tx: Math.max(-boundX, Math.min(boundX, nextTx)),
      ty: Math.max(-boundY, Math.min(boundY, nextTy)),
    };
  }, []);

  const onTouchStart = useCallback(
    (e) => {
      if (e.touches?.length === 2) {
        isPinching.current = true;
        isDragging.current = false;
        const t0 = getTouch(e, 0);
        const t1 = getTouch(e, 1);
        pinchStartDist.current = distance(t0, t1);
        pinchStartScale.current = scale;
        pinchMidpoint.current = midpoint(t0, t1);
      } else if (e.touches?.length === 1) {
        if (scale > 1) {
          isPanning.current = true;
          panLast.current = { x: getTouch(e).clientX, y: getTouch(e).clientY };
        } else {
          isDragging.current = true;
          startX.current = getTouch(e).clientX;
          dragOffset.current = 0;
        }
      }
    },
    [scale]
  );

  const onTouchMove = useCallback(
    (e) => {
      if (isPinching.current && e.touches?.length === 2) {
        const t0 = getTouch(e, 0);
        const t1 = getTouch(e, 1);
        const d = distance(t0, t1);
        const nextScale = clamp(
          (d / pinchStartDist.current) * pinchStartScale.current,
          MIN_SCALE,
          MAX_SCALE
        );

        const el = containerRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const mx = pinchMidpoint.current.x - (rect.left + rect.width / 2);
          const my = pinchMidpoint.current.y - (rect.top + rect.height / 2);
          const dx = mx * (1 - scale / nextScale);
          const dy = my * (1 - scale / nextScale);
          const { tx: ntx, ty: nty } = clampPan(nextScale, tx + dx, ty + dy);
          setTx(ntx);
          setTy(nty);
        }
        setScale(nextScale);
        return;
      }

      if (isPanning.current && e.touches?.length === 1) {
        const t = getTouch(e);
        const dx = t.clientX - panLast.current.x;
        const dy = t.clientY - panLast.current.y;
        panLast.current = { x: t.clientX, y: t.clientY };
        const { tx: ntx, ty: nty } = clampPan(scale, tx + dx, ty + dy);
        setTx(ntx);
        setTy(nty);
        return;
      }

      if (isDragging.current && e.touches?.length === 1) {
        dragOffset.current = getTouch(e).clientX - startX.current;
        setCurrentTranslateX(dragOffset.current);
      }
    },
    [scale, tx, ty, clampPan]
  );

  const onTouchEnd = useCallback(() => {
    if (isPinching.current) {
      isPinching.current = false;
      return;
    }
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (isDragging.current) {
      isDragging.current = false;
      const off = dragOffset.current;
      if (off > SWIPE_THRESHOLD) goBy(-1);
      else if (off < -SWIPE_THRESHOLD) goBy(1);
      dragOffset.current = 0;
      setCurrentTranslateX(0);
    }
  }, [goBy]);

  const onDoubleTap = useCallback(
    (e) => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const isTouch = 'touches' in e && e.touches?.length;
        const cx = isTouch ? e.touches[0].clientX : e.clientX;
        const cy = isTouch ? e.touches[0].clientY : e.clientY;
        const x = cx - (rect.left + rect.width / 2);
        const y = cy - (rect.top + rect.height / 2);

        if (scale > 1) {
          setScale(1);
          setTx(0);
          setTy(0);
        } else {
          const nextScale = 2;
          const dx = x * (1 - 1 / nextScale);
          const dy = y * (1 - 1 / nextScale);
          const { tx: ntx, ty: nty } = clampPan(nextScale, dx, dy);
          setScale(nextScale);
          setTx(ntx);
          setTy(nty);
        }
      }
      lastTap.current = now;
    },
    [scale, clampPan]
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - (rect.left + rect.width / 2);
      const my = e.clientY - (rect.top + rect.height / 2);

      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const nextScale = clamp(scale * (1 + delta), MIN_SCALE, MAX_SCALE);
      const dx = mx * (1 - scale / nextScale);
      const dy = my * (1 - scale / nextScale);
      const { tx: ntx, ty: nty } = clampPan(nextScale, tx + dx, ty + dy);
      setScale(nextScale);
      setTx(ntx);
      setTy(nty);
    },
    [scale, tx, ty, clampPan]
  );

  if (!photos || photos.length === 0 || currentIndex == null) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: scale > 1 ? 'grab' : 'default',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={(e) => {
        if (scale > 1) {
          isPanning.current = true;
          panLast.current = { x: e.clientX, y: e.clientY };
        } else {
          isDragging.current = true;
          startX.current = e.clientX;
        }
      }}
      onMouseMove={(e) => {
        if (scale > 1 && isPanning.current) {
          const dx = e.clientX - panLast.current.x;
          const dy = e.clientY - panLast.current.y;
          panLast.current = { x: e.clientX, y: e.clientY };
          const { tx: ntx, ty: nty } = clampPan(scale, tx + dx, ty + dy);
          setTx(ntx);
          setTy(nty);
        } else if (isDragging.current) {
          dragOffset.current = e.clientX - startX.current;
          setCurrentTranslateX(dragOffset.current);
        }
      }}
      onMouseUp={() => onTouchEnd()}
      onMouseLeave={() => onTouchEnd()}
      onClick={onDoubleTap}
      onWheel={onWheel}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: 24,
          cursor: 'pointer',
          padding: '10px 15px',
          borderRadius: '50%',
          zIndex: 1201,
          touchAction: 'none',
        }}
        aria-label="Close"
      >
        ✕
      </button>

      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            transform: `translateX(calc(-${currentIndex * 100}% + ${currentTranslateX}px))`,
            transition:
              isDragging.current || isPinching.current || isPanning.current
                ? 'none'
                : 'transform 0.3s ease-out',
            willChange: 'transform',
          }}
        >
          {photos.map((src, i) => {
            const isActive = i === currentIndex;
            return (
              <div
                key={src || i}
                style={{
                  flex: '0 0 100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <img
                  src={src}
                  alt={`Fullscreen Photo ${i + 1}`}
                  draggable={false}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    transform: isActive
                      ? `translate(${tx}px, ${ty}px) scale(${scale})`
                      : 'translate(0,0) scale(1)',
                    transition:
                      isDragging.current || isPinching.current || isPanning.current
                        ? 'none'
                        : 'transform 0.15s ease-out',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {scale === 1 && photos.length > 1 && (
        <>
          <button
            className="slider-arrow"
            onClick={() => goBy(-1)}
            aria-label="Previous photo"
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 24,
              color: '#fff',
            }}
          >
            ‹
          </button>
          <button
            className="slider-arrow"
            onClick={() => goBy(1)}
            aria-label="Next photo"
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 24,
              color: '#fff',
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
};

/* ===========================
   Collage Gallery Modal
   =========================== */
function GalleryModal({ photos = [], onClose, onOpenFull }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!photos?.length) return null;

  return (
    <div
      className="vd-gallery-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div
        className="vd-gallery-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Photo gallery"
      >
        <div className="vd-gallery-header">
          <div className="vd-gallery-title">
            Gallery{' '}
            <span style={{ color: '#64748b', fontWeight: 700 }}>
              • {photos.length} photos
            </span>
          </div>
          <button
            className="vd-gallery-close"
            onClick={onClose}
            aria-label="Close gallery"
          >
            ✕
          </button>
        </div>
        <div className="vd-gallery-body">
          <div className="vd-gallery-grid">
            {photos.map((src, i) => (
              <button
                key={src + i}
                className="vd-gallery-item"
                onClick={() => onOpenFull?.(i)}
                aria-label={`Open photo ${i + 1}`}
              >
                <img src={src} alt={`Photo ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   PAGE
   =========================== */
export default function VenueDetails() {
  useHideFooterNav();

  const { id } = useParams();
  const navigate = useNavigate();

  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);

  // FAVORITE STATE
  const [userId, setUserId] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [pop, setPop] = useState(false);
  const abortRef = useRef(false);

  const [showChat, setShowChat] = useState(false);
  const [chatOtherUserId, setChatOtherUserId] = useState(null);

  const [showGallery, setShowGallery] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null);

  // Helpers: infer "published"
  function getIsPublished(row) {
    if (!row) return false;
    if ('status' in row) return String(row.status) === 'Active';
    if ('is_active' in row) return !!row.is_active;
    if ('published' in row) return !!row.published;
    return false;
  }

  function buildPublishPatch(row, next) {
    const patch = {};
    if ('status' in row) patch.status = next ? 'Active' : 'Pending';
    if ('is_active' in row) patch.is_active = next;
    if ('published' in row) patch.published = next;
    return patch;
  }

  const isPublished = useMemo(() => getIsPublished(venue), [venue]);
  const [busyPublish, setBusyPublish] = useState(false);

  async function togglePublish() {
    if (!venue) return;
    const next = !isPublished;
    const patch = buildPublishPatch(venue, next);

    if (Object.keys(patch).length === 0) {
      alert(
        'No publish field found on this table. Add either `status`, `is_active`, or `published`.'
      );
      return;
    }

    setBusyPublish(true);
    try {
      const { error } = await supabase
        .from('theVenues')
        .update(patch)
        .eq('id', venue.id);

      if (error) throw error;

      setVenue((v) => ({ ...(v || {}), ...patch }));
      alert(next ? '✅ Listing published!' : '⏸️ Listing unpublished.');
    } catch (e) {
      console.error('togglePublish failed:', e?.message || e);
      alert('Failed to update publish state.');
    } finally {
      setBusyPublish(false);
    }
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1023);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Slider state
  const [index, setIndex] = useState(0);
  const startX = useRef(null);
  const deltaX = useRef(0);

  // Load venue
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('theVenues')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) console.error('Error loading venue:', error);
      setVenue(data || null);

      // Record a unique (per-day) view for this venue
      try {
        if (data?.id) {
          const key = todayKey(data.id);
          if (!localStorage.getItem(key)) {
            // 1) get authed user (if any)
            let authedUserId = null;
            try {
              const { data: ures } = await supabase.auth.getUser();
              authedUserId = ures?.user?.id || null;
            } catch (_) {
              authedUserId = null;
            }

            // 2) fallback anon id
            const anon = getAnonId();

            // 3) build payload using your columns
            const now = new Date();
            const isoNow = now.toISOString();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`; // for view_date (DATE)

            const payload = {
              venue_id: data.id,
              user_id: authedUserId, // null if not logged in
              anon_id: authedUserId ? null : anon,
              viewed_at: isoNow, // TIMESTAMP
              view_date: dateStr, // DATE (YYYY-MM-DD)
              viewed_on: 'details', // where it was viewed
            };

            const { error: viewError } = await supabase
              .from('venue_views')
              .insert(payload);

            if (viewError) {
              if (viewError.code === '23505') {
                // Duplicate for this venue/day/user — treat as success.
                // Mark it so we don't try again today from this browser.
                localStorage.setItem(key, '1');
                console.info(
                  'venue_views: duplicate daily view, ignoring.',
                  viewError
                );
              } else {
                console.warn('venue_views insert failed:', viewError);
              }
            } else {
              localStorage.setItem(key, '1');
            }
          }
        }
      } catch (e) {
        console.warn('view tracking error:', e?.message || e);
      }

      setIndex(0);
      setLoading(false);
    })();
  }, [id]);

  // Geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => console.warn('Geolocation error:', err.message)
    );
  }, []);

  // ORS route distance
  const getRouteDistance = useCallback(async (fromLat, fromLng, toLat, toLng) => {
    const API_KEY =
      'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM2YTcwNjc4ODg3MzQxOGE5OWNkZDI0MzUxNTYyY2FmIiwiaCI6Im11cm11cjY0In0=';
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const body = { coordinates: [[fromLng, fromLat], [toLng, toLat]] };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok || !data?.routes?.[0]?.summary?.distance) {
        console.error('❌ ORS API returned error or invalid format:', data);
        return Infinity;
      }
      const distanceMeters = data.routes[0].summary.distance;
      return distanceMeters / 1000;
    } catch (error) {
      console.error('❌ Failed to fetch route distance:', error);
      return Infinity;
    }
  }, []);

  useEffect(() => {
    if (userCoords && venue?.lat && venue?.lng) {
      getRouteDistance(userCoords.lat, userCoords.lng, venue.lat, venue.lng).then(
        (km) => {
          setDistanceKm(km);
        }
      );
    }
  }, [userCoords, venue, getRouteDistance]);

  const photos = useMemo(
    () =>
      Array.isArray(venue?.image_urls)
        ? venue.image_urls.filter(Boolean)
        : [],
    [venue]
  );
  const hasPhotos = photos.length > 0;

  const goTo = (i) => {
    if (!hasPhotos) return;
    const len = photos.length;
    setIndex(((i % len) + len) % len);
  };
  const goBy = (delta) => goTo(index + delta);

  const onSliderTouchStart = (e) => {
    startX.current = e.touches?.[0]?.clientX ?? 0;
    deltaX.current = 0;
  };
  const onSliderTouchMove = (e) => {
    if (startX.current == null) return;
    deltaX.current = (e.touches?.[0]?.clientX ?? 0) - startX.current;
  };
  const onSliderTouchEnd = () => {
    const threshold = 50;
    if (deltaX.current > threshold) goBy(-1);
    else if (deltaX.current < -threshold) goBy(1);
    startX.current = null;
    deltaX.current = 0;
  };

  const noticeSentence = (n) => {
    const d = Number(n);
    if (!Number.isFinite(d)) return '—';
    if (d === 0) return 'We accept same-day bookings.';
    if (d === 1) return 'We accept bookings at least 1 day in advance.';
    return `We accept bookings at least ${d} days in advance.`;
  };

  const handleChat = async (v) => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      alert('Please log in to chat.');
      return;
    }
    if (!v?.user_id) {
      console.error(
        'Missing venue.user_id. Make sure your SELECT includes user_id.'
      );
      return;
    }
    setChatOtherUserId(v.user_id);
    setShowChat(true);
  };

  const handleShare = () => {
    const url = window.location.href;
    const title = venue?.name || 'Venue';
    if (navigator.share) {
      navigator
        .share({ title, url })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      alert('Link copied to clipboard');
    }
  };

  // Auth + ownership
  const [authedUserId, setAuthedUserId] = useState(null);
  const isOwner = useMemo(() => {
    if (!venue || !authedUserId) return false;
    const ownerCol = venue.owner_id || venue.user_id;
    return ownerCol === authedUserId;
  }, [venue, authedUserId]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setAuthedUserId(user?.id || null);
      } catch (_) {
        setAuthedUserId(null);
      }
    })();
  }, []);

  // Edit modal
  const [showEditor, setShowEditor] = useState(false);

  const handleEdited = (updated) => {
    setVenue((prev) => ({ ...(prev || {}), ...(updated || {}) }));
    setShowEditor(false);
    alert('✅ Your venue has been updated!');
  };

  const fullAddress = useMemo(() => {
    if (!venue) return '';
    if (venue.formatted_address && venue.formatted_address.trim())
      return venue.formatted_address.trim();
    if (venue.address && venue.address.trim()) return venue.address.trim();
    if (venue.location && venue.location.trim()) return venue.location.trim();

    const parts = [
      venue.street_line1 || venue.street || venue.address_line1,
      venue.barangay && `Brgy ${venue.barangay}`,
      venue.city || venue.municipality || venue.town,
      venue.province || venue.state,
      venue.postal_code || venue.zip,
      venue.country,
    ]
      .filter(Boolean)
      .map((s) => String(s).trim());

    if (parts.length) return parts.join(', ');

    if (Number.isFinite(+venue?.lat) && Number.isFinite(+venue?.lng)) {
      return `${Number(venue.lat).toFixed(5)}, ${Number(venue.lng).toFixed(
        5
      )}`;
    }

    return '';
  }, [venue]);

  const renderRate = (v) => {
    const wd = Number(v?.rate_weekday);
    const we = Number(v?.rate_weekend);
    const single = Number(v?.rate);
    const fmt = (n) => `₱${Number(n).toLocaleString()}`;
    const hasWd = Number.isFinite(wd) && wd > 0;
    const hasWe = Number.isFinite(we) && we > 0;
    const hasSingle = Number.isFinite(single) && single > 0;

    if (hasWd && hasWe) return `Weekday ${fmt(wd)} • Weekend ${fmt(we)}`;
    if (hasSingle) return fmt(single);
    if (hasWd) return `Weekday ${fmt(wd)}`;
    if (hasWe) return `Weekend ${fmt(we)}`;
    return '—';
  };

  const to12h = (t) => {
    if (!t || typeof t !== 'string') return '';
    const [hh, mm = '00'] = t.split(':');
    let h = parseInt(hh, 10);
    if (Number.isNaN(h)) return t;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const showMinutes = parseInt(mm, 10) !== 0;
    return showMinutes
      ? `${h}:${mm.padStart(2, '0')}${ampm}`
      : `${h}${ampm}`;
  };

  /* ========= Favorite bootstrap ========= */
  useEffect(() => {
    abortRef.current = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (abortRef.current) return;

        if (user) {
          setUserId(user.id);
          if (!id) return;
          const { data: existing } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('venue_id', id)
            .maybeSingle();
          if (!abortRef.current) setIsFav(!!existing);
        } else {
          setUserId(null);
          setIsFav(false);
        }
      } catch (e) {
        console.warn('Fav init failed:', e?.message || e);
      }
    })();
    return () => {
      abortRef.current = true;
    };
  }, [id]);

  /* ========= Favorite toggle ========= */
  const toggleFavorite = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();

    if (!userId) {
      alert('Please log in to favorite venues.');
      return;
    }

    const next = !isFav;
    setIsFav(next);
    try {
      if (next) {
        const { error } = await supabase
          .from('favorites')
          .upsert(
            {
              user_id: userId,
              venue_id: id,
              earned_points: 1,
              action_source: 'favorite',
            },
            { onConflict: 'user_id,venue_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('venue_id', id);
        if (error) throw error;
      }
      setPop(true);
      setTimeout(() => setPop(false), 380);
    } catch (err) {
      setIsFav(!next); // revert
      console.error('Favorite toggle error:', err?.message || err);
      alert('Sorry, failed to update favorite. Please try again.');
    }
  };

  // ========= BEAUTIFUL LOADING STATE =========
  if (loading) {
    return (
      <div className="venue-details-page">
        <div className="vd-grid vd-loading-shell">
          <main className="vd-main">
            <div className="vd-skeleton-hero" />
            <div className="vd-skeleton-title" />
            <div className="vd-skeleton-text" />
            <div className="vd-skeleton-card" />
          </main>
          <aside className="vd-aside">
            <div className="vd-skeleton-aside" />
          </aside>
        </div>
      </div>
    );
  }

  if (!venue)
    return (
      <div className="venue-details-page">
        <p>Venue not found.</p>
      </div>
    );

  const priceText = renderRate(venue);

  return (
    <div className="venue-details-page vd-grid page">
      {/* Fullscreen Image Overlay */}
      {fullscreenImageIndex !== null && photos?.length > 0 && (
        <FullscreenImage
          photos={photos}
          initialIndex={fullscreenImageIndex}
          onClose={() => setFullscreenImageIndex(null)}
        />
      )}

      {/* Collage Gallery Modal */}
      {showGallery && photos?.length > 0 && (
        <GalleryModal
          photos={photos}
          onClose={() => setShowGallery(false)}
          onOpenFull={(i) => setFullscreenImageIndex(i)}
        />
      )}

      {/* HEADER */}
      <div className="page-head">
        <button
          onClick={() => navigate(-1)}
          className="back-btn"
          aria-label="Back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="vd-head-actions">
          {isOwner && (
            <>
              <button
                type="button"
                className="vd-head-pill"
                onClick={() => setShowEditor(true)}
              >
                <FiEdit2 size={14} />
                Edit venue
              </button>

              <button
                type="button"
                className={`vd-head-pill ${
                  isPublished
                    ? 'vd-head-pill-outline'
                    : 'vd-head-pill-primary'
                }`}
                onClick={togglePublish}
                disabled={busyPublish}
              >
                {busyPublish ? (
                  <>
                    <FiLoader size={14} className="spin" />
                    Saving...
                  </>
                ) : isPublished ? (
                  <>
                    <FiEyeOff size={14} />
                    Unpublish
                  </>
                ) : (
                  <>
                    <FiEye size={14} />
                    Publish
                  </>
                )}
              </button>
            </>
          )}

          {/* Share */}
          <button
            className="icon-btn"
            onClick={handleShare}
            aria-label="Share"
          >
            <FaShareAlt color="#64748b" />
          </button>

          {/* Edit modal (owner only) */}
          {isOwner && showEditor && (
            <div
              role="dialog"
              aria-modal="true"
              className="vd-editor-overlay"
              onClick={() => setShowEditor(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,.45)',
                zIndex: 1300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <div
                className="vd-editor-sheet"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(1100px, 96vw)',
                  maxHeight: '92vh',
                  overflow: 'auto',
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #edf2f6',
                  boxShadow: '0 20px 40px rgba(0,0,0,.18)',
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 6px 10px',
                  }}
                >
                  <strong style={{ fontSize: 16 }}>Edit Listing</strong>
                  <button
                    onClick={() => setShowEditor(false)}
                    aria-label="Close editor"
                    style={{
                      border: '1px solid #e6e9ef',
                      background: '#fff',
                      borderRadius: 10,
                      padding: '6px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <VenueOnboardingForm venueId={id} onSaved={handleEdited} />
              </div>
            </div>
          )}
        </div>
      </div>

      {isOwner && !isPublished && (
        <div
          style={{
            gridColumn: '1 / -1',
            margin: '4px 0 10px',
            padding: '10px 12px',
            border: '1px solid #EAB308',
            background: '#FEF9C3',
            color: '#92400e',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <span>
            This venue is <strong>unpublished</strong>. Publish it to make it
            visible to guests.
          </span>
        </div>
      )}

      {/* MAIN */}
      <main className="vd-main">
        {/* HERO / GALLERY */}
        <section className="vd-hero">
          <div
            className="slider"
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: isMobile ? '4 / 3' : '16 / 9',
              overflow: 'hidden',
            }}
            onTouchStart={onSliderTouchStart}
            onTouchMove={onSliderTouchMove}
            onTouchEnd={onSliderTouchEnd}
          >
            <div
              className="slider-track"
              style={{
                display: 'flex',
                height: '100%',
                transform: `translateX(-${index * 100}%)`,
                transition: 'transform .35s cubic-bezier(.2,.8,.2,1)',
              }}
              aria-live="polite"
            >
              {(hasPhotos
                ? photos
                : ['https://placehold.co/1200x800?text=No+Photos']
              ).map((src, i) => (
                <div
                  className="slide"
                  key={i}
                  style={{
                    flex: '0 0 100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    loading="lazy"
                    onClick={() => hasPhotos && setFullscreenImageIndex(i)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      cursor: hasPhotos ? 'zoom-in' : 'default',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Overlay UI */}
            <div className="vd-hero-overlay" />

            <div className="vd-hero-top">
              <div className="left vd-hero-ctas">
                {venue?.type && (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() =>
                      document
                        .querySelector('.vd-quickfacts')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    <FaTag /> {venue.type}
                  </button>
                )}
              </div>
              <div className="right vd-hero-ctas">
                {hasPhotos && (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => setShowGallery(true)}
                  >
                    Open gallery
                  </button>
                )}

                {/* Favorite button */}
                <button
                  className={`fav-btn ${isFav ? 'is-fav' : ''} ${
                    pop ? 'pop' : ''
                  }`}
                  onClick={toggleFavorite}
                  aria-pressed={isFav}
                  aria-label={
                    isFav
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                  title={
                    isFav
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                >
                  {isFav ? (
                    <FaHeart style={{ width: 18, height: 18 }} />
                  ) : (
                    <FaRegHeart style={{ width: 18, height: 18 }} />
                  )}
                </button>
              </div>
            </div>

            {/* Progress + count */}
            {hasPhotos && (
              <>
                <div className="vd-hero-count">
                  {index + 1} / {photos.length}
                </div>
                <div className="vd-progress">
                  <i
                    style={{
                      width: `${((index + 1) / photos.length) * 100}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {hasPhotos && photos.length > 1 && (
            <div className="thumbs">
              {photos.map((src, i) => (
                <div
                  key={src + i}
                  className={`thumb ${i === index ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                  role="button"
                  aria-label={`Open photo ${i + 1}`}
                >
                  <img src={src} alt={`Thumb ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* TITLE + META */}
        <h1 className="venue-title">{venue.name}</h1>
        <div className="vd-meta-row">
          {fullAddress ? (
            <a
              className="meta-sub"
              href={
                Number.isFinite(+venue?.lat) &&
                Number.isFinite(+venue?.lng)
                  ? `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      fullAddress
                    )}`
              }
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'inline-flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
              title="Open in Google Maps"
            >
              <FaMapMarkerAlt style={{ marginTop: 2 }} />
              <span>{fullAddress}</span>
            </a>
          ) : null}
        </div>

        {/* QUICK FACTS */}
        <div className="detail-card vd-quickfacts">
          <Row icon={ICON.price} label="Rate" value={priceText} />
          <Row
            icon={ICON.capacity}
            label="Capacity"
            value={venue?.capacity_max ?? '—'}
          />
          <Row icon={ICON.type} label="Type" value={venue?.type || '—'} />
        </div>

       {/* DESCRIPTION */}
{venue?.description && (
  <section className="vd-section">
    <h4>About this venue</h4>

    <div
      style={{
        margin: 0,
        padding: 0,
        display: "grid",
        gap: "8px",
        lineHeight: 1.7,
   color: "#6B7280", 
      }}
    >
      {venue.description
        .split(/\r?\n|•/g) // split by line breaks or bullet characters
        .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim()) // remove bullets
        .filter(Boolean) // remove empty lines
        .map((line, i) => (
          <p key={i} style={{ margin: 0 }}>
            {line}
          </p>
        ))}
    </div>
  </section>
)}


        {/* HOURS */}
        {( (venue?.open_time && venue?.close_time) ||
          venue?.hours ||
          Number.isFinite(+venue?.notice) ) && (
          <section className="vd-section">
            <h4>Operating hours</h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.6,
              }}
            >
              {( (venue?.open_time && venue?.close_time) || venue?.hours ) && (
                <li>
                  Hours:{' '}
                  {venue?.open_time && venue?.close_time
                    ? `${to12h(venue.open_time)} - ${to12h(
                        venue.close_time
                      )}`
                    : venue?.hours || '—'}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* EVENT HOURS & BUFFERS */}
        {(Number(venue?.setup_time_mins) > 0 ||
          Number(venue?.included_event_hours) > 0 ||
          Number(venue?.cleanup_time_mins) > 0 ||
          (Number.isFinite(+venue?.overtime_rate) &&
            +venue.overtime_rate > 0)) && (
          <section className="vd-section">
            <h4>Event hours & buffers</h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.6,
              }}
            >
              {Number(venue?.setup_time_mins) > 0 && (
                <li>
                  Setup -{' '}
                  {Math.round(
                    (+venue.setup_time_mins || 0) / 60
                  )}{' '}
                  Hours
                </li>
              )}
              {Number(venue?.included_event_hours) > 0 && (
                <li>Event - {venue.included_event_hours} Hours</li>
              )}
              {Number(venue?.cleanup_time_mins) > 0 && (
                <li>
                  Cleanup -{' '}
                  {Math.round(
                    (+venue.cleanup_time_mins || 0) / 60
                  )}{' '}
                  Hours
                </li>
              )}
              {Number.isFinite(+venue?.overtime_rate) &&
                +venue.overtime_rate > 0 && (
                  <li>
                    Overtime ₱
                    {Number(venue.overtime_rate).toLocaleString()}
                    /hr
                  </li>
                )}
            </ul>
          </section>
        )}

        {/* AMENITIES / INCLUSIONS / ADD-ONS / RULES */}
        {Array.isArray(venue?.amenities) &&
          venue.amenities.length > 0 && (
            <section className="vd-section">
              <h4>Amenities</h4>
              <div className="chip-row">
                {venue.amenities.map((a, i) => (
                  <span className="chip" key={i}>
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}
        {Array.isArray(venue?.inclusions) &&
          venue.inclusions.length > 0 && (
            <section className="vd-section">
              <h4>Inclusions</h4>
              <div className="chip-row">
                {venue.inclusions.map((a, i) => (
                  <span className="chip" key={i}>
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}
        {Array.isArray(venue?.addons) &&
          venue.addons.length > 0 && (
            <section className="vd-section">
              <h4>Add-ons</h4>
              <div className="chip-row">
                {venue.addons.map((a, i) => (
                  <span className="chip" key={i}>
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}
        {Array.isArray(venue?.rules) && venue.rules.length > 0 && (
          <section className="vd-section">
            <h4>Rules</h4>
            <div className="chip-row">
              {venue.rules.map((a, i) => (
                <span className="chip" key={i}>
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* NOTICE */}
        {Number.isFinite(+venue?.notice) && (
          <section className="vd-section">
            <h4>Notice</h4>
            <div className="vd-notice">
              {noticeSentence(venue?.notice)}
            </div>
          </section>
        )}

        {/* MAP */}
        {venue?.lat && venue?.lng && (
          <section className="vd-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <h4 style={{ margin: 0 }}>
                Map Location
                {typeof distanceKm === 'number' &&
                  distanceKm !== Infinity && (
                    <span
                      className="meta-sub"
                      style={{ marginLeft: 8 }}
                    >
                      📍 {distanceKm.toFixed(1)} km away
                    </span>
                  )}
              </h4>
              <a
                className="btn-primary"
                href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, padding: '8px 12px' }}
              >
                Get Directions
              </a>
            </div>
            <div className="vd-map">
              <MapContainer
                center={[venue.lat, venue.lng]}
                zoom={16}
                scrollWheelZoom={false}
                attributionControl={false}
                style={{ height: '100%', width: '100%' }}
                zoomControl={!isMobile}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Imagery © Esri, Maxar, Earthstar Geographics"
                />
                <TileLayer
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution="Labels © Esri"
                />

                <Marker
                  position={[venue.lat, venue.lng]}
                  icon={L.divIcon({
                    html: `
                      <div style="display:flex;flex-direction:column;align-items:center;">
                        <img src="${
                          venue.image_urls?.[0] ||
                          'https://placehold.co/60'
                        }" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);margin-bottom:4px;" />
                        <div style="display:inline-flex;align-items:center;gap:6px;background:white;padding:4px 8px;border-radius:6px;border:1px solid #ccc;font-size:13px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                          <img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" style="width:16px;height:16px;" />
                          <span style="color:#333;">${String(
                            venue.name || ''
                          )
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')}</span>
                        </div>
                      </div>
                    `,
                    className: '',
                    iconAnchor: [24, 60],
                  })}
                />
              </MapContainer>
            </div>
          </section>
        )}
      </main>

      {/* ASIDE (Desktop sticky booking card) */}
      <aside className="vd-aside">
        <div className="vd-aside-card">
          <div className="vd-price">
            <span className="amount">
              {priceText !== '—' ? priceText : 'Contact for price'}
            </span>
          </div>
          <div className="vd-cta-stack">
            <button
              className="btn-primary"
              onClick={() => navigate(`/venues/${venue.id}/book`)}
            >
              <FaCalendarCheck /> Book Now
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => handleChat(venue)}
            >
              <FaMessage /> Chat with host
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`,
                  '_blank'
                )
              }
            >
              <FaMapMarkerAlt /> View on Maps
            </button>
          </div>
        </div>
      </aside>

      {/* Sticky Footer CTA (mobile only) */}
      <div className="vd-sticky-cta">
        <div className="cta-bar">
          <button
            type="button"
            className="btn-outline"
            onClick={() => handleChat(venue)}
            style={{ flex: 1 }}
          >
            <FaMessage /> Chat
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate(`/venues/${venue.id}/book`)}
            style={{ flex: 1 }}
          >
            <FaCalendarCheck /> Book Now
          </button>
        </div>
      </div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        venue={venue}
        otherUserId={chatOtherUserId}
      />
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-ico" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{label}:</strong> {value}
      </div>
    </div>
  );
}
