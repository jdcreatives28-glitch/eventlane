// src/components/ChatModal.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { supabase } from "../supabaseClient";
import { FiPaperclip, FiArrowDownCircle } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import NeutralAvatar from "../components/NeutralAvatar"; // ← shared avatar

dayjs.extend(utc);

const PAGE_SIZE = 30;

// ---------- Inva-style theme tokens ----------
const bg = "#f5f7fb";
const card = "#ffffff";
const cardSoft = "#f0f3f9";

const accent = "#635bff";
const accent2 = "#ff6ad5";
const accent3 = "#22c55e";

const text = "#0f172a";
const textMuted = "#64748b";
const borderSubtle = "rgba(15, 23, 42, 0.08)";

const radiusXl = 22;
const radiusPill = 999;

// Simple helper to dedupe messages by id or tempId
function dedupeByIdOrTemp(messages) {
  const seen = new Set();
  const out = [];
  for (const m of messages) {
    const k = m.id || m.tempId;
    const key = k || `__anon__${m.created_at || ""}_${m.content || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "120px",
        flexDirection: "column",
        gap: "10px",
        color: "var(--muted, #555)"
      }}
    >
      <div
        style={{
          border: "4px solid #f3f3f3",
          borderTop: "4px solid var(--accent, #069C6F)",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          animation: "spin 1s linear infinite"
        }}
      />
      <span style={{ fontSize: 14 }}>Loading chat...</span>
      <style>
        {`@keyframes spin {0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);}}`}
      </style>
    </div>
  );
}

// ====== MAIN COMPONENT ======================================================

export default function ChatModal({ isOpen, onClose, venue, otherUserId: propOtherUserId }) {
  const [authUser, setAuthUser] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  const [otherUsername, setOtherUsername] = useState("");
  const [messages, setMessages] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [input, setInput] = useState("");
  const [isTypingOther, setIsTypingOther] = useState(false);
  const [sending, setSending] = useState(false);
  const [showScrollDownButton, setShowScrollDownButton] = useState(false);
  const [hasNewWhileUp, setHasNewWhileUp] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [booting, setBooting] = useState(false); // controls iOS anchor + spinner

  // refs
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingOffTimerRef = useRef(null);
  const oldestTsRef = useRef(null);
  const atBottomRef = useRef(true);

  // avatar cache
  const userAvatarCacheRef = useRef(new Map());
  const [avatarBump, setAvatarBump] = useState(0);

  const navigate = useNavigate();
  const venueId = venue?.id;
  const venueKey = venue?.slug || venue?.id;
  const venueDetailPath = venueKey ? `/venues/${venueKey}` : "/";

  // ---------------------------------------------------------------------------
  // Basic helpers
  // ---------------------------------------------------------------------------

  const getFirstVenueImage = useCallback((v) => {
    if (!v) return null;
    if (Array.isArray(v.image_urls)) return v.image_urls[0] || null;
    if (typeof v.image_urls === "string") {
      try {
        const arr = JSON.parse(v.image_urls);
        if (Array.isArray(arr)) return arr[0] || null;
      } catch {
        // ignore
      }
    }
    return null;
  }, []);

  const colorForId = useCallback((uid) => {
    if (!uid) return "#34D399";
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  const goToVenue = useCallback(() => {
    if (!venueKey) return;
    navigate(venueDetailPath);
  }, [navigate, venueKey, venueDetailPath]);

  const scrollToBottom = useCallback(
    (behavior = "auto") => {
      const el = containerRef.current;
      if (!el) return;

      const top = el.scrollHeight;

      if (el.scrollTo) {
        el.scrollTo({
          top,
          behavior
        });
      } else {
        el.scrollTop = top;
      }

      atBottomRef.current = true;
      setShowScrollDownButton(false);
    },
    []
  );

  const formatMessageTimestamp = useCallback((djs) => {
    const now = dayjs();
    if (now.isSame(djs, "day")) return djs.format("h:mm A");
    if (now.subtract(1, "day").isSame(djs, "day")) return `Yesterday ${djs.format("h:mm A")}`;
    return djs.format("MMM D, h:mm A");
  }, []);

  const shortAgo = useCallback((iso) => {
    const t = dayjs.utc(iso).local();
    const mins = dayjs().diff(t, "minute");
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return t.format("MMM D, h:mm A");
  }, []);

  // image compression helpers
  const canUseWebP = (() => {
    if (typeof document === "undefined") return false;
    try {
      const c = document.createElement("canvas");
      return c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      return false;
    }
  })();

  function renameWithExt(name, mime) {
    const ext = mime === "image/webp" ? ".webp" : ".jpg";
    return name.replace(/\.[^/.]+$/, "") + ext;
  }

  function loadImageFromFile(file) {
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

  async function compressImage(
    file,
    { maxW = 1600, maxH = 1600, quality = 0.8, prefer = "image/webp" } = {}
  ) {
    if (!file.type.startsWith("image/")) return null;
    if (/image\/heic|\.heic$/i.test(file.type) || /\.heic$/i.test(file.name)) return null;

    let img, width, height;
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      img = bitmap;
    } catch {
      const htmlImg = await loadImageFromFile(file);
      width = htmlImg.naturalWidth || htmlImg.width;
      height = htmlImg.naturalHeight || htmlImg.height;
      img = htmlImg;
    }

    let tW = width;
    let tH = height;
    if (width > maxW || height > maxH) {
      const scale = Math.min(maxW / width, maxH / height);
      tW = Math.round(width * scale);
      tH = Math.round(height * scale);
    }
    if (tW === width && tH === height && file.size < 450 * 1024) return null;

    const canvas = document.createElement("canvas");
    canvas.width = tW;
    canvas.height = tH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, tW, tH);

    const mime = prefer === "image/webp" && canUseWebP ? "image/webp" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) return null;
    return new File([blob], renameWithExt(file.name, mime), {
      type: mime,
      lastModified: Date.now()
    });
  }

  // ---------------------------------------------------------------------------
  // Load auth user
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthUser(data?.user || null);
    })();
  }, []);

  // On modal open, attempt initial scroll to bottom (safe, just in case)
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      scrollToBottom("auto");
    }, 0);
    return () => clearTimeout(id);
  }, [isOpen, scrollToBottom]);

  // ---------------------------------------------------------------------------
  // Resolve recipient (otherUserId)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !venue?.id) return;

    let cancelled = false;

    const resolveRecipient = async () => {
      const explicitlyPassed = propOtherUserId !== undefined;
      let target = explicitlyPassed ? propOtherUserId : venue.user_id || null;
      const { data } = await supabase.auth.getUser();
      const me = data?.user?.id || null;

      if (me && target === me) {
        if (explicitlyPassed) {
          target = null;
        } else {
          const { data: recent, error } = await supabase
            .from("messages")
            .select("sender_id,receiver_id,created_at")
            .eq("venue_id", venue.id)
            .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!error && recent?.length) {
            const m = recent[0];
            target = m.sender_id === me ? m.receiver_id : m.sender_id;
          } else {
            target = null;
          }
        }
      }

      if (!cancelled) setOtherUserId(target);
    };

    resolveRecipient();
    return () => {
      cancelled = true;
    };
  }, [isOpen, propOtherUserId, venue?.id, venue?.user_id]);

  // ---------------------------------------------------------------------------
  // Load other username
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isOpen || !otherUserId) {
        if (!cancelled) setOtherUsername("");
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user?.id || null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", otherUserId)
        .maybeSingle();
      const username = prof?.username?.trim?.();
      const name = username || (me && otherUserId === me ? "You" : "User");
      if (!cancelled) setOtherUsername(name);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, otherUserId]);

  // Always stick to bottom when new messages arrive,
  // but only if user is already near bottom (normal Messenger behavior).
  useEffect(() => {
    if (!isOpen) return;
    if (!messages.length) return;

    const id = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;

      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap < 200 || atBottomRef.current) {
        scrollToBottom("auto");
      }
    }, 0);

    return () => clearTimeout(id);
  }, [isOpen, messages.length, scrollToBottom]);

  // ---------------------------------------------------------------------------
  // Avatar loading + cache
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onAvatarUpdated = (e) => {
      const { userId, url, version } = e.detail || {};
      if (!userId) return;
      userAvatarCacheRef.current.set(userId, {
        url: url || null,
        version: version || Date.now()
      });
      setAvatarBump((x) => x + 1);
    };
    window.addEventListener("avatar:updated", onAvatarUpdated);
    return () => window.removeEventListener("avatar:updated", onAvatarUpdated);
  }, []);

  const AVATAR_BUCKET = "avatars";
  const isHttp = (v) => /^https?:\/\//i.test(v);
  const toPublicUrl = (value) => {
    if (!value) return null;
    if (isHttp(value)) return value;
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(value);
    return data?.publicUrl || null;
  };

  function UserAvatar({ userId, size = 40, title = "User", username }) {
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
        const byId = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", userId)
          .maybeSingle();
        const row =
          byId.data ||
          (
            await supabase
              .from("profiles")
              .select("avatar_url")
              .eq("user_id", userId)
              .maybeSingle()
          ).data;
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
        bg={colorForId(userId || "")}
        title={title || username}
        initialsFrom={username || title}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Initial message load + realtime subscription
  // ---------------------------------------------------------------------------
  const loadInitialMessages = useCallback(async () => {
    if (!authUser || !venueId || !otherUserId) return;

    setInitialLoading(true);
    setMessages([]);
    setHasMore(true);
    setBooting(false); // reset booting; will enable again only if we have messages
    atBottomRef.current = true;
    setShowScrollDownButton(false);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("venue_id", venueId)
      .or(
        `and(sender_id.eq.${authUser.id},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${authUser.id})`
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const newestDesc = !error && Array.isArray(data) ? data : [];
    const ordered = [...newestDesc].reverse(); // oldest → newest

    setMessages(ordered);
    oldestTsRef.current = ordered[0]?.created_at || null;
    setHasMore(newestDesc.length === PAGE_SIZE);

    // if we have messages, go into "booting" state so iOS-anchor effect runs
    if (ordered.length > 0) {
      setBooting(true);
    } else {
      setBooting(false);
    }

    setInitialLoading(false);

    // baseline scroll (desktop / non-iOS)
    setTimeout(() => {
      scrollToBottom("auto");
    }, 0);

    // mark unread as seen
    if (ordered.length) {
      const unreadIds = ordered
        .filter(
          (m) =>
            m.receiver_id === authUser.id &&
            m.sender_id === otherUserId &&
            m.is_read === false
        )
        .map((m) => m.id);
      if (unreadIds.length) {
        await supabase
          .from("messages")
          .update({
            is_read: true,
            seen_at: new Date().toISOString(),
            status: "seen"
          })
          .in("id", unreadIds);
      }
    }
  }, [authUser, venueId, otherUserId, scrollToBottom]);

  // Keep showing "Loading chat..." until we've actually anchored at the bottom (iOS-safe)
  useEffect(() => {
    if (!isOpen) return;
    if (!booting) return;
    if (!messages.length) return;

    let frameId;
    const maxAttempts = 15;

    const tryScroll = (attempt = 0) => {
      const el = containerRef.current;
      if (!el) {
        if (attempt >= maxAttempts) {
          setBooting(false);
        } else {
          frameId = requestAnimationFrame(() => tryScroll(attempt + 1));
        }
        return;
      }

      // Force scroll to bottom
      el.scrollTop = el.scrollHeight - el.clientHeight;

      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;

      // If gap is tiny, we are effectively at bottom
      if (gap <= 4 || attempt >= maxAttempts) {
        atBottomRef.current = true;
        setShowScrollDownButton(false);
        setBooting(false); // stop showing loading
      } else {
        frameId = requestAnimationFrame(() => tryScroll(attempt + 1));
      }
    };

    frameId = requestAnimationFrame(() => tryScroll(0));

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isOpen, booting, messages.length]);

  useEffect(() => {
    if (!isOpen || !authUser || !venueId || !otherUserId) return;

    let cancelled = false;

    (async () => {
      await loadInitialMessages();
      if (cancelled) return;

      const channel = supabase
        .channel(`realtime:chat-${venueId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `venue_id=eq.${venueId}`
          },
          async (payload) => {
            const msg = payload.new;
            const isRelevant =
              (msg.sender_id === authUser.id && msg.receiver_id === otherUserId) ||
              (msg.sender_id === otherUserId && msg.receiver_id === authUser.id);
            if (!isRelevant) return;

            // Avoid duplicates
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;

              // If message is mine, replace optimistic temp if exists
              if (msg.sender_id === authUser.id) {
                const idx = prev.findIndex(
                  (m) =>
                    m.tempId &&
                    m.file_type === msg.file_type &&
                    (m.content || "") === (msg.content || "")
                );
                if (idx !== -1) {
                  const clone = [...prev];
                  clone[idx] = msg;
                  return dedupeByIdOrTemp(clone);
                }
              }

              return dedupeByIdOrTemp([...prev, msg]);
            });

            // mark as seen if I'm at bottom and this is from other user
            if (msg.sender_id === otherUserId && atBottomRef.current) {
              await supabase
                .from("messages")
                .update({
                  is_read: true,
                  seen_at: new Date().toISOString(),
                  status: "seen"
                })
                .eq("id", msg.id);
            }

            const isMine = msg.sender_id === authUser.id;
            const shouldStickToBottom = atBottomRef.current || isMine;

            if (shouldStickToBottom) {
              setTimeout(() => scrollToBottom("auto"), 0);
            } else if (!isMine) {
              setHasNewWhileUp(true);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `venue_id=eq.${venueId}`
          },
          (payload) => {
            const updated = payload.new;
            const isRelevant =
              (updated.sender_id === authUser.id &&
                updated.receiver_id === otherUserId) ||
              (updated.sender_id === otherUserId &&
                updated.receiver_id === authUser.id);
            if (!isRelevant) return;
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
              )
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "typing_status",
            filter: `venue_id=eq.${venueId}`
          },
          (payload) => {
            const typing = payload.new;
            if (
              typing.sender_id === otherUserId &&
              typing.receiver_id === authUser.id
            ) {
              setIsTypingOther(!!typing.is_typing);
              if (atBottomRef.current) {
                setTimeout(() => scrollToBottom("auto"), 0);
              }
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setMessages([]);
      setHasNewWhileUp(false);
      setShowScrollDownButton(false);
      atBottomRef.current = true;
      setBooting(false);
      setInitialLoading(true);
    };
  }, [isOpen, authUser, venueId, otherUserId, loadInitialMessages, scrollToBottom]);

  // ---------------------------------------------------------------------------
  // Typing status (me)
  // ---------------------------------------------------------------------------
  const canSend = !!(authUser && venueId && otherUserId);
  const isOwner =
    !!authUser?.id && !!venue?.user_id && authUser.id === venue.user_id;
  const venueName = (venue?.name || "").trim();

  useEffect(() => {
    if (!canSend) return;

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      await supabase.from("typing_status").upsert(
        {
          sender_id: authUser.id,
          receiver_id: otherUserId,
          venue_id: venueId,
          is_typing: input.length > 0,
          updated_at: new Date().toISOString()
        },
        { onConflict: ["sender_id", "receiver_id", "venue_id"] }
      );
    }, 150);

    clearTimeout(typingOffTimerRef.current);
    typingOffTimerRef.current = setTimeout(async () => {
      await supabase.from("typing_status").upsert(
        {
          sender_id: authUser.id,
          receiver_id: otherUserId,
          venue_id: venueId,
          is_typing: false,
          updated_at: new Date().toISOString()
        },
        { onConflict: ["sender_id", "receiver_id", "venue_id"] }
      );
    }, 3000);

    return () => {
      clearTimeout(typingTimerRef.current);
      clearTimeout(typingOffTimerRef.current);
    };
  }, [input, canSend, authUser, otherUserId, venueId]);

  // ---------------------------------------------------------------------------
  // Mark all as read when modal opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !authUser || !otherUserId || !venueId) return;
    (async () => {
      await supabase
        .from("messages")
        .update({
          is_read: true,
          seen_at: new Date().toISOString(),
          status: "seen"
        })
        .eq("venue_id", venueId)
        .eq("sender_id", otherUserId)
        .eq("receiver_id", authUser.id)
        .eq("is_read", false);
    })();
  }, [isOpen, authUser, otherUserId, venueId]);

  // ---------------------------------------------------------------------------
  // ESC closes image viewer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!viewerSrc) return;
    const onKey = (e) => e.key === "Escape" && setViewerSrc(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerSrc]);

  // ---------------------------------------------------------------------------
  // Load older messages when scrolled to top
  // ---------------------------------------------------------------------------
  const loadOlder = useCallback(
    async () => {
      if (!authUser || !venueId || !otherUserId || !hasMore || isLoadingMore) return;

      const el = containerRef.current;
      const prevScrollTop = el?.scrollTop || 0;
      const prevScrollHeight = el?.scrollHeight || 0;

      setIsLoadingMore(true);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("venue_id", venueId)
        .or(
          `and(sender_id.eq.${authUser.id},receiver_id.eq.${otherUserId}),` +
            `and(sender_id.eq.${otherUserId},receiver_id.eq.${authUser.id})`
        )
        .lt("created_at", oldestTsRef.current)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (!error && Array.isArray(data) && data.length) {
        const older = [...data].reverse();
        const existingIds = new Set(messages.map((m) => m.id || m.tempId));
        const olderFiltered = older.filter((m) => !existingIds.has(m.id || m.tempId));

        setMessages((prev) => dedupeByIdOrTemp([...olderFiltered, ...prev]));
        oldestTsRef.current = olderFiltered[0]?.created_at || oldestTsRef.current;
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }

      setIsLoadingMore(false);

      // Preserve visual position (anchor) so it feels Messenger-like when loading history
      setTimeout(() => {
        const node = containerRef.current;
        if (!node) return;
        const newScrollHeight = node.scrollHeight;
        const delta = newScrollHeight - prevScrollHeight;
        node.scrollTop = prevScrollTop + delta;
      }, 0);
    },
    [authUser, venueId, otherUserId, hasMore, isLoadingMore, messages]
  );

  const onMessagesScroll = (e) => {
    const el = e.currentTarget;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = gap < 40;

    atBottomRef.current = atBottom;
    setShowScrollDownButton(!atBottom);

    if (el.scrollTop <= 24 && !isLoadingMore && hasMore) {
      loadOlder();
    }
  };

  // ---------------------------------------------------------------------------
  // Sending messages
  // ---------------------------------------------------------------------------
  const makeTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextOnly();
    }
  };

  const sendTextOnly = async () => {
    const content = input.replace(/\r\n/g, "\n");
    if (!content.trim() || !canSend) return;

    const tempId = makeTempId();
    const optimistic = {
      id: tempId,
      tempId,
      sender_id: authUser.id,
      receiver_id: otherUserId,
      venue_id: venueId,
      content,
      file_url: null,
      file_type: "text",
      created_at: new Date().toISOString(),
      status: "sending"
    };
    setMessages((prev) => dedupeByIdOrTemp([...prev, optimistic]));
    setInput("");
    setTimeout(() => scrollToBottom("auto"), 0);

    try {
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          sender_id: authUser.id,
          receiver_id: otherUserId,
          venue_id: venueId,
          content,
          file_url: null,
          file_type: "text",
          delivered_at: new Date().toISOString(),
          status: "sent"
        })
        .select()
        .single();
      if (inserted && !error) {
        setMessages((prev) =>
          dedupeByIdOrTemp(prev.map((m) => (m.tempId === tempId ? inserted : m)))
        );
      } else {
        setMessages((prev) =>
          dedupeByIdOrTemp(
            prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))
          )
        );
      }
    } catch {
      setMessages((prev) =>
        dedupeByIdOrTemp(
          prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))
        )
      );
    }
  };

  const sendAll = async () => {
    if (!canSend) return;
    const hasText = !!input.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!hasText && !hasAttachments) return;

    setSending(true);

    // text
    const textToSend = input.replace(/\r\n/g, "\n");
    if (hasText) {
      const tempId = makeTempId();
      const optimistic = {
        id: tempId,
        tempId,
        sender_id: authUser.id,
        receiver_id: otherUserId,
        venue_id: venueId,
        content: textToSend,
        file_url: null,
        file_type: "text",
        created_at: new Date().toISOString(),
        status: "sending"
      };
      setMessages((prev) => dedupeByIdOrTemp([...prev, optimistic]));
      setInput("");

      supabase
        .from("messages")
        .insert({
          sender_id: authUser.id,
          receiver_id: otherUserId,
          venue_id: venueId,
          content: textToSend,
          file_url: null,
          file_type: "text",
          delivered_at: new Date().toISOString(),
          status: "sent"
        })
        .select()
        .single()
        .then(({ data: inserted, error }) => {
          if (inserted && !error) {
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) => (m.tempId === tempId ? inserted : m))
              )
            );
          } else {
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) =>
                  m.tempId === tempId ? { ...m, status: "failed" } : m
                )
              )
            );
          }
        })
        .catch(() => {
          setMessages((prev) =>
            dedupeByIdOrTemp(
              prev.map((m) =>
                m.tempId === tempId ? { ...m, status: "failed" } : m
              )
            )
          );
        });
    }

    // attachments
    if (hasAttachments) {
      const attachments = pendingAttachments;
      setPendingAttachments([]);

      for (const item of attachments) {
        const tempId = makeTempId();
        const optimistic = {
          id: tempId,
          tempId,
          sender_id: authUser.id,
          receiver_id: otherUserId,
          venue_id: venueId,
          content: item.name || "",
          file_url: item.kind === "image" ? item.url : null,
          file_type: item.kind === "image" ? "image" : "file",
          created_at: new Date().toISOString(),
          status: "uploading"
        };
        setMessages((prev) => dedupeByIdOrTemp([...prev, optimistic]));
        setTimeout(() => scrollToBottom("auto"), 0);

        (async () => {
          const original = item.file;
          const ts = Date.now();
          let toUpload = original;
          let uploadName = original.name;

          if (item.kind === "image") {
            try {
              const compressed = await compressImage(original, {
                maxW: 1600,
                maxH: 1600,
                quality: 0.8,
                prefer: "image/webp"
              });
              if (compressed) {
                toUpload = compressed;
                uploadName = compressed.name;
              }
            } catch (e) {
              console.warn("Compression failed, using original:", e);
            }
          }

          const safeName = uploadName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const filePath = `chats/${venueId}/${ts}_${safeName}`;

          const { error: uploadErr } = await supabase.storage
            .from("chat-uploads")
            .upload(filePath, toUpload, {
              contentType: toUpload.type
            });
          if (uploadErr) {
            console.error("Upload error:", uploadErr);
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) =>
                  m.tempId === tempId ? { ...m, status: "failed" } : m
                )
              )
            );
            return;
          }

          const { data: urlData } = supabase.storage
            .from("chat-uploads")
            .getPublicUrl(filePath);
          const publicUrl = urlData.publicUrl;

          const { data: inserted, error } = await supabase
            .from("messages")
            .insert({
              sender_id: authUser.id,
              receiver_id: otherUserId,
              venue_id: venueId,
              content: item.name || "",
              file_url: publicUrl,
              file_type: item.kind === "image" ? "image" : "file",
              delivered_at: new Date().toISOString(),
              status: "sent"
            })
            .select()
            .single();

          if (inserted && !error) {
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) => (m.tempId === tempId ? { ...inserted } : m))
              )
            );
          } else {
            setMessages((prev) =>
              dedupeByIdOrTemp(
                prev.map((m) =>
                  m.tempId === tempId ? { ...m, status: "failed" } : m
                )
              )
            );
          }
          if (item.kind === "image" && item.url) URL.revokeObjectURL(item.url);
        })();
      }
    }

    setSending(false);
  };

  const onFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const existingKeys = new Set(pendingAttachments.map((it) => it.key));
    const next = [];

    for (const f of files) {
      const key = `${f.name}_${f.size}`;
      if (existingKeys.has(key)) continue;

      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        next.push({
          file: f,
          url,
          key,
          kind: "image",
          name: f.name
        });
      } else {
        next.push({
          file: f,
          key,
          kind: "file",
          name: f.name
        });
      }
    }
    if (next.length) setPendingAttachments((cur) => [...cur, ...next]);
    e.target.value = "";
  };

  const removePending = (key) => {
    setPendingAttachments((cur) => {
      const found = cur.find((i) => i.key === key);
      if (found?.kind === "image" && found.url) URL.revokeObjectURL(found.url);
      return cur.filter((i) => i.key !== key);
    });
  };

  // ---------------------------------------------------------------------------
  // Derived stuff for UI
  // ---------------------------------------------------------------------------
  if (!isOpen) return null;

  const headerAvatar = !isOwner ? (
    <VenueAvatar venue={venue} getFirstVenueImage={getFirstVenueImage} size={40} />
  ) : (
    <UserAvatar
      userId={otherUserId}
      size={40}
      title={otherUsername || "User"}
      username={otherUsername}
    />
  );

  const hasOther = !!otherUserId;
  const otherLabel = hasOther ? otherUsername?.trim() || "User" : "Conversation";
  const topTitle = isOwner ? otherLabel || "User" : venueName || "Venue";
  const showVenueBelow = isOwner && !!venueName && topTitle !== venueName;

  const inputPlaceholder = !authUser
    ? "Log in to chat"
    : isOwner
    ? `Replying as ${venueName || "your venue"}`
    : "Type your message…";

  const keyFor = (m, idx) => m.id || m.tempId || `${m.created_at || "?"}:${idx}`;

  const modalUI = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.32)",
        zIndex: 12000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: "8px 10px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          height: "min(80vh, 720px)",
          background:
            "radial-gradient(520px 260px at 0% 0%, rgba(99,91,255,.08), transparent 60%)," +
            "radial-gradient(480px 220px at 100% 0%, rgba(255,106,213,.10), transparent 60%)," +
            card,
          borderRadius: `${radiusXl}px ${radiusXl}px 0 0`,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${borderSubtle}`,
          boxShadow: "0 18px 50px rgba(15,23,42,0.12)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.24)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            color: "#fff",
            borderRadius: `${radiusXl}px ${radiusXl}px 0 0`,
            boxShadow:
              "0 8px 24px rgba(79,70,229,0.55), inset 0 -1px 0 rgba(255,255,255,0.35)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {headerAvatar}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15
              }}
            >
              {!isOwner ? (
                <Link
                  to={venueDetailPath}
                  title="Open venue details"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      window.open(
                        `${window.location.origin}${venueDetailPath}`,
                        "_blank",
                        "noopener"
                      );
                    }
                  }}
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#fff",
                    textDecoration: "none",
                    letterSpacing: 0.1
                  }}
                >
                  {topTitle}
                </Link>
              ) : (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: 0.1
                  }}
                >
                  {topTitle}
                </span>
              )}
              {isOwner && showVenueBelow && (
                <button
                  onClick={goToVenue}
                  title="Open venue details"
                  style={{
                    background: "rgba(15,23,42,0.25)",
                    border: "none",
                    color: "#E5FDF4",
                    cursor: "pointer",
                    padding: "4px 10px",
                    marginTop: 4,
                    borderRadius: radiusPill,
                    fontSize: 12,
                    fontWeight: 500,
                    textAlign: "left",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: accent3
                    }}
                  />
                  @{venueName}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(15,23,42,0.18)",
              color: "#fff",
              border: "none",
              fontSize: 18,
              width: 32,
              height: 32,
              borderRadius: radiusPill,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.35)"
            }}
          >
            ✕
          </button>
        </div>

        {/* MESSAGES */}
        <div
          id="chatMessages"
          ref={containerRef}
          onScroll={onMessagesScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 12px 8px",
            background:
              "radial-gradient(circle at top, rgba(99,91,255,0.06), transparent 60%), " +
              bg,
            position: "relative",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {!authUser && (
            <div
              style={{
                textAlign: "center",
                color: textMuted,
                padding: 24
              }}
            >
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: 16,
                  color: text
                }}
              >
                Login Required
              </h4>
              <p style={{ fontSize: 14 }}>Please log in to start a conversation.</p>
            </div>
          )}

          {authUser && (initialLoading || booting) && <LoadingSpinner />}

          {authUser && !initialLoading && !canSend && (
            <div
              style={{
                textAlign: "center",
                color: textMuted,
                padding: 24
              }}
            >
              <p style={{ fontSize: 14 }}>
                No recipient selected. Open a conversation from your Messages tab.
              </p>
            </div>
          )}

          {!initialLoading && messages.length > 0 && (
            <>
              {isLoadingMore && (
                <div
                  style={{
                    textAlign: "center",
                    margin: "8px 0 12px"
                  }}
                >
                  <Dot delay={0} /> <Dot delay={120} /> <Dot delay={240} />
                </div>
              )}

              {messages.map((m, idx) => {
                const isMine = m.sender_id === authUser?.id;
                const prev = messages[idx - 1];
                const prevTime = prev ? dayjs.utc(prev.created_at).local() : null;
                const thisTime = dayjs.utc(m.created_at).local();
                const showTime =
                  !prevTime || thisTime.diff(prevTime, "minute") > 5;

                const mineBubbleStyle = {
                  display: "inline-block",
                  background: `linear-gradient(135deg, ${accent}, ${accent2})`,
                  color: "#fff",
                  borderRadius: 18,
                  borderBottomRightRadius: 6,
                  maxWidth: "78%",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  boxShadow: "0 8px 18px rgba(79,70,229,0.45)",
                  fontSize: 14.5,
                  lineHeight: 1.5
                };

                const otherBubbleStyle = {
                  display: "inline-block",
                  background: cardSoft,
                  color: text,
                  borderRadius: 18,
                  borderBottomLeftRadius: 6,
                  maxWidth: "78%",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
                  border: `1px solid ${borderSubtle}`,
                  fontSize: 14.5,
                  lineHeight: 1.5
                };

                const bubbleBase = isMine ? mineBubbleStyle : otherBubbleStyle;

                let body;
                if (m.file_type === "image") {
                  body = (
                    <img
                      src={m.file_url}
                      alt="attachment"
                      loading="lazy"
                      onClick={() => m.file_url && setViewerSrc(m.file_url)}
                      onLoad={() => {
                        if (atBottomRef.current && idx >= messages.length - 2) {
                          scrollToBottom("auto");
                        }
                      }}
                      style={{
                        display: "block",
                        maxWidth: "70%",
                        height: "auto",
                        cursor: m.file_url ? "zoom-in" : "default",
                        borderRadius: 16,
                        boxShadow: "0 10px 26px rgba(15,23,42,0.35)"
                      }}
                    />
                  );
                } else if (m.file_type === "file") {
                  const displayName = pickFilename(m.content, m.file_url);
                  const ext = getExt(displayName);
                  body = (
                    <FileBubble
                      href={m.file_url}
                      name={displayName}
                      ext={ext}
                      uploading={m.status === "uploading"}
                      failed={m.status === "failed"}
                    />
                  );
                } else {
                  body = (
                    <div
                      style={{
                        ...bubbleBase,
                        padding: "9px 13px",
                        opacity: m.status === "sending" ? 0.85 : 1
                      }}
                    >
                      {m.content}
                    </div>
                  );
                }

                const isLastMine = isMine && idx === messages.length - 1;
                const statusText =
                  m.status === "failed"
                    ? "Failed to send"
                    : m.status === "uploading"
                    ? "Uploading…"
                    : m.status === "sending"
                    ? "Sending…"
                    : m.status === "seen"
                    ? "Seen"
                    : m.status === "delivered"
                    ? "Delivered"
                    : m.status
                    ? "Sent"
                    : "";
                const statusStamp = shortAgo(m.created_at);

                return (
                  <React.Fragment key={keyFor(m, idx)}>
                    {showTime && (
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          color: "#9ca3af",
                          margin: "10px 0"
                        }}
                      >
                        {formatMessageTimestamp(thisTime)}
                      </div>
                    )}

                    <div
                      style={{
                        margin: "6px 0",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        gap: 8
                      }}
                    >
                      {!isMine && (
                        <AvatarForMessage
                          message={m}
                          venue={venue}
                          otherUsername={otherUsername}
                          otherUserId={otherUserId}
                          authUserId={authUser?.id}
                          getFirstVenueImage={getFirstVenueImage}
                          colorForId={colorForId}
                          size={28}
                          UserAvatarCmp={UserAvatar}
                        />
                      )}
                      {body}
                    </div>

                    {isLastMine && (
                      <>
                        {m.status === "seen" ? (
                          // ✅ Small profile icon when SEEN
                          <div
                            style={{
                              marginTop: 4,
                              paddingRight: 6,
                              display: "flex",
                              justifyContent: "flex-end"
                            }}
                            title="Seen"
                            aria-label="Seen"
                          >
                            {isOwner ? (
                              // You are venue owner → show user's avatar
                              <UserAvatar
                                userId={otherUserId}
                                size={18}
                                title={otherUsername || "User"}
                                username={otherUsername}
                              />
                            ) : (
                              // You are client → show venue avatar
                              <VenueAvatar
                                venue={venue}
                                getFirstVenueImage={getFirstVenueImage}
                                size={18}
                              />
                            )}
                          </div>
                        ) : (
                          statusText && (
                            // Other statuses still show text (Sent / Delivered / Failed / Uploading)
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                marginTop: 4,
                                textAlign: "right",
                                paddingRight: isMine ? 6 : 0
                              }}
                            >
                              {statusText}
                              {statusText &&
                              !["Sending…", "Uploading…", "Failed to send"].includes(
                                statusText
                              )
                                ? ` · ${statusStamp}`
                                : ""}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}

          {!initialLoading && isTypingOther && (
            <div
              style={{
                margin: "8px 0 12px",
                textAlign: "left"
              }}
            >
              <div
                role="status"
                aria-label="Typing…"
                style={{
                  display: "inline-flex",
                  gap: 4,
                  padding: "6px 10px",
                  borderRadius: radiusPill,
                  background: cardSoft,
                  boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
                  border: `1px solid ${borderSubtle}`
                }}
              >
                <Dot delay={0} /> <Dot delay={120} /> <Dot delay={240} />
              </div>
            </div>
          )}

          <div ref={bottomRef} style={{ height: 1 }} />
        </div>

        {/* FLOATING CONTROLS */}
        {showScrollDownButton && (
          <button
            onClick={() => scrollToBottom("smooth")}
            style={{
              position: "absolute",
              bottom: "84px",
              left: "50%",
              transform: "translateX(-50%)",
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: radiusPill,
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(79,70,229,0.45)",
              zIndex: 1000,
              transition: "transform 0.15s ease, box-shadow 0.15s ease"
            }}
            title="Scroll to latest message"
            aria-label="Scroll to latest message"
          >
            <FiArrowDownCircle size={22} />
          </button>
        )}

        {hasNewWhileUp && !atBottomRef.current && (
          <button
            onClick={() => {
              setHasNewWhileUp(false);
              scrollToBottom("smooth");
            }}
            style={{
              position: "absolute",
              bottom: "136px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: radiusPill,
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 12,
              boxShadow: "0 8px 20px rgba(15,23,42,0.45)",
              zIndex: 1000,
              letterSpacing: 0.2
            }}
            aria-label="Jump to newest"
            title="Jump to newest"
          >
            New messages
          </button>
        )}

        {/* PENDING ATTACHMENTS */}
        {pendingAttachments.length > 0 && (
          <div
            style={{
              padding: "8px 12px",
              borderTop: `1px solid ${borderSubtle}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              background: cardSoft
            }}
          >
            {pendingAttachments.map((it) =>
              it.kind === "image" ? (
                <div
                  key={it.key}
                  style={{
                    position: "relative",
                    width: 74,
                    height: 74
                  }}
                >
                  <img
                    src={it.url}
                    alt="preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 12,
                      display: "block",
                      background: "#e5e7eb",
                      boxShadow: "0 4px 10px rgba(15,23,42,0.18)"
                    }}
                  />
                  <button
                    onClick={() => removePending(it.key)}
                    aria-label="Remove"
                    title="Remove"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "none",
                      background: "#f44336",
                      color: "#fff",
                      fontSize: 14,
                      cursor: "pointer",
                      lineHeight: "22px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.35)"
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  key={it.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: `1px solid ${borderSubtle}`,
                    borderRadius: 10,
                    background: card,
                    maxWidth: 260,
                    boxShadow: "0 1px 4px rgba(15,23,42,0.06)"
                  }}
                  title={it.name}
                >
                  <MiniFileIcon ext={getExt(it.name)} />
                  <span
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {it.name}
                  </span>
                  <button
                    onClick={() => removePending(it.key)}
                    aria-label="Remove"
                    title="Remove"
                    style={{
                      marginLeft: "auto",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "none",
                      background: "#f44336",
                      color: "#fff",
                      fontSize: 14,
                      cursor: "pointer",
                      lineHeight: "22px"
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* INPUT AREA */}
        <div className="avoid-ios-input-zoom">
          <div
            style={{
              borderTop: `1px solid ${borderSubtle}`,
              padding: 12,
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              background: cardSoft,
              borderRadius: `0 0 ${radiusXl}px ${radiusXl}px`,
              boxShadow: "0 -4px 14px rgba(15,23,42,0.06)"
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canSend || sending || initialLoading}
              title={!canSend ? "No recipient" : "Attach files"}
              aria-label="Attach"
              style={{
                border: `1px solid ${borderSubtle}`,
                background: card,
                borderRadius: 14,
                padding: "8px 10px",
                height: 44,
                width: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  !canSend || sending || initialLoading ? "#9CA3AF" : text,
                cursor:
                  !canSend || sending || initialLoading ? "not-allowed" : "pointer",
                boxShadow: "0 1px 4px rgba(15,23,42,0.08)"
              }}
            >
              <FiPaperclip size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json,.md,.rtf"
              style={{ display: "none" }}
              onChange={onFilePick}
            />
            <textarea
              id="chatInput"
              placeholder={inputPlaceholder}
              disabled={!canSend || sending || initialLoading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: `1px solid ${borderSubtle}`,
                borderRadius: 14,
                padding: "10px 12px",
                outline: "none",
                lineHeight: 1.35,
                maxHeight: 160,
                fontSize: 16,
                background: initialLoading ? "#f9fafb" : card,
                color: text,
                boxShadow: "0 1px 2px rgba(15,23,42,0.04)"
              }}
            />
            <button
              id="sendBtn"
              className="btn-primary"
              onClick={sendAll}
              disabled={
                !canSend ||
                sending ||
                initialLoading ||
                (!input.trim() && pendingAttachments.length === 0)
              }
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: radiusPill,
                padding: "10px 18px",
                cursor:
                  !canSend ||
                  sending ||
                  initialLoading ||
                  (!input.trim() && pendingAttachments.length === 0)
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 600,
                height: 44,
                boxShadow: "0 8px 18px rgba(79,70,229,0.45)",
                fontSize: 14,
                letterSpacing: 0.2,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity:
                  !canSend ||
                  sending ||
                  initialLoading ||
                  (!input.trim() && pendingAttachments.length === 0)
                    ? 0.7
                    : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* IMAGE VIEWER */}
      {viewerSrc && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setViewerSrc(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 13000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <img
            src={viewerSrc}
            alt="Full view"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: 12,
              boxShadow: "0 20px 45px rgba(0,0,0,0.75)"
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewerSrc(null);
            }}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              background: "rgba(15,23,42,0.65)",
              color: "#fff",
              border: "none",
              borderRadius: radiusPill,
              padding: "8px 14px",
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(0,0,0,0.7)"
            }}
            aria-label="Close image"
            title="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(modalUI, document.body);
}

