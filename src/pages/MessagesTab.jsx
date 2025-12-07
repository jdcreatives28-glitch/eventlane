// src/tabs/MessagesTab.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { supabase } from "../supabaseClient";
import ChatModal from "../components/ChatModal";
import ErrorBoundary from "../components/ErrorBoundary"; // adjust if needed
import NeutralAvatar from "../components/NeutralAvatar";

dayjs.extend(utc);

// 🎨 Canva-like / Inva theme tokens (professional variant)
const THEME = {
  bg: "#f5f7fb",
  card: "#ffffff",
  cardSoft: "#f0f3f9",
  accent: "#635bff",
  accentSoft: "rgba(99,91,255,0.10)",
  accentSoftStrong: "rgba(99,91,255,0.18)",
  text: "#0f172a",
  textMuted: "#64748b",
  borderSubtle: "rgba(148,163,184,0.35)",
  shadow: "0 1px 2px rgba(15,23,42,0.06)",
  shadowHover: "0 12px 30px rgba(99,91,255,0.18)",
};

const AVATAR_BUCKET = "avatars";
const isHttp = (v) => /^https?:\/\//i.test(v);
const toPublicUrl = (value) => {
  if (!value) return null;
  if (isHttp(value)) return value;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(value);
  return data?.publicUrl || null;
};

// Default export: with ErrorBoundary
export default function MessagesTab(props) {
  return (
    <ErrorBoundary>
      <MessagesTabInner {...props} />
    </ErrorBoundary>
  );
}

