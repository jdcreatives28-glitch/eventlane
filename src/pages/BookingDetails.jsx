// src/pages/BookingDetails.jsx
import React, { useEffect, useState, useLayoutEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import Swal from 'sweetalert2';
import { FaEdit } from 'react-icons/fa';
import {
  FiMessageSquare, FiExternalLink, FiAlertTriangle, FiCalendar, FiChevronLeft, FiChevronRight, FiSliders,
  FiCheckCircle, FiXCircle, FiEdit3, FiClock, FiInfo, FiList
} from 'react-icons/fi';

import ChatModal from '../components/ChatModal';
import { useUnread } from '../context/UnreadProvider';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

// Fields clients can change (require owner approval)
const CLIENT_APPROVAL_FIELDS = ['event_name', 'event_type', 'event_date', 'guest_count'];
// SLA for unnoticed pending requests (hours)
const PENDING_SLA_HOURS = 72;

// Works in Vite/browser and won’t crash if process is undefined
const IS_DEV =
  (typeof import.meta !== 'undefined' && import.meta.env && 'DEV' in import.meta.env)
    ? import.meta.env.DEV
    : (typeof process !== 'undefined' && process.env
        ? process.env.NODE_ENV !== 'production'
        : false);



// ---- schema-aware sanitizing ----
const UPDATABLE_COLUMNS = new Set([
  // only columns you actually allow the UI to change
  'event_name',
  'event_type',
  'event_date',
  'guest_count',
  'start_time',
  'end_time',
  'event_start_at',
  'event_end_at',
  'pending_changes',
  'needs_owner_approval',
  'status', // Ensure status is updatable if handled directly
]);

const FIELD_TYPES = {
  event_name: 'text',
  event_type: 'text',
  event_date: 'date',          // 'YYYY-MM-DD' or null
  guest_count: 'int',          // number or null
  start_time: 'time',          // 'HH:MM:SS' or null
  end_time: 'time',            // 'HH:MM:SS' or null
  event_start_at: 'timestamptz', // ISO string or null
  event_end_at: 'timestamptz',   // ISO string or null
  pending_changes: 'json',
  needs_owner_approval: 'bool',
  status: 'text', // Added for completeness if status changes are part of a patch
};

// Function to sanitize patch data
function sanitizePatch(patch = {}) {
  const ensureTimeSeconds = (v) => {
    if (v === null) return null;
    if (v == null || v === '') return undefined;
    const s = String(v).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    return undefined;
  };

  const ensureDate = (v) => {
    if (v === null) return null;
    if (!v && v !== 0) return undefined;
    const d = dayjs(v);
    return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
  };

  const ensureIso = (v) => {
    if (v === null) return null;
    if (!v && v !== 0) return undefined;
    const d = dayjs(v);
    return d.isValid() ? d.toDate().toISOString() : undefined;
  };

  const toBoolStrict = (v) => {
    if (v === null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true','t','1','yes','y','on'].includes(s))  return true;
      if (['false','f','0','no','n','off'].includes(s)) return false;
      return undefined;
    }
    return undefined;
  };

  const out = {};
  for (const [k, raw] of Object.entries(patch)) {
    if (!UPDATABLE_COLUMNS.has(k)) continue;
    const t = FIELD_TYPES[k] || 'text';

    if (raw === null) { out[k] = null; continue; }
    if (typeof raw === 'undefined') continue;

    let v;

    switch (t) {
      case 'int': {
        if (raw === '' || raw === undefined) break;
        const n = Number(raw);
        if (!Number.isFinite(n)) break;
        v = n;
        break;
      }
      case 'bool': {
        v = toBoolStrict(raw);
        if (typeof v === 'undefined') continue;
        break;
      }
      case 'date': {
        v = ensureDate(raw);
        if (typeof v === 'undefined') continue;
        break;
      }
      case 'time': {
        v = ensureTimeSeconds(raw);
        if (typeof v === 'undefined') continue;
        break;
      }
      case 'timestamptz': {
        v = ensureIso(raw);
        if (typeof v === 'undefined') continue;
        break;
      }
      case 'json': {
        if (raw === '' || raw === undefined) { v = null; }
        else if (typeof raw === 'object')     { v = raw; }
        else                                   continue;
        break;
      }
      case 'text':
      default: {
        v = String(raw);
        break;
      }
    }

    if (typeof v === 'undefined') continue;
    out[k] = v;
  }
  return out;
}

// Tabs mapping
const TABS = [
  { key: 'pending', label: 'Requests' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'expired',   label: 'Expired'   },
];

function normalizeTime(t) {
  if (t == null || t === '') return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

function normalizeDate(d) {
  if (!d) return null;
  const iso = dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD') : String(d);
  return iso;
}

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- auth / ownership ---
  const [userId, setUserId] = useState(null);
  const [noUser, setNoUser] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownedVenueIds, setOwnedVenueIds] = useState([]);

  // --- data / ui state ---
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [actionBusy, setActionBusy] = useState(false);

  // Tabs
  const [selectedTab, setSelectedTab] = useState('pending');

  // Calendar view
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(dayjs().startOf('month').toDate());

  // --- chat modal state ---
  const [showChat, setShowChat] = useState(false);
  const [chatOtherUserId, setChatOtherUserId] = useState(null);

  // Unread bookings integration
  const { bookingsUnreadByBooking = {}, markBookingNotificationsRead } = useUnread() || {};

  // --- filters ---
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState('recent');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [onlyPendingChanges, setOnlyPendingChanges] = useState(false);

  // Activity log state
  const [activity, setActivity] = useState([]);
  const [hasActivityTable, setHasActivityTable] = useState(true);
  const [latestActByBooking, setLatestActByBooking] = useState({});

  // inject skeleton css early
  useLayoutEffect(() => ensureBookingSkeletonCSS(), []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // auth
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const currentUserId = userData?.user?.id;
        if (!currentUserId) {
          setNoUser(true);
          setLoading(false);
          return;
        }
        setUserId(currentUserId);

        // venues owned by me
        const { data: venues, error: venueError } = await supabase
          .from('theVenues')
          .select('id')
          .eq('user_id', currentUserId);
        if (venueError) throw venueError;

        const ownedIds = venues?.map(v => v.id) || [];
        setOwnedVenueIds(ownedIds);
        setIsOwner(ownedIds.length > 0);

        // my bookings (as client)
        const { data: clientBookings, error: clientErr } = await supabase
          .from('bookings')
          .select('*, theVenues(*), profiles:user_id(*)')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });
        if (clientErr) throw clientErr;

        // bookings in my venues (as owner)
        let ownerBookings = [];
        if (ownedIds.length) {
          const { data, error } = await supabase
            .from('bookings')
            .select('*, theVenues(*), profiles:user_id(*)')
            .in('venue_id', ownedIds)
            .order('created_at', { ascending: false });
          if (error) throw error;
          ownerBookings = data || [];
        }

        // merge + dedupe + sort
        const combined = [...(ownerBookings || []), ...(clientBookings || [])];
        const unique = Array.from(new Map(combined.map(b => [b.id, b])).values());
        setAllBookings(sortBookings(unique));
      } catch (err) {
        console.error('BookingDetails error:', err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // realtime: reflect INSERT/UPDATE/DELETE for my bookings & owned venue bookings
  useEffect(() => {
    if (!userId) return;

    const handleChange = async (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;

      if (eventType === 'DELETE') {
        const deletedId = oldRow?.id;
        if (!deletedId) return;
        setAllBookings(prev => prev.filter(b => b.id !== deletedId));
        setSelectedBooking(prev => (prev && prev.id === deletedId ? null : prev));
        return;
      }

      const row = newRow;
      if (!row) return;

      if (row.user_id === userId || ownedVenueIds.includes(row.venue_id)) {
        await hydrateBooking(row.id);
      }
    };

    const channels = [];

    const chMine = supabase
      .channel(`rt-bookings-mine-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${userId}` }, handleChange)
      .subscribe();
    channels.push(chMine);

    if (ownedVenueIds.length) {
      const list = ownedVenueIds.join(',');
      const chOwned = supabase
        .channel(`rt-bookings-owned-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `venue_id=in.(${list})` }, handleChange)
        .subscribe();
      channels.push(chOwned);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, ownedVenueIds.join(',')]);

  // Hydrate a booking row with relations, then upsert into state
  const isNetErr = (e) =>
    e && (e.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(e.message));

  const hydrateBooking = async (bookingId, attempt = 1) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, theVenues(*), profiles:user_id(*)')
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;

      setAllBookings((prev) => {
        const idx = prev.findIndex((b) => b.id === bookingId);
        if (idx === -1) return sortBookings([data, ...prev]);
        const merged = { ...prev[idx], ...data };
        const next = [...prev];
        next[idx] = merged;
        return sortBookings(next);
      });

      setSelectedBooking((prev) => (prev && prev.id === bookingId ? { ...prev, ...data } : prev));
    } catch (e) {
      if (isNetErr(e) && attempt < 4) {
        const delay = 500 * Math.pow(2, attempt - 1);
        setTimeout(() => hydrateBooking(bookingId, attempt + 1), delay);
        return;
      }
      console.error('hydrateBooking failed:', e?.message || e);
    }
  };

  // --- edit helpers ---
  const handleEdit = (field) => {
    setEditingField(field);
    let currentValue;
    if (field === 'theVenues.name') {
      currentValue = selectedBooking?.theVenues?.name || '';
    } else if (field === 'event_date') {
      const raw = selectedBooking?.event_date;
      currentValue = raw ? dayjs(raw).format('YYYY-MM-DD') : '';
    } else {
      currentValue = selectedBooking?.[field] ?? '';
    }
    setEditValues(prev => ({ ...prev, [field]: currentValue }));
  };

  const handleEditChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  // Utility to safely format values in pending-changes compare table
  const pretty = (field, value) => {
    if (value == null || value === '') return '—';
    if (field === 'event_date') return dayjs(value).isValid() ? dayjs(value).format('MMMM D, YYYY') : String(value);
    return String(value);
  };

  const prettyStatus = (s) => {
    switch (String(s || '').toLowerCase()) {
      case 'pending':   return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'expired':   return 'Expired';
      default:          return s || '—';
    }
  };

  /**
 * Checks for venue availability, including time overlaps and if the date is in the past.
 * @param {string} venueId
 * @param {string} eventDate 'YYYY-MM-DD'
 * @param {string} startTime 'HH:MM' or 'HH:MM:SS'
 * @param {string} endTime 'HH:MM' or 'HH:MM:SS'
 * @param {string|null} excludeBookingId Optional: Booking ID to exclude from conflict check.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
const checkVenueAvailability = async (venueId, eventDate, startTime, endTime, excludeBookingId = null) => {
    if (!venueId || !eventDate || !startTime || !endTime) {
        console.warn("Missing parameters for availability check.");
        return { ok: true, reason: "missing_params" };
    }

    const proposedDayjsDate = dayjs(eventDate);
    // NEW: Check if the proposed date is in the past
    if (proposedDayjsDate.isBefore(dayjs(), 'day')) {
        return { ok: false, reason: 'past_date' };
    }

    // Existing check against self's booking date (from `saveEdit` original logic)
    const chk = await (async () => {
      const canSeeOthers = ownedVenueIds.includes(selectedBooking?.venue_id);
      const date = normalizeDate(eventDate);
      if (!venueId || !date) return { ok: true };
      if (!canSeeOthers) {
        const { data, error } = await supabase
          .from('venue_busy_days')
          .select('confirmed_count')
          .eq('venue_id', venueId)
          .eq('event_date', date)
          .maybeSingle();
        if (error) {
            console.warn("RLS issue or other error on venue_busy_days:", error);
            return { ok: true, reason: 'rls' };
        }
        // The current check only considers if *any* confirmed booking exists on that day.
        // This doesn't account for time overlaps.
        const busy = (data?.confirmed_count || 0) > 0;
        return { ok: !busy, reason: busy ? 'same_day_confirmed_exists' : undefined };
      }
      return { ok: true };
    })();

    if (chk.ok === false) {
        return { ok: false, reason: 'same_day_confirmed_exists' };
    } else if (chk.reason === 'rls') {
        // If RLS prevented full check, proceed with caution but warn user
        Swal.fire({
          title: `Couldn't fully verify availability`,
          text: `We couldn’t check all venue availability with your permissions. Your change will still be applied, but please confirm with the venue owner if necessary.`,
          icon: 'info',
        });
    }


    // --- CONCEPTUAL RPC CALL FOR ROBUST TIME OVERLAP CHECK ---
    try {
        const { data, error } = await supabase.rpc('check_booking_overlap', {
            p_venue_id: venueId,
            p_event_date: eventDate,
            p_start_time: normalizeTime(startTime),
            p_end_time: normalizeTime(endTime),
            p_exclude_booking_id: excludeBookingId
        });

        if (error) {
            console.error("RPC check_booking_overlap failed:", error);
            // Fallback to client-side or less strict check if RPC fails
            return { ok: true, reason: "rpc_failed" };
        }

        if (data && data.has_overlap) {
            return { ok: false, reason: data.reason || 'time_overlap' };
        }

        return { ok: true }; // No overlap found by RPC
    } catch (e) {
        console.warn("RPC check_booking_overlap not found or failed (likely not implemented yet). Falling back to basic checks.", e);
        return { ok: true, reason: "rpc_not_implemented_or_failed" };
    }
    // --- END CONCEPTUAL RPC CALL ---
};


  // Save flow:
  const saveEdit = async (field) => {
    const newValueRaw = editValues[field];
    const b = selectedBooking;
    if (!b) return;

    const normDate = (d) => (d ? (dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD') : null) : null);
    const normTime = (t) => {
      if (!t) return null;
      const s = String(t).trim();
      return /^\d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
    };
    const toIsoTs = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const t = /^\d{2}:\d{2}$/.test(timeStr) ? `${timeStr}:00` : timeStr;
      return new Date(`${dateStr}T${t}`).toISOString();
    };
    const buildEventTimestamps = (dateStr, startTime, endTime) => {
      if (!dateStr || !startTime || !endTime) return { startAt: null, endAt: null };
      const s = normTime(startTime);
      const e = normTime(endTime);
      const startAt = toIsoTs(dateStr, s);
      const endAt = s < e
        ? toIsoTs(dateStr, e)
        : toIsoTs(dayjs(dateStr).add(1, 'day').format('YYYY-MM-DD'), e);
      return { startAt, endAt };
    };

    const currentVal = field === 'theVenues.name'
      ? b?.theVenues?.name
      : b?.[field];

    if (field !== 'event_date' && ((newValueRaw == null && currentVal == null) || newValueRaw === currentVal)) {
      setEditingField(null);
      return;
    }

    if (field === 'guest_count') {
      const cap = Number(b?.theVenues?.capacity_max || 0);
      const val = Number(newValueRaw || 0);
      if (cap > 0 && val > cap) {
        Swal.fire('Capacity limit', `This venue allows up to ${cap} guests.`, 'warning');
        return;
      }
    }

    let typedValue = newValueRaw;
    if (field === 'event_date') typedValue = normDate(newValueRaw);
    if (field === 'guest_count') typedValue = newValueRaw === '' ? null : Number(newValueRaw);

    // --- CONFLICT CHECK FOR DATE CHANGES ---
    if (field === 'event_date') {
        const proposedDate = normalizeDate(newValueRaw);
        if (proposedDate !== b.event_date) { // Only check if date is actually changing
            const availability = await checkVenueAvailability(
                b.venue_id,
                proposedDate,
                b.start_time,
                b.end_time,
                b.id // Exclude current booking from check
            );

            if (!availability.ok) {
                let message = 'This venue is unavailable at the proposed time.';
                if (availability.reason === 'same_day_confirmed_exists') {
                    message = 'This venue already has a confirmed booking that day.';
                } else if (availability.reason === 'time_overlap') {
                    message = 'The proposed date and time conflict with an existing booking.';
                } else if (availability.reason === 'past_date') { // NEW REASON
                    message = 'The event date cannot be in the past.';
                }
                await Swal.fire({
                    title: 'Availability Conflict',
                    text: message,
                    icon: 'error',
                });
                setEditingField(null);
                return;
            }
        }
    }
    // --- END CONFLICT CHECK FOR DATE CHANGES ---


    const iAmClient = b?.user_id === userId;
    const rawStatus = String(b?.status || '').toLowerCase();

    // Client editing a NON-pending booking should trigger a change request
    if (iAmClient && rawStatus !== 'pending') {
        try {
            const proposalValue =
                field === 'event_date' ? normDate(newValueRaw) :
                field === 'guest_count' ? (newValueRaw === '' ? null : Number(newValueRaw)) :
                newValueRaw;

            // Ensure full payload is passed for proposal including derived timestamps if applicable
            let changesToPropose = { [field]: proposalValue };
            if (field === 'event_date') {
                const newDate = normDate(newValueRaw);
                const { startAt, endAt } = buildEventTimestamps(
                    newDate,
                    b?.start_time,
                    b?.end_time
                );
                changesToPropose = { event_date: newDate, event_start_at: startAt, event_end_at: endAt };
            } else if (field === 'start_time' || field === 'end_time') { // Should not be directly called for time, but good to have
                const newStart = field === 'start_time' ? normTime(newValueRaw) : normTime(b?.start_time);
                const newEnd   = field === 'end_time'   ? normTime(newValueRaw) : normTime(b?.end_time);
                const { startAt, endAt } = buildEventTimestamps(normDate(b?.event_date), newStart, newEnd);
                changesToPropose = { start_time: newStart, end_time: newEnd, event_start_at: startAt, event_end_at: endAt };
            }

            await proposeChange(b, changesToPropose);
        } finally {
            setEditingField(null);
        }
        return; // Important: Exit after proposing change for confirmed bookings
    }

    let payload = {};
    if (field === 'event_name' || field === 'event_type' || field === 'guest_count') {
        payload = { [field]: typedValue };
    } else if (field === 'event_date') {
      const newDate = normDate(newValueRaw);
      const { startAt, endAt } = buildEventTimestamps(
        newDate,
        b?.start_time,
        b?.end_time
      );
      payload = { event_date: newDate, event_start_at: startAt, event_end_at: endAt };
    } else if (field === 'start_time' || field === 'end_time') { // This path for direct updates by owner or pending client
        const newStart = field === 'start_time' ? normTime(newValueRaw) : normTime(b?.start_time);
        const newEnd   = field === 'end_time'   ? normTime(newValueRaw) : normTime(b?.end_time);
        const { startAt, endAt } = buildEventTimestamps(normDate(b?.event_date), newStart, newEnd);
        payload = { start_time: newStart, end_time: newEnd, event_start_at: startAt, event_end_at: endAt };
    }


    const patch = (iAmClient && rawStatus === 'pending')
      ? { ...payload, needs_owner_approval: false, pending_changes: null }
      : payload;

    const { row, error } = await updateBooking(
      b.id,
      patch,
      'id, event_name, event_type, event_date, guest_count, start_time, end_time, event_start_at, event_end_at, needs_owner_approval, pending_changes'
    );

    if (error) {
      if (iAmClient && rawStatus === 'pending') {
        Swal.fire('Error', error?.message || 'Not allowed to edit while pending. Please contact support.', 'error');
        setEditingField(null);
        return;
      }
      Swal.fire('Error', error?.message || 'Failed to save changes.', 'error');
      setEditingField(null);
      return;
    }

    const updated = row ? { ...b, ...row } : { ...b, ...patch };
    setSelectedBooking(updated);
    setAllBookings(prev => sortBookings(prev.map(item => (item.id === updated.id ? updated : item))));
    await safeLog('edit', { field, new_value: patch[field] ?? typedValue }, `Edited ${field}`, b.id);

    setEditingField(null);
  };

  // Client-side "change request" write.
  async function proposeChange(booking, changes, toastTitle = 'Change submitted') {
    const merged = { ...(booking?.pending_changes || {}), ...changes };

    // Include needs_owner_approval and pending_changes in selectList for direct update attempt
    const first = await updateBooking(
      booking.id,
      { pending_changes: merged, needs_owner_approval: true },
      'id, pending_changes, needs_owner_approval, event_name, event_type, event_date, guest_count, start_time, end_time, event_start_at, event_end_at, status' // Added other common fields for full hydrate
    );

    const blocked =
      first.error &&
      (
        first.error.code === 'P0001' || first.error.code === '42501' ||
        /cannot directly modify booking details|submit a change request/i.test(first.error.message || '')
      );

    if (!first.error) {
      const updated = first.row
        ? { ...booking, ...first.row }
        : { ...booking, pending_changes: merged, needs_owner_approval: true };

      setSelectedBooking(prev => (prev?.id === booking.id ? updated : prev));
      setAllBookings(prev => sortBookings(prev.map(b_item => (b_item.id === booking.id ? updated : b_item))));
      await safeLog('pending_change_requested', { changes }, 'Client requested changes', booking.id);
      await Swal.fire(toastTitle, 'Your update is pending venue owner approval.', 'success');
      return updated;
    }

    if (blocked) {
      try {
        const { data, error } = await supabase.rpc('request_booking_change', {
          p_booking_id: booking.id,
          p_changes: changes,
        });

        if (!error && data) {
          const updated = { ...booking, ...data };
          setSelectedBooking(prev => (prev?.id === booking.id ? updated : prev));
          setAllBookings(prev => sortBookings(prev.map(b_item => (b_item.id === booking.id ? updated : b_item))));
          await Swal.fire(toastTitle, 'Your update is pending venue owner approval.', 'success');
          return { ok: true, via: 'rpc', data };
        }
      } catch (e) {
        console.warn('RPC request_booking_change failed:', e);
      }

      const optimistic = {
        ...booking,
        needs_owner_approval: true,
        pending_changes: { ...(booking.pending_changes || {}), ...changes },
      };
      setSelectedBooking(prev => (prev?.id === booking.id ? optimistic : prev));
      setAllBookings(prev => sortBookings(prev.map(b_item => (b_item.id === booking.id ? optimistic : b_item))));
      await safeLog('pending_change_requested', { changes }, 'Client requested changes', booking.id);
      await Swal.fire(toastTitle, 'Your update is pending venue owner approval.', 'success');
      return { ok: true, via: 'activity_only' };
    }

    console.error('proposeChange failed:', first.error);
    await Swal.fire('Error', first?.error?.message || 'Could not submit change request.', 'error');
    return { ok: false, error: first.error };
  }

  // Tries different backends for “change request”
  async function submitChangeRequest(booking, changes, note) {
    // This function is meant as a fallback/alternative to `proposeChange`
    // In your current setup, `proposeChange` is called directly which handles these attempts.
    // If you intend for this `submitChangeRequest` to be the primary, you would call it from `proposeChange`.
    // For now, it's consistent with existing `saveTimeRange` which directly uses it.

    try {
      const { data, error, status } = await supabase
        .from('booking_change_requests')
        .insert({
          booking_id: booking.id,
          proposed_changes: changes,
          actor: userId,
          note: note || null,
          status: 'pending',
        })
        .select()
        .single();

      if (!error && data) {
        await safeLog('pending_change_requested', { changes }, 'Client requested changes', booking.id);
        return { ok: true, via: 'table', data };
      }

      if (status === 404 || (error && /not found|relation .* does not exist/i.test(error.message || ''))) {
        throw Object.assign(new Error('missing table'), { _fallback: 'missing_table' });
      }
      if (error) throw error;
    } catch (e) {
      try {
        const fnName = 'request_booking_change';
        const { data, error } = await supabase.rpc(fnName, {
          p_booking_id: booking.id,
          p_changes: changes,
          p_actor: userId,
          p_note: note || null,
        });
        if (!error) {
          await safeLog('pending_change_requested', { changes }, 'Client requested changes', booking.id);
          return { ok: true, via: 'rpc', data };
        }
      } catch { /* ignore */ }

      await safeLog('pending_change_requested', { changes }, 'Client requested changes', booking.id);
      return { ok: true, via: 'activity_only' };
    }
  }

  async function updateBooking(id, patch, selectList = 'id,status,start_time,end_time') {
    const clean = sanitizePatch(patch);

    if (!clean || Object.keys(clean).length === 0) {
      console.warn('[updateBooking] nothing to update after sanitize', patch);
      return { row: null, error: null, blocked: false, status: 204 };
    }

    if (process?.env?.NODE_ENV !== 'production') {
      console.log('[updateBooking] sending patch:', clean);
    }

    const q = supabase.from('bookings').update(clean).eq('id', id).select(selectList);
    const { data, error, status } = await q;

    if (error) {
      if (IS_DEV) {
        console.error('Update booking failed', {
          error_code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status,
          id,
          cleanPatch: clean,
        });
      }
      return { row: null, error, blocked: false, status };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { row: null, error: null, blocked: false, status };
    }

    return { row: data[0], error: null, blocked: false, status: 200 };
  }

  // Save both start & end time in one go
  const saveTimeRange = async (start, end) => {
    const b = selectedBooking;
    if (!b) return;

    const iAmClient = b?.user_id === userId;
    const rawStatus = String(b?.status || '').toLowerCase();

    const s = (start || '').trim();
    const e = (end || '').trim();

    if (!s || !e) {
      Swal.fire('Invalid time', 'Please enter both start and end time.', 'warning');
      return;
    }
    if (s === e) {
      Swal.fire('Invalid time', 'End time must be after start time.', 'warning');
      return;
    }
    if (!b.event_date) {
      Swal.fire('Missing date', 'Please set an event date first.', 'warning');
      return;
    }

    // --- CONFLICT CHECK FOR TIME RANGE ---
    const availability = await checkVenueAvailability(
        b.venue_id,
        normalizeDate(b.event_date),
        s,
        e,
        b.id // Exclude current booking from check
    );

    if (!availability.ok) {
        let message = 'This venue is unavailable at the proposed time.';
        if (availability.reason === 'time_overlap') {
            message = 'The proposed time range conflicts with an existing booking.';
        }
        await Swal.fire({
            title: 'Availability Conflict',
            text: message,
            icon: 'error',
        });
        setEditingField(null);
        return;
    }
    // --- END CONFLICT CHECK FOR TIME RANGE ---


    const { startAt, endAt } = buildEventTimestamps(
      dayjs(b.event_date).format('YYYY-MM-DD'),
      s,
      e
    );
    if (!startAt || !endAt) {
      Swal.fire('Invalid time', 'Could not compute event window.', 'error');
      return;
    }

    const payload = {
      start_time: /^\d{2}:\d{2}$/.test(s) ? `${s}:00` : s,
      end_time:   /^\d{2}:\d{2}$/.test(e) ? `${e}:00` : e,
      event_start_at: startAt,
      event_end_at:   endAt,
    };

    try {
      if (iAmClient) {
        if (rawStatus === 'pending') {
          const { row, error } = await updateBooking(
            b.id,
            { ...payload, needs_owner_approval: false, pending_changes: null },
            'id, start_time, end_time, event_start_at, event_end_at, needs_owner_approval, pending_changes'
          );

          if (error) {
            if (isDirectModifyBlocked(error)) {
              await submitChangeRequest(b, {
                start_time: payload.start_time,
                end_time:   payload.end_time
              });
              await Swal.fire('Change submitted', 'Your time update is pending venue owner approval.', 'success');
            } else {
              throw error;
            }
          } else {
            const updated = row ? { ...b, ...row } : { ...b, ...payload };
            setSelectedBooking(updated);
            setAllBookings(prev => sortBookings(prev.map(x => (x.id === b.id ? updated : x))));
            await safeLog(
              'edit',
              { field: 'time_range', new_value: { start_time: payload.start_time, end_time: payload.end_time } },
              'Client edited event time on pending booking',
              b.id
            );
          }

          setEditingField(null);
          return;
        }

        // Client editing confirmed booking time
        await proposeChange(
          b,
          { start_time: payload.start_time, end_time: payload.end_time },
          'Time change submitted'
        );
        setEditingField(null);
        return;
      }

      const { row, error } = await updateBooking(
        b.id,
        payload,
        'id, start_time, end_time, event_start_at, event_end_at, needs_owner_approval, pending_changes'
      );

      if (error) throw error;

      const updated = row ? { ...b, ...row } : { ...b, ...payload };
      setSelectedBooking(updated);
      setAllBookings(prev => sortBookings(prev.map(x => (x.id === b.id ? updated : x))));
      await safeLog(
        'edit',
        { field: 'time_range', new_value: { start_time: payload.start_time, end_time: payload.end_time } },
        'Edited event time',
        b.id
      );
    } catch (err) {
      console.error('saveTimeRange failed:', err);
      Swal.fire('Error', err?.message || 'Failed to save time.', 'error');
    } finally {
      setEditingField(null);
    }
  };

  const ACT_KEY = (bookingId) => `bkact:${bookingId}`;

  function loadLocalActivity(bookingId) {
    try {
      const raw = localStorage.getItem(ACT_KEY(bookingId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalActivity(bookingId, entries) {
    try {
      localStorage.setItem(ACT_KEY(bookingId), JSON.stringify(entries.slice(0, 50)));
    } catch {}
  }

  useEffect(() => {
    if (!hasActivityTable) return;

    const ids = (allBookings || [])
      .map(b => (b?.id != null ? String(b.id) : null))
      .filter(Boolean);

    if (!ids.length) { setLatestActByBooking({}); return; }

    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const cleanIds = ids.filter(id => UUID_RE.test(id));
    if (!cleanIds.length) { setLatestActByBooking({}); return; }

    (async () => {
      try {
        const BATCH = 60;
        const latest = {};

        for (let i = 0; i < cleanIds.length; i += BATCH) {
          const chunk = cleanIds.slice(i, i + BATCH);

          let resp = await supabase
            .from('booking_activity')
            .select('booking_id,type,at,created_at,details,actor')
            .in('booking_id', chunk);

          if (resp.error) {
            const e = resp.error;
            if (e.code === '42P01' || /relation .* does not exist/i.test(e.message)) {
              setHasActivityTable(false);
              return;
            }
            console.warn('[bkact] fetch error', e);
            continue;
          }

          for (const row of resp.data || []) {
            const ts = row.at || row.created_at;
            if (!ts) continue;
            const t  = dayjs(ts).valueOf();
            const prev = latest[row.booking_id];
            const prevT = prev ? dayjs(prev.at).valueOf() : -Infinity;
            if (t >= prevT) {
              latest[row.booking_id] = {
                type: row.type,
                at: ts,
                details: row.details || null,
                actor: row.actor || null,
              };
            }
          }
        }
        setLatestActByBooking(latest);

      } catch {
        // no-op
      }
    })();
  }, [allBookings, hasActivityTable]);

  useEffect(() => {
    if (!hasActivityTable) return;
    const ids = (allBookings || []).map(b => b.id).filter(Boolean);
    if (!ids.length) return;

    const quoted = ids.map(id => `"${String(id)}"`).join(',');

    const ch = supabase
      .channel(`rt-bkact-${userId || 'anon'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'booking_activity',
        filter: `booking_id=in.(${quoted})`,
      }, (payload) => {
        const rec = payload.new || payload.old;
        if (!rec?.booking_id) return;
        setLatestActByBooking((prev) => {
          const prevAt = prev[rec.booking_id]?.at ? dayjs(prev[rec.booking_id].at).valueOf() : -Infinity;
          const curAt  = dayjs(rec.at || rec.created_at).valueOf();
          if (curAt >= prevAt) {
            return {
              ...prev,
                [rec.booking_id]: {
                type: rec.type,
                at: rec.at || rec.created_at,
                details: rec.details || null,
                actor: rec.actor || null,
              },
            };
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, ownedVenueIds.join(',')]);

  // --- actions (status, approvals) ---
  const handleAction = async (action, booking) => {
    try {
      setActionBusy(true);

      if (action === 'cancel') {
        const confirm = await Swal.fire({
          title: 'Cancel Booking?',
          text: 'Are you sure you want to cancel this booking?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#1e7b56',
          cancelButtonColor: '#aaa',
          confirmButtonText: 'Yes, cancel it!',
        });
        if (!confirm.isConfirmed) return;

        const { row, error, blocked } = await updateBooking(booking.id, { status: 'cancelled' }, 'id, status');

        if (error) {
          Swal.fire('Error', error.message || 'Could not cancel booking.', 'error');
          return;
        }
        if (blocked) {
          Swal.fire('Not allowed', 'You do not have permission to cancel this booking.', 'error');
          return;
        }

        mutateBooking(booking.id, { status: row.status });
        Swal.fire('Cancelled', 'Booking has been cancelled.', 'success');
        await safeLog('status_change', { new_status: 'cancelled' }, 'Booking cancelled', booking.id);

      }

      if (action === 'confirm') {
        const hasDate = !!booking?.event_date;

        let start = booking?.start_time || '';
        let end   = booking?.end_time   || '';

        if (!start || !end) {
          const { value: form, isConfirmed } = await Swal.fire({
            title: 'Set event time',
            html: `
              <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; color:#6b7280; text-align:left;">Start</label>
                  <input type="time" id="bk-start" class="swal2-input" style="width:160px; margin:0;" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label style="font-size:12px; color:#6b7280; text-align:left;">End</label>
                  <input type="time" id="bk-end" class="swal2-input" style="width:160px; margin:0;" />
                </div>
              </div>
            `,
            didOpen: () => {
              if (start) document.getElementById('bk-start').value = start;
              if (end)   document.getElementById('bk-end').value   = end;
            },
            showCancelButton: true,
            confirmButtonText: 'Save & confirm',
            focusConfirm: false,
            preConfirm: () => {
              const s_val = (document.getElementById('bk-start')?.value || '').trim();
              const e_val = (document.getElementById('bk-end')?.value || '').trim();
              if (!s_val || !e_val) { Swal.showValidationMessage('Please set both start and end time.'); return; }
              if (s_val === e_val)  { Swal.showValidationMessage('End time must be after start time.'); return; }
              return { start_time: s_val, end_time: e_val };
            }
          });
          if (!isConfirmed) { setActionBusy(false); return; }
          start = form.start_time;
          end   = form.end_time;
        }

        if (!hasDate) {
          Swal.fire('Missing date', 'Please set an event date before confirming.', 'warning');
          setActionBusy(false);
          return;
        }

         // --- CONFLICT CHECK FOR CONFIRMING ---
        const availability = await checkVenueAvailability(
            booking.venue_id,
            normalizeDate(booking.event_date), // Use the booking's current event_date for the check
            start,
            end,
            booking.id // Exclude current booking from check
        );

        if (!availability.ok) {
            let message = 'This venue is unavailable at the proposed time.';
            if (availability.reason === 'same_day_confirmed_exists') {
                message = 'This venue already has a confirmed booking that day.';
            } else if (availability.reason === 'time_overlap') {
                message = 'The proposed time range conflicts with an existing booking.';
            } else if (availability.reason === 'past_date') { // NEW REASON
                message = 'The event date cannot be in the past.';
            }
            await Swal.fire({
                title: 'Availability Conflict',
                text: message,
                icon: 'error',
            });
            setActionBusy(false);
            return;
        }
        // --- END CONFLICT CHECK ---

        const { startAt, endAt } = buildEventTimestamps(booking.event_date, start, end);
        if (!startAt || !endAt) {
          Swal.fire('Invalid time', 'Please provide a valid start and end time.', 'warning');
          setActionBusy(false);
          return;
        }

        const patch = {
          status: 'confirmed',
          event_date: dayjs(booking.event_date).format('YYYY-MM-DD'),
          start_time: /^\d{2}:\d{2}$/.test(start) ? `${start}:00` : start,
          end_time:   /^\d{2}:\d{2}$/.test(end)   ? `${end}:00`   : end,
          event_start_at: startAt,
          event_end_at:   endAt,
        };

        const { row, error, blocked } = await updateBooking(
          booking.id,
          patch,
          'id,status,event_date,start_time,end_time,event_start_at,event_end_at'
        );

        if (error) {
          if (error.code === '23514') {
            Swal.fire('Cannot confirm', 'Your database requires date + start/end times. We now set those, but the row still violates a CHECK (likely start >= end). Please review and try again.', 'error');
          } else {
            Swal.fire('Error', error.message || 'Could not confirm booking.', 'error');
          }
          setActionBusy(false);
          return;
        }
        if (blocked) {
          Swal.fire('Not allowed', 'You do not have permission to confirm this booking.', 'error');
          setActionBusy(false);
          return;
        }

        mutateBooking(booking.id, { ...row });
        Swal.fire('Confirmed', 'Booking confirmed successfully.', 'success');
        await safeLog('status_change', { new_status: 'confirmed' }, 'Booking confirmed', booking.id);
        return;
      }

      if (action === 'complete') {
        const confirm = await Swal.fire({
          title: 'Mark as Completed?',
          text: 'This will mark the booking as completed.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#1e7b56',
          cancelButtonColor: '#aaa',
          confirmButtonText: 'Yes, mark completed',
        });
        if (!confirm.isConfirmed) return;

        const { row, error, blocked } = await updateBooking(booking.id, { status: 'completed' }, 'id, status');

        if (error) {
          Swal.fire('Error', error.message || 'Could not mark completed.', 'error');
          return;
        }
        if (blocked) {
          Swal.fire('Not allowed', 'You do not have permission to complete this booking.', 'error');
          return;
        }

        mutateBooking(booking.id, { status: row.status });
        Swal.fire('Done', 'Booking marked as completed.', 'success');
        await safeLog('status_change', { new_status: 'completed' }, 'Booking marked completed', booking.id);

      }
    } catch (err) {
      console.error('Action error:', err?.message || err);
      Swal.fire('Error', err?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const approvePendingChanges = async (booking) => {
    const changes = booking?.pending_changes || {};
    if (!Object.keys(changes).length) return;

    try {
      setActionBusy(true);

      const before = {};
      for (const k of Object.keys(changes)) before[k] = booking?.[k] ?? null;

      const updatePayload = { ...changes, pending_changes: null, needs_owner_approval: false };

      // --- CONFLICT CHECK FOR APPROVAL ---
      // If pending changes include date or time, perform an availability check
      if (changes.event_date || changes.start_time || changes.end_time) {
          const proposedDate = changes.event_date || normalizeDate(booking.event_date);
          const proposedStart = changes.start_time || booking.start_time;
          const proposedEnd = changes.end_time || booking.end_time;

          const availability = await checkVenueAvailability(
              booking.venue_id,
              proposedDate,
              proposedStart,
              proposedEnd,
              booking.id
          );

          if (!availability.ok) {
              let message = 'These changes would create an availability conflict.';
              if (availability.reason === 'same_day_confirmed_exists') {
                  message = 'This venue already has a confirmed booking that day.';
              } else if (availability.reason === 'time_overlap') {
                  message = 'The proposed changes conflict with an existing booking.';
              }
              await Swal.fire({
                  title: 'Availability Conflict',
                  text: message,
                  icon: 'error',
              });
              setActionBusy(false);
              return;
          }
      }
      // --- END CONFLICT CHECK FOR APPROVAL ---


      const { row, error, blocked } = await updateBooking(
        booking.id,
        updatePayload,
        'id, pending_changes, needs_owner_approval, event_name, event_type, event_date, guest_count, status, start_time, end_time, event_start_at, event_end_at' // Ensured all relevant fields are selected
      );

      if (error) throw error;
      if (blocked) {
        Swal.fire('Not allowed', 'You do not have permission to approve these changes.', 'error');
        return;
      }

      const after = {};
      for (const k of Object.keys(changes)) after[k] = row?.[k] ?? null;

      await safeLog(
        'pending_change_approved',
        { changes, before, after },
        'Owner approved client changes',
        booking.id
      );

      mutateBooking(booking.id, { ...row });
      Swal.fire('Approved', 'Client changes have been applied.', 'success');

    } catch (err) {
      console.error('Approve error:', err?.message || err);
      Swal.fire('Error', err?.message || 'Could not approve changes.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // currency + money helpers
  function getCurrency(b) {
    return b?.currency || b?.theVenues?.currency || 'PHP';
  }
  function formatMoney(n, currency = 'PHP') {
    if (n == null || n === '') return '—';
    const num = Number(n);
    if (Number.isNaN(num)) return String(n);
    return new Intl.NumberFormat(
      currency === 'PHP' ? 'en-PH' : 'en-US',
      { style: 'currency', currency }
    ).format(num);
  }

  const rejectPendingChanges = async (booking) => {
    try {
      setActionBusy(true);

      const { row, error, blocked } = await updateBooking(
        booking.id,
        { pending_changes: null, needs_owner_approval: false },
        'id, pending_changes, needs_owner_approval'
      );

      if (error) throw error;
      if (blocked) {
        Swal.fire('Not allowed', 'You do not have permission to reject these changes.', 'error');
        return;
      }

      mutateBooking(booking.id, { ...row });
      Swal.fire('Rejected', 'Client changes were rejected.', 'success');
      await safeLog('pending_change_rejected', { changes: booking.pending_changes }, 'Owner rejected client changes', booking.id);

    } catch (err) {
      console.error('Reject error:', err?.message || err);
      Swal.fire('Error', err?.message || 'Could not reject changes.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const mutateBooking = (bookingId, patch) => {
    setAllBookings(prev =>
      sortBookings(prev.map(b => (b.id === bookingId ? { ...b, ...patch } : b)))
    );
    setSelectedBooking(prev => (prev && prev.id === bookingId ? { ...prev, ...patch } : prev));
  };

  // Actions renderer (owner vs client)
  const renderActions = (booking) => {
    if (!booking) return null;

    const status = effectiveStatus(booking);

    const iAmOwnerOfThis = ownedVenueIds.includes(booking.venue_id);
    const iAmClient = booking.user_id === userId;

    if (status === 'cancelled' || status === 'completed' || status === 'expired') {
      return null;
    }

    // Show approve/reject for owner if pending changes exist, regardless of status
    if (iAmOwnerOfThis && booking.needs_owner_approval && booking.pending_changes && Object.keys(booking.pending_changes).length > 0) {
        return (
            <>
                <button
                    onClick={() => rejectPendingChanges(booking)}
                    className="btn danger-outline"
                    disabled={actionBusy}
                >
                    Reject Changes
                </button>
                <button
                    onClick={() => approvePendingChanges(booking)}
                    className="btn success-outline"
                    disabled={actionBusy}
                >
                    Approve Changes
                </button>
                {/* Keep existing status actions if needed */}
                {status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction('cancel', booking)}
                      className="btn danger-outline"
                      disabled={actionBusy}
                    >
                      Cancel Booking
                    </button>
                    <button
                      onClick={() => handleAction('confirm', booking)}
                      className="btn success-outline"
                      disabled={actionBusy}
                    >
                      Confirm Booking
                    </button>
                  </>
                )}
                {status === 'confirmed' && (
                  <>
                    <button
                      onClick={() => handleAction('cancel', booking)}
                      className="btn danger-outline"
                      disabled={actionBusy}
                    >
                      Cancel Booking
                    </button>
                    <button
                      onClick={() => handleAction('complete', booking)}
                      className="btn success-outline"
                      disabled={actionBusy}
                    >
                      Mark Completed
                    </button>
                  </>
                )}
            </>
        );
    }

    if (status === 'pending') {
      if (iAmOwnerOfThis) {
        return (
          <>
            <button
              onClick={() => handleAction('cancel', booking)}
              className="btn danger-outline"
              disabled={actionBusy}
            >
              Cancel Booking
            </button>
            <button
              onClick={() => handleAction('confirm', booking)}
              className="btn success-outline"
              disabled={actionBusy}
            >
              Confirm
            </button>
          </>
        );
      }
      if (iAmClient) {
        return (
          <button
            onClick={() => handleAction('cancel', booking)}
            className="btn danger-outline"
            disabled={actionBusy}
          >
            Cancel Booking
          </button>
        );
      }
      return null;
    }

    if (status === 'confirmed') {
      if (iAmOwnerOfThis) {
        return (
          <>
            <button
              onClick={() => handleAction('cancel', booking)}
              className="btn danger-outline"
              disabled={actionBusy}
            >
              Cancel Booking
            </button>
            <button
              onClick={() => handleAction('complete', booking)}
              className="btn success-outline"
              disabled={actionBusy}
            >
              Mark Completed
            </button>
          </>
        );
      }
      return null;
    }

    return null;
  };

  const getStatusColors = (status) => {
    switch (String(status || '').toLowerCase()) {
      case 'pending':   return { bg: '#FEF3C7', color: '#B45309' };
      case 'confirmed': return { bg: '#DCFCE7', color: '#15803D' };
      case 'completed': return { bg: '#DBEAFE', color: '#1D4ED8' };
      case 'cancelled': return { bg: '#FEE2E2', color: '#B91C1C' };
      case 'expired':   return { bg: '#F3F4F6', color: '#6B7280' };
      default:          return { bg: '#E5E7EB', color: '#374151' };
    }
  };

  const isPast = (d) => (d ? dayjs(d).isBefore(dayjs(), 'day') : false);

  function lastUpdatedAt(b) {
    const candidates = [
      b.status_changed_at,
      b.updated_at,
      b.confirmed_at,
      b.completed_at,
      b.cancelled_at,
      b.expired_at,
      b.created_at,
    ].filter(Boolean);
    if (candidates.length === 0) return null;
    return candidates.map((t) => dayjs(t)).sort((a, b) => b.valueOf() - a.valueOf())[0];
  }

  function cmpClosest(a, b) {
    const now = dayjs();
    const da = a.event_date ? dayjs(a.event_date) : null;
    const db = b.event_date ? dayjs(b.event_date) : null;

    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;

    const diffA = da.diff(now, 'minute');
    const diffB = db.diff(now, 'minute');

    const scoreA = diffA >= 0 ? diffA : 1e9 + Math.abs(diffA);
    const scoreB = diffB >= 0 ? diffB : 1e9 + Math.abs(diffB);

    return scoreA - scoreB;
  }

  function cmpNewest(a, b) {
    const la = lastUpdatedAt(a);
    const lb = lastUpdatedAt(b);
    if (!la && !lb) return 0;
    if (!la) return 1;
    if (!lb) return -1;
    return lb.valueOf() - la.valueOf();
  }

  function effectiveStatus(b) {
    const raw = String(b?.status || '').toLowerCase();

    if (raw === 'pending') {
      const pastDate = isPast(b?.event_date);
      const createdAt = b?.created_at ? dayjs(b.created_at) : null;
      const slaExpired = createdAt ? dayjs().diff(createdAt, 'hour') >= PENDING_SLA_HOURS : false;

      if (pastDate || slaExpired) return 'expired';
      return 'pending';
    }

    if (raw === 'confirmed') {
      if (isPast(b?.event_date)) return 'completed';
      return 'confirmed';
    }

    return raw;
  }

  const tabNotifs = useMemo(() => {
    const base = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, expired: 0 };

    for (const b of allBookings) {
      const status = effectiveStatus(b);
      const hasUnread = (bookingsUnreadByBooking[b.id] || 0) > 0;

      const needsApproval =
        ownedVenueIds.includes(b.venue_id) &&
        b.needs_owner_approval; // Only check needs_owner_approval for owner

      if ((hasUnread || needsApproval) && Object.prototype.hasOwnProperty.call(base, status)) {
        base[status] += 1;
      }
    }
    return base;
  }, [allBookings, bookingsUnreadByBooking, ownedVenueIds]);

  const confirmedByDate = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      if (effectiveStatus(b) !== 'confirmed') continue;
      if (!b.event_date) continue;
      const k = dayjs(b.event_date).format('YYYY-MM-DD');
      (map[k] ||= []).push(b);
    }
    return map;
  }, [allBookings]);

  const pendingByDate = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      if (effectiveStatus(b) !== 'pending') continue;
      if (!b.event_date) continue;
      const k = dayjs(b.event_date).format('YYYY-MM-DD');
      (map[k] ||= []).push(b);
    }
    return map;
  }, [allBookings]);

  const eventTypeOptions = useMemo(() => {
    const set = new Set();
    for (const b of allBookings) {
      const t = (b.event_type || '').trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allBookings]);

  const venueOptions = useMemo(() => {
    const map = new Map();
    for (const b of allBookings) {
      if (b.venue_id) {
        const name = b.theVenues?.name || 'Unnamed venue';
        map.set(b.venue_id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBookings]);

  const filteredBase = useMemo(
    () => allBookings.filter((b) => effectiveStatus(b) === selectedTab),
    [allBookings, selectedTab]
  );

  const filteredAdvanced = useMemo(() => {
    return filteredBase.filter((b) => {
      if (eventTypeFilter !== 'all' && (b.event_type || '') !== eventTypeFilter) return false;
      if (venueFilter !== 'all' && b.venue_id !== venueFilter) return false;

      if (onlyPendingChanges) {
        const iAmOwnerOfThis = ownedVenueIds.includes(b.venue_id);
        const hasPending =
          !!b.needs_owner_approval &&
          b.pending_changes &&
          Object.keys(b.pending_changes).length > 0;
        if (!(iAmOwnerOfThis && hasPending)) return false;
      }

      return true;
    });
  }, [filteredBase, eventTypeFilter, venueFilter, onlyPendingChanges, ownedVenueIds]);

  const visible = useMemo(() => {
    const arr = [...filteredAdvanced];
    if (sortMode === 'closest') {
      arr.sort(cmpClosest);
    } else {
      arr.sort(cmpNewest);
    }
    return arr;
  }, [filteredAdvanced, sortMode]);

  const calendarBookings = useMemo(() => {
    return allBookings.filter(b =>
      ['pending', 'confirmed'].includes(effectiveStatus(b))
    );
  }, [allBookings]);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const b of calendarBookings) {
      if (!b.event_date) continue;
      const k = dayjs(b.event_date).format('YYYY-MM-DD');
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return m;
  }, [calendarBookings]);

  const [dayList, setDayList] = useState({ open: false, date: null, items: [] });

  const openDayList = (iso) => {
    const items = byDate.get(iso) || [];
    if (items.length === 1) {
      setSelectedBooking(items[0]);
      return;
    }
    if (items.length > 1) {
      setDayList({
        open: true,
        date: iso,
        items: items
          .slice()
          .sort(
            (a, b) =>
              (a.start_time || '').localeCompare(b.start_time || '') ||
              (a.theVenues?.name || '').localeCompare(b.theVenues?.name || '')
          ),
      });
    }
  };

  const renderDateCell = (dateObj) => {
    const iso = dayjs(dateObj).format('YYYY-MM-DD');
    const items = byDate.get(iso) || [];
    const total = items.length;
    const confirmedCount = items.filter(b => String(b.status).toLowerCase() === 'confirmed').length;
    const pendingCount   = items.filter(b => String(b.status).toLowerCase() === 'pending').length;
    const hasAny = total > 0;

    return (
      <button
        type="button"
        className={`cal-day ${hasAny ? 'has' : ''}`}
        onClick={() => hasAny && openDayList(iso)}
        aria-label={
          hasAny
            ? `${dayjs(dateObj).format('MMMM D')}: ${total} bookings`
            : dayjs(dateObj).format('MMMM D')
        }
      >
        <span className="cal-num">{dayjs(dateObj).date()}</span>

        {hasAny && (
          <>
            <div className="cal-dots" aria-hidden="true">
              {confirmedCount > 0 && <span className="cal-dot cal-dot-confirmed" title={`${confirmedCount} confirmed`} />}
              {pendingCount > 0 && <span className="cal-dot cal-dot-pending" title={`${pendingCount} pending`} />}
            </div>

            {total > 1 && (
              <span className="cal-count" title={`${total} bookings`}>{total}</span>
            )}
          </>
        )}
      </button>
    );
  };

  const safeLog = async (
    type,
    details = {},
    message = '',
    bookingId = selectedBooking?.id
  ) => {
    try {
      if (!bookingId) return;

      const at = new Date().toISOString();
      const localEntry = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        booking_id: bookingId,
        type,
        details,
        message,
        at,
        actor: userId || null,
      };

      setActivity(prev => [localEntry, ...prev]);

      const cached = loadLocalActivity(bookingId);
      saveLocalActivity(bookingId, [localEntry, ...cached]);

      if (!hasActivityTable) return;

      const { data, error } = await supabase
        .from('booking_activity')
        .insert({
          booking_id: bookingId,
          type,
          details,
          message,
          at,
          actor: userId || null,
        })
        .select()
        .single();

      if (error) {
        const code = error.code || '';
        const msg  = String(error.message || '');
        if (
          /(42P01|42501|42703)/.test(code) ||
          /relation .* does not exist|permission|policy|column .* does not exist/i.test(msg)
        ) {
          setHasActivityTable(false);
          console.warn('[activity] logging disabled:', msg || code);
        }
        return;
      }

      if (data) {
        setActivity(prev => [data, ...prev.filter(e => e.id !== localEntry.id)]);
        const updatedCache = loadLocalActivity(bookingId).filter(e => e.id !== localEntry.id);
        saveLocalActivity(bookingId, [data, ...updatedCache]);
      }
    } catch (err) {
      console.warn('[activity] safeLog failed (local-only):', err);
    }
  };

  const isDirectModifyBlocked = (err) => {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    return (
      msg.includes('cannot directly modify booking details') ||
      msg.includes('submit a change request') ||
      err.code === 'P0001' ||
      err.code === '42501'
    );
  };

  const handleChat = async (booking, e) => {
    e?.stopPropagation?.();

    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      alert('Please log in to chat.');
      return;
    }
    if (!booking) return;

    const iAmOwnerOfThis = ownedVenueIds.includes(booking.venue_id);
    const toUserId = iAmOwnerOfThis ? booking.user_id : booking?.theVenues?.user_id;

    if (!toUserId) {
      alert('Chat recipient not found.');
      return;
    }

    setChatOtherUserId(toUserId);
    setShowChat(true);
  };

  const PastBadge = () => (
    <span className="status-pill past" title="Past">
      <FiAlertTriangle style={{ verticalAlign: '-2px', marginRight: 4 }} />
      <span>Past</span>
    </span>
  );

  useEffect(() => {
    if (selectedBooking?.id && userId && typeof markBookingNotificationsRead === 'function') {
      markBookingNotificationsRead(userId, selectedBooking.id);
      markBookingSeen(selectedBooking.id);
    }
  }, [selectedBooking?.id, userId, markBookingNotificationsRead]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!selectedBooking?.id) { setActivity([]); return; }
      try {
        const { data, error } = await supabase
          .from('booking_activity')
          .select('*')
          .eq('booking_id', selectedBooking.id)
          .order('at', { ascending: false })
          .limit(200);

        if (error) {
          if (/relation .* does not exist/i.test(error.message) || error.code === '42P01') {
            if (!aborted) setHasActivityTable(false);
            return;
          }
          throw error;
        }
        if (!aborted) {
          setHasActivityTable(true);
          const locals = loadLocalActivity(selectedBooking.id) || [];
          const merged = [...locals, ...(data || [])].sort(
            (a, b) => dayjs(b.at || b.created_at).valueOf() - dayjs(a.at || a.created_at).valueOf()
          );
          setActivity(merged);
        }

      } catch {
        if (!aborted) setHasActivityTable(false);
      }
    })();
    return () => { aborted = true; };
  }, [selectedBooking?.id]);

  const derivedActivity = useMemo(() => {
    const items = [];
    const b = selectedBooking;
    if (!b) return items;

    if (b.created_at) {
      items.push({
        at: b.created_at,
        type: 'created',
        summary: 'Booking requested',
      });
    }

    if (b.status) {
      const eff = effectiveStatus(b);
      const at =
        b.status_changed_at || b.confirmed_at || b.cancelled_at || b.completed_at || b.expired_at ||
        b.updated_at || b.created_at;
      items.push({
        at,
        type: 'status_change',
        details: { new_status: eff },
        summary: `Status: ${prettyStatus(eff)}`,
      });

      const raw = String(b.status || '').toLowerCase();
      if (raw === 'pending') {
        const createdAt = b?.created_at ? dayjs(b.created_at) : null;
        const slaExpired = createdAt ? dayjs().diff(createdAt, 'hour') >= PENDING_SLA_HOURS : false;
        if (isPast(b.event_date) || slaExpired) {
          items.push({
            at: b.updated_at || b.created_at,
            type: 'notice',
            summary: 'Automatically marked as Expired (pending too long or date passed)',
          });
        }
      } else if (raw === 'confirmed' && isPast(b.event_date)) {
        items.push({
          at: b.updated_at || b.event_date,
          type: 'notice',
          summary: 'Automatically shown as Completed (event date passed)',
        });
      }
    }

    if (b.needs_owner_approval && b.pending_changes && Object.keys(b.pending_changes).length > 0) {
      items.push({
        at: b.updated_at || b.created_at,
        type: 'pending_change_requested',
        details: { changes: b.pending_changes },
        summary: 'Client requested changes',
      });
    }

    return items;
  }, [selectedBooking]);

  const SEEN_KEY = (id) => `bk-seen:${id}`;
  const markBookingSeen = (id) => {
    try { localStorage.setItem(SEEN_KEY(id), new Date().toISOString()); } catch {}
  };
  const isUnseenAct = (id, act) => {
    if (!act?.at) return false;
    try {
      const seenIso = localStorage.getItem(SEEN_KEY(id));
      if (!seenIso) return true;
      return dayjs(act.at).isAfter(dayjs(seenIso));
    } catch { return true; }
  };

  function toIsoTs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const t = /^\d{2}:\d{2}$/.test(timeStr) ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${t}`).toISOString();
  }

  function buildEventTimestamps(dateStr, startTime, endTime) {
    if (!dateStr || !startTime || !endTime) return { startAt: null, endAt: null };
    const s = /^\d{2}:\d{2}$/.test(startTime) ? `${startTime}:00` : startTime;
    const e = /^\d{2}:\d{2}$/.test(endTime)   ? `${endTime}:00`   : endTime;

    const sameDayStartISO = toIsoTs(dateStr, s);
    const endSameDayISO   = toIsoTs(dateStr, e);

    if (s < e) {
      return { startAt: sameDayStartISO, endAt: endSameDayISO };
    } else {
      const nextDay = dayjs(dateStr).add(1, 'day').format('YYYY-MM-DD');
      return { startAt: sameDayStartISO, endAt: toIsoTs(nextDay, e) };
    }
  }

  const activityMerged = useMemo(() => {
    const dbStatusChanges = new Set();
    if (Array.isArray(activity)) {
      for (const it of activity) {
        if (String(it?.type || '').toLowerCase() === 'status_change') {
          const ns = String(it?.details?.new_status || '').toLowerCase();
          dbStatusChanges.add(ns || '*');
        }
      }
    }

    const norm = (it, src) => ({
      id: it.id ?? null,
      at: it.at || it.created_at || it.timestamp || new Date().toISOString(),
      type: it.type,
      details: it.details || {},
      message: it.message || it.summary || '',
      actor: it.actor ?? null,
      _src: src,
    });

    const raw = [];

    if (Array.isArray(activity)) raw.push(...activity.map(x => norm(x, 'db')));

    if (Array.isArray(derivedActivity)) {
      for (const d of derivedActivity) {
        const isStatus = String(d?.type || '').toLowerCase() === 'status_change';
        const ns = String(d?.details?.new_status || '').toLowerCase();
        if (isStatus && (dbStatusChanges.size > 0 && (dbStatusChanges.has('*') || dbStatusChanges.has(ns)))) {
          continue;
        }
        raw.push(norm(d, 'derived'));
      }
    }

    const seen = new Set();
    const out = [];
    for (const x of raw) {
      const k = x.id != null ? `db:${x.id}` : `drv:${x.type}:${x.at}:${x.message}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...x, _k: k });
    }

    return out.sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());
  }, [activity, derivedActivity]);

if (loading) {
  return (
    <div className="page" style={{ padding: 10, paddingBottom: 70 }}>
      <div className="booking-shell">
        <Header
          loading
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          counts={{}}
          showCalendar={showCalendar}
          setShowCalendar={setShowCalendar}
        />

        {/* ✅ Skeleton is constrained to same width as real cards */}
        <div className="bk-sk-container">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bk-sk-card">
              <div className="bk-sk-title" />
              <div className="bk-sk-line w-70" />
              <div className="bk-sk-line w-50" />
              <div className="bk-sk-chip" />
            </div>
          ))}
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}



 if (noUser) {
  return (
    <div className="page" style={{ padding: 10 }}>
      <div className="booking-shell">
        <Header
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          counts={tabNotifs}
          showCalendar={showCalendar}
          setShowCalendar={setShowCalendar}
        />
        <Card>
          <p style={{ fontSize: 16, marginBottom: 12 }}>
            You need to log in to view your bookings.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const event = new CustomEvent('openLoginModal');
                window.dispatchEvent(event);
                setTimeout(() => navigate('/login'), 50);
              }}
              className="btn primary"
            >
              Log In
            </button>
            <button onClick={() => navigate('/venue-map')} className="btn ghost">
              Explore Venues
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

return (
  <div className="page" style={{ padding: 10 }}>
    {/* ✅ Shared centered shell */}
    <div className="booking-shell">
      <Header
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        counts={tabNotifs}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
      />

      {showCalendar ? (
        // ✅ CALENDAR VIEW: no FiltersBar here anymore
        <CalendarView
          monthDate={calMonth}
          setMonthDate={setCalMonth}
          confirmedByDate={confirmedByDate}
          pendingByDate={pendingByDate}
          onOpenDate={openDayList}
        />
      ) : allBookings.length === 0 ? (
        <Card center>
          <p style={{ fontSize: 16, marginBottom: 12 }}>You haven’t made any bookings yet.</p>
          <button onClick={() => navigate('/venue-map')} className="btn primary">
            Find a Venue
          </button>
        </Card>
      ) : (
        <>
          {/* ✅ LIST VIEW: Filters stay here */}
          <FiltersBar
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            sortMode={sortMode}
            setSortMode={setSortMode}
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            venueFilter={venueFilter}
            setVenueFilter={setVenueFilter}
            onlyPendingChanges={onlyPendingChanges}
            setOnlyPendingChanges={setOnlyPendingChanges}
            eventTypeOptions={eventTypeOptions}
            venueOptions={venueOptions}
            isOwner={isOwner}
          />
          {visible.length > 0 ? (
            <div className="booking-grid">
              {visible.map((b) => {
                const statusEff = effectiveStatus(b);
                const colors = getStatusColors(statusEff);
                const past = isPast(b.event_date);

                const iAmOwnerOfThis = ownedVenueIds.includes(b.venue_id);
                const isMine = b.user_id === userId;
                const iAmClient = isMine;
                const role = isMine ? 'mine' : (iAmOwnerOfThis ? 'incoming' : 'other');

                const unreadCount = Number(bookingsUnreadByBooking[b.id] || 0);
                const needsApproval =
                  ownedVenueIds.includes(b.venue_id) &&
                  !!b.needs_owner_approval &&
                  b.pending_changes &&
                  Object.keys(b.pending_changes).length > 0;

                const awaitingApprovalClient =
                  iAmClient &&
                  !!b.needs_owner_approval &&
                  b.pending_changes &&
                  Object.keys(b.pending_changes).length > 0;

                const lastAct = latestActByBooking[b.id] || null;
                const approvedForClient =
                  iAmClient &&
                  lastAct?.type === 'pending_change_approved' &&
                  isUnseenAct(b.id, lastAct);

                const rejectedForClient =
                  iAmClient &&
                  lastAct?.type === 'pending_change_rejected' &&
                  isUnseenAct(b.id, lastAct);

                const confirmedForClient =
                  iAmClient &&
                  lastAct?.type === 'status_change' &&
                  String(lastAct?.details?.new_status || '').toLowerCase() === 'confirmed' &&
                  isUnseenAct(b.id, lastAct);

                const capBadge = (n) => (n > 99 ? '99+' : String(n));
                const showAnyBadge =
                  (iAmOwnerOfThis && needsApproval) ||
                  unreadCount > 0 ||
                  (iAmClient && (approvedForClient || rejectedForClient || confirmedForClient));

                const notice = (() => {
                  if (!iAmClient) return null;

                  if (awaitingApprovalClient) {
                    return { text: 'Waiting for owner approval', tone: 'warn', showDot: true };
                  }

                  if (lastAct && isUnseenAct(b.id, lastAct)) {
                    if (lastAct.type === 'pending_change_approved') {
                      return { text: 'Your requested changes were approved', tone: 'ok', showDot: true };
                    }
                    if (lastAct.type === 'pending_change_rejected') {
                      return { text: 'Your requested changes were rejected', tone: 'red', showDot: true };
                    }
                    if (lastAct.type === 'status_change') {
                      const ns = String(lastAct?.details?.new_status || '').toLowerCase();
                      if (ns === 'confirmed')  return { text: 'Your booking was confirmed',  tone: 'ok',  showDot: true };
                      if (ns === 'cancelled')  return { text: 'Your booking was cancelled',  tone: 'red', showDot: true };
                      if (ns === 'completed')  return { text: 'Your booking was marked completed', tone: 'info', showDot: true };
                    }
                  }
                  return null;
                })();

                const ownerNotice = (() => {
                  if (!iAmOwnerOfThis) return null;

                  if (needsApproval) {
                    if (lastAct?.type === 'pending_change_requested' && isUnseenAct(b.id, lastAct)) {
                      return { text: 'Client requested changes — review now', tone: 'warn', showDot: true };
                    }
                    return { text: 'Client requested changes — review', tone: 'warn', showDot: false };
                  }

                  return null;
                })();

                return (
                  <div
                    key={`${b.id}-${b.created_at}`}
                    className={`booking-card ${role}`}
                    onClick={() => setSelectedBooking(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedBooking(b)}
                    aria-label={
                      `${b.event_name}, ${prettyStatus(statusEff)} — ` +
                      (role === 'mine' ? 'Your request' :
                      role === 'incoming' ? 'Client request' : 'Other') +
                      (unreadCount > 0 ? ` — ${unreadCount} updates` : '') +
                      (awaitingApprovalClient ? ' — awaiting approval' : '') +
                      (approvedForClient ? ' — changes approved' : '')+
                      (rejectedForClient ? ' — changes rejected' : '')+
                      (confirmedForClient ? ' — confirmed' : '')
                    }
                  >
                    {showAnyBadge ? (
                      <div className="bk-badges" aria-hidden="true">
                        {iAmOwnerOfThis && needsApproval && (
                          <span
                            className="bk-badge bk-badge-warn"
                            title="Client requested changes — review"
                            aria-label="Client requested changes — review"
                          >
                            Review
                          </span>
                        )}

                        {unreadCount > 0 && (
                          <span
                            className="bk-badge"
                            title={`${unreadCount} update${unreadCount > 1 ? 's' : ''}`}
                            aria-label={`${unreadCount} updates`}
                          >
                            {capBadge(unreadCount)}
                          </span>
                        )}

                        {iAmClient && confirmedForClient && (
                          <span
                            className="bk-badge bk-badge-ok"
                            title="Booking confirmed"
                            aria-label="Booking confirmed"
                          >
                            New
                          </span>
                        )}
                        {iAmClient && approvedForClient && (
                          <span
                            className="bk-badge bk-badge-ok"
                            title="Changes approved"
                            aria-label="Changes approved"
                          >
                            OK
                          </span>
                        )}
                        {iAmClient && rejectedForClient && (
                          <span
                            className="bk-badge"
                            title="Changes rejected"
                            aria-label="Changes rejected"
                          >
                            !
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        {notice?.showDot && (
                          <span className={`bk-dot ${notice.tone}`} aria-label="New update" />
                        )}
                        {ownerNotice?.showDot && (
                          <span className={`bk-dot ${ownerNotice.tone}`} aria-label="Action needed" />
                        )}
                      </>
                    )}

                    <div className="booking-card__head">
                      <h3 className="booking-title">{b.event_name}</h3>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {past && <PastBadge />}
                        <span
                          className="status-pill"
                          style={{ backgroundColor: colors.bg, color: colors.color }}
                        >
                          <span className="status-dot" />
                          {prettyStatus(statusEff)}
                        </span>
                      </div>
                    </div>

                    <div className="booking-card__meta">
                      {role === 'incoming' && (
                        <div className="meta-row">
                          <span className="meta-label">From</span>
                          <span className="meta-value">
                            <span className="meta-user">
                              <span className="meta-username">
                                {b.profiles?.username || 'Client'}
                              </span>
                              <Avatar
                                size={20}
                                src={b.profiles?.avatar_url}
                                alt={b.profiles?.username || 'Client'}
                              />
                            </span>
                          </span>
                        </div>
                      )}

                      <div className="meta-row">
                        <span className="meta-label">Venue</span>
                        <span className="meta-value">{b.theVenues?.name || '—'}</span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-label">Date</span>
                        <span className="meta-value">
                          {b.event_date ? dayjs(b.event_date).format('MMMM D, YYYY') : '—'}
                        </span>
                      </div>

                      <div className="meta-row">
                        <span className="meta-label">
                          {statusEff === 'pending' ? 'Requested' : 'Status'}
                        </span>
                        <span className="meta-value" style={{display:'flex', alignItems: 'center', gap: '4px'}}>
                          {(() => {
                            const currentStatusColors = getStatusColors(statusEff);
                            if (statusEff === 'pending') {
                              return dayjs(b.created_at).fromNow();
                            } else if (statusEff === 'confirmed') {
                              const time = b.confirmed_at || b.updated_at || b.created_at;
                              return <><span className="status-dot" style={{ backgroundColor: currentStatusColors.color }} />Confirmed {dayjs(time).fromNow()}</>;
                            } else if (statusEff === 'completed') {
                              const time = b.completed_at || b.updated_at || b.created_at;
                              return <><span className="status-dot" style={{ backgroundColor: currentStatusColors.color }} />Completed {dayjs(time).fromNow()}</>;
                            } else if (statusEff === 'cancelled') {
                              const time = b.cancelled_at || b.updated_at || b.created_at;
                              return <><span className="status-dot" style={{ backgroundColor: currentStatusColors.color }} />Cancelled {dayjs(time).fromNow()}</>;
                            } else if (statusEff === 'expired') {
                              const time = b.updated_at || b.created_at;
                              return <><span className="status-dot" style={{ backgroundColor: currentStatusColors.color }} />Expired {dayjs(time).fromNow()}</>;
                            }
                            return dayjs(b.created_at).fromNow();
                          })()}
                        </span>
                      </div>

                      {notice && (
                        <div className={`bk-card-note ${notice.tone}`} role="status">
                          {!/^[!]/.test(notice.text) ? <>{notice.text}</> : notice.text}
                        </div>
                      )}

                      {ownerNotice && (
                        <div className={`bk-card-note ${ownerNotice.tone}`} role="status">
                          {ownerNotice.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card center>
              <p style={{ fontSize: 16, marginBottom: 0 }}>
                {selectedTab === 'pending' && 'No requests match your filters.'}
                {selectedTab === 'confirmed' && 'No confirmed bookings match your filters.'}
                {selectedTab === 'completed' && 'No completed bookings match your filters.'}
                {selectedTab === 'cancelled' && 'No cancelled bookings match your filters.'}
                {selectedTab === 'expired' && 'No expired bookings match your filters.'}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
      {/* ---------- Details Modal ---------- */}
      {selectedBooking && (
        <div
          className="modal-overlay"
          onClick={() => {
            setSelectedBooking(null);
            setEditingField(null);
            setEditValues({});
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-title-row">
              <h2 className="modal-title">{selectedBooking.event_name}</h2>

              <div className="modal-title-right">
                {selectedBooking.event_date && isPast(selectedBooking.event_date) && (
                  <div className="alert past alert-xs">
                    <FiAlertTriangle className="alert__icon" />
                    <span>Past</span>
                  </div>
                )}
                {(() => {
                  const eff = effectiveStatus(selectedBooking);
                  const col = getStatusColors(eff);
                  return (
                    <span
                      className="status-pill"
                      style={{ backgroundColor: col.bg, color: col.color }}
                      title={`Status: ${prettyStatus(eff)}`}
                    >
                      <span className="status-dot" />
                      {prettyStatus(eff)}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="modal-section">
              {[
                { label: 'Event Name', field: 'event_name' },
                { label: 'Event Type', field: 'event_type' },
                { label: 'Date', field: 'event_date' },
                { label: 'Guest Count', field: 'guest_count', hint: selectedBooking?.theVenues?.capacity_max ? `Max: ${selectedBooking.theVenues.capacity_max}` : '' },
              ].map(({ label, field, editable = true, hint }) => {
                const value = field === 'theVenues.name'
                  ? selectedBooking?.theVenues?.name
                  : selectedBooking?.[field];

                const isEditing = editingField === field;
                const inputType =
                  field === 'event_date' ? 'date' :
                  field === 'guest_count' ? 'number' : 'text';

                const rightAddon =
                  field === 'theVenues.name' && selectedBooking?.venue_id ? (
                    <button
                      className="icon-btn"
                      title="Open venue details"
                      onClick={() => navigate(`/venues/${selectedBooking.venue_id}`)}
                    >
                      <FiExternalLink />
                    </button>
                  ) : null;

                const eff = effectiveStatus(selectedBooking);
                const iAmClientHere = selectedBooking?.user_id === userId;
                const iAmOwnerHere  = ownedVenueIds.includes(selectedBooking?.venue_id);

                let canEdit = editable && !['cancelled','completed','expired'].includes(eff);

                // If owner, always allow editing unless status is final. Client can only edit if pending or needs approval.
                if (iAmClientHere) {
                  canEdit = canEdit && (eff === 'pending' || (eff === 'confirmed' && selectedBooking.needs_owner_approval));
                }
                // Owners can always edit if not cancelled/completed/expired, as they manage directly
                if (iAmOwnerHere) {
                    canEdit = editable && !['cancelled','completed','expired'].includes(eff);
                }


                return (
                  <div key={field} className="row-edit">
                    <label className="row-label"><strong>{label}</strong></label>
                    <div className="row-editor">
                      {isEditing ? (
                        field === 'event_type' ? (
                          <select
                            value={editValues[field] ?? ''}
                            onChange={(e) => handleEditChange(field, e.target.value)}
                            onBlur={() => saveEdit(field)}
                            autoFocus
                            className="input"
                          >
                            <option value="">Select event type</option>
                            {EVENT_TYPES.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={inputType}
                            value={editValues[field] ?? ''}
                            onChange={(e) => handleEditChange(field, e.target.value)}
                            onBlur={() => saveEdit(field)}
                            autoFocus
                            className="input"
                            min={field === 'guest_count' ? 1 : undefined}
                            max={
                              field === 'guest_count' && selectedBooking?.theVenues?.capacity_max
                                ? Number(selectedBooking.theVenues.capacity_max)
                                : undefined
                            }
                            // Added pattern for time-like inputs to enforce HH:MM
                            pattern={inputType === 'time' ? '^([01]\\d|2[0-3]):?([0-5]\\d)$' : undefined}
                          />
                        )
                      ) : (
                        <span>
                          {field === 'event_date'
                            ? (value ? dayjs(value).format('MMMM D, YYYY') : '—')
                            : (String(value ?? '—'))}
                        </span>
                      )}

                      {hint && !isEditing && <span className="hint">{hint}</span>}

                      {canEdit && !isEditing && (
                        <FaEdit
                          className="edit-icon"
                          onClick={() => handleEdit(field)}
                          title="Edit"
                        />
                      )}

                      {rightAddon}
                    </div>

                    {field === 'event_date' && isPast(selectedBooking.event_date) && (
                      <div className="muted" style={{ marginTop: 4 }}>
                        This date has already passed.
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="row-edit">
                <label className="row-label"><strong>Event Time</strong></label>
                <div className="row-editor" style={{ gap: 8, alignItems: 'center' }}>
                  {editingField === 'time_range' ? (
                    <>
                      <input
                        type="time"
                        className="input"
                        defaultValue={
                          /^\d{2}:\d{2}/.test(selectedBooking?.start_time || '')
                            ? selectedBooking.start_time.slice(0,5)
                            : ''
                        }
                        onChange={(e) => handleEditChange('start_time_tmp', e.target.value)}
                        autoFocus
                        pattern="^([01]\d|2[0-3]):?([0-5]\d)$"
                      />
                      <span style={{ color: '#6b7280' }}>–</span>
                      <input
                        type="time"
                        className="input"
                        defaultValue={
                          /^\d{2}:\d{2}/.test(selectedBooking?.end_time || '')
                            ? selectedBooking.end_time.slice(0,5)
                            : ''
                        }
                        onChange={(e) => handleEditChange('end_time_tmp', e.target.value)}
                        pattern="^([01]\d|2[0-3]):?([0-5]\d)$"
                      />
                      <button
                        className="btn primary"
                        onClick={() => saveTimeRange(editValues.start_time_tmp, editValues.end_time_tmp)}
                        disabled={actionBusy} // Disable while action is busy
                      >
                        {actionBusy ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1 }}>
                        {selectedBooking?.start_time && selectedBooking?.end_time
                          ? `${to12hCompact(selectedBooking.start_time)} – ${to12hCompact(selectedBooking.end_time)}`
                          : '—'}
                      </span>
                      {(() => {
                        const eff = effectiveStatus(selectedBooking);
                        const iAmClient = selectedBooking?.user_id === userId;
                        const iAmOwnerOfThis = ownedVenueIds.includes(selectedBooking?.venue_id);
                        const canEditTime =
                          (iAmClient && (eff === 'pending' || (eff === 'confirmed' && selectedBooking.needs_owner_approval))) ||
                          (iAmOwnerOfThis && !['completed','cancelled','expired'].includes(eff));

                        return canEditTime ? (
                          <FaEdit
                            className="edit-icon"
                            onClick={() => {
                              setEditingField('time_range');
                              setEditValues(prev => ({
                                ...prev,
                                start_time_tmp: /^\d{2}:\d{2}/.test(selectedBooking?.start_time || '') ? selectedBooking.start_time.slice(0,5) : '',
                                end_time_tmp:   /^\d{2}:\d{2}/.test(selectedBooking?.end_time   || '') ? selectedBooking.end_time.slice(0,5)   : '',
                              }));
                            }}
                            title="Edit time"
                          />
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              </div>

              <div className="row-edit">
                <label className="row-label"><strong>Venue Rate</strong></label>
                <div className="row-editor">
                  <span style={{ flex: 1 }}>
                    {(() => {
                      const cur = getCurrency(selectedBooking);
                      const venueRate =
                        selectedBooking?.venue_rate ??
                        selectedBooking?.theVenues?.rate ??
                        selectedBooking?.theVenues?.price ?? null;
                      return formatMoney(venueRate, cur);
                    })()}
                  </span>
                </div>
              </div>

              <div className="row-edit">
                <label className="row-label"><strong>Reservation Fee</strong></label>
                <div className="row-editor">
                  <span style={{ flex: 1 }}>
                    {(() => {
                      const cur = getCurrency(selectedBooking);
                      const fee =
                        selectedBooking?.reservation_fee ??
                        selectedBooking?.downpayment ??
                        selectedBooking?.deposit ?? null;
                      return formatMoney(fee, cur);
                    })()}
                  </span>

                  {(() => {
                    const paid =
                      selectedBooking?.reservation_paid === true ||
                      /^(paid|settled)$/i.test(String(
                        selectedBooking?.reservation_status || selectedBooking?.payment_status || ''
                      ));

                    return (
                      <span className={`chip ${paid ? 'ok' : 'red'}`}>
                        {paid ? 'Paid' : 'Unpaid'}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="row-edit">
                <label className="row-label"><strong>Venue</strong></label>
                <div className="row-editor">
                  <span style={{ flex: 1 }}>
                    {selectedBooking?.theVenues?.name || '—'}
                  </span>

                  {selectedBooking?.venue_id && (
                    <button
                      className="icon-btn"
                      title="Open venue details"
                      onClick={() => navigate(`/venues/${selectedBooking.venue_id}`)}
                      aria-label="Open venue details"
                    >
                      <FiExternalLink />
                    </button>
                  )}
                </div>
              </div>

              <div className="row-edit">
                <label className="row-label"><strong>Submitted by</strong></label>
                <div className="row-editor">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      size={35}
                      src={selectedBooking?.profiles?.avatar_url}
                      alt={selectedBooking?.profiles?.username || 'User'}
                    />
                    <div>
                      {selectedBooking.user_id === userId
                        ? 'You'
                        : (selectedBooking.profiles?.username || 'Unknown')}
                        <div className="muted">{dayjs(selectedBooking.created_at).fromNow()}</div>
                    </div>

                  </div>

                  <button
                    className="icon-btn"
                    title="Message"
                    onClick={(e) => handleChat(selectedBooking, e)}
                    disabled={
                      (!ownedVenueIds.includes(selectedBooking.venue_id) &&
                      selectedBooking.user_id === userId &&
                      !selectedBooking?.theVenues?.user_id)
                    }
                  >
                    <FiMessageSquare />
                  </button>
                </div>
              </div>

              {/* Pending client changes (owner view) */}
              {ownedVenueIds.includes(selectedBooking.venue_id) &&
                selectedBooking.needs_owner_approval &&
                selectedBooking.pending_changes &&
                Object.keys(selectedBooking.pending_changes).length > 0 && (
                <div className="pending-box">
                  <div className="pending-head">
                    <strong>Client change requests</strong>
                  </div>
                  <div className="pending-list">
                    {Object.entries(selectedBooking.pending_changes).map(([field, newVal]) => {
                      const labelMap = {
                        event_name: 'Event Name',
                        event_type: 'Event Type',
                        event_date: 'Date',
                        guest_count: 'Guest Count',
                        start_time: 'Start Time', // Added for time range
                        end_time: 'End Time',     // Added for time range
                      };
                      const current =
                        field === 'event_date'
                          ? selectedBooking?.event_date
                          : selectedBooking?.[field];

                      return (
                        <div key={field} className="pending-row">
                          <div className="pending-field">{labelMap[field] || field}</div>
                          <div className="pending-current">{pretty(field, current)}</div>
                          <div className="pending-arrow">→</div>
                          <div className="pending-proposed">{pretty(field, newVal)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pending-actions">
                    <button
                      className="btn danger-outline"
                      onClick={() => rejectPendingChanges(selectedBooking)}
                      disabled={actionBusy}
                    >
                      Reject
                    </button>
                    <button
                      className="btn success-outline"
                      onClick={() => approvePendingChanges(selectedBooking)}
                      disabled={actionBusy}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {renderActions(selectedBooking)}
            </div>
            <ActivityLog items={activityMerged} me={userId} />
          </div>
        </div>
      )}

      {dayList.open && (
        <div
          className="modal-overlay"
          onClick={() => setDayList({ open: false, date: null, items: [] })}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title" style={{ marginBottom: 6 }}>
              Bookings on {dayjs(dayList.date).format('MMMM D, YYYY')}
            </h3>

            <div className="daylist">
              {dayList.items.map((b) => (
                <button
                  key={b.id}
                  className="daylist-row"
                  onClick={() => {
                    setSelectedBooking(b);
                    setDayList({ open: false, date: null, items: [] });
                  }}
                >
                  <div className="daylist-main">
                    <strong style={{ color: '#111827' }}>{b.event_name}</strong>
                    <div className="daylist-sub">
                      {b.start_time && b.end_time
                        ? `${to12hCompact(b.start_time)}–${to12hCompact(b.end_time)}`
                        : 'Time N/A'} • {b.theVenues?.name || '—'}
                    </div>
                  </div>

                  <span
                    className={`badge ${ effectiveStatus(b) === 'confirmed' ? 'ok' : effectiveStatus(b) === 'completed' ? 'ok' : 'warn' }`}
                  >
                    {prettyStatus(effectiveStatus(b))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ChatModal
        key={`${selectedBooking?.id || 'none'}:${chatOtherUserId || 'none'}`}
        isOpen={showChat && !!chatOtherUserId}
        onClose={() => {
          setShowChat(false);
          setChatOtherUserId(null);
        }}
        venue={selectedBooking?.theVenues || null}
        otherUserId={chatOtherUserId}
      />

      <style>{styles}</style>
    </div>
  );
}
/* -------------------------------- Calendar View -------------------------------- */

function CalendarView({ monthDate, setMonthDate, confirmedByDate, pendingByDate, onOpenDate }) { const month = dayjs(monthDate);
  const startOfMonth = month.startOf('month');
  const endOfMonth = month.endOf('month');
  const daysInMonth = endOfMonth.date();
  const startWeekday = startOfMonth.day();

  const prevMonth = () => setMonthDate(dayjs(monthDate).subtract(1, 'month').toDate());
  const nextMonth = () => setMonthDate(dayjs(monthDate).add(1, 'month').toDate());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`emp-${i}`} className="bk-cal-cell empty" aria-hidden="true" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = month.date(d).format('YYYY-MM-DD');
    const hasConfirmed = Array.isArray(confirmedByDate[dateKey]) && confirmedByDate[dateKey].length > 0;
    const hasPending   = Array.isArray(pendingByDate?.[dateKey]) && pendingByDate[dateKey].length > 0;
    const isToday = dayjs().isSame(month.date(d), 'day');

    cells.push(
      <button
        key={dateKey}
        type="button"
        className={`bk-cal-cell day ${hasConfirmed ? 'has-confirmed' : ''} ${hasPending ? 'has-pending' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => (hasConfirmed || hasPending) && onOpenDate(dateKey)}
        aria-label={`${month.format('MMMM')} ${d}${(hasConfirmed||hasPending) ? ' — has bookings' : ''}`}
      >
        <span className="bk-cal-date">{d}</span>
       {(hasConfirmed || hasPending) && (
         <div className="bk-cal-dots" aria-hidden="true">
           {hasConfirmed && <span className="bk-cal-dot dot-confirmed" />}
           {hasPending && <span className="bk-cal-dot dot-pending" />}
          </div>
       )}
      </button>
    );
  }

  return (
    <div className="bk-cal-wrap">
      <div className="bk-cal-head">
        <button className="bk-cal-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
        <div className="bk-cal-title">{month.format('MMMM YYYY')}</div>
        <button className="bk-cal-nav" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      <div className="bk-cal-week">
        {weekDays.map((w) => (
          <div key={w} className="bk-cal-weekday">{w}</div>
        ))}
      </div>

      <div className="bk-cal-grid">
        {cells}
      </div>

      <div className="bk-cal-legend">
        <span className="legend-item">
          <span className="legend-dot legend-confirmed" /> Confirmed
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-pending" /> Pending
        </span>
      </div>
    </div>
  );
}

// HH:mm -> "3PM" or "3:30PM"
function to12hCompact(t) {
  if (!t) return '';
  const [hh, mm = '00'] = t.split(':');
  let h = parseInt(hh, 10);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return parseInt(mm, 10) ? `${h}:${mm}${ampm}` : `${h}${ampm}`;
}


/* -------------------------------- Helpers / constants -------------------------------- */

const EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Corporate Event',
  'Debut',
  'Christening',
  'Anniversary',
  'Reunion',
  'Others',
];

function Header({ selectedTab, setSelectedTab, counts, loading = false, showCalendar, setShowCalendar }) {
  return (
    <div
      style={{
        background: '#f8f9fa',
        padding: 5,
        borderRadius: 12,
        marginBottom: 12,
        margin: 0,
      }}
    >
      <div className="hdr-row">
        <h2 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Bookings</h2>
        {!loading && (
<button
  className="bk-view-toggle"
  onClick={() => setShowCalendar((v) => !v)}
  type="button"
  aria-label={showCalendar ? 'Switch to list view' : 'Switch to calendar view'}
>
  {showCalendar ? (
    <>
      <FiList className="bk-view-toggle-icon" />
      <span className="bk-view-toggle-text">List View</span>
    </>
  ) : (
    <>
      <FiCalendar className="bk-view-toggle-icon" />
      <span className="bk-view-toggle-text">Calendar View</span>
    </>
  )}
</button>


        )}
      </div>

      <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>
        View, edit, and manage your event bookings.
      </p>

      {loading ? (
        <div className="tabs" aria-hidden>
          <div className="tab-skeleton w-90" />
          <div className="tab-skeleton w-110" />
          <div className="tab-skeleton w-110" />
          <div className="tab-skeleton w-105" />
        </div>
      ) : (
        <TabStrip
          tabs={TABS}
          counts={counts}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
        />

      )}
    </div>
  );
}

function TabStrip({ tabs, counts, selectedTab, onSelect }) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 0);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    updateArrows();
    const el = ref.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  const nudge = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <div className="tabs-wrap">
      <div
        ref={ref}
        className="tabs"
        role="tablist"
        aria-label="Booking status tabs"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={selectedTab === t.key}
            className={`tab ${selectedTab === t.key ? 'active' : ''}`}
            onClick={() => onSelect(t.key)}
          >
            <span>{t.label}</span>
            {(counts?.[t.key] || 0) > 0 && (
              <span className="dot" aria-label={`${counts[t.key]} updates`}></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


function Card({ children, center = false }) {
  return (
    <div
      style={{
        background: '#fff',
        padding: 24,
        borderRadius: 12,
        textAlign: center ? 'center' : 'left',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        border: '1px solid #eee',
      }}
    >
      {children}
    </div>
  );
}

function ActivityLog({ items = [], me }) {
  if (!items.length) return null;

  const prettyStatusLocal = (s) => {
    switch (String(s || '').toLowerCase()) {
      case 'pending':   return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'expired':   return 'Expired';
      default:          return s || '—';
    }
  };

  const fieldLabel = (k) => ({
    event_name: 'Event Name',
    event_type: 'Event Type',
    event_date: 'Date',
    guest_count: 'Guest Count',
    start_time: 'Start Time',
    end_time: 'End Time',
    'theVenues.name': 'Venue Name',
  }[k] || k);

  const prettyLocal = (field, value) => {
    if (value == null || value === '') return '—';
    if (field === 'event_date') {
      return dayjs(value).isValid()
        ? dayjs(value).format('MMMM D, YYYY')
        : String(value);
    }
    // Added specific formatting for time fields if needed, e.g., to12hCompact
    if (field === 'start_time' || field === 'end_time') {
        return to12hCompact(value);
    }
    return String(value);
  };

  const iconFor = (type) => {
    switch (type) {
      case 'created': return <FiClock />;
      case 'status_change': return <FiInfo />;
      case 'pending_change_requested': return <FiEdit3 />;
      case 'pending_change_approved': return <FiCheckCircle />;
      case 'pending_change_rejected': return <FiXCircle />;
      case 'edit': return <FiEdit3 />;
      case 'notice': return <FiInfo />;
      default: return <FiInfo />;
    }
  };

  const colorFor = (type, details) => {
    if (type === 'pending_change_requested') return 'amber';
    if (type === 'pending_change_approved') return 'green';
    if (type === 'pending_change_rejected') return 'red';
    if (type === 'status_change') {
      const s = (details?.new_status || '').toLowerCase();
      if (s === 'confirmed' || s === 'completed') return 'green';
      if (s === 'cancelled' || s === 'expired') return 'red';
    }
    if (type === 'edit') return 'blue';
    return 'slate';
  };

  const labelFor = (it) => {
    const mine = me && it.actor && it.actor === me;

    switch (it.type) {
      case 'created':
        return 'Booking requested';
      case 'notice':
        return it.message || 'Notice';
      case 'status_change':
        return `Status: ${prettyStatusLocal(it.details?.new_status || '—')}`;
      case 'pending_change_requested':
        return mine ? 'You requested changes' : 'Client requested changes';
      case 'pending_change_approved':
        return mine ? 'You approved changes' : 'Owner approved changes';
      case 'pending_change_rejected':
        return mine ? 'You rejected changes' : 'Owner rejected changes';
      case 'edit':
        return it.message || (mine ? 'You edited this booking' : 'Edited booking');
      default:
        return it.message || it.type;
    }
  };

  const ChangeRows = ({ changes, before = {}, after = {} }) => {
    if (!changes || typeof changes !== 'object') return null;
    const entries = Object.entries(changes);
    if (!entries.length) return null;

    const get = (obj, k) =>
      obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;

    return (
      <div className="act-changes">
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <div className="lbl">{fieldLabel(k)}</div>
            <div className="cur">{prettyLocal(k, get(before, k))}</div>
            <div className="arr">→</div>
            <div>{prettyLocal(k, get(after, k) ?? v)}</div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="activity">
      <div className="activity-head"><strong>Activity</strong></div>
      <ul className="activity-list">
        {items.map((it) => (
          <li key={it._k} className="activity-item">
            <span className={`act-icon ${colorFor(it.type, it.details)}`}>
              {iconFor(it.type)}
            </span>
            <div className="act-body">
              <div className="act-line">{labelFor(it)}</div>
              <div className="act-meta">
                {dayjs(it.at).format('MMM D, YYYY h:mm A')} • {dayjs(it.at).fromNow()}
              </div>
              {['pending_change_requested','pending_change_approved','pending_change_rejected'].includes(it.type) && (
                <ChangeRows
                  changes={it.details?.changes}
                  before={it.details?.before}
                  after={it.details?.after}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


function FiltersBar({
  filtersOpen, setFiltersOpen,
  sortMode, setSortMode,
  eventTypeFilter, setEventTypeFilter,
  venueFilter, setVenueFilter,
  onlyPendingChanges, setOnlyPendingChanges,
  eventTypeOptions, venueOptions,
  isOwner,
}) {
  return (
    <div className="filters-wrap" aria-label="Booking filters">
      <button
        type="button"
        className="filters-toggle"
        onClick={() => setFiltersOpen(!filtersOpen)}
        aria-expanded={filtersOpen}
        aria-controls="filters-panel"
        title="Filters"
      >
        <FiSliders />
        <span className="filters-title">Filter</span>
      </button>

      {filtersOpen && (
        <div id="filters-panel" className="filters-panel">
          <div className="filters-row">
            <label className="filters-label" htmlFor="sortMode">Sort</label>
            <select
              id="sortMode"
              className="filters-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              <option value="recent">Newest update</option>
              <option value="closest">Closest date</option>
            </select>
          </div>

          <div className="filters-row">
            <label className="filters-label" htmlFor="eventTypeFilter">Event type</label>
            <select
              id="eventTypeFilter"
              className="filters-select"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All</option>
              {eventTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="filters-row">
            <label className="filters-label" htmlFor="venueFilter">Venue</label>
            <select
              id="venueFilter"
              className="filters-select"
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
            >
              <option value="all">All</option>
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {isOwner && (
            <div className="filters-row inline">
              <label className="filters-checkbox">
                <input
                  type="checkbox"
                  checked={onlyPendingChanges}
                  onChange={(e) => setOnlyPendingChanges(e.target.checked)}
                />
                <span>Pending owner approval only</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function Avatar({ src, alt, size = 28 }) {
  const s = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
    background: '#e5e7eb',
    border: '1px solid #fff',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
  };
  return src ? (
    <img src={src} alt={alt || 'Avatar'} style={s} />
  ) : (
    <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6b7280' }}>
      {String(alt || 'U').slice(0, 1).toUpperCase()}
    </div>
  );
}

const sortBookings = (list) => [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
let __bkCSS = false;
function ensureBookingSkeletonCSS() {
  if (__bkCSS) return;
  const style = document.createElement("style");
  style.id = "booking-skeleton-css";
style.innerHTML = `
  /* Skeleton container behaves like booking list, but centered */
  .bk-sk-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .bk-sk-card {
    position: relative;
    overflow: hidden;
    background: var(--card, #fff);
    margin-bottom: 10px;
    border-radius: 16px;
    padding: 16px;
    min-height: 120px;
    box-shadow: 0 12px 30px rgba(15,23,42,0.06);
  }

  .bk-sk-title,
  .bk-sk-line,
  .bk-sk-chip {
    background: var(--card-soft, #f0f3f9);
    border-radius: 999px;
    position: relative;
    overflow: hidden;
  }

  .bk-sk-title {
    height: 18px;
    width: 60%;
    margin-bottom: 12px;
    border-radius: 10px;
  }

  .bk-sk-line {
    height: 12px;
    margin: 8px 0;
    border-radius: 999px;
  }

  .bk-sk-line.w-70 { width: 70%; }
  .bk-sk-line.w-50 { width: 50%; }

  .bk-sk-chip {
    width: 80px;
    height: 20px;
    border-radius: 999px;
    margin-top: 12px;
  }

  .bk-sk-title::after,
  .bk-sk-line::after,
  .bk-sk-chip::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0),
      rgba(255,255,255,.7),
      rgba(255,255,255,0)
    );
    animation: bk-shimmer 1.05s infinite;
  }

  @keyframes bk-shimmer {
    100% {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bk-sk-title::after,
    .bk-sk-line::after,
    .bk-sk-chip::after {
      animation: none;
    }
  }

  /* ✅ Desktop: center skeleton within main content, not full screen */
  @media (min-width: 1024px) {
    .bk-sk-container {
      grid-template-columns: 1fr;
      max-width: 1024px;
      margin: 0 auto;      /* center in the page content */
      justify-items: stretch;
    }

    .bk-sk-card {
      width: 100%;
    }
  }
`;

  document.head.appendChild(style);
  __bkCSS = true;
}

const styles = `
  /* ================================
     Canva-like Theme Tokens (Inva)
     Professional Variant
     ================================ */
  :root {
    --bg: #f5f7fb;
    --bg-soft: #ffffff;
    --card: #ffffff;
    --card-soft: #f0f3f9;

    --accent: #635bff;
    --accent-soft: rgba(99, 91, 255, 0.10);
    --accent-2: #ff6ad5;
    --accent-2-soft: rgba(255, 106, 213, 0.16);

    --ok: #16a34a;
    --ok-soft: #ecfdf3;
    --ok-border: #bbf7d0;

    --warn: #f59e0b;
    --warn-soft: #fffbeb;
    --warn-border: #fed7aa;

    --danger: #dc2626;
    --danger-soft: #fef2f2;
    --danger-border: #fecaca;

    --slate: #0f172a;
    --muted: #6b7280;
    --border-soft: rgba(148, 163, 184, 0.35);
    --border-strong: rgba(15, 23, 42, 0.14);

    --shadow-soft: 0 14px 40px rgba(15,23,42,0.15);
    --shadow-card: 0 8px 22px rgba(15,23,42,0.10);
  }

  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    background: var(--bg);
    color: var(--slate);
    font-size: 13px;
  }

  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 10px 10px 32px;
    font-family: inherit;
    font-size: 13px;
  }

  /* ================================
     Booking Cards Grid
     ================================ */
  .booking-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .booking-card {
    position: relative;
    background:
      radial-gradient(circle at -10% -20%, rgba(99,91,255,0.10) 0, transparent 52%),
      radial-gradient(circle at 110% 120%, rgba(255,106,213,0.12) 0, transparent 55%),
      var(--card);
    border-radius: 16px;
    padding: 14px 14px 12px;
    min-height: 115px;
    cursor: pointer;
    border: 1px solid var(--border-soft);
    box-shadow: var(--shadow-card);
    transition:
      box-shadow .14s ease,
      transform .10s ease,
      border-color .10s ease,
      background .10s ease;
    font-family: inherit;
    overflow: hidden;
    font-size: 12.5px;
  }

  .booking-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 0% 0%, rgba(255,255,255,0.7), transparent 60%);
    opacity: 0;
    pointer-events: none;
    transition: opacity .16s ease;
  }

  .booking-card:hover {
    box-shadow: var(--shadow-soft);
    transform: translateY(-2px);
    border-color: rgba(99,91,255,0.32);
    background:
      radial-gradient(circle at -10% -20%, rgba(99,91,255,0.14) 0, transparent 55%),
      radial-gradient(circle at 110% 120%, rgba(255,106,213,0.16) 0, transparent 58%),
      var(--card);
  }
  .booking-card:hover::before {
    opacity: 1;
  }

  .booking-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .booking-title {
    margin: 0;
    font-size: 13px;
    color: var(--accent);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    max-width: 70%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .booking-card__meta {
    margin-top: 8px;
    color: #111827;
    line-height: 1.45;
    font-size: 12px;
  }

  /* Status pill (per booking row) */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 11px;
    text-transform: capitalize;
    border: 1px solid transparent;
    background: rgba(148,163,184,0.10);
    color: #374151;
    backdrop-filter: blur(8px);
  }

  .status-pill .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-pill.past {
    background: var(--danger-soft);
    color: var(--danger);
    border-color: var(--danger-border);
  }
  .status-pill.confirmed {
    background: var(--ok-soft);
    color: var(--ok);
    border-color: var(--ok-border);
  }
  .status-pill.pending {
    background: var(--warn-soft);
    color: var(--warn);
    border-color: var(--warn-border);
  }

  /* ================================
     Tabs (top filter tabs)
     ================================ */
  .tabs-wrap {
    display:flex;
    align-items:center;
    gap:8px;
    margin-top:8px;
    padding-bottom:4px;
  }

  .tabs {
    display:flex;
    flex-wrap:nowrap;
    gap:6px;
    overflow-x:auto;
    overflow-y:hidden;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior-x:contain;
    scroll-snap-type:x proximity;
  }

  .tabs::-webkit-scrollbar{ height:4px; }
  .tabs::-webkit-scrollbar-thumb{
    background: rgba(148,163,184,0.45);
    border-radius:999px;
  }
  .tabs{ scrollbar-width:thin; }

  .tab {
    flex:0 0 auto;
    position:relative;
    border:none;
    background: transparent;
    padding:7px 11px;
    cursor:pointer;
    font-weight:600;
    font-size:11.5px;
    color: var(--muted);
    border-radius: 999px;
    white-space:nowrap;
    scroll-snap-align:start;
    font-family: inherit;
    transition:
      background .12s ease,
      color .12s ease,
      box-shadow .12s ease,
      transform .08s ease;
  }

  .tab:hover {
    color:#111827;
    background: rgba(148,163,184,0.12);
  }

  .tab.active {
    color:#0f172a;
    background: #ffffff;
    box-shadow: 0 8px 22px rgba(148,163,184,0.32);
    transform: translateY(-1px);
  }

  .tab .dot {
    position:absolute;
    top:4px;
    right:3px;
    width:7px;
    height:7px;
    border-radius:50%;
    background:#EF4444;
    box-shadow:0 0 0 2px #fff;
  }

  .tab-skeleton {
    height: 30px;
    border-radius:999px;
    background: var(--card-soft);
    position:relative;
    overflow:hidden;
    border:1px solid rgba(148,163,184,0.35);
  }
  .tab-skeleton::after {
    content:"";
    position:absolute;
    inset:0;
    transform:translateX(-100%);
    background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.7), rgba(255,255,255,0));
    animation: bk-shimmer 1.05s infinite;
  }
  .tab-skeleton.w-90 { width: 90px; }
  .tab-skeleton.w-105 { width: 105px; }
  .tab-skeleton.w-110 { width: 110px; }

  .tabs-nav-btn{
    border:1px solid var(--border-soft);
    background:#ffffff;
    border-radius:10px;
    padding:5px;
    line-height:0;
    cursor:pointer;
    color:#374151;
    box-shadow: 0 6px 16px rgba(15,23,42,0.10);
  }
  .tabs-nav-btn:hover{ background:#f3f4ff; }
  .tabs-nav-btn[disabled]{ opacity:.35; cursor:default; }

    /* ================================
     Modal (Booking Details)
     (Matched to VenueManager modal)
     ================================ */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.30);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    z-index: 9999;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .modal-card {
    background:
      radial-gradient(circle at 0% 0%, rgba(255,255,255,0.80), transparent 60%),
      var(--card);
    border-radius: 18px;
    width: min(960px, 96vw);       /* wider, like VenueManager */
    max-height: 90vh;
    padding: 18px 18px 14px;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(15,23,42,0.35);
    font-family: inherit;
    border: 1px solid var(--border-soft);
    font-size: 12.5px;
  }

  .modal-close {
    position: absolute;
    top: 10px;
    right: 14px;
    border: none;
    background: rgba(248,250,252,0.96);
    font-size: 16px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    box-shadow: 0 6px 18px rgba(15,23,42,0.20);
    transition:
      background .12s ease,
      transform .06s ease,
      color .12s ease,
      box-shadow .12s ease;
  }
  .modal-close:hover {
    background: #ffffff;
    color: #111827;
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(15,23,42,0.28);
  }
  .modal-close:active {
    transform: translateY(1px);
    box-shadow: 0 3px 10px rgba(15,23,42,0.22);
  }

  .modal-title-row {
    padding-bottom: 8px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid rgba(226,232,240,0.9);
  }

  .modal-title {
    font-size: 14px;
    font-weight: 800;
    margin: 0;
        color: var(--slate);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .modal-section {
    line-height: 1.4;
    font-size: 12.5px;
    color: #111827;
    background: radial-gradient(circle at -10% -20%, rgba(99, 91, 255, 0.10) 0, transparent 52%), radial-gradient(circle at 110% 120%, rgba(255, 106, 213, 0.12) 0, transparent 55%), var(--card);
   
   
  }

  .row-edit {
  
    padding: 9px 11px;
    margin-bottom: 0;
    border-radius: 11px;
    border: 0px solid rgba(148,163,184,0.30);
  }

  .row-label {
    display: block;
    color: #64748b;
    margin-bottom: 3px;
    text-transform: uppercase;
    letter-spacing: .11em;
    font-size: 10.5px;
    font-weight: 600;
  }

  .row-editor {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .input {
    flex: 1;
    padding: 7px 9px;
    border: 1px solid rgba(148,163,184,0.6);
    border-radius: 9px;
    font-size: 12.5px;
    outline: none;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    transition:
      border-color .12s ease,
      box-shadow .12s ease,
      background .12s ease;
  }
  .input:focus {
    border-color: #a5b4fc;
    box-shadow:
      0 0 0 1px rgba(99,91,255,0.30),
      0 0 0 4px rgba(129,140,248,0.24);
    background: #ffffff;
  }

  .edit-icon {
    cursor: pointer;
    color: #9ca3af;
    transition: color .12s ease, transform .06s ease;
    font-size: 14px;
  }
  .edit-icon:hover {
    color: var(--accent);
    transform: translateY(-1px);
  }

  .muted {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }

  .hint {
    font-size: 11px;
    color: var(--muted);
    margin-left: 6px;
  }

  .icon-btn {
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 14px;
    background: rgba(248,250,252,0.95);
    color: #111827;
    font-size: 18px;
    padding: 0;
    transition:
      background .12s ease,
      transform .06s ease,
      box-shadow .12s ease;
    box-shadow: 0 6px 18px rgba(15,23,42,0.16);
  }
  .icon-btn:hover {
    background: #ffffff;
    transform: translateY(-1px);
  }
  .icon-btn:active { transform: translateY(1px); }
  .icon-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .icon-btn svg { width: 1em; height: 1em; }
  .icon-btn.sm {
    width: 30px;
    height: 30px;
    font-size: 16px;
    border-radius: 11px;
    box-shadow: 0 5px 15px rgba(15,23,42,0.15);
  }
  .icon-btn.lg {
    width: 44px;
    height: 44px;
    font-size: 20px;
    border-radius: 15px;
  }

  .btn {
    padding: 8px 13px;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 12.5px;
    transition:
      box-shadow .12s ease,
      transform .06s ease,
      filter .12s ease,
      background .12s ease;
  }
  .btn[disabled] {
    opacity: .6;
    cursor: not-allowed;
  }
  .btn.primary {
    background: linear-gradient(135deg, #635bff, #8b5cf6);
    color: #fff;
    box-shadow: 0 10px 24px rgba(99,91,255,0.35);
  }
  .btn.primary:hover {
    filter: brightness(1.02);
    transform: translateY(-1px);
  }
  .btn.ghost {
    background: rgba(248,250,252,0.95);
    color: #111827;
    border: 1px solid rgba(148,163,184,0.65);
  }
  .btn.ghost:hover {
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(148,163,184,0.24);
  }
  .btn.danger-outline {
    background: var(--danger-soft);
    color: var(--danger);
    border: 1px solid var(--danger-border);
  }
  .btn.success-outline {
    background: var(--ok-soft);
    color: var(--ok);
    border: 1px solid var(--ok-border);
  }

  .modal-actions {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .modal-actions .btn {
    flex: 1 1 100%;
    width: 100%;
  }


  /* ================================
     Alerts
     ================================ */
  .alert{
    display:flex;
    align-items:center;
    gap:.45rem;
    padding:.45rem .65rem;
    border-radius:999px;
    border:1px solid var(--alert-border, var(--danger-border));
    background:var(--alert-bg, var(--danger-soft));
    color:var(--alert-fg, var(--danger));
    font-weight:600;
    line-height:1.25;
    font-size:.78rem;
  }
  .alert-xs { font-size:.76rem; padding:.32rem .5rem; }
  .alert-sm { font-size:.78rem; padding:.4rem .55rem; }
  .alert-md { font-size:.85rem; }
  .alert-lg { font-size:.95rem; padding:.6rem .8rem; }
  .alert__icon { flex:0 0 auto; font-size:1em; }

  .past {
    --alert-bg: var(--warn-soft);
    --alert-fg: #9A3412;
    --alert-border: var(--warn-border);
  }

  /* ================================
     Pending changes box
     ================================ */
  .pending-box {
    margin-top: 14px;
    border: 1px solid var(--border-soft);
    border-radius: 14px;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(148,163,184,0.20);
    font-size: 12px;
  }
  .pending-head {
    padding: 8px 11px;
    background: var(--bg-soft);
    border-bottom: 1px solid rgba(148,163,184,0.35);
    font-weight:600;
    font-size:12px;
  }
  .pending-list { padding: 8px 11px; }
  .pending-row {
    display: grid;
    grid-template-columns: 130px 1fr auto 1fr;
    align-items: center;
    gap: 6px;
    padding: 5px 0;
    border-bottom: 1px dashed #e5e7eb;
    font-size:12px;
  }
  .pending-row:last-child { border-bottom: none; }
  .pending-field { font-weight: 600; color: #111827; }
  .pending-current { color: #6b7280; }
  .pending-arrow { color: #9ca3af; }
  .pending-proposed { color: #111827; font-weight: 600; }
  .pending-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 11px;
    border-top: 1px solid #e5e7eb;
  }

  /* ================================
     Calendar (Bookings map)
     ================================ */
  .hdr-row {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    font-size: 12px;
  }

  .cal-toggle {
    display:inline-flex;
    align-items:center;
    gap:6px;
    background:#ffffff;
    border:1px solid rgba(148,163,184,0.6);
    color:#111827;
    border-radius:999px;
    padding:7px 9px;
    font-weight:600;
    cursor:pointer;
    font-size:12px;
    box-shadow: 0 7px 18px rgba(148,163,184,0.24);
  }
  .cal-toggle:hover { background:#f9fafb; }

  .bk-cal-wrap {
    background: var(--card);
    border:1px solid rgba(148,163,184,0.45);
    border-radius:14px;
    padding:10px 10px 12px;
    margin: 8px 5px 14px;
    box-shadow: 0 10px 24px rgba(148,163,184,0.28);
    font-size: 12px;
  }

  .bk-cal-head {
    display:flex;
    align-items:center;
    justify-content:space-between;
    margin-bottom:6px;
  }
  .bk-cal-title {
    font-weight:700;
    color:#111827;
    font-size:12px;
    letter-spacing:.14em;
    text-transform:uppercase;
  }

.bk-cal-nav {
  display: inline-flex;              /* ✅ center contents */
  align-items: center;
  justify-content: center;

  width: 32px;
  height: 32px;
  border-radius: 999px;

  border: 1px solid rgba(148,163,184,0.65);
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(15,23,42,0.08);

  font-size: 18px;                   /* arrow size (for <, > or icon) */
  line-height: 1;
  color: #0f172a;

  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.bk-cal-nav:hover {
  background: #f8fafc;
  border-color: rgba(37,99,235,0.6);
  box-shadow: 0 6px 16px rgba(15,23,42,0.12);
}

.bk-cal-nav:active {
  transform: scale(0.94);
  box-shadow: 0 2px 6px rgba(15,23,42,0.18);
}

.bk-cal-nav:focus-visible {
  outline: 2px solid rgba(37,99,235,0.8);
  outline-offset: 2px;
}


  .bk-cal-week {
    display:grid;
    grid-template-columns: repeat(7, 1fr);
    gap:5px;
    margin: 5px 0;
  }
  .bk-cal-weekday {
    text-align:center;
    font-size:10px;
    font-weight:600;
    color:#6b7280;
    text-transform:uppercase;
    letter-spacing:.11em;
  }

  .bk-cal-grid {
    display:grid;
    grid-template-columns: repeat(7, 1fr);
    gap:5px;
  }

  .bk-cal-cell {
    background: var(--card-soft);
    border:1px solid rgba(226,232,240,0.9);
    border-radius:10px;
    min-height:52px;
    display:flex;
    align-items:flex-start;
    justify-content:flex-start;
    padding:6px;
    position:relative;
    font-size:11.5px;
    transition: box-shadow .10s ease, transform .06s ease, border-color .10s ease, background .10s ease;
  }
  .bk-cal-cell.empty { background:transparent; border:none; }
  .bk-cal-cell.day { cursor:pointer; }
  .bk-cal-cell.day:hover {
    box-shadow: 0 0 0 1px rgba(99,91,255,0.35), 0 0 0 4px rgba(129,140,248,0.22);
    background:#ffffff;
    transform: translateY(-1px);
  }
  .bk-cal-cell.today {
    border-color: var(--accent);
  }

  .bk-cal-date {
    font-weight:700;
    color:#0f172a;
    font-size:11.5px;
  }

  .bk-cal-cell.has-confirmed {
    background: var(--ok-soft);
    border-color: var(--ok-border);
  }
  .bk-cal-cell.has-pending {
    background: var(--warn-soft);
    border-color: var(--warn-border);
  }
  .bk-cal-cell.has-confirmed.has-pending {
    background: linear-gradient(
      135deg,
      var(--ok-soft) 0%,
      var(--ok-soft) 50%,
      var(--warn-soft) 50%,
      var(--warn-soft) 100%
    );
    border-color: var(--ok-border);
  }

  .bk-cal-dots {
    position:absolute;
    right:5px;
    bottom:5px;
    display:flex;
    gap:3px;
  }
  .bk-cal-dot {
    width:7px;
    height:7px;
    border-radius:50%;
  }
  .dot-confirmed { background: var(--ok); }
  .dot-pending   { background: var(--warn); }

  .bk-cal-legend {
    margin-top:7px;
    font-size:11.5px;
    color:#374151;
    display:flex;
    gap:10px;
  }
  .legend-item {
    display:inline-flex;
    align-items:center;
    gap:5px;
  }
  .legend-dot {
    width:9px;
    height:9px;
    border-radius:50%;
    display:inline-block;
  }
  .legend-confirmed { background: var(--ok); }
  .legend-pending   { background: var(--warn); }

  /* ================================
     Role / Meta rows
     ================================ */
  .role-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: rgb(130, 130, 130);
    padding: 3px 7px;
    background: rgba(248,250,252,0.96);
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
  }

  .meta-label {
    color:#111827;
    font-weight: 600;
    font-size: 12px;
  }

  .meta-value {
    color:#4b5563;
    font-weight: 400;
    text-align: right;
    margin-left: 10px;
    max-width: 60%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size:12px;
  }

  .meta-user {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    justify-content: flex-end;
  }

  .meta-username {
    min-width: 0;
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ================================
     Day list (per-date bookings)
     ================================ */
  .daylist{
    display:flex;
    flex-direction:column;
    gap: 7px;
    margin-top: 7px;
  }
  .daylist-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:9px;
    padding:9px 11px;
    border:1px solid rgba(226,232,240,0.9);
    border-radius:11px;
    background:#ffffff;
    cursor:pointer;
    text-align:left;
    box-shadow: 0 7px 18px rgba(148,163,184,0.20);
    transition: transform .08s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
    font-size: 12px;
  }
  .daylist-row:hover{
    background:#f9fafb;
    transform: translateY(-1px);
    border-color: rgba(99,91,255,0.28);
    box-shadow: 0 10px 22px rgba(99,91,255,0.24);
  }
  .daylist-sub{
    color: var(--muted);
    font-size:11.5px;
    margin-top: 2px;
  }

  .badge {
    padding: 3px 7px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 11px;
  }
  .badge.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .badge.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }

  /* ================================
     Activity feed
     ================================ */
  .activity{
    margin-top:10px;
    padding-top:8px;
  }
  .activity-head{
    font-weight:700;
    color:#111827;
    margin-bottom:5px;
    text-transform:uppercase;
    letter-spacing:.09em;
    font-size:10.5px;
  }
  .activity-list{
    list-style:none;
    padding:0;
    margin:0;
    display:flex;
    flex-direction:column;
    gap:7px;
  }
  .activity-item{
    display:flex;
    align-items:flex-start;
    gap:8px;
    padding:7px 0;
    border-bottom:1px dashed #e5e7eb;
    font-size:12px;
  }
  .activity-item:last-child{ border-bottom:none; }

  .act-icon{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:20px;
    height:20px;
    border-radius:999px;
    background:#f3f4f6;
    color:#374151;
    flex:0 0 auto;
    font-size:12px;
  }
  .act-icon.green{ background:#E7F9EF; color:#15803D; }
  .act-icon.amber{ background:#FEF7E7; color:#B45309; }
  .act-icon.red{ background:#FEECEC; color:#B91C1C; }
  .act-icon.blue{ background:#E7F1FE; color:#1D4ED8; }
  .act-icon.slate{ background:#F3F4F6; color:#374151; }

  .act-body{
    flex:1;
    min-width:0;
  }
  .act-line{
    color:#111827;
    font-size:12.5px;
    font-weight:500;
  }
  .act-meta{
    color:#6b7280;
    font-size:11px;
    margin-top:2px;
  }

  .act-changes{
    margin-top:5px;
    display:grid;
    grid-template-columns: 130px 1fr auto 1fr;
    gap:6px;
    font-size:12px;
    align-items:center;
  }
  .act-changes .lbl{ font-weight:600; color:#374151; }
  .act-changes .cur{ color:#6b7280; }
  .act-changes .arr{ color:#9ca3af; }

  /* ================================
     Badges / chips / notes
     ================================ */
  .bk-badges {
    position: absolute;
    top: 7px;
    right: 7px;
    display: flex;
    gap: 5px;
    z-index: 2;
  }
  .bk-badge {
    background: var(--danger);
    color: #fff;
    border-radius: 9999px;
    padding: 0 5px;
    font-size: 10px;
    line-height: 16px;
    min-width: 16px;
    text-align: center;
    border: 2px solid #fff;
    font-weight: 700;
  }
  .bk-badge-warn { background: var(--warn); }

  .bk-dot{
    position:absolute;
    top:9px;
    right:9px;
    width:8px;
    height:8px;
    border-radius:999px;
    border:2px solid #fff;
    box-shadow:0 0 0 1px rgba(0,0,0,.06);
  }
  .bk-dot.warn { background: var(--warn); }
  .bk-dot.ok   { background: var(--ok); }
  .bk-dot.info { background:#3B82F6; }
  .bk-dot.red  { background: var(--danger); }

  .bk-card-note{
    margin-top:8px;
    padding:7px 9px;
    border-radius:9px;
    font-size:11.5px;
    font-weight:500;
    line-height:1.25;
    border:1px solid #e5e7eb;
    color:#111827;
    background:var(--warn-soft);
    border-color:var(--warn-border);
  }
  .bk-card-note.ok{
    background:var(--ok-soft);
    border-color:var(--ok-border);
    color:#065F46;
  }
  .bk-card-note.warn{
    background:var(--warn-soft);
    border-color:var(--warn-border);
    color:#92400E;
  }
  .bk-card-note.red{
    background:var(--danger-soft);
    border-color:var(--danger-border);
    color:#991B1C;
  }
  .bk-card-note.info{
    background:#DBEAFE;
    border-color:#93C5FD;
    color:#1E40AF;
  }

  .chip{
    display:inline-flex;
    align-items:center;
    gap:5px;
    padding:3px 7px;
    border-radius:999px;
    font-weight:600;
    font-size:11px;
    background:rgba(248,250,252,0.96);
    color:#374151;
    border:1px solid rgba(209,213,219,0.9);
    backdrop-filter: blur(8px);
  }
  .chip.ok  {
    background:var(--ok-soft);
    color:var(--ok);
    border-color:var(--ok-border);
  }
  .chip.red {
    background:var(--danger-soft);
    color:var(--danger);
    border-color:var(--danger-border);
  }

  /* ================================
     Filters
     ================================ */
  .filters-wrap{
    margin: 8px 5px 10px;
    font-size: 12px;
  }
  .filters-toggle{
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid rgba(148,163,184,0.6);
    background: #ffffff;
    border-radius: 999px;
    padding: 6px 10px;
    font-weight: 600;
    cursor: pointer;
    color: #111827;
    font-size:12px;
    box-shadow: 0 8px 20px rgba(148,163,184,0.26);
  }
  .filters-toggle:hover{ background: #f9fafb; }
  .filters-title{ font-size: 13px; }

  .filters-panel{
    margin-top: 8px;
    background: #ffffff;
    border: 1px solid rgba(148,163,184,0.45);
    border-radius: 14px;
    padding: 9px 11px 10px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 9px;
    box-shadow: 0 10px 24px rgba(148,163,184,0.26);
  }
  .filters-row{ display: flex; flex-direction: column; gap: 5px; }
  .filters-row.inline{ flex-direction: row; align-items: center; gap: 9px; }

  .filters-label{
    color: #6b7280;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: .10em;
    font-weight:600;
  }
  .filters-select{
    border: 1px solid #d1d5db;
    border-radius: 9px;
    padding: 7px 9px;
    font-size: 12.5px;
    font-family: inherit;
    background:#f9fafb;
  }
  .filters-select:focus{
    outline:none;
    border-color:#a5b4fc;
    box-shadow: 0 0 0 1px rgba(99,91,255,0.30), 0 0 0 4px rgba(129,140,248,0.22);
    background:#ffffff;
  }
  .filters-checkbox input{ margin-right: 7px; }

  /* ================================
     Responsive
     ================================ */
  @media (min-width: 1024px) {
    .booking-grid {
      grid-template-columns: 1fr;
      justify-items: center;
    }
    .booking-card {
      width: 100%;
      max-width: 1024px;
    }
  }
  .bk-view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,0.65);
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
  box-shadow: 0 4px 10px rgba(15,23,42,0.08);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.bk-view-toggle-icon {
  font-size: 16px;
  line-height: 1;
}

.bk-view-toggle-text {
  line-height: 1;
}

.bk-view-toggle:hover {
  background: #f8fafc;
  border-color: rgba(37,99,235,0.6);
  box-shadow: 0 6px 16px rgba(15,23,42,0.12);
}

.bk-view-toggle:active {
  transform: scale(0.96);
  box-shadow: 0 2px 6px rgba(15,23,42,0.18);
}


    
`;