// ====== Supporting components / helpers =====================================

function VenueAvatar({ venue, getFirstVenueImage, size = 28 }) {
  const img = getFirstVenueImage?.(venue);
  const name = venue?.name || "Venue";
  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    background: "var(--surface, #e5e7eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
    flexShrink: 0
  };
  return (
    <div style={wrapperStyle} title={name} aria-label="Venue">
      {img ? (
        <img
          loading="lazy"
          src={img}
          alt={name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block"
          }}
        />
      ) : (
        <span
          style={{
            color: "#fff",
            background: "var(--accent-2, #34D399)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: Math.max(10, Math.floor(size * 0.48))
          }}
        >
          {(name[0] || "V").toUpperCase()}
        </span>
      )}
    </div>
  );
}

function AvatarForMessage({
  message,
  venue,
  otherUsername,
  otherUserId,
  authUserId,
  getFirstVenueImage,
  colorForId,
  size = 24,
  UserAvatarCmp
}) {
  const senderId = message.sender_id;
  const senderIsOwner = venue?.user_id && senderId === venue.user_id;
  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: "#e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.06)"
  };
  if (senderIsOwner) {
    const venueImg = getFirstVenueImage(venue);
    const vName = venue?.name || "Venue";
    return (
      <div style={wrapperStyle} title={vName} aria-label="Venue">
        {venueImg ? (
          <img
            loading="lazy"
            src={venueImg}
            alt={vName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }}
          />
        ) : (
          <span
            style={{
              color: "#fff",
              background: "var(--accent-2, #34D399)",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: Math.max(10, Math.floor(size * 0.48))
            }}
          >
            {(vName[0] || "V").toUpperCase()}
          </span>
        )}
      </div>
    );
  }
  const title = senderId === authUserId ? "You" : otherUsername || "User";
  return (
    <UserAvatarCmp
      userId={senderId}
      size={size}
      title={title}
      username={title}
    />
  );
}

