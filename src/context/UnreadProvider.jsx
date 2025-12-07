import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";

const UnreadCtx = createContext({
  // messages
  unread: 0,
  ensurePermission: () => false,
  markConversationRead: async () => {},
  // bookings
  bookingUnread: 0,
  bookingsUnreadByBooking: {}, // { [bookingId]: number }
  refreshBookingUnread: async () => {},
  markBookingNotificationsRead: async () => {},
});

export const useUnread = () => useContext(UnreadCtx);

// Optional neutral avatar for notifications (replace with your logo if you want)
const DEFAULT_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <rect width="100%" height="100%" fill="#069C6F"/>
  <circle cx="64" cy="48" r="24" fill="#fff"/>
  <rect x="24" y="82" width="80" height="36" rx="18" fill="#fff"/>
</svg>`);

/** RPC helper kept for other cases if needed */
async function rpcWithParams(name, attempts) {
  for (const params of attempts) {
    try {
      const { data, error, status } = await supabase.rpc(name, params);
      if (!error) return { data, error: null, status };
      if (status !== 400 && status !== 404) return { data: null, error, status };
    } catch {
      // try next
    }
  }
  return { data: null, error: { message: "all attempts failed" }, status: 400 };
}

export function UnreadProvider({ children }) {
  const [user, setUser] = useState(null);

  // Messages unread (existing)
  const [unread, setUnread] = useState(0);

  // Bookings unread/updates (total + per booking)
  const [bookingUnread, setBookingUnread] = useState(0);
  const [bookingsUnreadByBooking, setBookingsUnreadByBooking] = useState({});

  // Owned venues cache for fallback owner-attention count
  const ownedVenueIdsRef = useRef([]);
  const [ownedVenueIds, setOwnedVenueIds] = useState([]);

  const location = useLocation();
  const msgChannelRef = useRef(null);
  const bookNotifChannelRef = useRef(null);
  const bookOwnedChannelRef = useRef(null);
  const bookMineChannelRef = useRef(null);

  const bcRef = useRef(null);
  const recountTimer = useRef(null);
  const bookingRecountTimer = useRef(null);

  // Runtime capability flags so we don't retry RPCs that 404
  const hasBookingRpc = useRef({
    byBooking: null,
    total: null,
    markRead: null,
  });

  /* -------------------- helpers -------------------- */

  const recalcUnread = useCallback(async (uid) => {
    if (!uid) {
      setUnread(0);
      return;
    }
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", uid)
      .eq("is_read", false);

    if (!error && typeof count === "number") {
      setUnread(count);
      // broadcast to other tabs
      bcRef.current?.postMessage({ type: "unread", value: count });
    }
  }, []);

  const scheduleRecalcSoon = useCallback(
    (uid) => {
      clearTimeout(recountTimer.current);
      recountTimer.current = setTimeout(() => recalcUnread(uid), 250);
    },
    [recalcUnread]
  );

  // BOOKING: unread/updates recalculation
  const recalcBookingUnread = useCallback(
    async (uid) => {
      if (!uid) {
        setBookingUnread(0);
        setBookingsUnreadByBooking({});
        return;
      }

      let total = 0;
      let map = {};

      // 1) Preferred: notifications table (if present)
      try {
        const { data: rows, error } = await supabase
          .from("booking_notifications")
          .select("booking_id")
          .eq("recipient_id", uid)
          .eq("is_read", false);

        if (!error && Array.isArray(rows)) {
          total = rows.length;
          map = rows.reduce((acc, r) => {
            if (r?.booking_id)
              acc[r.booking_id] = (acc[r.booking_id] || 0) + 1;
            return acc;
          }, {});
        }
      } catch {
        // ignore if table not present
      }

      // 2a) per-booking map first (RPC with p_recipient), gated to avoid repeat 404s
      if (Object.keys(map).length === 0 && hasBookingRpc.current.byBooking !== false) {
        try {
          const { data, error, status } = await supabase.rpc(
            "booking_unread_by_booking",
            { p_recipient: uid }
          );
          if (!error && Array.isArray(data)) {
            hasBookingRpc.current.byBooking = true;
            map = data.reduce((acc, r) => {
              if (r?.booking_id) acc[r.booking_id] = Number(r.unread || 0);
              return acc;
            }, {});
            total = Object.values(map).reduce(
              (a, b) => a + Number(b || 0),
              0
            );
          } else if (status === 404) {
            hasBookingRpc.current.byBooking = false;
          }
        } catch {
          // noop
        }
      }

      // 2b) total (if still zero), gated
      if (total === 0 && hasBookingRpc.current.total !== false) {
        try {
          const { data, error, status } = await supabase.rpc(
            "booking_unread_total",
            { p_recipient: uid }
          );
          if (!error && typeof data === "number") {
            hasBookingRpc.current.total = true;
            total = data;
          } else if (status === 404) {
            hasBookingRpc.current.total = false;
          }
        } catch {
          // noop
        }
      }

      // 3) Fallback for owners: pending approvals
      if (total === 0) {
        const owned = ownedVenueIdsRef.current || [];
        if (owned.length) {
          try {
            const { count, error } = await supabase
              .from("bookings")
              .select("*", { count: "exact", head: true })
              .in("venue_id", owned)
              .eq("status", "pending")
              .eq("needs_owner_approval", true);
            if (!error && typeof count === "number") {
              total = count;
            }
          } catch {
            // ignore
          }
        }
      }

      setBookingsUnreadByBooking(map);
      setBookingUnread(total);

      // broadcast + DOM event (for components not using context)
      bcRef.current?.postMessage({ type: "bookingUnread", value: total });
      bcRef.current?.postMessage({ type: "bookingUnreadMap", value: map });
      try {
        window.dispatchEvent(
          new CustomEvent("bookingUnread:update", { detail: total })
        );
      } catch {
        /* noop */
      }
    },
    []
  );

  const scheduleBookingRecalcSoon = useCallback(
    (uid) => {
      clearTimeout(bookingRecountTimer.current);
      bookingRecountTimer.current = setTimeout(
        () => recalcBookingUnread(uid),
        250
      );
    },
    [recalcBookingUnread]
  );

  const ensurePermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }, []);

  const showNotification = useCallback(
    async (payload) => {
      // Don’t notify if we’re on /messages and tab is visible
      const onMessages = location.pathname === "/messages";
      const hidden = document.hidden;
      if (!hidden && onMessages) return;

      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") {
        try {
          await ensurePermission();
        } catch {}
        if (Notification.permission !== "granted") return;
      }

      const m = payload?.new || payload; // supabase payload.new on INSERT
      let body = m?.content || "";
      if (!body && m?.file_type === "image") body = "Sent a photo";
      if (!body && m?.file_type === "file") body = "Sent a file";

      new Notification("New message", {
        body: body || "You have a new message",
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
      });
    },
    [location.pathname, ensurePermission]
  );

  /* -------------------- realtime wiring -------------------- */

  const attachMessageRealtime = useCallback(
    (uid) => {
      if (!uid) return;
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }

      const ch = supabase
        .channel(`unread-${uid}`)
        // New message to me
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${uid}`,
          },
          (payload) => {
            scheduleRecalcSoon(uid);
            showNotification(payload);
          }
        )
        // Mark read/unread updates
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${uid}`,
          },
          () => scheduleRecalcSoon(uid)
        )
        .subscribe();

      msgChannelRef.current = ch;
    },
    [scheduleRecalcSoon, showNotification]
  );

  const attachBookingRealtime = useCallback(
    (uid, owned) => {
      if (!uid) return;

      // Clear previous
      if (bookNotifChannelRef.current) {
        supabase.removeChannel(bookNotifChannelRef.current);
        bookNotifChannelRef.current = null;
      }
      if (bookOwnedChannelRef.current) {
        supabase.removeChannel(bookOwnedChannelRef.current);
        bookOwnedChannelRef.current = null;
      }
      if (bookMineChannelRef.current) {
        supabase.removeChannel(bookMineChannelRef.current);
        bookMineChannelRef.current = null;
      }

      // booking_notifications (preferred source)
      const chNotif = supabase
        .channel(`booking-notifs-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "booking_notifications",
            filter: `recipient_id=eq.${uid}`,
          },
          () => scheduleBookingRecalcSoon(uid)
        )
        .subscribe();
      bookNotifChannelRef.current = chNotif;

      // bookings changes where I am the client
      const chMine = supabase
        .channel(`booking-mine-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `user_id=eq.${uid}`,
          },
          () => scheduleBookingRecalcSoon(uid)
        )
        .subscribe();
      bookMineChannelRef.current = chMine;

      // bookings changes for venues I own (to catch approvals)
      if (owned?.length) {
        const list = owned.join(",");
        const chOwned = supabase
          .channel(`booking-owned-${uid}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
              filter: `venue_id=in.(${list})`,
            },
            () => scheduleBookingRecalcSoon(uid)
          )
          .subscribe();
        bookOwnedChannelRef.current = chOwned;
      }
    },
    [scheduleBookingRecalcSoon]
  );

  /* -------------------- cross-tab sync -------------------- */

  useEffect(() => {
    bcRef.current = new BroadcastChannel("unread");
    const bc = bcRef.current;
    bc.onmessage = (evt) => {
      if (evt?.data?.type === "unread" && typeof evt.data.value === "number") {
        setUnread(evt.data.value);
      }
      if (
        evt?.data?.type === "bookingUnread" &&
        typeof evt.data.value === "number"
      ) {
        setBookingUnread(evt.data.value);
      }
      if (evt?.data?.type === "bookingUnreadMap" && evt.data.value) {
        setBookingsUnreadByBooking(evt.data.value || {});
      }
    };
    return () => bc.close();
  }, []);

  // Also support global DOM event for components not using context
  useEffect(() => {
    const onBooking = (e) => {
      const next = Number(e?.detail ?? 0);
      if (!Number.isNaN(next)) {
        setBookingUnread(next);
        bcRef.current?.postMessage({ type: "bookingUnread", value: next });
      }
    };
    window.addEventListener("bookingUnread:update", onBooking);
    return () => window.removeEventListener("bookingUnread:update", onBooking);
  }, []);

  /* -------------------- auth boot + initial pulls -------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;

      const me = data?.user || null;
      setUser(me);

      if (me?.id) {
        // Owned venues (for fallback owner attention)
        try {
          const { data: venues, error } = await supabase
            .from("theVenues")
            .select("id")
            .eq("user_id", me.id);
          if (!error) {
            const ids = (venues || []).map((v) => v.id);
            ownedVenueIdsRef.current = ids;
            setOwnedVenueIds(ids);
          }
        } catch {
          // ignore
        }

        await recalcUnread(me.id);
        await recalcBookingUnread(me.id);
        attachMessageRealtime(me.id);
        attachBookingRealtime(me.id, ownedVenueIdsRef.current);
      } else {
        setUnread(0);
        setBookingUnread(0);
        setBookingsUnreadByBooking({});
      }
    })();

    return () => {
      alive = false;
      // Cleanup any open channels on unmount
      if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
      if (bookNotifChannelRef.current)
        supabase.removeChannel(bookNotifChannelRef.current);
      if (bookOwnedChannelRef.current)
        supabase.removeChannel(bookOwnedChannelRef.current);
      if (bookMineChannelRef.current)
        supabase.removeChannel(bookMineChannelRef.current);
    };
  }, [
    recalcUnread,
    recalcBookingUnread,
    attachMessageRealtime,
    attachBookingRealtime,
  ]);

  /* -------------------- public APIs -------------------- */

  // Messages: mark conversation as read
  const markConversationRead = useCallback(
    async (venueId, otherUserId, myId) => {
      if (!venueId || !otherUserId || !myId) return;
      await supabase
        .from("messages")
        .update({
          is_read: true,
          seen_at: new Date().toISOString(),
          status: "seen",
        })
        .eq("venue_id", venueId)
        .eq("sender_id", otherUserId)
        .eq("receiver_id", myId)
        .eq("is_read", false);

      // Recalc after marking read
      scheduleRecalcSoon(myId);
    },
    [scheduleRecalcSoon]
  );

  const markBookingNotificationsRead = useCallback(
    async (myId, bookingId) => {
      if (!myId) return;

      // Mark rows in the table (if present)
      try {
        const q = supabase
          .from("booking_notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("recipient_id", myId)
          .eq("is_read", false);
        if (bookingId) q.eq("booking_id", bookingId);
        await q;
      } catch {}

      // Also call the RPC
      try {
        await supabase.rpc("booking_mark_read", {
          p_recipient: myId,
          p_booking: bookingId ?? null,
        });
      } catch {}

      // Optimistic local update + recount
      setBookingsUnreadByBooking((prev) => {
        if (!bookingId) {
          setBookingUnread(0);
          bcRef.current?.postMessage({ type: "bookingUnread", value: 0 });
          bcRef.current?.postMessage({
            type: "bookingUnreadMap",
            value: {},
          });
          return {};
        }
        const next = { ...prev, [bookingId]: 0 };
        const nextTotal = Object.values(next).reduce(
          (a, b) => a + Number(b || 0),
          0
        );
        setBookingUnread(nextTotal);
        bcRef.current?.postMessage({ type: "bookingUnread", value: nextTotal });
        bcRef.current?.postMessage({ type: "bookingUnreadMap", value: next });
        return next;
      });

      scheduleBookingRecalcSoon(myId);
    },
    [scheduleBookingRecalcSoon]
  );

  // Public refresher (useful after bulk operations)
  const refreshBookingUnread = useCallback(async () => {
    if (user?.id) await recalcBookingUnread(user.id);
  }, [user?.id, recalcBookingUnread]);

  const value = useMemo(
    () => ({
      // messages
      unread,
      ensurePermission,
      markConversationRead,
      // bookings
      bookingUnread,
      bookingsUnreadByBooking,
      refreshBookingUnread,
      markBookingNotificationsRead,
    }),
    [
      unread,
      ensurePermission,
      markConversationRead,
      bookingUnread,
      bookingsUnreadByBooking,
      refreshBookingUnread,
      markBookingNotificationsRead,
    ]
  );

  return <UnreadCtx.Provider value={value}>{children}</UnreadCtx.Provider>;
}

// Also keep default export (so you can import UnreadProvider either way)
export default UnreadProvider;
