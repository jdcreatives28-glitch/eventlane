// src/pages/VenueManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaMoneyBillWave,
  FaShoppingCart,
  FaEye,
  FaCommentDots,
  FaHeart,
  FaExternalLinkAlt,
  FaHashtag,
} from "react-icons/fa";

// ====== Theme tokens (Canva-like, no greens) ======
const ACCENT = "#635bff";
const ACCENT_SOFT = "rgba(99, 91, 255, 0.07)";
const BORDER_SOFT = "#e5e7eb";
const TEXT_MAIN = "#0f172a";
const TEXT_MUTED = "#64748b";
const CARD_BG = "#ffffff";

// Small, clean stat cards
const CARD = {
  wrap: {
    background: CARD_BG,
    border: `1px solid ${BORDER_SOFT}`,
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  title: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  big: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 800,
    color: TEXT_MAIN,
  },
  sub: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
};

const Badge = ({ ok, text }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 9px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color: ok ? "#1e293b" : "#b45309",
      background: ok ? "rgba(148,163,184,0.14)" : "rgba(252,211,77,0.16)",
      border: `1px solid ${ok ? "rgba(148,163,184,0.7)" : "rgba(251,191,36,0.6)"}`,
    }}
  >
    {text}
  </span>
);

// Optional tiny line chart (not wired yet, kept for future)
function Sparkline({ points = [] }) {
  if (!points?.length) return null;
  const w = 90,
    h = 26,
    pad = 2;
  const max = Math.max(...points, 1);
  const step = (w - pad * 2) / Math.max(points.length - 1, 1);
  const d = points
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
    </svg>
  );
}

