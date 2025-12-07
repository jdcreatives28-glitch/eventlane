import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import '../pages/BookingModal.css';

// Icons
import {
  FiCalendar,
  FiClock,
  FiEdit3,
  FiUsers,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiMapPin,
} from 'react-icons/fi';

/* ============================== Helpers ============================== */

const formatLocalDateYYYYMMDD = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const hhmmToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const addMinutesHHMM = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const H = Math.floor(total / 60) % 24;
  const M = total % 60;
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
};

const clampHHMM = (t, min, max) => {
  if (!t) return t;
  if (min && t < min) return min;
  if (max && t > max) return max;
  return t;
};

const formatTime12Hour = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayHours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const isWeekend = (date) => {
  if (!date) return false;
  const d = date.getDay();
  return d === 0 || d === 6;
};

const getApplicableRate = (venue, date) => {
  if (!venue) return 0;
  const mode = venue.rate_mode || 'single';
  if (mode === 'split') {
    const wk = Number(venue.rate_weekday || 0);
    const we = Number(venue.rate_weekend || 0);
    return isWeekend(date) ? we : wk;
  }
  return Number(venue.rate || 0);
};

const peso = (n = 0) => `₱${Number(n || 0).toLocaleString()}`;

/* ============================== DatePicker ============================== */

function DatePicker({ id, selectedDate, onDateChange }) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="calendar-day empty" aria-hidden="true" />
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const isSelected =
        selectedDate && date.toDateString() === selectedDate.toDateString();
      const isPast = date < startOfToday;

      days.push(
        <button
          key={`day-${day}`}
          type="button"
          className={`calendar-day ${
            isSelected ? 'selected' : ''
          } ${isPast ? 'disabled' : ''}`}
          onClick={() => {
            if (!isPast) {
              onDateChange(new Date(year, month, day));
              setShowCalendar(false);
            }
          }}
          disabled={isPast}
          aria-selected={isSelected}
          aria-label={`Select ${months[month]} ${day}, ${year}`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="picker-wrap" ref={calendarRef}>
      <div className="input-shell" onClick={() => setShowCalendar(!showCalendar)}>
        <FiCalendar className="input-icon" aria-hidden />
        <input
          id={id}
          type="text"
          value={
            selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : ''
          }
          readOnly
          placeholder="Select date"
          className="input-field"
          aria-haspopup="dialog"
          aria-expanded={showCalendar}
          required
        />
      </div>

      {showCalendar && (
        <div className="calendar" role="dialog" aria-modal="true" aria-label="Choose a date">
          <div className="calendar-header">
            <button
              type="button"
              onClick={prevMonth}
              className="nav-btn"
              aria-label="Previous month"
            >
              <FiChevronLeft />
            </button>
            <h4>
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h4>
            <button
              type="button"
              onClick={nextMonth}
              className="nav-btn"
              aria-label="Next month"
            >
              <FiChevronRight />
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="calendar-days">{renderDays()}</div>
        </div>
      )}
    </div>
  );
}

/* ============================== TimePicker ============================== */

