// src/pages/MyListings.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { FaEye, FaEyeSlash, FaEdit } from "react-icons/fa";

// ===== Theme tokens (match VenueManager / Inva) =====
const ACCENT = "#635bff";
const ACCENT_SOFT = "rgba(99, 91, 255, 0.07)";
const BORDER_SOFT = "#e5e7eb";
const TEXT_MAIN = "#0f172a";
const TEXT_MUTED = "#64748b";
const CARD_BG = "#ffffff";

export default function MyListings() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user || null);
        if (!user?.id) {
          setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from("theVenues")
          .select(
            "id,name,city,province,rate,rate_weekday,rate_weekend,image_urls,status,updated_at"
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        setErr(e?.message || "Failed to load your listings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Publish => set status to "Active"
  const publish = async (id) => {
    try {
      const { error } = await supabase
        .from("theVenues")
        .update({ status: "Active" })
        .eq("id", id);
      if (error) throw error;
      setRows((xs) => xs.map((r) => (r.id === id ? { ...r, status: "Active" } : r)));
    } catch (e) {
      alert(e?.message || "Failed to publish.");
    }
  };

  // Unpublish => set status to "Pending"
  const unpublish = async (id) => {
    try {
      const { error } = await supabase
        .from("theVenues")
        .update({ status: "Pending" })
        .eq("id", id);
      if (error) throw error;
      setRows((xs) => xs.map((r) => (r.id === id ? { ...r, status: "Pending" } : r)));
    } catch (e) {
      alert(e?.message || "Failed to unpublish.");
    }
  };

  const priceText = (v) => {
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
  };

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
        Loading listings…
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
        Please log in to view your listings.
      </div>
    );
  }

  if (err) {
    return (
      <div
        style={{
          padding: 16,
          maxWidth: 980,
          margin: "0 auto",
          color: "#b91c1c",
          fontSize: 13,
        }}
      >
        {err}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px 12px 24px",
        maxWidth: 980,
        margin: "0 auto",
        color: TEXT_MAIN,
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 2px",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: -0.3,
            }}
          >
            My Listings
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>
            Manage which venues are visible to guests.
          </p>
        </div>
        <Link
          to="/venue-onboarding"
          style={{
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 999,
            border: `1px solid ${ACCENT}`,
            padding: "8px 14px",
            background: ACCENT,
            color: "#fff",
            boxShadow: "0 8px 20px rgba(99,91,255,0.24)",
            whiteSpace: "nowrap",
          }}
        >
          + Add New Venue
        </Link>
      </header>

      {rows.length === 0 ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px dashed ${BORDER_SOFT}`,
            padding: 18,
            background: "#f9fafb",
            fontSize: 13,
            color: TEXT_MUTED,
          }}
        >
          You don’t have any venues yet.{" "}
          <Link
            to="/venue-onboarding"
            style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}
          >
            Create your first listing.
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {rows.map((v) => {
            const cover =
              v.image_urls?.[0] || "https://placehold.co/640x400?text=No+Photo";
            const isActive = String(v.status || "").toLowerCase() === "active";
            return (
              <article
                key={v.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  border: `1px solid ${BORDER_SOFT}`,
                  borderRadius: 14,
                  padding: 10,
                  background: CARD_BG,
                  boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
                  alignItems: "stretch",
                  boxSizing: "border-box",
                  width: "100%",
                }}
              >
                {/* Cover */}
                <img
                  src={cover}
                  alt=""
                  style={{
                    flex: "0 0 170px",
                    width: 170,
                    height: 115,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: `1px solid ${BORDER_SOFT}`,
                    background: "#f3f4f6",
                  }}
                />

                {/* Main content */}
                <div
                  style={{
                    flex: "1 1 180px",
                    minWidth: 0, // prevent overflow of long names
                    display: "grid",
                    gridTemplateRows: "auto auto auto",
                    rowGap: 6,
                    alignContent: "space-between",
                  }}
                >
                  <div>
                    <Link
                      to={`/venues/${v.id}`}
                      style={{
                        fontWeight: 750,
                        fontSize: 15,
                        color: TEXT_MAIN,
                        textDecoration: "none",
                      }}
                    >
                      {v.name}
                    </Link>
                    <div
                      style={{
                        fontSize: 12,
                        color: TEXT_MUTED,
                        marginTop: 2,
                      }}
                    >
                      {[v.city, v.province].filter(Boolean).join(", ") || "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_MUTED,
                        marginTop: 2,
                      }}
                    >
                      Updated:{" "}
                      {v.updated_at
                        ? new Date(v.updated_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: TEXT_MAIN,
                    }}
                  >
                    {priceText(v)}
                  </div>

                  <StatusPill isActive={isActive} status={v.status} />
                </div>

                {/* Actions */}
                <div
                  style={{
                    flex: "0 0 140px",
                    display: "grid",
                    gap: 8,
                    alignContent: "flex-start",
                    minWidth: 120,
                   
                  }}
                >
                  <button
                    type="button"
                    onClick={() => (isActive ? unpublish(v.id) : publish(v.id))}
                    style={publishBtnStyle(isActive)}
                  >
                    {isActive ? (
                      <>
                        <FaEyeSlash size={12} />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <FaEye size={12} />
                        Publish
                      </>
                    )}
                  </button>

                  <Link
                    to={`/venues/${v.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderRadius: 999,
                      border: `1px solid ${BORDER_SOFT}`,
                      padding: "7px 10px",
                      background: "#ffffff",
                      textDecoration: "none",
                      color: TEXT_MAIN,
                      fontWeight: 650,
                      fontSize: 12,
                    }}
                  >
                    <FaEdit size={12} />
                    Open
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===== Reusable small components / styles ===== */

function StatusPill({ isActive, status }) {
  const label = isActive ? "Active" : status || "Pending";
  const icon = isActive ? <FaEye size={11} /> : <FaEyeSlash size={11} />;
  const bg = isActive ? ACCENT_SOFT : "rgba(148,163,184,0.16)";
  const color = isActive ? ACCENT : "#4b5563";
  const border = isActive
    ? `1px solid rgba(99,91,255,0.4)`
    : `1px solid rgba(148,163,184,0.8)`;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: bg,
        border,
        borderRadius: 999,
        padding: "4px 10px",
        width: "fit-content",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function publishBtnStyle(isActive) {
  if (isActive) {
    // Unpublish (soft neutral)
    return {
      borderRadius: 999,
      border: `1px solid ${BORDER_SOFT}`,
      padding: "7px 10px",
      background: "#fff7ed",
      cursor: "pointer",
      fontWeight: 650,
      fontSize: 12,
      color: "#9a3412",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      boxSizing: "border-box",
    };
  }
  // Publish (accent)
  return {
    borderRadius: 999,
    border: `1px solid ${ACCENT}`,
    padding: "7px 10px",
    background: ACCENT,
    cursor: "pointer",
    fontWeight: 650,
    fontSize: 12,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    boxShadow: "0 8px 18px rgba(99,91,255,0.32)",
    width: "100%",
    boxSizing: "border-box",
  };
}