function pickFilename(content, url) {
  const fromContent = (content || "").trim();
  if (fromContent) return fromContent;
  try {
    const clean = decodeURIComponent((url || "").split("?")[0]);
    const base = clean.substring(clean.lastIndexOf("/") + 1);
    return base || "file";
  } catch {
    return "file";
  }
}

function getExt(name = "") {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "";
}

function categoryForExt(ext) {
  if (!ext)
    return {
      key: "file",
      label: "FILE",
      color: "#6b7280"
    };
  const map = {
    pdf: { key: "pdf", label: "PDF", color: "#ef4444" },
    doc: { key: "doc", label: "DOC", color: "#2563eb" },
    docx: { key: "doc", label: "DOCX", color: "#2563eb" },
    rtf: { key: "doc", label: "RTF", color: "#2563eb" },
    txt: { key: "txt", label: "TXT", color: "#6b7280" },
    md: { key: "txt", label: "MD", color: "#6b7280" },
    xls: { key: "xls", label: "XLS", color: "#16a34a" },
    xlsx: { key: "xls", label: "XLSX", color: "#16a34a" },
    csv: { key: "xls", label: "CSV", color: "#16a34a" },
    ppt: { key: "ppt", label: "PPT", color: "#f97316" },
    pptx: { key: "ppt", label: "PPTX", color: "#f97316" },
    zip: { key: "zip", label: "ZIP", color: "#eab308" },
    rar: { key: "zip", label: "RAR", color: "#eab308" },
    "7z": { key: "zip", label: "7Z", color: "#eab308" },
    json: { key: "code", label: "JSON", color: "#8b5cf6" },
    js: { key: "code", label: "JS", color: "#8b5cf6" },
    ts: { key: "code", label: "TS", color: "#8b5cf6" },
    jsx: { key: "code", label: "JSX", color: "#8b5cf6" },
    tsx: { key: "code", label: "TSX", color: "#8b5cf6" },
    py: { key: "code", label: "PY", color: "#8b5cf6" },
    java: { key: "code", label: "JAVA", color: "#8b5cf6" },
    rb: { key: "code", label: "RB", color: "#8b5cf6" },
    go: { key: "code", label: "GO", color: "#8b5cf6" },
    php: { key: "code", label: "PHP", color: "#8b5cf6" },
    c: { key: "code", label: "C", color: "#8b5cf6" },
    cpp: { key: "code", label: "CPP", color: "#8b5cf6" },
    cs: { key: "code", label: "CS", color: "#8b5cf6" }
  };
  return (
    map[ext] || {
      key: "file",
      label: (ext || "FILE").toUpperCase(),
      color: "#6b7280"
    }
  );
}

