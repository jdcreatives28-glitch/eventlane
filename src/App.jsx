// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import FooterNav from './components/FooterNav';
import AnimatedRoutes from './AnimatedRoutes';
import AuthModal from './components/AuthModal';

import Events from './pages/Events';
import VenueMap from './pages/VenueMap';
import VenueDetails from './pages/VenueDetails';
import LiveEventsMap from './pages/LiveEventsMap';
import BookingDetails from './pages/BookingDetails';
import MessagesTab from "./pages/MessagesTab";
import ErrorBoundary from "./components/ErrorBoundary";
import OnboardVenue from './pages/OnboardVenue';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import BookingForm from './pages/BookingForm';

// 🔔 unread context
import { useUnread } from './context/UnreadProvider';

// 🔒 route guard
import ProtectedRoute from './ProtectedRoute';

// ✅ auth listener
import { supabase } from './supabaseClient';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const contentRef = useRef(null);
  const [authOpen, setAuthOpen] = useState(false);

  const { unread } = useUnread() || { unread: 0 };

  // per-route scroll memory
  const scrollMemoRef = useRef({}); // { [pathname]: number }

  const isEvents = location.pathname === '/events';

  // auto-hide UI states
  const [topHidden, setTopHidden] = useState(false);
  const [topElevated, setTopElevated] = useState(false);
  const [bottomHidden, setBottomHidden] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  // Open auth modal from anywhere
  useEffect(() => {
    const open = () => setAuthOpen(true);
    window.addEventListener('open-auth', open);
    return () => window.removeEventListener('open-auth', open);
  }, []);

  // Close auth on successful sign in
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setAuthOpen(false);
    });
    return () => {
      try { data?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  // Detect mobile
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handleResize = (e) => setIsMobile(e.matches);
    handleResize(mql);
    mql.addEventListener('change', handleResize);
    return () => mql.removeEventListener('change', handleResize);
  }, []);

  // Close sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Open AuthModal when routed to /login (keep background content)
  useEffect(() => {
    if (location.pathname === '/login') setAuthOpen(true);
  }, [location.pathname]);

  // Attach scroll listener (and store per-route scrollTop)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const THRESHOLD = 6;

    const onScroll = () => {
      scrollMemoRef.current[location.pathname] = el.scrollTop || 0;
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        const y = el.scrollTop || 0;
        const last = lastYRef.current;
        const delta = y - last;

        setTopElevated(y > 2);

        if (delta > THRESHOLD && y > 48) {
          setTopHidden(true);
          setBottomHidden(true);
        } else if (delta < -THRESHOLD) {
          setTopHidden(false);
          setBottomHidden(false);
        }

        if (y < 24) {
          setTopHidden(false);
          setBottomHidden(false);
        }

        lastYRef.current = y;
        tickingRef.current = false;
      });
    };

    lastYRef.current = el.scrollTop || 0;
    el.addEventListener('scroll', onScroll, { passive: true });
    scrollMemoRef.current[location.pathname] = el.scrollTop || 0;

    return () => {
      el.removeEventListener('scroll', onScroll);
      scrollMemoRef.current[location.pathname] = el.scrollTop || 0;
    };
  }, [location.pathname]);

  // Restore scrollTop on route change
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const saved = scrollMemoRef.current[location.pathname] ?? 0;
    el.scrollTo({ top: saved, behavior: 'auto' });
  }, [location.pathname]);

  // Styles for sticky top wrapper
  const topWrapStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    transform: topHidden ? 'translateY(-110%)' : 'translateY(0)',
    transition: 'transform 200ms ease, box-shadow 150ms ease, border-color 150ms ease',
    background: '#fff',
    willChange: 'transform',
    boxShadow: topElevated ? '0 1px 0 rgba(0,0,0,0.06)' : 'none',
  };

  // main-content is the scroll container
  const mainContentStyle = {
    position: 'relative',
    overflow: 'auto',
    height: '100vh',
    WebkitOverflowScrolling: 'touch',
    background: '#f7f9fb',
    // keep content clear of the fixed footer
    paddingBottom: 72, // ~ FooterNav height
  };

  return (
    <div className="app-layout">
      {!isMobile && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-content" ref={contentRef} style={mainContentStyle}>
        {/* Sticky Topbar */}
        <div style={topWrapStyle}>
          <Topbar
            onMenuClick={() => !isMobile && setSidebarOpen(prev => !prev)}
            onLoginClick={() => setAuthOpen(true)}
            unread={unread}
          />
        </div>

        {/* Keep Events mounted always, just hide/show it */}
        <div aria-hidden={!isEvents} style={{ display: isEvents ? 'block' : 'none' }}>
          <Events />
        </div>

        {/* Other routes when NOT on /events */}
        {!isEvents && (
          <Routes>
            <Route path="/live-events-map" element={<LiveEventsMap />} />
            <Route path="/booking" element={<BookingDetails />} />
            <Route path="/booking/:id" element={<BookingDetails />} />
            <Route
              path="/messages"
              element={
                <ErrorBoundary>
                  <MessagesTab onUnreadChange={() => {}} />
                </ErrorBoundary>
              }
            />
            <Route path="/venue-map" element={<VenueMap />} />
            <Route path="/venue/:id" element={<VenueDetails />} />
            <Route path="/venues/:id" element={<VenueDetails />} />

            {/* 🔒 Protect venue onboarding */}
            <Route
              path="/venue-onboarding"
              element={
                <ProtectedRoute>
                  <OnboardVenue />
                </ProtectedRoute>
              }
            />

            {/* Route that just triggers the login modal via effect */}
            <Route path="/login" element={<div />} />

            {/* Static pages + booking */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/venues/:id/book" element={<BookingForm />} />

            {/* ✅ Reset password page for Supabase recovery link */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Fallback */}
            <Route path="*" element={<AnimatedRoutes />} />
          </Routes>
        )}

        {/* FooterNav renders directly; it controls its own fixed positioning */}
        <FooterNav hidden={bottomHidden} />

        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    </div>
  );
}
