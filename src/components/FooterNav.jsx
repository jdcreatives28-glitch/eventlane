// src/components/FooterNav.jsx
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaMapMarkerAlt, FaCalendarCheck } from "react-icons/fa";
import { FaHouse, FaMessage, FaBullhorn } from "react-icons/fa6";
import { useUnread } from "../context/UnreadProvider";

function Badge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="badge"
      aria-live="polite"
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        background: "#ef4444",
        color: "#fff",
        borderRadius: 9999,
        padding: "0 6px",
        fontSize: 10,
        lineHeight: "16px",
        minWidth: 16,
        textAlign: "center",
        border: "2px solid #f9fafb",
        fontWeight: 700,
        boxShadow: "0 0 0 1px rgba(15,23,42,0.10)",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function FooterNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { unread, bookingUnread: providerBookingUnread } = useUnread();
  const [bookingUnread, setBookingUnread] = useState(
    typeof providerBookingUnread === "number" ? providerBookingUnread : 0
  );

  // 👇 track mobile vs desktop (hide footer on desktop)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth <= 900;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 900);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 👇 Hide-on-scroll state (footer only)
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    if (typeof providerBookingUnread === "number") {
      setBookingUnread(providerBookingUnread);
    }
  }, [providerBookingUnread]);

  useEffect(() => {
    const onBookingUnread = (e) => {
      const next = Number(e?.detail ?? 0);
      if (!Number.isNaN(next)) setBookingUnread(next);
    };
    window.addEventListener("bookingUnread:update", onBookingUnread);
    return () =>
      window.removeEventListener("bookingUnread:update", onBookingUnread);
  }, []);

  // 👇 Attach to the app's scroll container ('.main-content')
  useEffect(() => {
    const scroller =
      document.querySelector(".main-content") ||
      document.scrollingElement ||
      window;

    const getY = () =>
      scroller === window
        ? window.pageYOffset || document.documentElement.scrollTop || 0
        : scroller.scrollTop || 0;

    lastYRef.current = getY();

    const THRESHOLD = 6;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        const y = getY();
        const last = lastYRef.current;
        const delta = y - last;

        if (delta > THRESHOLD && y > 48) {
          // scrolling down
          setHidden(true);
        } else if (delta < -THRESHOLD) {
          // scrolling up
          setHidden(false);
        }

        // Always show near the very top
        if (y < 24) setHidden(false);

        lastYRef.current = y;
        tickingRef.current = false;
      });
    };

    const opts = { passive: true };
    (scroller === window ? window : scroller).addEventListener(
      "scroll",
      onScroll,
      opts
    );
    return () =>
      (scroller === window ? window : scroller).removeEventListener(
        "scroll",
        onScroll
      );
  }, []);

  // 🔄 Expose footer visibility as a CSS hook for FAB / other UI
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement; // <html>

    if (hidden) {
      root.classList.add("footer-hidden");
      root.classList.remove("footer-visible");
    } else {
      root.classList.add("footer-visible");
      root.classList.remove("footer-hidden");
    }

    return () => {
      root.classList.remove("footer-visible");
      root.classList.remove("footer-hidden");
    };
  }, [hidden]);

  const items = [
    { label: "Home", icon: <FaHouse />, path: "/" },
    { label: "Social", icon: <FaBullhorn />, path: "/events" },
    { label: "Venues", icon: <FaMapMarkerAlt />, path: "/venues" },
    {
      label: "Bookings",
      icon: <FaCalendarCheck />,
      path: "/booking",
      count: bookingUnread,
    },
    { label: "Messages", icon: <FaMessage />, path: "/messages", count: unread },
  ];

  const handleClick = (item) => {
    if (item.path === "/events") {
      if (pathname === "/events") {
        window.socialTabRefresh?.(true);
      } else {
        navigate("/events");
      }
      return;
    }
    if (pathname !== item.path) navigate(item.path);
  };

  // ✅ Inva-style floating nav bar with hide/show animation
  const navStyle = {
    ...styles.navBase,
    transform: hidden ? "translateY(110%)" : "translateY(0)",
    transition: "transform 200ms ease",
    willChange: "transform",
    display: isMobile ? "flex" : "none", // 👈 hide on desktop
  };

  return (
    <nav className="footer-nav" style={navStyle}>
      <div style={styles.navInner}>
        {items.map((item) => {
          const isActive = pathname === item.path;
          const aria =
            item.count && item.count > 0
              ? `${item.label} (${item.count} ${
                  item.label === "Messages" ? "unread" : "updates"
                })`
              : item.label;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleClick(item)}
              className={`footer-btn ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={aria}
              style={isActive ? styles.btnActive : styles.btnBase}
            >
              <div style={styles.iconWrap}>
                <span
                  style={isActive ? styles.iconBubbleActive : styles.iconBubble}
                >
                  {item.icon}
                </span>
                <Badge count={item.count || 0} />
              </div>
              <span
                className="footer-label"
                style={isActive ? styles.labelActive : styles.label}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Inva-style footer nav styles ---------- */

const styles = {
  navBase: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 45,
    pointerEvents: "none", // so only the pill bar is interactive
    padding: "0 14px calc(10px + env(safe-area-inset-bottom))",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    boxSizing: "border-box",
  },
  navInner: {
    pointerEvents: "auto",
    maxWidth: 460,
    width: "100%",
    background:
      "radial-gradient(circle at 0% 0%, rgba(99,91,255,0.35), transparent 55%), rgba(15,23,42,0.96)",
    borderRadius: 999,
    padding: "6px 10px 4px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
    boxShadow:
      "0 18px 38px rgba(15,23,42,0.65), 0 0 0 1px rgba(148,163,184,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  btnBase: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 2px 2px",
  },
  btnActive: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 2px 2px",
  },
  iconWrap: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 32,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#E5E7EB",
    fontSize: 15,
    background: "rgba(148,163,184,0.18)",
  },
  iconBubbleActive: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#F9FAFB",
    fontSize: 16,
    background:
      "radial-gradient(circle at 0% 0%, #f97316, #facc15 60%, #f97316 100%)",
    boxShadow:
      "0 0 0 1px rgba(15,23,42,0.8), 0 8px 16px rgba(15,23,42,0.75)",
  },
  label: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: 500,
  },
  labelActive: {
    fontSize: 11,
    color: "#FEFCE8",
    fontWeight: 600,
  },
};