function IconCircle({ label, color, size = 48 }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.max(10, Math.floor(size * 0.34)),
        letterSpacing: 0.5,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12) inset"
      }}
    >
      {label}
    </div>
  );
}

function FileBubble({ href, name, ext, uploading, failed }) {
  const cat = categoryForExt(ext);
  const Card = href && !uploading && !failed ? "a" : "div";
  const commonStyle = {
    textDecoration: "none",
    color: "inherit",
    display: "inline-block",
    maxWidth: "80%",
    background: "var(--surface, #ffffff)",
    border: "1px solid var(--border, #E9ECEF)",
    borderRadius: 14,
    padding: 10,
    boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
    opacity: uploading ? 0.9 : 1
  };
  return (
    <Card
      href={Card === "a" ? href : undefined}
      target={Card === "a" ? "_blank" : undefined}
      rel={Card === "a" ? "noopener noreferrer" : undefined}
      style={commonStyle}
      title={name}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <IconCircle label={cat.label} color={cat.color} size={46} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 260
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: failed ? "#ef4444" : "#6b7280",
              marginTop: 2
            }}
          >
            {failed
              ? "Failed to upload"
              : uploading
              ? "Uploading…"
              : `${cat.label} file • Click to open`}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniFileIcon({ ext }) {
  const cat = categoryForExt(ext);
  return <IconCircle label={cat.label} color={cat.color} size={28} />;
}

let typingAnimInjected = false;
function useTypingAnimStyles() {
  useEffect(() => {
    if (typingAnimInjected) return;
    const style = document.createElement("style");
    style.id = "chat-typing-anim";
    style.textContent =
      "@keyframes typing-bounce {0%, 80%, 100% { transform: translateY(0) scale(1); opacity: .35; } 40% { transform: translateY(-4px) scale(1.15); opacity: 1; }}@media (prefers-reduced-motion: reduce) {.typing-dot { animation: none !important; }}";
    document.head.appendChild(style);
    typingAnimInjected = true;
  }, []);
}

function Dot({ delay = 0, size = 6 }) {
  useTypingAnimStyles();
  return (
    <span
      className="typing-dot"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#6b7280",
        display: "inline-block",
        margin: 2,
        animation: "typing-bounce 1s infinite ease-in-out",
        animationDelay: `${delay}ms`
      }}
    />
  );
}