export default function VenueManager() {
  const [user, setUser] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // range
  const [range, setRange] = useState("7d"); // today | 7d | 30d | custom
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString());
  const [to, setTo] = useState(() => new Date().toISOString());

  // aggregates
  const [totals, setTotals] = useState({
    bookings: 0,
    revenue: 0,
    views: 0,
    messages: 0,
    favorites: 0,
    tags: 0,
  });

  // per venue metrics
  const [rows, setRows] = useState([]);

  // upcoming events
  const [upcoming, setUpcoming] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // sorting
  const [sortBy, setSortBy] = useState("updated_at"); // id | name | bookings | revenue | views | conv | favorites | tags | updated_at
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  // handle range changes
  useEffect(() => {
    const now = new Date();
    if (range === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      setFrom(start);
      setTo(now.toISOString());
    } else if (range === "7d") {
      setFrom(new Date(now.getTime() - 6 * 86400000).toISOString());
      setTo(now.toISOString());
    } else if (range === "30d") {
      setFrom(new Date(now.getTime() - 29 * 86400000).toISOString());
      setTo(now.toISOString());
    }
  }, [range]);

  // bootstrap
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user || null);

        if (!user?.id) {
          // no session
          setVenues([]);
          setRows([]);
          setTotals({
            bookings: 0,
            revenue: 0,
            views: 0,
            messages: 0,
            favorites: 0,
            tags: 0,
          });
          setUpcoming([]);
          setSelectedBooking(null);
          return;
        }

        // 1) fetch owner’s venues
        const { data: vs, error: vErr } = await supabase
          .from("theVenues")
          .select(
            "id,name,status,city,province,rate,rate_weekday,rate_weekend,image_urls,updated_at,reservation_fee"
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (vErr) throw vErr;

        const venueList = vs || [];
        setVenues(venueList);

        const venueIds = venueList.map((v) => v.id);
        const reservationFeeByVenue = Object.fromEntries(
          venueList.map((v) => [v.id, Number(v.reservation_fee) || 0])
        );

        // If no venues, short-circuit and avoid querying other tables
        if (!venueIds.length) {
          setRows([]);
          setTotals({
            bookings: 0,
            revenue: 0,
            views: 0,
            messages: 0,
            favorites: 0,
            tags: 0,
          });
          setUpcoming([]);
          setSelectedBooking(null);
          return;
        }

        // helper: apply ISO range on a given column
        const rangeFilter = (q, col = "created_at") => q.gte(col, from).lte(col, to);

        // Bookings + “Revenue”
        const bookingsByVenue = {};
        const revenueByVenue = {};
        try {
          let qb = supabase
            .from("bookings")
            .select("venue_id,status,payment_status,reservation_fee_paid,created_at");
          qb = rangeFilter(qb, "created_at").in("venue_id", venueIds);
          const { data: bs } = await qb;

          (bs || []).forEach((b) => {
            const id = b.venue_id;
            if (!bookingsByVenue[id]) bookingsByVenue[id] = 0;
            if (!revenueByVenue[id]) revenueByVenue[id] = 0;

            const s = String(b.status || "").toLowerCase();
            const isCountable = ["confirmed", "completed", "paid", "approved"].includes(s);
            if (isCountable) bookingsByVenue[id] += 1;

            const paid =
              String(b.payment_status || "").toLowerCase() === "paid" || !!b.reservation_fee_paid;
            if (paid) revenueByVenue[id] += reservationFeeByVenue[id] || 0;
          });
        } catch {
          /* ignore */
        }

        // Views (venue_views)
        const viewsByVenue = {};
        try {
          let qv = supabase.from("venue_views").select("venue_id,viewed_at");
          qv = rangeFilter(qv, "viewed_at").in("venue_id", venueIds);

          const { data: vs2 } = await qv;

          (vs2 || []).forEach((v) => {
            viewsByVenue[v.venue_id] = (viewsByVenue[v.venue_id] || 0) + 1;
          });
        } catch {
          /* ignore */
        }

        // Messages
        const msgsByVenue = {};
        try {
          let qm = supabase.from("messages").select("venue_id,created_at");
          qm = rangeFilter(qm, "created_at").in("venue_id", venueIds);
          const { data: ms } = await qm;
          (ms || []).forEach((m) => {
            msgsByVenue[m.venue_id] = (msgsByVenue[m.venue_id] || 0) + 1;
          });
        } catch {
          /* ignore */
        }

        // Favorites
        const favsByVenue = {};
        try {
          let qf = supabase.from("favorites").select("venue_id,created_at");
          qf = rangeFilter(qf, "created_at").in("venue_id", venueIds);
          const { data: fs } = await qf;
          (fs || []).forEach((f) => {
            favsByVenue[f.venue_id] = (favsByVenue[f.venue_id] || 0) + 1;
          });
        } catch {
          /* ignore */
        }

        // Tags in posts
        const tagsByVenue = {};
        try {
          let qp = supabase.from("posts").select("venue_id,created_at");
          qp = rangeFilter(qp, "created_at").in("venue_id", venueIds);
          const { data: ps } = await qp;
          (ps || []).forEach((p) => {
            tagsByVenue[p.venue_id] = (tagsByVenue[p.venue_id] || 0) + 1;
          });
        } catch {
          /* ignore */
        }

        // Upcoming events (full row, next 3–5 across all venues, independent of range)
        try {
          const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const { data: up } = await supabase
            .from("bookings")
            .select(
              "id, user_id, venue_id, event_date, start_time, end_time, note, status, created_at, updated_at, event_name, event_type, guest_count, reservation_fee_paid, proof_image_url, pending_changes, needs_owner_approval, event_start_at, event_end_at, expires_at, confirmed_at, completed_at, cancelled_at, expired_at, status_changed_at, auto_action_reason, dispute_flag, payment_status"
            )
            .in("venue_id", venueIds)
            .gte("event_date", todayStr)
            .order("event_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(5);

const upcomingList =
  up?.map((b) => {
    const venue = venueList.find((v) => v.id === b.venue_id);
    return {
      ...b,
      venue_name: venue?.name || "Unnamed venue",
    };
  }) || [];

// show only bookings that are NOT cancelled and NOT completed
const filteredUpcoming = upcomingList.filter((b) => {
  const s = String(b.status || "").toLowerCase();
  return s !== "cancelled" && s !== "canceled" && s !== "completed";
});

setUpcoming(filteredUpcoming);

        } catch {
          setUpcoming([]);
        }

        // Build rows
        const list = venueList.map((v) => {
          const isActive = String(v.status || "").toLowerCase() === "active";
          const priceStr = priceText(v);
          const hasCover = !!(v.image_urls && v.image_urls[0]);
          const hasPrice = priceStr !== "Contact for price";

          const bookings = bookingsByVenue[v.id] || 0;
          const views = viewsByVenue[v.id] || 0;
          const conv = views > 0 ? bookings / views : null;

          const health = computeHealth({
            isActive,
            hasCover,
            hasPrice,
          });

          return {
            id: v.id,
            name: v.name,
            status: v.status || "Pending",
            isActive,
            cover: v.image_urls?.[0] || null,
            location: [v.city, v.province].filter(Boolean).join(", "),
            priceText: priceStr,
            updated_at: v.updated_at,
            bookings,
            revenue: revenueByVenue[v.id] || 0,
            views,
            messages: msgsByVenue[v.id] || 0,
            favorites: favsByVenue[v.id] || 0,
            tags: tagsByVenue[v.id] || 0,
            conv, // conversion ratio (0–1) or null
            healthLabel: health.label,
            healthSeverity: health.severity,
            healthIssues: health.issues,
          };
        });
        setRows(list);

        // Totals
        setTotals({
          bookings: list.reduce((a, b) => a + b.bookings, 0),
          revenue: list.reduce((a, b) => a + b.revenue, 0),
          views: list.reduce((a, b) => a + b.views, 0),
          messages: list.reduce((a, b) => a + b.messages, 0),
          favorites: list.reduce((a, b) => a + b.favorites, 0),
          tags: list.reduce((a, b) => a + b.tags, 0),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const dateLabel = useMemo(() => {
    const fmt = (s) =>
      new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(from)} – ${fmt(to)}`;
  }, [from, to]);

  // Sorted rows (client-side)
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];

      // handle nulls
      if (av == null && bv != null) return 1 * dir;
      if (av != null && bv == null) return -1 * dir;
      if (av == null && bv == null) return 0;

      // numeric
      if (typeof av === "number" && typeof bv === "number") {
        return av === bv ? 0 : av > bv ? 1 * dir : -1 * dir;
      }

      // dates
      if (sortBy === "updated_at") {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return ad === bd ? 0 : ad > bd ? 1 * dir : -1 * dir;
      }

      // conversion ratio
      if (sortBy === "conv") {
        const an = typeof av === "number" ? av : -1;
        const bn = typeof bv === "number" ? bv : -1;
        return an === bn ? 0 : an > bn ? 1 * dir : -1 * dir;
      }

      // strings
      return String(av).localeCompare(String(bv)) * dir;
    });

    return arr;
  }, [rows, sortBy, sortDir]);

  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: TEXT_MUTED,
          fontSize: 13,
        }}
      >
        Loading manager…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          padding: 16,
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: TEXT_MUTED,
          fontSize: 13,
        }}
      >
        Please log in to view your Venue Manager.
      </div>
    );
  }

  // label for the Custom button: replace "Custom" with date range once active
  const customLabel = range === "custom" ? dateLabel : "Custom";

  const handleSortClick = (key) => {
    setSortBy((prevKey) => {
      if (prevKey === key) {
        // toggle dir
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      } else {
        setSortDir("desc");
        return key;
      }
    });
  };

  const renderSortLabel = (label, key) => {
    const isActive = sortBy === key;
    const arrow = !isActive ? "" : sortDir === "asc" ? " ▲" : " ▼";
    return (
      <button
        type="button"
        onClick={() => handleSortClick(key)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: isActive ? TEXT_MAIN : "#475569",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
        }}
      >
        {label}
        {arrow && <span style={{ fontSize: 9 }}>{arrow}</span>}
      </button>
    );
  };

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
        color: TEXT_MAIN,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: -0.3,
            }}
          >
            Venue Manager
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>
            Track bookings across all your venues.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {/* Date range now lives inside the "Custom" button */}
      </div>

      {/* Range Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <RangeButton label="Today" value="today" range={range} setRange={setRange} />
        <RangeButton label="Last 7 days" value="7d" range={range} setRange={setRange} />
        <RangeButton label="Last 30 days" value="30d" range={range} setRange={setRange} />
        <RangeButton label={customLabel} value="custom" range={range} setRange={setRange} />

        {range === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              value={isoToInput(from)}
              onChange={(e) => setFrom(inputToIso(e.target.value))}
              style={inputDateStyle}
            />
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>–</span>
            <input
              type="date"
              value={isoToInput(to)}
              onChange={(e) => setTo(endOfDayIso(e.target.value))}
              style={inputDateStyle}
            />
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaShoppingCart size={14} color={ACCENT} />
            <h4 style={CARD.title}>Bookings</h4>
          </div>
          <div style={CARD.big}>{totals.bookings}</div>
          <div style={CARD.sub}>Confirmed / Completed in range</div>
        </div>

        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaMoneyBillWave size={14} color={ACCENT} />
            <h4 style={CARD.title}>Revenue</h4>
          </div>
          <div style={CARD.big}>₱{Number(totals.revenue).toLocaleString()}</div>
          <div style={CARD.sub}>Reservation fees marked paid</div>
        </div>

        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaEye size={14} color={ACCENT} />
            <h4 style={CARD.title}>Views</h4>
          </div>
          <div style={CARD.big}>{totals.views}</div>
          <div style={CARD.sub}>Venue detail views</div>
        </div>

        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaCommentDots size={14} color={ACCENT} />
            <h4 style={CARD.title}>Messages</h4>
          </div>
          <div style={CARD.big}>{totals.messages}</div>
          <div style={CARD.sub}>Chats received</div>
        </div>

        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaHeart size={14} color={ACCENT} />
            <h4 style={CARD.title}>Favorites</h4>
          </div>
          <div style={CARD.big}>{totals.favorites}</div>
          <div style={CARD.sub}>Added to favorites</div>
        </div>

        <div style={CARD.wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FaHashtag size={14} color={ACCENT} />
            <h4 style={CARD.title}>Post Tags</h4>
          </div>
          <div style={CARD.big}>{totals.tags}</div>
          <div style={CARD.sub}>User posts tagging your venues</div>
        </div>
      </div>

      {/* Upcoming Events Widget */}
      <div
        style={{
          ...CARD.wrap,
          padding: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: upcoming.length ? 8 : 0,
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: ACCENT_SOFT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FaCalendarAlt size={13} color={ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MAIN }}>
              Upcoming events
            </div>
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>
              Next {Math.min(upcoming.length || 0, 5)} bookings across your venues
            </div>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              borderRadius: 8,
              background: "#f9fafb",
              padding: 8,
            }}
          >
            You have no upcoming events yet. Once guests book future dates, they’ll appear here.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 4,
            }}
          >
            {upcoming.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedBooking(e)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  padding: 8,
                  border: "1px solid rgba(148,163,184,0.3)",
                  background: "#f9fafb",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: 4,
                    alignSelf: "stretch",
                    borderRadius: 999,
                    background: statusColor(e.status),
                    opacity: 0.9,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: TEXT_MAIN,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {e.event_name || "Untitled event"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: TEXT_MUTED,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {formatEventDateTime(e.event_date, e.start_time, e.end_time)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: TEXT_MUTED,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    at <span style={{ fontWeight: 600 }}>{e.venue_name}</span>
                  </div>
                </div>
                <span style={statusPillStyle(e.status)}>{prettyStatus(e.status)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Per-Venue Table */}
      <div
        style={{
          ...CARD.wrap,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 10,
            borderBottom: `1px solid ${BORDER_SOFT}`,
            fontWeight: 700,
            fontSize: 13,
            background: "#f9fafb",
          }}
        >
          Your Venues
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", color: "#475569" }}>
                <th style={th}>{renderSortLabel("Venue", "name")}</th>
                <th style={th}>Status</th>
                <th style={th}>Health</th>
                <th style={th}>{renderSortLabel("Price", "priceText")}</th>
                <th style={thNum}>{renderSortLabel("Bookings", "bookings")}</th>
                <th style={thNum}>{renderSortLabel("Revenue", "revenue")}</th>
                <th style={thNum}>{renderSortLabel("Views", "views")}</th>
                <th style={thNum}>{renderSortLabel("Conv.", "conv")}</th>
                <th style={thNum}>{renderSortLabel("Messages", "messages")}</th>
                <th style={thNum}>{renderSortLabel("Favorites", "favorites")}</th>
                <th style={thNum}>{renderSortLabel("Tags", "tags")}</th>
                <th style={th}>{renderSortLabel("Updated", "updated_at")}</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid #f1f5f9` }}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img
                        src={r.cover || "https://placehold.co/80x60?text=—"}
                        alt=""
                        style={{
                          width: 72,
                          height: 56,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: `1px solid ${BORDER_SOFT}`,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <Link
                          to={`/venues/${r.id}`}
                          style={{
                            fontWeight: 700,
                            color: TEXT_MAIN,
                            textDecoration: "none",
                            fontSize: 13,
                          }}
                        >
                          {r.name}
                        </Link>
                        <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                          {r.location || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <Badge
                      ok={r.isActive}
                      text={r.isActive ? "Active" : r.status || "Pending"}
                    />
                  </td>
                  <td style={td}>
                    <span
                      style={healthPillStyle(r.healthSeverity)}
                      title={r.healthIssues?.length ? r.healthIssues.join(" • ") : undefined}
                    >
                      {r.healthLabel}
                    </span>
                  </td>
                  <td style={td}>{r.priceText}</td>
                  <td style={tdNum}>{r.bookings}</td>
                  <td style={tdNum}>₱{Number(r.revenue).toLocaleString()}</td>
                  <td style={tdNum}>{r.views}</td>
                  <td style={tdNum}>
                    {r.views > 0 && typeof r.conv === "number" ? (
                      <span style={convStyle(r.conv)}>
                        {(r.conv * 100).toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tdNum}>{r.messages}</td>
                  <td style={tdNum}>{r.favorites}</td>
                  <td style={tdNum}>{r.tags}</td>
                  <td style={td}>
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td style={td}>
                    <Link
                      to={`/venues/${r.id}`}
                      title="Open"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: 11,
                        color: ACCENT,
                      }}
                    >
                      Open <FaExternalLinkAlt size={10} />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    style={{
                      padding: 16,
                      color: TEXT_MUTED,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    You don’t have any venues yet.{" "}
                    <Link to="/new-venue" style={{ color: ACCENT, fontWeight: 600 }}>
                      Add your first listing.
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <p style={{ marginTop: 10, color: TEXT_MUTED, fontSize: 11 }}>
        <strong>Revenue</strong> = sum of each venue’s <code>reservation_fee</code> for bookings in
        range that are marked paid. If you later store exact amounts on <code>bookings</code>,
        replace this with a real sum.
      </p>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            zIndex: 9999,
          }}
          onClick={() => setSelectedBooking(null)}
        >
          <div
            style={{
              width: "min(920px, 100%)",
              maxHeight: "90vh",
              background: "#ffffff",
              borderRadius: 18,
              border: `1px solid ${BORDER_SOFT}`,
              boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
              padding: 18,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 16,
                  background: ACCENT_SOFT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FaCalendarAlt size={18} color={ACCENT} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: -0.2,
                      color: TEXT_MAIN,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {selectedBooking.event_name || "Untitled event"}
                  </h2>
                  {selectedBooking.event_type && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                        background: "rgba(99,91,255,0.08)",
                        color: ACCENT,
                        border: `1px solid rgba(99,91,255,0.25)`,
                      }}
                    >
                      {selectedBooking.event_type}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: TEXT_MUTED,
                    marginBottom: 4,
                  }}
                >
                  {formatEventDateTime(
                    selectedBooking.event_date,
                    selectedBooking.start_time,
                    selectedBooking.end_time
                  )}
                  {" • "}
                  at{" "}
                  <span style={{ fontWeight: 600 }}>
                    {selectedBooking.venue_name || "Unnamed venue"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: TEXT_MUTED,
                  }}
                >
                  Booking ID:{" "}
                  <code
                    style={{
                      fontSize: 11,
                      background: "#f3f4f6",
                      padding: "1px 5px",
                      borderRadius: 6,
                    }}
                  >
                    {selectedBooking.id}
                  </code>{" "}
                  • Created{" "}
                  {selectedBooking.created_at
                    ? formatDateTimeShort(selectedBooking.created_at)
                    : "—"}
                  {" • Updated "}
                  {selectedBooking.updated_at
                    ? formatDateTimeShort(selectedBooking.updated_at)
                    : "—"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                <span style={statusPillStyle(selectedBooking.status)}>
                  {prettyStatus(selectedBooking.status)}
                </span>
                {selectedBooking.payment_status && (
                  <span style={paymentPillStyle(selectedBooking.payment_status)}>
                    {prettyPaymentStatus(selectedBooking.payment_status)}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(226,232,240,0.9)",
                marginBottom: 10,
              }}
            />

            {/* Modal body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingRight: 4,
                paddingBottom: 4,
              }}
            >
              {/* Top grid: core details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    background: "#f9fafb",
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 6,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      color: TEXT_MUTED,
                    }}
                  >
                    Event details
                  </h4>
                  <DetailRow label="Event type" value={selectedBooking.event_type} />
                  <DetailRow
                    label="Guests"
                    value={
                      typeof selectedBooking.guest_count === "number"
                        ? selectedBooking.guest_count.toLocaleString()
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Event date"
                    value={
                      selectedBooking.event_date
                        ? selectedBooking.event_date
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Start time"
                    value={formatTimeOnly(selectedBooking.start_time)}
                  />
                  <DetailRow
                    label="End time"
                    value={formatTimeOnly(selectedBooking.end_time)}
                  />
                  <DetailRow
                    label="Event start at"
                    value={
                      selectedBooking.event_start_at
                        ? formatDateTimeShort(selectedBooking.event_start_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Event end at"
                    value={
                      selectedBooking.event_end_at
                        ? formatDateTimeShort(selectedBooking.event_end_at)
                        : "—"
                    }
                  />
                </div>

                <div
                  style={{
                    background: "#f9fafb",
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 6,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      color: TEXT_MUTED,
                    }}
                  >
                    Status & payments
                  </h4>
                  <DetailRow
                    label="Status"
                    value={prettyStatus(selectedBooking.status)}
                  />
                  <DetailRow
                    label="Payment status"
                    value={prettyPaymentStatus(selectedBooking.payment_status)}
                  />
                  <DetailRow
                    label="Reservation fee paid"
                    value={boolLabel(selectedBooking.reservation_fee_paid)}
                  />
                  <DetailRow
                    label="Dispute flag"
                    value={boolLabel(selectedBooking.dispute_flag)}
                  />
                  <DetailRow
                    label="Expires at"
                    value={
                      selectedBooking.expires_at
                        ? formatDateTimeShort(selectedBooking.expires_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Confirmed at"
                    value={
                      selectedBooking.confirmed_at
                        ? formatDateTimeShort(selectedBooking.confirmed_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Completed at"
                    value={
                      selectedBooking.completed_at
                        ? formatDateTimeShort(selectedBooking.completed_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Cancelled at"
                    value={
                      selectedBooking.cancelled_at
                        ? formatDateTimeShort(selectedBooking.cancelled_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Expired at"
                    value={
                      selectedBooking.expired_at
                        ? formatDateTimeShort(selectedBooking.expired_at)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Status changed at"
                    value={
                      selectedBooking.status_changed_at
                        ? formatDateTimeShort(selectedBooking.status_changed_at)
                        : "—"
                    }
                  />
                </div>

                <div
                  style={{
                    background: "#f9fafb",
                    borderRadius: 12,
                    padding: 10,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      marginBottom: 6,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      color: TEXT_MUTED,
                    }}
                  >
                    Approvals & system
                  </h4>
                  <DetailRow
                    label="Needs owner approval"
                    value={boolLabel(selectedBooking.needs_owner_approval)}
                  />
                  <DetailRow
                    label="Pending changes"
                    value={boolLabel(selectedBooking.pending_changes)}
                  />
                  <DetailRow
                    label="Auto action reason"
                    value={selectedBooking.auto_action_reason || "—"}
                  />
                  <DetailRow
                    label="Proof image"
                    value={
                      selectedBooking.proof_image_url
                        ? "Attached"
                        : "None"
                    }
                  />
                  {selectedBooking.proof_image_url && (
                    <div style={{ marginTop: 6 }}>
                      <img
                        src={selectedBooking.proof_image_url}
                        alt="Payment proof"
                        style={{
                          maxWidth: "100%",
                          maxHeight: 160,
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Note */}
              <div
                style={{
                  marginTop: 4,
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    marginBottom: 4,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                    color: TEXT_MUTED,
                  }}
                >
                  Notes
                </h4>
                <div
                  style={{
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    minHeight: 40,
                    fontSize: 12,
                    background: "#f9fafb",
                    color: selectedBooking.note ? TEXT_MAIN : TEXT_MUTED,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedBooking.note || "No notes added for this booking."}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
             <div
  style={{
    fontSize: 11,
    color: TEXT_MUTED,
  }}
>
  View or manage this booking in{" "}
  <Link
    to={`/booking?booking_id=${selectedBooking.id}&tab=bookings`}
    style={{ color: ACCENT, fontWeight: 600 }}
  >
    Booking Details
  </Link>
  .
</div>
<div style={{ display: "flex", gap: 8 }}>
  <Link
    to={`/booking?booking_id=${selectedBooking.id}&tab=bookings`}
    style={{
      padding: "6px 12px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      textDecoration: "none",
      border: `1px solid ${ACCENT}`,
      color: ACCENT,
      background: "#ffffff",
    }}
  >
    View booking details
  </Link>
  <button
    type="button"
    onClick={() => setSelectedBooking(null)}
    style={{
      padding: "6px 12px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      border: "none",
      color: "#0f172a",
      background: "#e5e7eb",
      cursor: "pointer",
    }}
  >
    Close
  </button>
</div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------ helpers ------------ */

function priceText(v) {
  const wd = Number(v?.rate_weekday);
  const we = Number(v?.rate_weekend);
  const single = Number(v?.rate);
  const fmt = (n) => `₱${Number(n).toLocaleString()}`;
  if (Number.isFinite(wd) && wd > 0 && Number.isFinite(we) && we > 0)
    return `Weekday ${fmt(wd)} • Weekend ${fmt(we)}`;
  if (Number.isFinite(single) && single > 0) return fmt(single);
  if (Number.isFinite(wd) && wd > 0) return `Weekday ${fmt(wd)}`;
  if (Number.isFinite(we) && we > 0) return `Weekend ${fmt(we)}`;
  return "Contact for price";
}

// Simple health scoring based on listing completeness
function computeHealth({ isActive, hasCover, hasPrice }) {
  const issues = [];

  if (!isActive) issues.push("Venue is not active");
  if (!hasCover) issues.push("No cover photo");
  if (!hasPrice) issues.push("No price set");

  let severity = "good";
  if (issues.length === 0) {
    severity = "good";
  } else if (!isActive) {
    severity = "bad";
  } else {
    severity = "warn";
  }

  const label =
    severity === "good"
      ? "Ready"
      : severity === "bad"
      ? "Not active"
      : !hasCover
      ? "Needs photos"
      : "Needs price";

  return { label, severity, issues };
}

function isoToInput(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch {
    return "";
  }
}

function inputToIso(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return new Date().toISOString();
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  return start.toISOString();
}

function endOfDayIso(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return new Date().toISOString();
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return end.toISOString();
}

/* ------------ styles ------------ */

const th = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  borderBottom: "1px solid #eef2f6",
  whiteSpace: "nowrap",
};
const thNum = { ...th, textAlign: "right" };

const td = {
  padding: "9px 10px",
  fontSize: 12,
  verticalAlign: "top",
  borderTop: "1px solid #f8fafc",
};
const tdNum = { ...td, textAlign: "right" };

function btnBase(active) {
  return {
    border: `1px solid ${active ? ACCENT : BORDER_SOFT}`,
    background: active ? ACCENT_SOFT : "#ffffff",
    color: active ? ACCENT : TEXT_MAIN,
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 600,
    fontSize: 11,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
}

const inputDateStyle = {
  borderRadius: 999,
  border: `1px solid ${BORDER_SOFT}`,
  padding: "4px 8px",
  fontSize: 11,
  outline: "none",
};

function RangeButton({ label, value, range, setRange }) {
  const active = range === value;
  return (
    <button type="button" onClick={() => setRange(value)} style={btnBase(active)}>
      {label}
    </button>
  );
}

function healthPillStyle(severity) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  };

  if (severity === "good") {
    return {
      ...base,
      background: "rgba(34,197,94,0.14)",
      color: "#15803d",
      border: "1px solid rgba(34,197,94,0.4)",
    };
  }
  if (severity === "bad") {
    return {
      ...base,
      background: "rgba(248,113,113,0.12)",
      color: "#b91c1c",
      border: "1px solid rgba(248,113,113,0.7)",
    };
  }
  // warn
  return {
    ...base,
    background: "rgba(250,204,21,0.12)",
    color: "#92400e",
    border: "1px solid rgba(250,204,21,0.7)",
  };
}

function convStyle(conv) {
  // conv is 0–1
  const pct = conv * 100;
  let color = "#6b7280";
  if (pct >= 3) color = "#16a34a";
  else if (pct >= 1) color = "#0f172a";

  return {
    fontWeight: 600,
    color,
  };
}

/* ------------ status + date helpers ------------ */

function prettyStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "Confirmed";
  if (s === "completed") return "Completed";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "pending") return "Pending";
  if (s === "tentative") return "Tentative";
  if (!s) return "Unknown";
  return s[0].toUpperCase() + s.slice(1);
}

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "#22c55e";
  if (s === "completed") return "#0ea5e9";
  if (s === "cancelled" || s === "canceled") return "#ef4444";
  if (s === "pending") return "#eab308";
  if (s === "tentative") return "#a855f7";
  return "#94a3b8";
}

function statusPillStyle(status) {
  const base = {
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  };
  const s = String(status || "").toLowerCase();

  if (s === "confirmed") {
    return {
      ...base,
      background: "rgba(34,197,94,0.12)",
      color: "#15803d",
      border: "1px solid rgba(34,197,94,0.4)",
    };
  }
  if (s === "completed") {
    return {
      ...base,
      background: "rgba(14,165,233,0.12)",
      color: "#0369a1",
      border: "1px solid rgba(14,165,233,0.4)",
    };
  }
  if (s === "cancelled" || s === "canceled") {
    return {
      ...base,
      background: "rgba(248,113,113,0.12)",
      color: "#b91c1c",
      border: "1px solid rgba(248,113,113,0.4)",
    };
  }
  if (s === "pending") {
    return {
      ...base,
      background: "rgba(250,204,21,0.12)",
      color: "#854d0e",
      border: "1px solid rgba(250,204,21,0.4)",
    };
  }
  return {
    ...base,
    background: "rgba(148,163,184,0.16)",
    color: "#475569",
    border: "1px solid rgba(148,163,184,0.5)",
  };
}

function prettyPaymentStatus(ps) {
  const s = String(ps || "").toLowerCase();
  if (!s) return "Not set";
  if (s === "paid") return "Paid";
  if (s === "unpaid") return "Unpaid";
  if (s === "partial") return "Partial";
  return s[0].toUpperCase() + s.slice(1);
}

function paymentPillStyle(ps) {
  const base = {
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  };
  const s = String(ps || "").toLowerCase();
  if (s === "paid") {
    return {
      ...base,
      background: "rgba(34,197,94,0.12)",
      color: "#15803d",
      border: "1px solid rgba(34,197,94,0.4)",
    };
  }
  if (s === "unpaid") {
    return {
      ...base,
      background: "rgba(248,113,113,0.12)",
      color: "#b91c1c",
      border: "1px solid rgba(248,113,113,0.4)",
    };
  }
  if (s === "partial") {
    return {
      ...base,
      background: "rgba(250,204,21,0.12)",
      color: "#854d0e",
      border: "1px solid rgba(250,204,21,0.4)",
    };
  }
  return {
    ...base,
    background: "rgba(148,163,184,0.16)",
    color: "#475569",
    border: "1px solid rgba(148,163,184,0.5)",
  };
}

function formatEventDateTime(dateStr, startTime, endTime) {
  if (!dateStr) return "Date not set";

  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dObj = new Date(y, m - 1, d);
    const datePart = dObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const formatTime = (t) => {
      if (!t) return null;
      const [hh, mm] = String(t).split(":").map(Number);
      const dt = new Date();
      dt.setHours(hh || 0, mm || 0, 0, 0);
      return dt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    };

    const start = formatTime(startTime);
    const end = formatTime(endTime);

    if (start && end) return `${datePart} • ${start} – ${end}`;
    if (start) return `${datePart} • ${start}`;
    return datePart;
  } catch {
    return dateStr;
  }
}

function formatDateTimeShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "—";
  }
}

function formatTimeOnly(t) {
  if (!t) return "—";
  try {
    const [hh, mm] = String(t).split(":").map(Number);
    const dt = new Date();
    dt.setHours(hh || 0, mm || 0, 0, 0);
    return dt.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return t;
  }
}

function boolLabel(v) {
  if (v === null || v === undefined) return "—";
  return v ? "Yes" : "No";
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 4,
        fontSize: 11,
      }}
    >
      <span style={{ color: TEXT_MUTED }}>{label}</span>
      <span style={{ fontWeight: 600, color: TEXT_MAIN, textAlign: "right" }}>
        {value || value === 0 ? value : "—"}
      </span>
    </div>
  );
}
