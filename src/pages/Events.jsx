// src/pages/Events.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchPosts } from '../utils/LoadPosts';
import { SUPABASE_URL, supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import NeutralAvatar from '../components/NeutralAvatar';
import { Heart, MessageCircle } from "lucide-react";

/* ---------------------------------- */
/* Inline Styles (Canva-like purple)  */
/* ---------------------------------- */

const EVENTS_STYLES = `
:root {
  --events-bg: #f5f7fb;
  --events-surface: #ffffff;
  --events-card-soft: #f0f3f9;

  --events-accent: #635bff;
  --events-accent-soft: rgba(99, 91, 255, 0.12);
  --events-accent-2: #ff6ad5;

  --events-text: #0f172a;
  --events-text-muted: #64748b;
  --events-border-subtle: rgba(15, 23, 42, 0.08);

  --events-radius-lg: 18px;
  --events-radius-md: 14px;
  --events-radius-sm: 10px;
  --events-radius-pill: 999px;

  --events-shadow-soft: 0 18px 40px rgba(15, 23, 42, 0.10);
  --events-shadow-subtle: 0 8px 20px rgba(15, 23, 42, 0.06);
}

/* root container */
.events-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 12px 96px;
  background: var(--events-bg);
  min-height: 100vh;
  box-sizing: border-box;
}

/* Generic card look (same vibe as home / builder) */
.card {
  background: var(--events-surface);
  border-radius: var(--events-radius-lg);
  border: 1px solid var(--events-border-subtle);
  box-shadow: var(--events-shadow-subtle);
}

/* Header card */
.events-header {
  padding: 0px 18px 18px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.events-subtitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--events-text);
  margin-bottom:0;
}

.events-subinfo {
  font-size: 13px;
  line-height: 1.5;
  color: var(--events-text-muted);
  margin:0;
}

/* Share button – pill, purple */
.share-event-btn {
  margin-top: 10px;
  align-self: flex-start;
  border-radius: var(--events-radius-pill);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  outline: none;
  cursor: pointer;
  background: var(--events-accent);
  color: #ffffff;
  box-shadow: var(--events-shadow-soft);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease;
}

.share-event-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 45px rgba(99, 91, 255, 0.4);
  background: #574dfd;
}

.share-event-btn:active {
  transform: translateY(0);
  box-shadow: 0 12px 28px rgba(99, 91, 255, 0.45);
}

/* No posts text */
.no-posts {
  text-align: center;
  color: var(--events-text-muted);
  font-size: 14px;
  margin-top: 40px;
}

/* Feed list */
.post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Post card */
.post-card {
  padding: 10px 10px 12px;
  border-radius: var(--events-radius-lg);
}

/* Header row in post card */
.post-user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  paddding-right:0px;
}

.post-user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.post-user strong {
  font-size: 14px;
  color: var(--events-text);
}

.post-time,
.post-user-details .post-time {
  font-size: 12px;
  color: var(--events-text-muted);
  margin:0;
}

/* Venue tags / badges */
.venue-link {
  color: var(--events-accent);
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
}

.venue-link:hover {
  text-decoration: underline;
}

.venue-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--events-radius-pill);
  background: var(--events-accent-soft);
  color: var(--events-accent);
  margin-left: 6px;
}

/* Caption */
.post-caption {
  margin: 8px 2px 6px;
  font-size: 14px;
  color: var(--events-text);
  line-height: 1.4;
}

/* Images layout */
.post-images {
  margin-top: 4px;
  border-radius: var(--events-radius-md);
  overflow: hidden;
  background: var(--events-card-soft);
}

.post-images.layout-0 {
  display: none;
}

.image-wrapper {
  position: relative;
  overflow: hidden;
  background: #1f2933;
}

.image-wrapper.single {
  max-height: 430px;
}

.post-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease-out;
}

.image-wrapper:hover .post-image {
  transform: scale(1.02);
}

/* Two images */
.post-images.layout-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

/* 3 images – horizontal scroll gallery */
.scrollable-gallery {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* 4+ images – grid */
.grid-gallery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(96px, 1fr);
  gap: 2px;
}

.overlay-more {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f9fafb;
  font-size: 20px;
  font-weight: 600;
}

/* Actions row */
.post-actions.pretty {
  margin-top: 8px;
  display: flex;
  padding: 4px 2px 0;
  align-items: center;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
  margin-top: 10px;
}

.act-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--events-radius-pill);
  font-size: 12px;
  color: var(--events-text-muted);
  transition: background 0.15s ease, color 0.15s ease, transform 0.08s ease;
}

.act-btn .icon {
  margin-right: 2px;
}

.act-btn:hover {
  background: rgba(99, 91, 255, 0.08);
  color: var(--events-accent);
}

.act-btn.active {
  background: var(--events-accent-soft);
  color: var(--events-accent);
}

.act-btn span:last-child {
  font-weight: 500;
}

.act-sep {
  flex: 1;
}

/* Skeletons */
.skeleton-card {
  position: relative;
  overflow: hidden;
}

.sk {
  background: linear-gradient(
    90deg,
    #e5e7eb 0%,
    #f4f4f5 25%,
    #e5e7eb 50%,
    #f4f4f5 75%,
    #e5e7eb 100%
  );
  background-size: 200% 100%;
  animation: events-skeleton-pulse 1.4s ease-in-out infinite;
  border-radius: 999px;
}

.sk-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.sk-avatar.sm {
  width: 28px;
  height: 28px;
}

.sk-line {
  height: 10px;
  border-radius: 999px;
  margin-bottom: 4px;
}

.sk-line.w-48 { width: 48%; }
.sk-line.w-28 { width: 28%; }
.sk-line.w-100 { width: 100%; }
.sk-line.w-80 { width: 80%; }
.sk-line.w-60 { width: 60%; }

.sk-image {
  width: 100%;
  height: 190px;
  border-radius: var(--events-radius-md);
  margin-top: 8px;
}

.sk-pill {
  width: 90px;
  height: 24px;
  border-radius: var(--events-radius-pill);
}

.mt-6 { margin-top: 6px; }
.mt-12 { margin-top: 12px; }
.ml-8 { margin-left: 8px; }

@keyframes events-skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Comments */
.comments-section {
  margin-top: 8px;
  padding: 8px 10px 10px;
  border-radius: var(--events-radius-md);
  background: var(--events-card-soft);
  box-shadow: none;
}

.comment-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.comment-body {
  flex: 1;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.comment-name {
  font-size: 12px;
  color: var(--events-text);
}

.comment-time {
  font-size: 11px;
  color: var(--events-text-muted);
}

.comment-text {
  margin-top: 2px;
  font-size: 13px;
  color: var(--events-text);
}

/* comment menu */
.comment-menu-wrap {
  margin-left: auto;
  position: relative;
}

.comment-kebab {
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  color: var(--events-text-muted);
}

.comment-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--events-surface);
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
  padding: 4px;
  min-width: 140px;
  z-index: 40;
}

.comment-menu .menu-item {
  width: 100%;
  padding: 6px 10px;
  text-align: left;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  color: var(--events-text);
}

.comment-menu .menu-item:hover {
  background: rgba(148, 163, 184, 0.1);
}

.comment-menu .menu-item.danger {
  color: #ef4444;
}

/* comment input */
.comment-add {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.comment-input {
  flex: 1;
  border-radius: var(--events-radius-pill);
  border: 1px solid rgba(148, 163, 184, 0.5);
  padding: 7px 14px;
  font-size: 13px;
  outline: none;
  background: #ffffff;
}

.comment-input:focus {
  border-color: var(--events-accent);
  box-shadow: 0 0 0 1px rgba(99, 91, 255, 0.25);
}

.comment-send {
  border-radius: var(--events-radius-pill);
  border: none;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: var(--events-accent);
  color: #ffffff;
}

/* comment edit */
.comment-edit {
  margin-top: 4px;
}

.comment-edit .comment-input {
  width: 100%;
  border-radius: var(--events-radius-sm);
}

.comment-edit-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.btn {
  border-radius: var(--events-radius-pill);
  font-size: 12px;
  border: none;
  padding: 6px 12px;
  cursor: pointer;
}

.btn.ghost {
  background: transparent;
  color: var(--events-text-muted);
}

.btn.primary {
  background: var(--events-accent);
  color: #ffffff;
}

/* Post details overlay – mobile-safe */
.pd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  z-index: 60;

  display: flex;
  justify-content: center;
  align-items: center;

  padding: 0px;
  padding-top: max(env(safe-area-inset-top), 16px); /* iPhone notch */

  /* ❌ no more scrolling here – modal will scroll */
  overflow: hidden;
}

/* Modal becomes the scroll container */
.pd-modal {
  background: #020617;
  border-radius: 22px;
  width: 100%;
  max-width: 960px;

  /* limit to viewport height & scroll inside */
  max-height: calc(100dvh - 32px - env(safe-area-inset-top));
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.8);
}

/* Small screens – full screen sheet */
@media (max-width: 768px) {
  .pd-overlay {
    padding: 0;
    align-items: flex-start;
  }
  .pd-modal {
    border-radius: 0;
    width: 100%;
    max-width: 100%;
    max-height: 100dvh; /* full viewport */
  }
}

/* Sticky header inside scrollable modal */
.pd-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.96);

  position: sticky;
  top: 0;
  z-index: 5; /* above content */
}


.pd-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.pd-head-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pd-userline {
  font-size: 13px;
  color: #e5e7eb;
}

.pd-tagline {
  font-size: 12px;
  color: #9ca3af;
}

.pd-time {
  font-size: 11px;
  color: #9ca3af;
}

.pd-close {
  border: none;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  font-size: 16px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  cursor: pointer;
}

.pd-close:hover {
  background: rgba(99, 91, 255, 0.65);
}

.pd-slider-wrap {
  position: relative;
  background: #020617;
}

.pd-slider {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.pd-slide {
  min-width: 100%;

  scroll-snap-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #1e293b 0, #020617 60%);
}

.pd-image {
  max-width: 100%;
  max-height: calc(80vh - 76px);
  object-fit: contain;
}

/* arrows */
.pd-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 999px;
  border: none;
  width: 32px;
  height: 32px;
  background: rgba(15, 23, 42, 0.85);
  color: #e5e7eb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pd-arrow.left { left: 8px; }
.pd-arrow.right { right: 8px; }

/* Infinite bottom spinner */
.infinite-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px 0 24px;
  gap: 6px;
}

.infinite-spinner .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--events-accent);
  animation: events-bounce 0.9s infinite alternate;
}

.infinite-spinner .dot:nth-child(2) {
  animation-delay: 0.12s;
}
.infinite-spinner .dot:nth-child(3) {
  animation-delay: 0.24s;
}

@keyframes events-bounce {
  0% { transform: translateY(0); opacity: 0.6; }
  100% { transform: translateY(-4px); opacity: 1; }
}

/* Post modal / edit modal base */
.pm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 70;
}

.pm-modal {
  background: var(--events-surface);
  border-radius: 22px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.7);
}

.pm-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-header strong {
  font-size: 15px;
  color: var(--events-text);
}

.pm-close {
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--events-text-muted);
}

.pm-body {
  padding: 12px 16px 10px;
  overflow-y: auto;
}

.pm-row {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--events-text-muted);
}

.pm-input,
.pm-textarea,
.pm-dropdown {
  font-size: 13px;
}

.pm-input,
.pm-textarea,
.pm-uploader-grid,
.pm-dropdown,
.pm-seg {
  border-radius: var(--events-radius-md);
}

.pm-input,
.pm-textarea,
.pm-uploader-grid {
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: #ffffff;
  padding: 7px 10px;
}

.pm-input:focus,
.pm-textarea:focus {
  outline: none;
  border-color: var(--events-accent);
  box-shadow: 0 0 0 1px rgba(99, 91, 255, 0.25);
}

.pm-textarea {
  resize: vertical;
  min-height: 70px;
}

/* segmented control */
.pm-seg {
  display: inline-flex;
  padding: 2px;
  background: #f3f4f6;
  border: 1px solid rgba(148, 163, 184, 0.5);
}

.pm-seg-btn {
  border-radius: var(--events-radius-pill);
  border: none;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--events-text-muted);
  background: transparent;
}

.pm-seg-btn.active {
  background: var(--events-accent);
  color: #ffffff;
}

/* hint */
.pm-hint {
  font-size: 11px;
  color: var(--events-text-muted);
}

/* dropdown */
.pm-dropdown {
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid rgba(148, 163, 184, 0.5);
  padding: 4px;
  background: #ffffff;
}

.pm-option {
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--events-text);
}

.pm-option:hover {
  background: rgba(148, 163, 184, 0.12);
}

.pm-option.active {
  background: var(--events-accent-soft);
  color: var(--events-accent);
}

/* uploader grid */
.pm-uploader-grid {
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}

.pm-thumb {
  position: relative;
  border-radius: var(--events-radius-md);
  overflow: hidden;
  background: #0f172a;
}

.pm-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pm-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.75);
  color: #e5e7eb;
}

.pm-thumb-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(15, 23, 42, 0.7);
}

.pm-thumb-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--events-accent), var(--events-accent-2));
}

/* "+" tile */
.pm-plus {
  border: 1px dashed rgba(148, 163, 184, 0.7);
  border-radius: var(--events-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  cursor: pointer;
  background: #f9fafb;
  min-height: 80px;
}

.pm-plus.disabled {
  opacity: 0.6;
  cursor: default;
}

.pm-plus-inner {
  text-align: center;
  color: var(--events-text-muted);
  font-size: 12px;
}

.pm-plus-icon {
  font-size: 20px;
  font-weight: 500;
}

.pm-plus-text {
  margin-top: 2px;
}

/* hidden file input */
.pm-file-hidden {
  display: none;
}

/* footer */
.pm-footer {
  padding: 10px 16px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  display: flex;
  align-items: center;
  gap: 10px;
}

.pm-progress {
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.pm-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--events-accent), var(--events-accent-2));
}

.pm-progress-text {
  font-size: 11px;
  color: var(--events-text-muted);
  min-width: 34px;
  text-align: right;
}

.pm-btn {
  border-radius: var(--events-radius-pill);
  border: none;
  font-size: 12px;
  padding: 6px 13px;
  cursor: pointer;
}

.pm-btn.ghost {
  background: transparent;
  color: var(--events-text-muted);
}

.pm-btn.primary {
  background: var(--events-accent);
  color: #ffffff;
}

/* Mobile tweaks */
@media (max-width: 600px) {
  .events-container {
    padding: 12px 10px 90px;
  }

  .post-card {
    border-radius: 16px;
  }

  /* 🔹 Mobile: modal behaves like a full-screen sheet */
  .pd-overlay {
    padding: 0;
    align-items: flex-start;                /* start at top */
  }

  .pd-modal {
    border-radius: 0;
    width: 100%;
    max-width: 100%;
    height: 100dvh;                         /* use dynamic viewport height */
    max-height: 100dvh;
    overflow-y: auto;                       /* scroll inside the modal */
    -webkit-overflow-scrolling: touch;
  }

  /* 🔹 Slide area uses remaining height below header */
  .pd-slide {
    /* header is ~56–70px tall; tweak this value if needed */
    max-height: calc(100dvh - 70px);
    min-height: auto;                       /* don’t force it taller than the viewport */
  }
}
/* Make the modal a vertical flex layout */
.pd-modal {
  display: flex;
  flex-direction: column;
}

/* Let the slider area take all remaining height under the header */
.pd-slider-wrap {
  flex: 1 1 auto;
  display: flex;
}

.pd-slider {
  flex: 1 1 auto;
  display: flex;
}

/* Each slide fills that space and centers its content */
.pd-slide {
  flex: 1 1 auto;
  min-width: 100%;
  min-height: 0;           /* important so it can shrink inside flex */
  display: flex;
  align-items: center;     /* ⬅ vertical center */
  justify-content: center; /* ⬅ horizontal center */
}

/* Image itself stays centered and contained */
.pd-image {
  max-width: 100%;
  max-height: 100%;
  height: auto;
  object-fit: contain;
  margin: auto;            /* extra safety for centering */
}
@media (max-width: 600px) {
  .pd-modal {
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
}

`;

/* ---------------------------------- */
/* Utilities                          */
/* ---------------------------------- */
const genId = () =>
  (window.crypto?.randomUUID?.() ||
    `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

function timeAgoShort(ts) {
  const t = new Date(ts).getTime();
  if (!t) return '';
  const diff = Date.now() - t;
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (diff < m) return '1m';
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  return `${Math.floor(diff / d)}d`;
}

function extFromMime(mime) {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  return (mime.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
}
function renameWithExt(name, mime) {
  const ext = extFromMime(mime);
  return name.replace(/\.[^.]+$/, '') + '.' + ext;
}
function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
async function compressImageFile(
  file,
  { maxWidth = 1600, maxHeight = 1600, quality = 0.8, mimeType = 'image/jpeg' } = {}
) {
  try {
    let source; let usingBitmap = false;
    if ('createImageBitmap' in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
        usingBitmap = true;
      } catch {}
    }
    if (!source) source = await loadImageElementFromFile(file);

    const sw = source.width, sh = source.height;
    const scale = Math.min(1, maxWidth / sw, maxHeight / sh);
    const tw = Math.max(1, Math.round(sw * scale));
    const th = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, tw, th);

    if (usingBitmap && source.close) source.close();

    const blob = await new Promise((res) => canvas.toBlob(res, mimeType, quality));
    if (!blob) return file;

    return new File([blob], renameWithExt(file.name, mimeType), {
      type: mimeType, lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
function putToSupabaseStorageWithProgress({ bucket, path, file, authToken, onProgress, upsert = false }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.setRequestHeader('x-upsert', upsert ? 'true' : 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) onProgress(evt.loaded, evt.total);
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`;
        resolve(publicUrl);
      } else {
        reject(new Error(`Upload failed (${xhr.status}) ${xhr.responseText || ''}`));
      }
    };
    xhr.send(file);
  });
}