function MessagesTabInner({ onUnreadChange }) {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  // Usernames
  const [usernameMap, setUsernameMap] = useState({});
  const [namesReady, setNamesReady] = useState(false);

  // ChatModal state
  const [showChat, setShowChat] = useState(false);
  const [chatVenue, setChatVenue] = useState(null);
  const [chatOtherUserId, setChatOtherUserId] = useState(null);

  // Options modal state
  const [optionsMsg, setOptionsMsg] = useState(null);

  // Avatar cache + event bridge
  const userAvatarCacheRef = useRef(new Map()); // userId -> { url, version }
  const [avatarBump, setAvatarBump] = useState(0);

  // Inject tiny keyframe for skeleton shimmer
  useEffect(() => {
    if (document.getElementById("msg-sk-shimmer-css")) return;
    const s = document.createElement("style");
    s.id = "msg-sk-shimmer-css";
    s.textContent = `
      @keyframes msg-sk-shimmer { 100% { transform: translateX(100%); } }
      @media (prefers-reduced-motion: reduce) { .msg-sk-anim { animation: none !important; } }
    `;
    document.head.appendChild(s);
  }, []);

  // Fetch auth once + subscribe
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthUser(data?.user || null);
      setAuthReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Topbar broadcast: bust avatar cache
  useEffect(() => {
    const onAvatarUpdated = (e) => {
      const { userId, url, version } = e.detail || {};
      if (!userId) return;
      userAvatarCacheRef.current.set(userId, { url: url || null, version: version || Date.now() });
      setAvatarBump((x) => x + 1);
    };
    window.addEventListener("avatar:updated", onAvatarUpdated);
    return () => window.removeEventListener("avatar:updated", onAvatarUpdated);
  }, []);

  // Helper: first venue image (array or JSON string)
  const getFirstVenueImage = useCallback((v) => {
    if (!v) return null;
    if (Array.isArray(v.image_urls)) return v.image_urls[0] || null;
    if (typeof v.image_urls === "string") {
      try {
        const arr = JSON.parse(v.image_urls);
        if (Array.isArray(arr)) return arr[0] || null;
      } catch {}
    }
    return null;
  }, []);

  // Avatar component (uses NeutralAvatar fallback if no photo)
  function UserAvatar({ userId, size = 42, title = "User", username }) {
    const cache = userAvatarCacheRef.current;
    const [state, setState] = useState(() => cache.get(userId) || { url: null, version: 0 });

    useEffect(() => {
      if (!userId) return;
      const cached = cache.get(userId);
      if (cached) {
        setState(cached);
        return;
      }

      let cancelled = false;
      (async () => {
        const byId = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
        const row =
          byId.data ||
          (await supabase.from("profiles").select("avatar_url").eq("user_id", userId).maybeSingle()).data;
        const raw = row?.avatar_url || null;
        const url = toPublicUrl(raw);
        const entry = { url, version: 0 };
        cache.set(userId, entry);
        if (!cancelled) setState(entry);
      })();

      return () => {
        cancelled = true;
      };
    }, [userId, avatarBump]);

    return (
      <NeutralAvatar
        size={size}
        src={state.url}
        cacheKey={state.version}
        seed={userId}
        title={title || username}
        initialsFrom={username || title}
      />
    );
  }

  // Fetch + subscribe
  const fetchMessages = useCallback(
    async ({ showSpinner = true } = {}) => {
      if (!authUser) return;
      if (showSpinner) setLoading(true);
      setNamesReady(false);

      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          id, content, created_at, sender_id, receiver_id, is_read,
          venue_id, pinned_by, file_type, file_url, status,
          theVenues ( id, name, user_id, image_urls )
        `)
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        setRows([]);
        setUsernameMap({});
        if (showSpinner) setLoading(false);
        setNamesReady(true);
        return;
      }

      const ids = new Set();
      (messages || []).forEach((m) => {
        if (m.sender_id) ids.add(m.sender_id);
        if (m.receiver_id) ids.add(m.receiver_id);
      });

      let nameMap = {};
      const allIds = Array.from(ids);
      if (allIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", allIds);
        if (Array.isArray(profs)) {
          nameMap = Object.fromEntries(profs.map((p) => [p.id, (p.username || "").trim()]));
        }
      }

      setRows(messages || []);
      setUsernameMap(nameMap);
      setNamesReady(true);
      if (showSpinner) setLoading(false);
    },
    [authUser]
  );

  useEffect(() => {
    if (!authUser) return;

    fetchMessages({ showSpinner: true });

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`messages-tab-${authUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${authUser.id}` },
        () => fetchMessages({ showSpinner: false })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${authUser.id}` },
        () => fetchMessages({ showSpinner: false })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${authUser.id}` },
        () => fetchMessages({ showSpinner: false })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${authUser.id}` },
        () => fetchMessages({ showSpinner: false })
      )
      .subscribe();

  channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [authUser, fetchMessages]);

  // Reduce to latest-per-conversation (venueId + otherUserId)
  const conversations = useMemo(() => {
    if (!authUser) return [];
    const latestByKey = new Map();

    rows.forEach((msg) => {
      const venue = msg.theVenues || {};
      if (!venue?.id) return;

      const otherId = authUser.id === msg.sender_id ? msg.receiver_id : msg.sender_id;
      if (!otherId) return;

      const key = `${venue.id}-${otherId}`;
      const existing = latestByKey.get(key);
      if (existing) {
        if (new Date(msg.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, msg);
        }
      } else {
        latestByKey.set(key, msg);
      }
    });

    const list = Array.from(latestByKey.values());
    list.sort((a, b) => {
      const ap = a.pinned_by === authUser.id ? 1 : 0;
      const bp = b.pinned_by === authUser.id ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return list;
  }, [rows, authUser]);

  const newestByDate = useMemo(() => {
    if (!conversations.length) return null;
    let newest = conversations[0];
    for (const m of conversations) {
      if (new Date(m.created_at) > new Date(newest.created_at)) newest = m;
    }
    return newest;
  }, [conversations]);
  // (newestByDate currently unused, kept for potential later logic)

  // Unread badge for parent tab
  useEffect(() => {
    if (!authUser || !onUnreadChange || loading) return;
    const convKeys = new Set();
    for (const m of rows) {
      if (m.receiver_id === authUser.id && m.is_read === false && m.venue_id) {
        convKeys.add(`${m.venue_id}-${m.sender_id}`);
      }
    }
    onUnreadChange(convKeys.size);
  }, [rows, loading, authUser?.id, onUnreadChange]);

  // Utils
  const timeAgo = (iso) => {
    const mins = dayjs().diff(dayjs.utc(iso).local(), "minute");
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const openConversation = async (msg) => {
    const venue = msg.theVenues;
    const otherId = authUser.id === msg.sender_id ? msg.receiver_id : msg.sender_id;

    await supabase
      .from("messages")
      .update({
        is_read: true,
        seen_at: new Date().toISOString(),
        status: "seen",
      })
      .eq("venue_id", venue.id)
      .eq("sender_id", otherId)
      .eq("receiver_id", authUser.id)
      .eq("is_read", false);

    setChatVenue(venue);
    setChatOtherUserId(otherId);
    setShowChat(true);
  };

  const togglePin = async (msg) => {
    if (!authUser) return;
    const isPinned = msg.pinned_by === authUser.id;
    await supabase.from("messages").update({ pinned_by: isPinned ? null : authUser.id }).eq("id", msg.id);
  };

  const deleteConversation = async (msg) => {
    if (!authUser) return;
    const venueId = msg.venue_id;
    const otherId = authUser.id === msg.sender_id ? msg.receiver_id : msg.sender_id;
    const ok = window.confirm("Delete conversation? This will remove the entire chat history for this venue and user.");
    if (!ok) return;

    const orClause = `and(sender_id.eq.${authUser.id},receiver_id.eq.${otherId},venue_id.eq.${venueId}),and(sender_id.eq.${otherId},receiver_id.eq.${authUser.id},venue_id.eq.${venueId})`;

    const { error } = await supabase.from("messages").delete().or(orClause);
    if (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete conversation.");
    } else {
      fetchMessages();
    }
  };

  // UI helpers to avoid flicker
  const displayNameFor = useCallback(
    (uid) => {
      if (!uid) return "Guest";
      if (uid === authUser?.id) return "You";
      const name = usernameMap[uid];
      if (typeof name === "string" && name.trim()) return name.trim();
      return namesReady ? `User-${uid.slice(0, 6)}` : "";
    },
    [authUser?.id, usernameMap, namesReady]
  );

  const NameSkeleton = ({ w = 90 }) => (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: w,
        height: 11,
        borderRadius: 6,
        background: "#e5e7eb",
        position: "relative",
        overflow: "hidden",
        verticalAlign: "middle",
      }}
    >
      <span
        className="msg-sk-anim"
        style={{
          position: "absolute",
          inset: 0,
          transform: "translateX(-100%)",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9), rgba(255,255,255,0))",
          animation: "msg-sk-shimmer 1.05s infinite",
        }}
      />
    </span>
  );

  const openOptions = (msg) => setOptionsMsg(msg);
  const closeOptions = () => setOptionsMsg(null);

  /* ------------------------------- render ------------------------------- */

  if (!authReady) {
    return (
      <div
        id="messagesWrapper"
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "0px",
          boxSizing: "border-box",
          background: THEME.bg,
          minHeight: "100vh",
        }}
      >
        <Header />
        <ConversationsSkeleton count={6} />
      </div>
    );
  }
  if (!authUser) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: THEME.textMuted,
          background: THEME.bg,
          minHeight: "60vh",
          fontSize: 13,
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            color: THEME.text,
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          Login Required
        </h3>
        <p> Please log in to view your messages.</p>
      </div>
    );
  }

  return (
    <div
      id="messagesWrapper"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "0px",
        boxSizing: "border-box",
        background: THEME.bg,
        minHeight: "100vh",
      }}
    >
      <Header />

      {loading ? (
        <ConversationsSkeleton count={6} />
      ) : conversations.length === 0 ? (
        <EmptyState />
      ) : (
        <div id="messagesContent" style={{ paddingBottom: 10 }}>
          {conversations.map((msg) => {
            const venue = msg.theVenues;
            const isOwner = venue?.user_id === authUser.id;
            const otherId = authUser.id === msg.sender_id ? msg.receiver_id : msg.sender_id;

            const rawOtherName = displayNameFor(otherId);
            const nameNode = !namesReady ? <NameSkeleton w={90} /> : <>{rawOtherName}</>;

            const venueName = venue?.name || "Unknown Venue";
            const isUnread = msg.receiver_id === authUser.id && msg.is_read === false;
            const isPinnedByMe = msg.pinned_by === authUser.id;

            const sentByMe = msg.sender_id === authUser.id;
            let previewText = msg.content || "";
            if (msg.file_type === "image") {
              previewText = sentByMe ? "You sent a photo" : "Sent a photo";
            } else if (msg.file_type === "file") {
              const fileName = (msg.content || "").trim();
              if (fileName) {
                previewText = sentByMe ? `You sent “${fileName}”` : `Sent “${fileName}”`;
              } else {
                previewText = sentByMe ? "You sent a file" : "Sent a file";
              }
            }
            const isTextPreview = !msg.file_type || msg.file_type === "text";

            const stamp = timeAgo(msg.created_at);

            const titleNode = isOwner ? (
              <>
                <span>{nameNode}</span>
                <span style={{ color: "#9CA3AF", margin: "0 6px" }}>→</span>
                <span style={{ color: THEME.accent, fontWeight: 700 }}>{venueName}</span>
              </>
            ) : (
              <span style={{ color: THEME.accent, fontWeight: 700 }}>{venueName}</span>
            );

            const avatar = isOwner ? (
              <div style={{ marginRight: 12, flexShrink: 0 }}>
                <UserAvatar userId={otherId} size={44} title={rawOtherName || "User"} username={rawOtherName} />
              </div>
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
                  marginRight: 12,
                }}
              >
                {(() => {
                  const venueImg = getFirstVenueImage(venue);
                  const venueNameSafe = venueName || "Venue";
                  return venueImg ? (
                    <img
                      src={venueImg}
                      alt={venueNameSafe}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      style={{
                        color: "#fff",
                        background: THEME.accent,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {venueNameSafe.charAt(0).toUpperCase()}
                    </span>
                  );
                })()}
              </div>
            );

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  borderRadius: 16,
                  alignItems: "flex-start",
                  padding: 11,
                  margin: "8px 10px",
                  background: isUnread
                    ? `radial-gradient(circle at -10% -20%, ${THEME.accentSoft} 0, transparent 52%), ${THEME.cardSoft}`
                    : `radial-gradient(circle at -10% -20%, ${THEME.accentSoft} 0, transparent 52%), ${THEME.card}`,
                  border: `1px solid ${
                    isUnread ? "rgba(129,140,248,0.6)" : THEME.borderSubtle
                  }`,
                  boxShadow: THEME.shadow,
                  position: "relative",
                  transition:
                    "transform .08s ease, box-shadow .08s ease, background .08s ease, border-color .08s ease",
                  cursor: "pointer",
                  fontSize: 12.5,
                }}
                onClick={() => openConversation(msg)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = THEME.shadowHover;
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.borderColor = "rgba(129,140,248,0.7)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = THEME.shadow;
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = isUnread
                    ? "rgba(129,140,248,0.6)"
                    : THEME.borderSubtle;
                }}
              >
                {/* 📌 Corner pin if pinned */}
                {isPinnedByMe && (
                  <span
                    aria-label="Pinned conversation"
                    title="Pinned conversation"
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 8,
                      fontSize: 14,
                      lineHeight: 1,
                      color: "#9CA3AF",
                      userSelect: "none",
                    }}
                  >
                    📌
                  </span>
                )}

                {avatar}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* title row */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <div
                      title={isOwner ? `${namesReady ? rawOtherName : "Loading…"} → ${venueName}` : venueName}
                      style={{
                        fontWeight: isUnread ? 800 : 700,
                        fontSize: 13,
                        color: THEME.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {titleNode}
                    </div>

                    <button
                      aria-label="Conversation options"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOptions(msg);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "#9CA3AF",
                        fontSize: 18,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ⋯
                    </button>
                  </div>

                  {/* preview row */}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: THEME.textMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "80%",
                        fontWeight: isUnread ? 600 : 400,
                      }}
                    >
                      {isTextPreview && previewText ? `“${previewText}”` : previewText}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "#98A2B3",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {stamp}
                      </div>
                      {isUnread && (
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            background: THEME.accent,
                            borderRadius: "50%",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chat modal (has its own styling & overlay inside ChatModal) */}
      <ChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        venue={chatVenue}
        otherUserId={chatOtherUserId}
      />

      {/* Options modal */}
      <OptionsModal
        open={!!optionsMsg}
        isPinned={!!optionsMsg && optionsMsg.pinned_by === authUser?.id}
        onClose={closeOptions}
        onPinToggle={async () => {
          if (!optionsMsg) return;
          await togglePin(optionsMsg);
          closeOptions();
        }}
        onDelete={async () => {
          if (!optionsMsg) return;
          await deleteConversation(optionsMsg);
          closeOptions();
        }}
      />
    </div>
  );
}