function TimePicker({ id, selectedTime, onTimeChange, min = '00:00', max = '23:59' }) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timePickerRef = useRef(null);
  const timeListRef = useRef(null);

  const generateTimeSlots = (intervalMinutes) => {
    const out = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += intervalMinutes) {
        const hour = String(h).padStart(2, '0');
        const minute = String(m).padStart(2, '0');
        const t = `${hour}:${minute}`;
        if (t >= min && t <= max) out.push(t);
      }
    }
    return out;
  };

  const timeSlots = useMemo(() => generateTimeSlots(15), [min, max]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showTimePicker && timeListRef.current && selectedTime) {
      const el = timeListRef.current.querySelector(
        `.time-slot[data-time="${selectedTime}"]`
      );
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      }
    }
  }, [showTimePicker, selectedTime]);

  const handleTimeSelect = (time24) => {
    onTimeChange(time24);
    setShowTimePicker(false);
  };

  return (
    <div className="picker-wrap" ref={timePickerRef}>
      <div className="input-shell" onClick={() => setShowTimePicker(!showTimePicker)}>
        <FiClock className="input-icon" aria-hidden />
        <input
          id={id}
          type="text"
          value={selectedTime ? formatTime12Hour(selectedTime) : ''}
          readOnly
          placeholder="Select time"
          className="input-field"
          aria-haspopup="listbox"
          aria-expanded={showTimePicker}
          required
        />
      </div>

      {showTimePicker && (
        <div className="time-list" ref={timeListRef} role="listbox" aria-label="Choose a time">
          {timeSlots.map((time24) => (
            <button
              type="button"
              key={time24}
              data-time={time24}
              className={`time-slot ${selectedTime === time24 ? 'selected' : ''}`}
              onClick={() => handleTimeSelect(time24)}
              role="option"
              aria-selected={selectedTime === time24}
            >
              {formatTime12Hour(time24)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== Main Modal ============================== */

export default function BookingModal({ venue, isOpen, onClose }) {
  const [form, setForm] = useState({
    event_name: '',
    event_type: '',
    event_date: null,
    start_time: '',
    end_time: '',
    guest_count: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setIsAuthed(!!session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setIsAuthed(!!session?.user)
    );
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const maxCap = Number(venue?.capacity_max || 0) || undefined;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    setTimeout(() => titleRef.current?.focus(), 0);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'guest_count') {
      let n = value === '' ? '' : String(Math.max(1, Number(value || 0)));
      if (n !== '' && maxCap) n = String(Math.min(Number(n), maxCap));
      setForm((prev) => ({ ...prev, guest_count: n }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => setForm((prev) => ({ ...prev, event_date: date }));
  const handleTimeChange = (name, time) =>
    setForm((prev) => ({ ...prev, [name]: time }));

  const venueOpen = venue?.open_time || '00:00';
  const venueClose = venue?.close_time || '23:59';
  const endMin = form.start_time ? addMinutesHHMM(form.start_time, 15) : venueOpen;
  const endMax = venueClose;

  useEffect(() => {
    if (!form.end_time) return;
    const clamped = clampHHMM(form.end_time, endMin, endMax);
    if (clamped !== form.end_time) {
      setForm((prev) => ({ ...prev, end_time: clamped }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endMin, endMax]);

  const applicableRate = useMemo(
    () => (form.event_date ? getApplicableRate(venue, form.event_date) : 0),
    [venue, form.event_date]
  );

  const reservationFee = useMemo(
    () => (applicableRate > 0 ? Math.round(applicableRate * 0.1) : 0),
    [applicableRate]
  );

  const formattedDate = useMemo(
    () =>
      form.event_date
        ? form.event_date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '',
    [form.event_date]
  );

  const checkAvailability = async (dateStr, start, end) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('start_time,end_time,status')
      .eq('venue_id', venue.id)
      .eq('event_date', dateStr)
      .in('status', ['pending', 'confirmed']);

    if (error) throw error;

    const s = hhmmToMinutes(start);
    const e = hhmmToMinutes(end);

    return (data || []).some(({ start_time, end_time }) =>
      rangesOverlap(s, e, hhmmToMinutes(start_time), hhmmToMinutes(end_time))
    );
  };

  const handleBook = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return Swal.fire(
        'Login Required',
        'Please login to book a venue.',
        'warning'
      );
    }

    if (!form.event_name.trim()) {
      return Swal.fire('Event Name Required', 'Please enter an event name.', 'warning');
    }
    if (!form.event_type) {
      return Swal.fire('Event Type Required', 'Please select an event type.', 'warning');
    }
    if (!form.event_date) {
      return Swal.fire('Date Required', 'Please select an event date.', 'warning');
    }
    if (!form.start_time) {
      return Swal.fire('Start Time Required', 'Please select a start time.', 'warning');
    }
    if (!form.end_time) {
      return Swal.fire('End Time Required', 'Please select an end time.', 'warning');
    }
    if (form.start_time >= form.end_time) {
      return Swal.fire(
        'Time Error',
        'Start time cannot be later than or equal to end time.',
        'warning'
      );
    }
    if (!/^\d+$/.test(String(form.guest_count)) || Number(form.guest_count) < 1) {
      return Swal.fire(
        'Invalid Guests',
        'Please enter a valid guest count (1 or more).',
        'warning'
      );
    }
    const maxCapLocal = Number(venue?.capacity_max || 0) || undefined;
    if (maxCapLocal && Number(form.guest_count) > maxCapLocal) {
      return Swal.fire(
        'Over Capacity',
        `Max capacity is ${maxCapLocal} guests.`,
        'warning'
      );
    }

    const dateStr = formatLocalDateYYYYMMDD(form.event_date);
    setSubmitting(true);

    try {
      const hasConflict = await checkAvailability(
        dateStr,
        form.start_time,
        form.end_time
      );
      if (hasConflict) {
        setSubmitting(false);
        return Swal.fire(
          'Unavailable',
          'Those hours are already booked for this date.',
          'warning'
        );
      }

      const { data: inserted, error: insertError } = await supabase
        .from('bookings')
        .insert({
          venue_id: venue.id,
          event_name: form.event_name,
          event_type: form.event_type,
          event_date: dateStr,
          start_time: form.start_time,
          end_time: form.end_time,
          guest_count: Number(form.guest_count),
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(insertError);
        return Swal.fire(
          'Error',
          insertError.message || 'Something went wrong while booking.',
          'error'
        );
      }

      try {
        await supabase.rpc('booking_notify_new_request', {
          p_booking_id: inserted.id,
        });
      } catch (rpcErr) {
        console.warn('booking_notify_new_request failed:', rpcErr?.message || rpcErr);
      }

      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke(
        'create-xendit-invoice',
        {
          body: {
            booking_id: inserted.id,
            amount: reservationFee,
            description: `Reservation fee for booking “${venue.name}”`,
          },
        }
      );

      if (invoiceError || !invoiceData?.invoice_url) {
        console.error('Invoice creation failed:', invoiceError);
        return Swal.fire(
          'Booking Created',
          'We could not start the payment automatically. Please contact support to complete your reservation.',
          'warning'
        );
      }

      await Swal.fire({
        title: 'Booking Created',
        text: 'Redirecting you to secure payment…',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
      });

      window.location.href = invoiceData.invoice_url;
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Unable to process your request right now.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const titleId = 'booking-modal-title';

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {/* ===== HERO (matches new CSS) ===== */}
        <div className="hero">
          <div className="hero-content">
            <div className="hero-meta">
              {/* Optional avatar if you want it */}
              <div className="venue-avatar">
                {venue?.image_urls?.[0] ? (
                  <img
                    src={venue.image_urls[0]}
                    alt={venue.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 12,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  venue?.name?.[0] || 'V'
                )}
              </div>
              <div className="hero-text">
                <h2 id={titleId} ref={titleRef}>
                  Book “{venue.name}”
                </h2>
                <p className="sub">
                  <FiMapPin
                    style={{ fontSize: 12, marginRight: 4, verticalAlign: 'middle' }}
                  />
                  {venue?.location_text || venue?.location || 'Pick a date & time that works'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* ===== BODY ===== */}
        <div className="modal-body">
          <div className="grid">
            {/* LEFT: FORM CARD */}
            <div className="card">
              <div className="field">
                <label htmlFor="eventName">
                  Event Name <span className="required">*</span>
                </label>
                <div className="input-shell">
                  <FiEdit3 className="input-icon" aria-hidden />
                  <input
                    id="eventName"
                    name="event_name"
                    value={form.event_name}
                    onChange={handleChange}
                    placeholder="e.g., John & Jane’s Wedding"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="eventType">
                  Event Type <span className="required">*</span>
                </label>
                <div className="select-shell">
                  <select
                    id="eventType"
                    name="event_type"
                    value={form.event_type}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Select Event Type</option>
                    <option value="Wedding">Wedding</option>
                    <option value="Debut">Debut</option>
                    <option value="Birthday">Birthday</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Christening">Christening</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Others">Others</option>
                  </select>
                  <FiChevronDown className="select-caret" aria-hidden />
                </div>
              </div>

              <div className="two">
                <div className="field">
                  <label htmlFor="eventDate">
                    Event Date <span className="required">*</span>
                  </label>
                  <DatePicker
                    id="eventDate"
                    selectedDate={form.event_date}
                    onDateChange={handleDateChange}
                  />
                </div>

                <div className="mini-summary">
                  <div className="mini-row">
                    <span className="k">Rate</span>
                    <span className="v">
                      {form.event_date ? peso(applicableRate) : '—'}
                    </span>
                  </div>
                  <div className="mini-row">
                    <span className="k">Reservation (10%)</span>
                    <span className="v accent">
                      {form.event_date ? peso(reservationFee) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="two">
                <div className="field">
                  <label htmlFor="startTime">
                    Start Time <span className="required">*</span>
                  </label>
                  <TimePicker
                    id="startTime"
                    selectedTime={form.start_time}
                    onTimeChange={(time) => {
                      const newStart = clampHHMM(
                        time,
                        venueOpen,
                        addMinutesHHMM(venueClose, -15)
                      );
                      const newEndMin = addMinutesHHMM(newStart, 15);
                      const nextEnd =
                        form.end_time && form.end_time >= newEndMin ? form.end_time : '';
                      setForm((prev) => ({
                        ...prev,
                        start_time: newStart,
                        end_time: nextEnd,
                      }));
                    }}
                    min={venueOpen}
                    max={addMinutesHHMM(venueClose, -15)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="endTime">
                    End Time <span className="required">*</span>
                  </label>
                  <TimePicker
                    id="endTime"
                    selectedTime={form.end_time}
                    onTimeChange={(time) => handleTimeChange('end_time', time)}
                    min={endMin}
                    max={endMax}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="guestCount">
                  Number of Guests <span className="required">*</span>
                  {maxCap ? ` (Max ${maxCap})` : ''}
                </label>
                <div className="input-shell">
                  <FiUsers className="input-icon" aria-hidden />
                  <input
                    id="guestCount"
                    type="number"
                    name="guest_count"
                    value={form.guest_count}
                    onChange={handleChange}
                    placeholder="Estimated guest count"
                    min="1"
                    {...(maxCap ? { max: maxCap } : {})}
                    inputMode="numeric"
                    className="input-field"
                    required
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: SUMMARY CARD */}
            <aside className="summary">
              <div className="summary-card">
                <div className="summary-header">
                  <h3>Booking Summary</h3>
                  <span className="badge">
                    {form.event_date
                      ? isWeekend(form.event_date)
                        ? 'Weekend'
                        : 'Weekday'
                      : '—'}
                  </span>
                </div>

                <div className="summary-row">
                  <span>Date</span>
                  <span>{formattedDate || '—'}</span>
                </div>
                <div className="summary-row">
                  <span>Time</span>
                  <span>
                    {form.start_time && form.end_time
                      ? `${formatTime12Hour(form.start_time)} – ${formatTime12Hour(
                          form.end_time
                        )}`
                      : '—'}
                  </span>
                </div>
                <div className="summary-row">
                  <span>Guests</span>
                  <span>{form.guest_count || 0}</span>
                </div>

                <div className="divider" />

                <div className="summary-row">
                  <span>Estimated Rate</span>
                  <span>{peso(applicableRate)}</span>
                </div>
                <div className="summary-row">
                  <span>Reservation (10%)</span>
                  <span style={{ color: '#ea580c', fontWeight: 700 }}>
                    {peso(reservationFee)}
                  </span>
                </div>

                <p className="fineprint">
                  Paying the reservation fee will secure your slot. Remaining balance is
                  settled directly with the venue.
                </p>
              </div>
            </aside>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            aria-label="Cancel booking"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleBook}
            disabled={submitting || !isAuthed}
            aria-busy={submitting}
            title={isAuthed ? undefined : 'Login to book'}
          >
            {submitting ? 'Processing…' : isAuthed ? 'Reserve & Pay' : 'Login to Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
