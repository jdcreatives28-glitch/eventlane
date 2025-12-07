// src/AnimatedRoutes.jsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Home from './pages/Home';
import VenueList from './pages/VenueList';
import VenueDetails from './pages/VenueDetails';
import MyListings from './pages/MyListings';
import VenueManager from './pages/VenueManager';

// 🔒 guard
import ProtectedRoute from './ProtectedRoute';

export default function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    const scroller = document.querySelector('.main-content');
    if (!scroller) return;

    // Do NOT interfere with Social (we preserve/restore there)
    if (location.pathname === '/events') return;

    // For non-Social routes, scroll to top
    scroller.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/venues" element={<VenueList />} />
        <Route path="/venues/:id" element={<VenueDetails />} />

        {/* Owner pages (protected) */}
        <Route
          path="/my-listings"
          element={
            <ProtectedRoute>
              <MyListings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute>
              <VenueManager />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