/* ----------------------------- UI bits ----------------------------- */

function Header() {
  return (
    <div
      style={{
        padding: "18px 16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: THEME.text,
          }}
        >
          Conversations
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 9px",
            borderRadius: 999,
            background: THEME.accentSoft,
            color: THEME.accent,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Messages
        </span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: THEME.textMuted,
        }}
      >
        Message venue owners and keep all replies in one place.
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        color: THEME.textMuted,
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          margin: "0 auto 14px",
          background: THEME.accentSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
        }}
      >
        💬
      </div>
      <h3 style={{ margin: "4px 0 6px", fontSize: 17, color: THEME.text, fontWeight: 700 }}>
        No messages yet
      </h3>
      <p style={{ fontSize: 13, color: THEME.textMuted, margin: 0 }}>
        Start a conversation with a venue owner to inquire or book.
      </p>
    </div>
  );
}

function ConversationsSkeleton({ count = 6 }) {
  return (
    <div id="messagesSkeleton" style={{ padding: "0 0px 0px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            borderRadius: 16,
            alignItems: "flex-start",
            padding: 11,
            margin: "8px 10px",
            background: THEME.card,
            border: `1px solid ${THEME.borderSubtle}`,
            boxShadow: THEME.shadow,
          }}
        >
          {/* avatar skeleton */}
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#e5e7eb",
              marginRight: 12,
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <span
              className="msg-sk-anim"
              style={{
                position: "absolute",
                inset: 0,
                transform: "translateX(-100%)",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9), rgba(255,255,255,0))",
                animation: "msg-sk-shimmer 1.05s infinite",
              }}
            />
          </div>

          {/* text skeletons */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* title row */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <SkeletonBlock w="50%" h={13} br={7} />
              <SkeletonBlock w={22} h={13} br={7} />
            </div>
            {/* preview row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <SkeletonBlock w="70%" h={11} br={6} />
              <SkeletonDot />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonBlock({ w = "100%", h = 12, br = 6 }) {
  return (
    <div
      aria-hidden
      style={{
        width: w,
        height: h,
        borderRadius: br,
        background: "#e5e7eb",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        className="msg-sk-anim"
        style={{
          position: "absolute",
          inset: 0,
          transform: "translateX(-100%)",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9), rgba(255,255,255,0))",
          animation: "msg-sk-shimmer 1.05s infinite",
        }}
      />
    </div>
  );
}

function SkeletonDot() {
  return (
    <div
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#e5e7eb",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        className="msg-sk-anim"
        style={{
          position: "absolute",
          inset: 0,
          transform: "translateX(-100%)",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9), rgba(255,255,255,0))",
          animation: "msg-sk-shimmer 1.05s infinite",
        }}
      />
    </div>
  );
}

/** Small centered options dialog */
function OptionsModal({ open, onClose, onPinToggle, onDelete, isPinned }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(14px)",          // ✅ blur background (matches booking modal vibe)
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(360px, 92%)",
          background: THEME.card,
          borderRadius: 16,
          boxShadow: "0 18px 45px rgba(15,23,42,0.35)",
          overflow: "hidden",
          border: `1px solid ${THEME.borderSubtle}`,
        }}
      >
        <div
          style={{
            padding: "11px 15px",
            borderBottom: `1px solid ${THEME.borderSubtle}`,
            fontWeight: 600,
            fontSize: 13,
            color: THEME.text,
          }}
        >
          Conversation options
        </div>

        <div style={{ padding: 6 }}>
          <button
            onClick={onPinToggle}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              color: THEME.text,
            }}
          >
            {isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={onDelete}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "#e74c3c",
            }}
          >
            Delete conversation
          </button>
        </div>

        <div
          style={{
            padding: 8,
            borderTop: `1px solid ${THEME.borderSubtle}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "9px 13px",
              background: THEME.cardSoft,
              border: `1px solid ${THEME.borderSubtle}`,
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              color: THEME.text,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