/* ---------------------------------- */

export default function Events() {
  // inject inline CSS once
  useEffect(() => {
    let el = document.getElementById('events-inline-styles');
    if (!el) {
      el = document.createElement('style');
      el.id = 'events-inline-styles';
      el.textContent = EVENTS_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const venueImageCacheRef = useRef(new Map());
  const [editPost, setEditPost] = useState(null);

  const [selectedPost, setSelectedPost] = useState(null);
  const [startIndex, setStartIndex] = useState(0);

  const [showPostModal, setShowPostModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [ownedVenues, setOwnedVenues] = useState([]);

  const [likesCount, setLikesCount] = useState({});
  const [commentsCount, setCommentsCount] = useState({});
  const [likedByMe, setLikedByMe] = useState({});
  const usernameCacheRef = useRef(new Map());

  const [openComments, setOpenComments] = useState({});
  const toggleCommentsPanel = (postId) =>
    setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }));

  const [menuOpenId, setMenuOpenId] = useState(null);
  const closeMenus = () => setMenuOpenId(null);
  useEffect(() => {
    const onClick = (e) => {
      if (!e.target.closest?.('.post-kebab-wrap')) closeMenus();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const navigate = useNavigate();
  const goToVenue = (venueId) => {
    if (!venueId) return;
    navigate(`/venues/${venueId}`);
  };

  const PAGE_SIZE = 12;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(null);
  const loadMoreRef = useRef(null);

  const getScroller = () =>
    document.querySelector('.main-content') ||
    document.scrollingElement ||
    document.documentElement ||
    document.body;

  const attemptRestore = useCallback((y) => {
    const scroller = getScroller();
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const target = Math.min(y, maxY);
    scroller.scrollTo({ top: target, behavior: 'auto' });
    return Math.abs((scroller.scrollTop || 0) - target) < 2;
  }, []);

  useEffect(() => {
    return () => {
      const scroller = getScroller();
      sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop || 0));
    };
  }, []);

  const fetchPage = useCallback(async ({ mode = 'initial' } = {}) => {
    const isInitial = mode === 'initial';
    if (isInitial) setLoading(true); else setLoadingMore(true);

    try {
      let q = supabase
        .from('posts')
        .select(`
          id, user_id, username, caption, photos, venue_id, created_at,
          theVenues ( id, name, image_urls )
        `)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (!isInitial && cursorRef.current) q = q.lt('created_at', cursorRef.current);

      const { data: rawRows, error } = await q;
      if (error) throw error;

      // fetch missing usernames into cache
      const cache = usernameCacheRef.current;
      const needIds = Array.from(
        new Set((rawRows || []).map(r => r.user_id).filter(Boolean))
      ).filter(uid => !cache.has(uid));

      if (needIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', needIds);

        for (const p of profs || []) cache.set(p.id, p.username || '');
      }

      const rows = (rawRows || []).map(row => {
        const posterIsVenue =
          (row?.username || '').trim().toLowerCase() ===
          (row?.theVenues?.name || '').trim().toLowerCase();

        return {
          ...row,
          displayName: posterIsVenue
            ? (row.theVenues?.name || 'Venue')
            : (usernameCacheRef.current.get(row.user_id) || 'User'),
          timeAgo: timeAgoShort(row.created_at),
        };
      });

      if (isInitial) setPosts(rows);
      else {
        setPosts(prev => {
          const seen = new Set(prev.map(p => p.id));
          const append = rows.filter(r => !seen.has(r.id));
          return [...prev, ...append];
        });
      }

      if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
      if (mode === 'initial') { setPosts([]); setHasMore(false); }
    } finally {
      if (isInitial) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  const SCROLL_KEY = 'events:scrollY';
  const restoredOnceRef = useRef(false);

  const refreshFeed = useCallback(async (forceTop = false) => {
    if (forceTop) {
      sessionStorage.removeItem(SCROLL_KEY);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    cursorRef.current = null;
    setHasMore(true);
    await fetchPage({ mode: 'initial' });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchPage({ mode: 'more' });
  }, [loadingMore, hasMore, fetchPage]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '1200px 0px', threshold: 0.01 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const onScroll = () => {
      if (loadingMore || !hasMore) return;
      const el = document.scrollingElement || document.documentElement;
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distanceFromBottom < 1500) loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore, loadingMore, hasMore]);

  // save on scroll
  useEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;
    const onScroll = () =>
      sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop || 0));
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  // save on unload / tab hide
  useEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;
    const save = () => sessionStorage.setItem(SCROLL_KEY, String(scroller.scrollTop || 0));
    const onVis = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      save();
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // restore scroll (will pull more pages if needed)
  useEffect(() => {
    if (loading || restoredOnceRef.current) return;

    const scroller = getScroller();
    const savedY = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (!scroller || savedY <= 0) { restoredOnceRef.current = true; return; }

    let raf;
    let stoppedByUser = false;
    const onUserScroll = () => { stoppedByUser = true; };

    const tick = async () => {
      if (stoppedByUser) return;
      const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (maxY + 50 < savedY && hasMore && !loadingMore) {
        await loadMore();
      }
      const target = Math.min(savedY, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      scroller.scrollTo({ top: target, behavior: 'auto' });

      if (Math.abs((scroller.scrollTop || 0) - target) < 2 || !hasMore) {
        restoredOnceRef.current = true;
        scroller.removeEventListener('scroll', onUserScroll, true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    scroller.addEventListener('scroll', onUserScroll, { capture: true, passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', onUserScroll, true);
    };
  }, [loading, hasMore, loadingMore, loadMore]);

  useEffect(() => {
    window.socialTabRefresh = refreshFeed;
    return () => { delete window.socialTabRefresh; };
  }, [refreshFeed]);

  // ------------- shared helpers (avatars) -------------
  const colorForId = useCallback((uid) => {
    if (!uid) return '#635bff';
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  const getFirstVenueImage = useCallback((v) => {
    if (!v) return null;
    if (Array.isArray(v.image_urls)) return v.image_urls[0] || null;
    if (typeof v.image_urls === 'string') {
      try {
        const arr = JSON.parse(v.image_urls);
        if (Array.isArray(arr)) return arr[0] || null;
      } catch {}
    }
    return null;
  }, []);

  function VenueAvatar({ venue, venueId, size = 36, title = 'Venue' }) {
    const cache = venueImageCacheRef.current;
    const [imgUrl, setImgUrl] = useState(() => getFirstVenueImage(venue));

    useEffect(() => {
      const direct = getFirstVenueImage(venue);
      if (direct) {
        setImgUrl(direct);
        if (venueId) cache.set(venueId, direct);
        return;
      }
      if (!venueId) return;
      if (cache.has(venueId)) {
        setImgUrl(cache.get(venueId) || null);
        return;
      }
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('theVenues')
          .select('image_urls')
          .eq('id', venueId)
          .single();
        if (error) {
          cache.set(venueId, null);
          return;
        }
        const url = getFirstVenueImage(data);
        cache.set(venueId, url || null);
        if (!cancelled) setImgUrl(url || null);
      })();
      return () => { cancelled = true; };
    }, [venue, venueId]);

    const letter = (venue?.name?.[0] || 'V').toUpperCase();
    return (
      <div
        title={title}
        aria-label="Venue"
        style={{
          width: size, height: size, borderRadius: '50%', overflow: 'hidden',
          background: '#e5e7eb', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', flexShrink: 0,
        }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={venue?.name || 'Venue'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <span
            style={{
              color: '#fff', background: '#635bff', width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: Math.max(12, Math.floor(size * 0.44)),
            }}
          >
            {letter}
          </span>
        )}
      </div>
    );
  }

  // cache: userId -> { url, version }
  const userAvatarCacheRef = useRef(new Map());
  const [avatarBump, setAvatarBump] = useState(0);

  useEffect(() => {
    const onAvatarUpdated = (e) => {
      const { userId, url, version } = e.detail || {};
      if (!userId) return;
      userAvatarCacheRef.current.set(userId, { url: url || null, version: version || Date.now() });
      setAvatarBump((x) => x + 1);
    };
    window.addEventListener('avatar:updated', onAvatarUpdated);
    return () => window.removeEventListener('avatar:updated', onAvatarUpdated);
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set((posts || []).map((p) => p.user_id).filter(Boolean)))
      .filter((id) => !userAvatarCacheRef.current.has(id));
    if (!ids.length) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', ids);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          userAvatarCacheRef.current.set(row.id, { url: row.avatar_url || null, version: 0 });
        }
        setAvatarBump((x) => x + 1);
      }
    })();
  }, [posts]);

  function UserAvatar({ userId, title = 'User', size = 36, username }) {
    const cache = userAvatarCacheRef.current;
    const [state, setState] = useState(() => cache.get(userId) || { url: null, version: 0 });

    useEffect(() => {
      if (!userId) return;
      const cached = cache.get(userId);
      if (cached) { setState(cached); return; }
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', userId)
          .single();
        const url = error ? null : data?.avatar_url || null;
        const entry = { url, version: 0 };
        cache.set(userId, entry);
        if (!cancelled) setState(entry);
      })();
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, avatarBump]);

    return (
      <NeutralAvatar
        size={size}
        src={state.url}
        cacheKey={state.version}
        seed={userId}
        bg={colorForId(userId || '')}
        title={title || username}
        initialsFrom={username || title}
      />
    );
  }

  function formatCount(n) {
    n = Number(n || 0);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  useEffect(() => {
    const loadEngagement = async () => {
      if (!posts?.length) return;
      const ids = posts.map((p) => p.id);

      const { data: likeRows } = await supabase.from('likes').select('post_id,user_id').in('post_id', ids);
      const lc = {}; const lbm = {};
      for (const r of likeRows || []) {
        lc[r.post_id] = (lc[r.post_id] || 0) + 1;
        if (r.user_id === currentUser?.id) lbm[r.post_id] = true;
      }
      setLikesCount(lc); setLikedByMe(lbm);

      const { data: commentRows } = await supabase.from('comments').select('post_id').in('post_id', ids);
      const cc = {};
      for (const r of commentRows || []) cc[r.post_id] = (cc[r.post_id] || 0) + 1;
      setCommentsCount(cc);
    };
    loadEngagement();
  }, [posts, currentUser]);

  const toggleLike = async (postId) => {
    if (!currentUser?.id) {
      alert('Please log in to like posts.');
      return;
    }
    const isLiked = !!likedByMe[postId];
    setLikedByMe((prev) => ({ ...prev, [postId]: !isLiked }));
    setLikesCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + (isLiked ? -1 : 1)) }));
    try {
      if (isLiked) {
        const { error } = await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUser.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }]);
        if (error) throw error;
      }
    } catch (e) {
      setLikedByMe((prev) => ({ ...prev, [postId]: isLiked }));
      setLikesCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + (isLiked ? 1 : -1)) }));
      console.error(e);
      alert('Failed to update like. Please try again.');
    }
  };

  const onCommentDelta = (postId, delta) => {
    setCommentsCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 0) + delta) }));
  };

  // load posts + user + owned venues
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let profileUsername = '';
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        profileUsername = prof?.username ?? '';
      }
      const cUser = user ? { id: user.id, username: profileUsername } : null;
      setCurrentUser(cUser);

      if (cUser?.id) {
        const { data: venues } = await supabase
          .from('theVenues')
          .select('id,name')
          .eq('user_id', cUser.id);
        setOwnedVenues(venues || []);
      } else {
        setOwnedVenues([]);
      }

      await fetchPage({ mode: 'initial' });
    };
    load();
  }, []);


  useEffect(() => {
    window.openPostModal = () => setShowPostModal(true);
    return () => { delete window.openPostModal; };
  }, []);

  const openPostDetails = (post, index = 0) => {
    setSelectedPost(post);
    setStartIndex(index);
    document.body.style.overflow = 'hidden';
  };
  const closePostDetails = () => {
    setSelectedPost(null);
    setStartIndex(0);
    document.body.style.overflow = '';
  };

  const isVenuePoster = (post) => {
    const a = (post?.username || '').trim().toLowerCase();
    const b = (post?.theVenues?.name || '').trim().toLowerCase();
    return !!a && !!b && a === b;
  };

  const canDeletePost = (post) => {
    if (!currentUser?.id) return false;
    if (post.user_id === currentUser.id) return true;
    if (isVenuePoster(post) && post.venue_id) {
      return ownedVenues.some((v) => v.id === post.venue_id);
    }
    return false;
  };

  const deletePost = async (post) => {
    if (!canDeletePost(post)) return;
    const ok = window.confirm('Delete this post? This cannot be undone.');
    if (!ok) return;
    const prev = posts;
    setPosts((p) => p.filter((x) => x.id !== post.id));
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
    } catch (e) {
      console.error(e);
      alert('Failed to delete post.');
      setPosts(prev);
    } finally {
      closeMenus();
    }
  };

  return (
    <div className="events-container">
      {/* header styled as card */}
      <div className="events-header card">
        <p className="events-subtitle">Celebrate life's moments with the community</p>
        <p className="events-subinfo">
          Share photos of your birthday, wedding, or any special event held at your venue. Inspire others to book the perfect place!
        </p>
        <button className="share-event-btn" onClick={() => setShowPostModal(true)}>
          Share Your Event
        </button>
      </div>

      {loading ? (
        <SkeletonFeed count={6} />
      ) : posts?.length === 0 ? (
        <p className="no-posts">No posts yet. Be the first to share your event!</p>
      ) : (
        <div className="post-list">
          {posts.map((post) => {
            const posterIsVenue = isVenuePoster(post);
            const showKebab = canDeletePost(post);

            return (
              <div key={post.id} className="post-card card">
                <div className="post-user-row">
                  <div style={{ marginRight: 0 }}>
                    {posterIsVenue ? (
                      <VenueAvatar
                        venue={post.theVenues}
                        venueId={post.venue_id}
                        size={36}
                        title={post.theVenues?.name || 'Venue'}
                      />
                    ) : (
                      <UserAvatar userId={post.user_id} size={36} title={post.displayName || 'User'} />
                    )}
                  </div>

                  <div className="post-user-details" style={{ flex: 1, minWidth: 0 }}>
                    <div className="post-user" style={{ display: 'flex', alignItems: 'center', columnGap: 5, rowGap: 0, flexWrap: 'wrap' }}>
                      <strong>
                        {posterIsVenue && post.venue_id ? (
                          <Link to={`/venues/${post.venue_id}`} className="venue-link" onClick={(e) => e.stopPropagation()} title="Open venue details">
                            {post.displayName}
                          </Link>
                        ) : (
                          post.displayName
                        )}
                      </strong>
                      {posterIsVenue ? (
                        <span className="venue-badge">Official Venue</span>
                      ) : (
                        <span style={{ color: '#666' }}>
                          tagged{' '}
                          <Link
                            to={post.venue_id ? `/venues/${post.venue_id}` : '#'}
                            className="venue-link"
                            onClick={(e) => {
                              if (!post.venue_id) return;
                              e.stopPropagation();
                            }}
                          >
                            {post.theVenues?.name || 'Unknown Venue'}
                          </Link>
                        </span>
                      )}
                    </div>
                    <p className="post-time">{post.timeAgo}</p>
                  </div>

                  <div className="post-kebab-wrap" style={{ marginLeft: 6, position: 'relative' }}>
                    {showKebab && (
                      <>
                        <button
                          className="post-kebab"
                          aria-haspopup="menu"
                          aria-expanded={menuOpenId === post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((prev) => (prev === post.id ? null : post.id));
                          }}
                          title="Post options"
                          style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            color: '#666', fontSize: 20, lineHeight: 1, padding: '4px 6px',
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpenId === post.id && (
                          <div
                            className="post-menu"
                            role="menu"
                            style={{
                              position: 'absolute', top: '100%', right: 0, background: '#fff',
                              border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              padding: 6, zIndex: 20, minWidth: 160,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="menu-item"
                              role="menuitem"
                              onClick={() => { closeMenus(); setEditPost(post); }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '8px 10px',
                                background: 'transparent', border: 'none', color: '#111',
                                cursor: 'pointer', borderRadius: 6,
                              }}
                            >
                              Edit
                            </button>

                            <button
                              className="menu-item danger"
                              role="menuitem"
                              onClick={() => deletePost(post)}
                              style={{
                                width: '100%', textAlign: 'left', padding: '8px 10px',
                                background: 'transparent', border: 'none', color: '#ef4444',
                                cursor: 'pointer', borderRadius: 6,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <p className="post-caption">{post.caption}</p>

                <div className={`post-images layout-${post.photos?.length || 0}`}>
                  {post.photos?.length === 1 && (
                    <div className="image-wrapper single" onClick={() => openPostDetails(post, 0)}>
                      <img src={post.photos[0]} alt="Event" className="post-image single" />
                    </div>
                  )}
                  {post.photos?.length === 2 && (
                    <>
                      {post.photos.map((src, index) => (
                        <div
                          key={`${post.id}_img_${index}`}
                          className="image-wrapper square"
                          onClick={() => openPostDetails(post, index)}
                        >
                          <img src={src} alt={`Event ${index}`} className="post-image" />
                        </div>
                      ))}
                    </>
                  )}
                  {post.photos?.length === 3 && (
                    <div className="scrollable-gallery">
                      {post.photos.map((src, index) => (
                        <div
                          key={`${post.id}_img_${index}`}
                          className="image-wrapper square"
                          onClick={() => openPostDetails(post, index)}
                        >
                          <img src={src} alt={`Event ${index}`} className="post-image" />
                        </div>
                      ))}
                    </div>
                  )}
                  {post.photos?.length >= 4 && (
                    <div className="grid-gallery">
                      {post.photos.slice(0, 4).map((src, index) => (
                        <div
                          key={`${post.id}_img_${index}`}
                          className="image-wrapper square"
                          onClick={() => openPostDetails(post, index)}
                        >
                          <img src={src} alt={`Event ${index}`} className="post-image" />
                          {index === 3 && post.photos.length > 4 && (
                            <div className="overlay-more" aria-hidden="true">
                              +{post.photos.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="post-actions pretty">
                  <button
                    className={`act-btn like ${likedByMe[post.id] ? 'active' : ''}`}
                    onClick={() => toggleLike(post.id)}
                    aria-pressed={!!likedByMe[post.id]}
                    aria-label={likedByMe[post.id] ? 'Unlike' : 'Like'}
                    title={likedByMe[post.id] ? 'Unlike' : 'Like'}
                  >
                    <Heart size={20} strokeWidth={2} fill={likedByMe[post.id] ? "currentColor" : "none"} className="icon heart" />
                    <span className="act-label">Like</span>
                    <span className="">{formatCount(likesCount[post.id])}</span>
                  </button>

                  <span className="act-sep" aria-hidden="true"></span>

                  <button
                    className="act-btn comment"
                    onClick={() => toggleCommentsPanel(post.id)}
                    aria-label="Show comments"
                    title="Show comments"
                  >
                    <MessageCircle size={20} strokeWidth={2} className="icon bubble" />
                    <span className="act-label">Comment</span>
                    <span className="">{formatCount(commentsCount[post.id])}</span>
                  </button>
                </div>

                {openComments[post.id] && (
                  <CommentsPanel
                    postId={post.id}
                    postOwnerId={post.user_id}
                    currentUser={currentUser}
                    onCommentDelta={onCommentDelta}
                    colorForId={colorForId}
                    UserAvatarCmp={UserAvatar}
                  />
                )}
              </div>
            );
          })}

          <div ref={loadMoreRef} style={{ height: 1 }} />
          {loadingMore && <BottomSpinner />}
        </div>
      )}

      {selectedPost && (
        <PostDetailsModal
          post={selectedPost}
          startIndex={startIndex}
          onClose={closePostDetails}
          colorForId={colorForId}
          getFirstVenueImage={getFirstVenueImage}
          UserAvatarCmp={UserAvatar}
        />
      )}

      {showPostModal && (
        <PostModal
          onClose={() => setShowPostModal(false)}
          currentUser={currentUser}
          ownedVenues={ownedVenues}
          onSuccess={async () => {
            setShowPostModal(false);
            const letterColors = window.letterColors || {};
            await fetchPosts(setPosts, setLoading, currentUser || {}, letterColors);
          }}
        />
      )}

      {editPost && (
        <EditPostModal
          post={editPost}
          currentUser={currentUser}
          ownedVenues={ownedVenues}
          onClose={() => setEditPost(null)}
          onSaved={(updated) => {
            setPosts(prev => prev.map(p => {
              if (p.id !== updated.id) return p;
              const venueName = updated.theVenues?.name || p.theVenues?.name || '';
              const posterIsVenue =
                (updated.username || '').trim().toLowerCase() === venueName.trim().toLowerCase();
              const profName = usernameCacheRef.current.get(p.user_id) || p.displayName || 'User';
              return {
                ...p,
                caption: updated.caption,
                photos: updated.photos,
                username: updated.username,
                venue_id: updated.venue_id,
                theVenues: updated.theVenues || p.theVenues,
                displayName: posterIsVenue ? (venueName || 'Venue') : profName,
              };
            }));
            setEditPost(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------- */
/* Skeleton UI Components */
/* ---------------------- */
function SkeletonFeed({ count = 6 }) {
  return (
    <div className="post-list" role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPostCard key={i} />
      ))}
    </div>
  );
}
function SkeletonPostCard() {
  return (
    <div className="post-card skeleton-card card" aria-hidden="true">
      <div className="post-user-row">
        <div className="sk sk-avatar" />
        <div className="post-user-details">
          <div className="sk sk-line w-48" />
          <div className="sk sk-line w-28 mt-6" />
        </div>
      </div>
      <div className="sk sk-line w-100 mt-12" />
      <div className="sk sk-line w-80 mt-6" />
      <div className="sk sk-image mt-12" />
      <div className="post-actions pretty mt-12">
        <div className="sk sk-pill" />
        <span className="act-sep" />
        <div className="sk sk-pill" />
      </div>
    </div>
  );
}

/* ---------------------- */
/* Post Details Modal     */
/* ---------------------- */
function PostDetailsModal({ post, onClose, startIndex = 0, colorForId, getFirstVenueImage, UserAvatarCmp }) {
  const sliderRef = useRef(null);

  const posterIsVenue =
    (post?.username || '').trim().toLowerCase() ===
    (post?.theVenues?.name || '').trim().toLowerCase();

  function VenueCircle({ venue, venueId, size = 40, title = 'Venue', getFirstVenueImage }) {
    const cacheRef = useRef(new Map());
    const [imgUrl, setImgUrl] = useState(() => getFirstVenueImage?.(venue) || null);

    useEffect(() => {
      const direct = getFirstVenueImage?.(venue);
      if (direct) {
        setImgUrl(direct);
        if (venueId) cacheRef.current.set(venueId, direct);
        return;
      }
      if (!venueId) return;

      const cached = cacheRef.current.get(venueId);
      if (cached !== undefined) { setImgUrl(cached || null); return; }

      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('theVenues')
          .select('image_urls')
          .eq('id', venueId)
          .single();
        if (error) { cacheRef.current.set(venueId, null); return; }
        const url = getFirstVenueImage?.(data) || null;
        cacheRef.current.set(venueId, url);
        if (!cancelled) setImgUrl(url);
      })();

      return () => { cancelled = true; };
    }, [venue, venueId, getFirstVenueImage]);

    const letter = (venue?.name?.[0] || 'V').toUpperCase();
    const style = {
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: '#e5e7eb', display: 'flex', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)', flexShrink: 0,
    };

    return (
      <div title={title} aria-label="Venue" style={style}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={venue?.name || 'Venue'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <span
            style={{
              color: '#fff', background: '#635bff', width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: Math.max(12, Math.floor(size * 0.44)),
            }}
          >
            {letter}
          </span>
        )}
      </div>
    );
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // jump to clicked index on open
    if (!sliderRef.current) return;
    const w = sliderRef.current.offsetWidth || 0;
    sliderRef.current.scrollLeft = (w * startIndex) || 0;
  }, [startIndex, post?.id]);

  return (
    <div className="pd-overlay" onClick={onClose}>
      <div className="pd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pd-header">
          <div className="pd-head-left">
            <div style={{ marginRight: 10 }}>
              {posterIsVenue ? (
                <VenueCircle
                  venue={post.theVenues}
                  venueId={post.venue_id}
                  size={40}
                  title={post.theVenues?.name || 'Venue'}
                  getFirstVenueImage={getFirstVenueImage}
                />
              ) : UserAvatarCmp ? (
                <UserAvatarCmp userId={post.user_id} size={40} title={post.displayName || 'User'} />
              ) : (
                <NeutralAvatar size={40} bg={colorForId(post.user_id)} title={post.displayName || 'User'} />
              )}
            </div>
            <div className="pd-head-meta">
              <div className="pd-userline">
                <strong>
                  {posterIsVenue && post.venue_id ? (
                    <Link to={`/venues/${post.venue_id}`} className="venue-link" onClick={(e) => e.stopPropagation()}>
                      {post.displayName}
                    </Link>
                  ) : (
                    post.displayName
                  )}
                </strong>{' '}
                {posterIsVenue ? (
                  <span className="venue-badge">Official Venue</span>
                ) : (
                  <span className="pd-tagline">
                    tagged{' '}
                    <Link
                      to={post.venue_id ? `/venues/${post.venue_id}` : '#'}
                      className="venue-link"
                      onClick={(e) => { if (!post.venue_id) return; e.stopPropagation(); }}
                    >
                      {post.theVenues?.name || 'Unknown Venue'}
                    </Link>
                  </span>
                )}
              </div>
              <div className="pd-time">{post.timeAgo}</div>
            </div>
          </div>
          <button className="pd-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pd-slider-wrap">


          <div className="pd-slider" ref={sliderRef}>
            {(post.photos || []).map((src, i) => (
              <div className="pd-slide" key={`${post.id}_pd_${i}`}>
                <img className="pd-image" src={src} alt={`Event photo ${i + 1}`} />
              </div>
            ))}
          </div>


        </div>
      </div>
    </div>
  );
}

function BottomSpinner() {
  return (
    <div className="infinite-spinner" role="status" aria-live="polite" aria-label="Loading more">
      <div className="dot" /><div className="dot" /><div className="dot" />
    </div>
  );
}

/* ---------------------- */
/* Comments Panel         */
/* ---------------------- */
function CommentsPanel({ postId, postOwnerId, currentUser, onCommentDelta, colorForId, UserAvatarCmp }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [usernames, setUsernames] = useState({});
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('comments')
        .select('id, post_id, user_id, text, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) { setComments([]); setLoading(false); return; }

      const uids = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)));
      let map = {};
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', uids);
        map = Object.fromEntries((profs || []).map((p) => [p.id, p.username]));
      }
      setUsernames(map);
      setComments((rows || []).map((r) => ({ ...r, username: map[r.user_id] || 'User' })));
      setLoading(false);
    })();
  }, [postId]);

  const submitComment = async () => {
    if (!currentUser?.id) { alert('Please log in to comment.'); return; }
    const trimmed = text.trim(); if (!trimmed) return;

    setSubmitting(true);
    try {
      const payload = { post_id: postId, user_id: currentUser.id, text: trimmed };
      const { data, error } = await supabase
        .from('comments')
        .insert([payload])
        .select('id, post_id, user_id, text, created_at')
        .single();
      if (error) throw error;

      const displayUsername = usernames[currentUser.id] || currentUser.username || 'User';
      if (!usernames[currentUser.id] && currentUser.username) {
        setUsernames((prev) => ({ ...prev, [currentUser.id]: currentUser.username }));
      }
      setComments((prev) => [...prev, { ...data, username: displayUsername }]);
      setText('');
      onCommentDelta?.(postId, +1);
    } catch (e) {
      console.error(e);
      alert('Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c) => { setEditingId(c.id); setEditingText(c.text || ''); setMenuOpenId(null); };
  const cancelEdit = () => { setEditingId(null); setEditingText(''); };
  const saveEdit = async (c) => {
    const trimmed = editingText.trim(); if (!trimmed) return;
    if (currentUser?.id !== c.user_id && currentUser?.id !== postOwnerId) return;
    const { data, error } = await supabase.from('comments').update({ text: trimmed }).eq('id', c.id).select().single();
    if (error) { alert('Failed to edit comment.'); return; }
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...data, username: x.username } : x)));
    setEditingId(null); setEditingText('');
  };
  const deleteComment = async (c) => {
    if (currentUser?.id !== c.user_id && currentUser?.id !== postOwnerId) return;
    try {
      const { error } = await supabase.from('comments').delete().eq('id', c.id);
      if (error) throw error;
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      onCommentDelta?.(postId, -1);
    } catch (e) {
      console.error(e);
      alert('Failed to delete comment.');
    } finally {
      setMenuOpenId(null);
    }
  };

  return (
    <div className="comments-section card">
      {loading ? (
        <>
          <div className="comment-row muted">
            <div className="sk sk-avatar sm" />
            <div className="sk sk-line w-60 ml-8" />
          </div>
          <div className="comment-row muted">
            <div className="sk sk-avatar sm" />
            <div className="sk sk-line w-48 ml-8" />
          </div>
        </>
      ) : (
        comments.map((c) => {
          const canModerate = currentUser?.id === c.user_id || currentUser?.id === postOwnerId;
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="comment-row">
              <div style={{ marginRight: 8 }}>
                {UserAvatarCmp ? (
                  <UserAvatarCmp userId={c.user_id} size={28} title={c.username || 'User'} username={c.username} />
                ) : (
                  <NeutralAvatar size={28} bg={colorForId(c.user_id)} title={c.username || 'User'} />
                )}
              </div>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong className="comment-name">{c.username || 'User'}</strong>
                  <span className="comment-time">{timeAgoShort(c.created_at)}</span>

                  {canModerate && (
                    <div className="comment-menu-wrap">
                      <button
                        className="comment-kebab"
                        aria-haspopup="menu"
                        aria-expanded={menuOpenId === c.id}
                        onClick={() => setMenuOpenId((prev) => (prev === c.id ? null : c.id))}
                        title="More actions"
                      >
                        ⋯
                      </button>

                      {menuOpenId === c.id && (
                        <div className="comment-menu" role="menu">
                          <button className="menu-item" role="menuitem" onClick={() => startEdit(c)}>Edit</button>
                          <button className="menu-item danger" role="menuitem" onClick={() => deleteComment(c)}>Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isEditing ? (
                  <div className="comment-text">{c.text}</div>
                ) : (
                  <div className="comment-edit">
                    <input
                      className="comment-input"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(c); }
                        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                      }}
                      autoFocus
                    />
                    <div className="comment-edit-actions">
                      <button className="btn ghost" onClick={cancelEdit}>Cancel</button>
                      <button className="btn primary" onClick={() => saveEdit(c)} disabled={!editingText.trim()}>
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      <div className="comment-add">
        <input
          className="comment-input"
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
          }}
        />
        <button className="comment-send" onClick={submitComment} disabled={submitting || !text.trim()}>
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/* ---------------------- */
/* Post Modal (create)    */
/* ---------------------- */
/** Item shape: { id, file, previewUrl } */
function PostModal({ onClose, onSuccess, currentUser, ownedVenues }) {
  const [caption, setCaption] = useState('');
  const [items, setItems] = useState([]);         // [{id,file,previewUrl}]
  const [posting, setPosting] = useState(false);

  const canPostAsVenue = ownedVenues?.length > 0;
  const [mode, setMode] = useState('self');       // 'self' | 'venue'
  const [ownVenueId, setOwnVenueId] = useState(ownedVenues?.[0]?.id || null);

  const [venueQuery, setVenueQuery] = useState('');
  const [venueOptions, setVenueOptions] = useState([]);
  const [taggedVenueId, setTaggedVenueId] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [overallPct, setOverallPct] = useState(0);
  const [filePctMap, setFilePctMap] = useState({}); // {id: pct}

  const fileInputRef = useRef(null);

  // --- helpers for stable keys & cleanup ---
  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;

    // dedupe by name+size
    const sig = new Set(items.map((x) => `${x.file.name}|${x.file.size}`));
    const next = [];
    for (const f of picked) {
      const key = `${f.name}|${f.size}`;
      if (sig.has(key)) continue;
      const id = genId();
      const previewUrl = URL.createObjectURL(f);
      next.push({ id, file: f, previewUrl });
    }
    if (!next.length) return;
    setItems((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    setFilePctMap((prev) => {
      const cp = { ...prev }; delete cp[id]; return cp;
    });
  };

  useEffect(() => {
    return () => {
      items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
    };
  }, [items]);

  const onPickFiles = (e) => addFiles(e.target.files);
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer?.files); };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!venueQuery?.trim()) { setVenueOptions([]); return; }
      const { data } = await supabase
        .from('theVenues')
        .select('id,name')
        .ilike('name', `%${venueQuery.trim()}%`)
        .limit(8);
      setVenueOptions(data || []);
    }, 250);
    return () => clearTimeout(id);
  }, [venueQuery]);

  const submitPost = async () => {
    if (!currentUser?.id) { alert('Please log in to share an event.'); return; }
    if (!items.length) { alert('Please upload at least one image.'); return; }
    if (mode === 'venue' && !ownVenueId) { alert('Please choose which venue you are posting as.'); return; }
    if (mode === 'self' && !taggedVenueId) { alert('Please tag a venue.'); return; }

    setPosting(true);
    setUploading(true);
    setOverallPct(0);
    setFilePctMap({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) { alert('Please log in again.'); return; }

      const COMPRESS_OPTS = { maxWidth: 1600, maxHeight: 1600, quality: 0.8, mimeType: 'image/jpeg' };

      // compress first to calculate totalBytes correctly
      const prepared = [];
      for (const it of items) {
        const f = it.file;
        const shouldCompress = (f.size || 0) > 400 * 1024 || /image\/(png|tiff|heic|heif)/i.test(f.type || '');
        const cf = shouldCompress ? await compressImageFile(f, COMPRESS_OPTS) : f;
        prepared.push({ id: it.id, file: cf });
      }

      const bucket = 'post-images';
      const totalBytes = prepared.reduce((s, x) => s + (x.file.size || 0), 0) || 1;
      let uploadedBytes = 0;
      const uploads = [];

      for (let i = 0; i < prepared.length; i++) {
        const { id, file } = prepared[i];
        const ext = file.name && file.name.includes('.') ? file.name.split('.').pop() : extFromMime(file.type || 'image/jpeg');
        const path = `${currentUser.id}/${Date.now()}-${i}.${ext}`;

        let lastLoaded = 0;
        const publicUrl = await putToSupabaseStorageWithProgress({
          bucket,
          path,
          file,
          authToken,
          onProgress: (loaded, total) => {
            const pct = Math.round((loaded / (total || file.size || 1)) * 100);
            setFilePctMap((prev) => ({ ...prev, [id]: pct }));
            const delta = loaded - lastLoaded;
            lastLoaded = loaded;
            uploadedBytes += Math.max(0, delta);
            setOverallPct(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
          },
        });

        uploads.push(publicUrl);
      }

      const venueNameForOwn = ownedVenues.find((v) => v.id === ownVenueId)?.name || '';
      const payload = {
        user_id: currentUser.id,
        username: mode === 'venue' ? venueNameForOwn : currentUser.username || '',
        caption: caption || '',
        photos: uploads,
        venue_id: mode === 'venue' ? ownVenueId : taggedVenueId,
      };

      const { error: insErr } = await supabase.from('posts').insert([payload]);
      if (insErr) throw insErr;

      // cleanup thumbnails
      items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));

      setCaption('');
      setItems([]);
      onSuccess?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Failed to publish post.');
    } finally {
      setPosting(false);
      setUploading(false);
      setOverallPct(0);
      setFilePctMap({});
    }
  };

  return (
    <div className="pm-overlay" onClick={() => { if (!uploading && !posting) onClose(); }}>
      <div className="pm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <strong>Share Your Event</strong>
          <button className="pm-close" onClick={onClose} aria-label="Close" disabled={uploading || posting} title={uploading || posting ? 'Please wait…' : 'Close'}>
            ✕
          </button>
        </div>

        <div className="pm-body">
          {ownedVenues?.length > 0 && (
            <div className="pm-row">
              <label className="pm-label">Post as</label>
              <div className="pm-seg">
                <button className={`pm-seg-btn ${mode === 'self' ? 'active' : ''}`} onClick={() => setMode('self')} type="button">Myself</button>
                <button className={`pm-seg-btn ${mode === 'venue' ? 'active' : ''}`} onClick={() => setMode('venue')} type="button">A venue I own</button>
              </div>
            </div>
          )}

          {mode === 'venue' && ownedVenues?.length > 0 && (
            <div className="pm-row">
              <label className="pm-label">Choose venue</label>
              <select className="pm-input" value={ownVenueId || ''} onChange={(e) => setOwnVenueId(e.target.value)} disabled={uploading || posting}>
                {ownedVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <div className="pm-hint">This post will appear as your venue (Official Venue).</div>
            </div>
          )}

          {mode === 'self' && (
            <div className="pm-row">
              <label className="pm-label">Tag a venue</label>
              <input
                className="pm-input"
                placeholder="Search venue name…"
                value={venueQuery}
                onChange={(e) => { setVenueQuery(e.target.value); setTaggedVenueId(null); }}
                disabled={uploading || posting}
              />
              {venueOptions.length > 0 && (
                <div className="pm-dropdown">
                  {venueOptions.map((v) => (
                    <div
                      key={v.id}
                      className={`pm-option ${taggedVenueId === v.id ? 'active' : ''}`}
                      onClick={() => { if (uploading || posting) return; setTaggedVenueId(v.id); setVenueQuery(v.name); setVenueOptions([]); }}
                    >
                      {v.name}
                    </div>
                  ))}
                </div>
              )}
              <div className="pm-hint">Required: pick the venue where this event happened.</div>
            </div>
          )}

          <div className="pm-row">
            <label className="pm-label">Caption</label>
            <textarea className="pm-textarea" rows={3} placeholder="Tell everyone about your event…" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={uploading || posting} />
          </div>

          <div className="pm-row">
            <label className="pm-label">Photos</label>

            <input ref={fileInputRef} className="pm-file-hidden" type="file" multiple accept="image/*" onChange={onPickFiles} disabled={uploading || posting} />

            <div className="pm-uploader-grid" onDrop={onDrop} onDragOver={onDragOver}>
              {items.map((it) => (
                <div key={it.id} className="pm-thumb">
                  <img src={it.previewUrl} alt="Selected" />
                  <button
                    className="pm-remove"
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => removeItem(it.id)}
                    title="Remove"
                    disabled={uploading}
                  >
                    ✕
                  </button>

                  {uploading && (
                    <div className="pm-thumb-progress">
                      <div className="pm-thumb-progress-bar" style={{ width: `${filePctMap[it.id] || 0}%` }} />
                    </div>
                  )}
                </div>
              ))}

              <div
                className={`pm-plus ${uploading ? 'disabled' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onKeyDown={(e) => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) fileInputRef.current?.click(); }}
                title={uploading ? 'Uploading…' : 'Add photos'}
              >
                <div className="pm-plus-inner">
                  <div className="pm-plus-icon">+</div>
                  <div className="pm-plus-text">{uploading ? 'Uploading…' : 'Add photos'}</div>
                </div>
              </div>
            </div>

            <div className="pm-hint">Tip: you can drag & drop images here.</div>
          </div>
        </div>

        <div className="pm-footer">
          <div className="pm-progress">
            <div className="pm-progress-bar" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="pm-progress-text">{uploading ? `${overallPct}%` : ''}</div>

          <button className="pm-btn ghost" onClick={onClose} disabled={posting || uploading}>Cancel</button>
          <button className="pm-btn primary" onClick={submitPost} disabled={posting || uploading || !items.length}>
            {uploading ? `Uploading ${overallPct}%` : posting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- */
/* Edit Post Modal        */
/* ---------------------- */
/** New uploads also use stable IDs to avoid key/preview glitches */
function EditPostModal({ post, currentUser, ownedVenues, onClose, onSaved }) {
  const posterIsVenue =
    (post?.username || '').trim().toLowerCase() ===
    (post?.theVenues?.name || '').trim().toLowerCase();

  const [caption, setCaption] = useState(post?.caption || '');
  const [keptUrls, setKeptUrls] = useState(() => Array.isArray(post?.photos) ? [...post.photos] : []);
  const [newItems, setNewItems] = useState([]);   // [{id,file,previewUrl}]

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overallPct, setOverallPct] = useState(0);
  const [filePctMap, setFilePctMap] = useState({}); // {id:pct}

  const canPostAsVenue = ownedVenues?.length > 0;
  const [mode, setMode] = useState(posterIsVenue && canPostAsVenue ? 'venue' : 'self');
  const [ownVenueId, setOwnVenueId] = useState(
    posterIsVenue && post?.venue_id && ownedVenues?.some(v => v.id === post.venue_id)
      ? post.venue_id
      : ownedVenues?.[0]?.id || null
  );

  const [venueQuery, setVenueQuery] = useState(!posterIsVenue ? (post?.theVenues?.name || '') : '');
  const [venueOptions, setVenueOptions] = useState([]);
  const [taggedVenueId, setTaggedVenueId] = useState(!posterIsVenue ? post?.venue_id || null : null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !uploading && !saving && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [uploading, saving, onClose]);

  useEffect(() => {
    return () => newItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
  }, [newItems]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (mode !== 'self') return;
      const q = (venueQuery || '').trim();
      if (!q) { setVenueOptions([]); return; }
      const { data } = await supabase
        .from('theVenues')
        .select('id,name')
        .ilike('name', `%${q}%`)
        .limit(8);
      setVenueOptions(data || []);
    }, 250);
    return () => clearTimeout(id);
  }, [mode, venueQuery]);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const sig = new Set(newItems.map((x) => `${x.file.name}|${x.file.size}`));
    const next = [];
    for (const f of picked) {
      const key = `${f.name}|${f.size}`;
      if (sig.has(key)) continue;
      const id = genId();
      const previewUrl = URL.createObjectURL(f);
      next.push({ id, file: f, previewUrl });
    }
    if (!next.length) return;
    setNewItems((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const onPickFiles = (e) => addFiles(e.target.files);
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer?.files); };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const removeExisting = (idx) => setKeptUrls((prev) => prev.filter((_, i) => i !== idx));
  const removeNew = (id) => {
    setNewItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    setFilePctMap((prev) => { const cp = { ...prev }; delete cp[id]; return cp; });
  };

  const save = async () => {
    if (mode === 'venue' && !ownVenueId) { alert('Please choose which venue you are posting as.'); return; }
    if (mode === 'self' && !taggedVenueId) { alert('Please tag a venue.'); return; }
    if (keptUrls.length + newItems.length === 0) { alert('Your post must include at least one image.'); return; }

    setSaving(true);
    setUploading(newItems.length > 0);
    setOverallPct(0);
    setFilePctMap({});

    try {
      let uploaded = [];
      if (newItems.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        if (!authToken) throw new Error('Please log in again.');

        const COMPRESS_OPTS = { maxWidth: 1600, maxHeight: 1600, quality: 0.8, mimeType: 'image/jpeg' };

        const prepared = [];
        for (const it of newItems) {
          const f = it.file;
          const shouldCompress = (f.size || 0) > 400 * 1024 || /image\/(png|tiff|heic|heif)/i.test(f.type || '');
          const cf = shouldCompress ? await compressImageFile(f, COMPRESS_OPTS) : f;
          prepared.push({ id: it.id, file: cf });
        }

        const bucket = 'post-images';
        const totalBytes = prepared.reduce((s, x) => s + (x.file.size || 0), 0) || 1;
        let uploadedBytes = 0;

        for (let i = 0; i < prepared.length; i++) {
          const { id, file } = prepared[i];
          const ext = file.name && file.name.includes('.') ? file.name.split('.').pop() : extFromMime(file.type || 'image/jpeg');
          const path = `${post.user_id}/${Date.now()}-${i}.${ext}`;

          let lastLoaded = 0;
          const url = await putToSupabaseStorageWithProgress({
            bucket,
            path,
            file,
            authToken,
            onProgress: (loaded, total) => {
              const pct = Math.round((loaded / (total || file.size || 1)) * 100);
              setFilePctMap((prev) => ({ ...prev, [id]: pct }));
              const delta = loaded - lastLoaded;
              lastLoaded = loaded;
              uploadedBytes += Math.max(0, delta);
              setOverallPct(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
            },
          });

          uploaded.push(url);
        }
      }

      const photos = [...keptUrls, ...uploaded];
      const newVenueId = mode === 'venue' ? ownVenueId : taggedVenueId;
      const venueNameForOwn = ownedVenues?.find((v) => v.id === ownVenueId)?.name || '';
      const newUsername = mode === 'venue' ? venueNameForOwn : (currentUser?.username || 'User');

      const { data: updated, error } = await supabase
        .from('posts')
        .update({ caption: (caption || '').trim(), photos, username: newUsername, venue_id: newVenueId })
        .eq('id', post.id)
        .select('id, caption, photos, username, venue_id')
        .single();

      if (error) throw error;

      let venueRow = null;
      if (updated?.venue_id) {
        const { data: v } = await supabase
          .from('theVenues')
          .select('id, name, image_urls')
          .eq('id', updated.venue_id)
          .single();
        venueRow = v || null;
      }

      newItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
      onSaved?.({ ...updated, theVenues: venueRow });
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
      setUploading(false);
      setOverallPct(0);
      setFilePctMap({});
    }
  };

  const disabled = uploading || saving;

  return (
    <div className="pm-overlay" onClick={() => !disabled && onClose?.()}>
      <div className="pm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <strong>Edit Post</strong>
          <button className="pm-close" onClick={onClose} aria-label="Close" disabled={disabled}>✕</button>
        </div>

        <div className="pm-body">
          {canPostAsVenue && (
            <div className="pm-row">
              <label className="pm-label">Post as</label>
              <div className="pm-seg">
                <button className={`pm-seg-btn ${mode === 'self' ? 'active' : ''}`} onClick={() => { setMode('self'); }} type="button" disabled={disabled}>Myself</button>
                <button className={`pm-seg-btn ${mode === 'venue' ? 'active' : ''}`} onClick={() => { setMode('venue'); }} type="button" disabled={disabled}>A venue I own</button>
              </div>
            </div>
          )}

          {mode === 'venue' && canPostAsVenue && (
            <div className="pm-row">
              <label className="pm-label">Choose venue</label>
              <select className="pm-input" value={ownVenueId || ''} onChange={(e) => setOwnVenueId(e.target.value)} disabled={disabled}>
                {ownedVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <div className="pm-hint">This post will appear as your venue (Official Venue).</div>
            </div>
          )}

          {mode === 'self' && (
            <div className="pm-row">
              <label className="pm-label">Tag a venue</label>
              <input
                className="pm-input"
                placeholder="Search venue name…"
                value={venueQuery}
                onChange={(e) => { setVenueQuery(e.target.value); setTaggedVenueId(null); }}
                disabled={disabled}
              />
              {venueOptions.length > 0 && (
                <div className="pm-dropdown">
                  {venueOptions.map((v) => (
                    <div
                      key={v.id}
                      className={`pm-option ${taggedVenueId === v.id ? 'active' : ''}`}
                      onClick={() => { if (disabled) return; setTaggedVenueId(v.id); setVenueQuery(v.name); setVenueOptions([]); }}
                    >
                      {v.name}
                    </div>
                  ))}
                </div>
              )}
              <div className="pm-hint">Required: pick the venue where this event happened.</div>
            </div>
          )}

          <div className="pm-row">
            <label className="pm-label">Caption</label>
            <textarea className="pm-textarea" rows={3} placeholder="Update your caption…" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={disabled} />
          </div>

          <div className="pm-row">
            <label className="pm-label">Photos</label>
            <div className="pm-uploader-grid" onDrop={onDrop} onDragOver={onDragOver}>
              {keptUrls.map((src, i) => (
                <div key={`keep-${i}`} className="pm-thumb">
                  <img src={src} alt={`Existing ${i + 1}`} />
                  <button className="pm-remove" type="button" aria-label="Remove photo" onClick={() => removeExisting(i)} title="Remove" disabled={disabled}>✕</button>
                </div>
              ))}

              {newItems.map((it) => (
                <div key={it.id} className="pm-thumb">
                  <img src={it.previewUrl} alt="Selected" />
                  <button className="pm-remove" type="button" aria-label="Remove photo" onClick={() => removeNew(it.id)} title="Remove" disabled={uploading}>✕</button>
                  {uploading && (
                    <div className="pm-thumb-progress">
                      <div className="pm-thumb-progress-bar" style={{ width: `${filePctMap[it.id] || 0}%` }} />
                    </div>
                  )}
                </div>
              ))}

              <input
                ref={fileInputRef}
                className="pm-file-hidden"
                type="file"
                multiple
                accept="image/*"
                onChange={onPickFiles}
                disabled={disabled}
              />
              <div
                className={`pm-plus ${disabled ? 'disabled' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => !disabled && fileInputRef.current?.click()}
                onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) fileInputRef.current?.click(); }}
                title={disabled ? 'Uploading…' : 'Add photos'}
              >
                <div className="pm-plus-inner">
                  <div className="pm-plus-icon">+</div>
                  <div className="pm-plus-text">{uploading ? 'Uploading…' : 'Add photos'}</div>
                </div>
              </div>
            </div>
            <div className="pm-hint">Drag & drop to add photos. Remove any you don’t want to keep.</div>
          </div>
        </div>

        <div className="pm-footer">
          <div className="pm-progress">
            <div className="pm-progress-bar" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="pm-progress-text">{uploading ? `${overallPct}%` : ''}</div>

          <button className="pm-btn ghost" onClick={onClose} disabled={disabled}>Cancel</button>
          <button
            className="pm-btn primary"
            onClick={save}
            disabled={disabled || (keptUrls.length + newItems.length === 0)}
            title={keptUrls.length + newItems.length === 0 ? 'Add at least one image' : 'Save changes'}
          >
            {uploading ? `Uploading ${overallPct}%` : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
