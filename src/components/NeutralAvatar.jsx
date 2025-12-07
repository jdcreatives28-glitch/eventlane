// src/components/NeutralAvatar.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Neutral avatar with optional real image.
 *
 * Props:
 * - size: number (px)
 * - src: image URL (public/signed). If it changes, component resets error state.
 * - cacheKey: optional string/number to append as ?v= cache-buster (UI-level only)
 * - bg: fallback background color. If not given, derived from `seed` (HSL).
 * - fg: fallback foreground color (silhouette/initials)
 * - title: tooltip + aria-label
 * - alt: img alt (defaults to title)
 * - style: extra wrapper styles
 * - initials: explicit initials fallback (e.g., "JD")
 * - initialsFrom: string to compute initials from if `initials` not provided
 * - seed: consistent color seed (userId/username). Ignored if `bg` provided.
 * - rounded: circle (true) or rounded-rect (false)
 * - onClick: if provided, avatar becomes a button (Enter/Space supported)
 * - imgProps: extra props to pass to <img>
 */
export default function NeutralAvatar({
  size = 42,
  src,
  cacheKey,
  bg,
  fg = "#FFFFFF",
  title = "User",
  alt,
  style,
  initials,
  initialsFrom,
  seed,
  rounded = true,
  onClick,
  imgProps = {},
}) {
  const [err, setErr] = useState(false);

  // Append ?v=cacheKey only for display (DB should store clean URL)
  const displaySrc = useMemo(() => {
    if (!src) return src;
    if (!cacheKey) return src;
    return src.includes("?") ? `${src}&v=${cacheKey}` : `${src}?v=${cacheKey}`;
  }, [src, cacheKey]);

  // If src changes, clear error so the new image can load
  useEffect(() => {
    setErr(false);
  }, [displaySrc]);

  const s = size;
  const icon = Math.round(s * 0.72);

  // Derive background color from seed if not explicitly provided
  const derivedBg = useMemo(() => {
    if (bg) return bg;
    if (!seed) return "#34D399"; // default green
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }, [bg, seed]);

  // Compute initials if not provided
  const computedInitials = useMemo(() => {
    if (initials) return initials.toUpperCase().slice(0, 3);
    if (!initialsFrom) return null;
    const parts = String(initialsFrom)
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean);
    if (parts.length === 0) return null;
    const chars = (parts[0][0] || "") + (parts[1]?.[0] || "");
    return chars.toUpperCase();
  }, [initials, initialsFrom]);

  const isClickable = typeof onClick === "function";

  const wrapperStyle = {
    width: s,
    height: s,
    borderRadius: rounded ? "50%" : 12,
    overflow: "hidden",
    background: "#cccccc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
    flexShrink: 0,
    userSelect: "none",
    ...style,
    cursor: isClickable ? "pointer" : style?.cursor,
  };

  const handleKeyDown = (e) => {
    if (!isClickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(e);
    }
  };

  // 1) Real photo if provided and not errored
  if (displaySrc && !err) {
    return (
      <div
        title={title}
        aria-label={title}
        style={wrapperStyle}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <img
          key={displaySrc}            // force remount on URL change (cache bust)
          src={displaySrc}
          alt={alt || title}
          onError={() => setErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
          decoding="async"
          draggable={false}
          {...imgProps}
        />
      </div>
    );
  }

  // 2) Initials fallback if available
  if (computedInitials) {
    const fontSize = Math.max(10, Math.floor(s * 0.42));
    return (
      <div
        title={title}
        aria-label={title}
        style={wrapperStyle}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <span
          aria-hidden="true"
          style={{
            color: fg,
            fontWeight: 700,
            fontSize,
            lineHeight: 1,
            letterSpacing: 0.5,
            transform: "translateY(2%)",
          }}
        >
          {computedInitials}
        </span>
      </div>
    );
  }

  // 3) Silhouette fallback
  return (
    <div
      title={title}
      aria-label={title}
      style={wrapperStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <svg viewBox="0 0 64 64" width={icon} height={icon} aria-hidden="true">
        <circle cx="32" cy="22" r="12" fill={fg} />
        <path d="M10 56c0-12 10-20 22-20s22 8 22 20" fill={fg} />
      </svg>
    </div>
  );
}
