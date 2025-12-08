// src/pages/About.jsx
import React, { useEffect, useState } from 'react';

const THEME = {
  bg: '#f5f7fb',
  panel: '#ffffff',
  accent: '#635bff',
  accentSoft: 'rgba(99,91,255,0.08)',
  text: '#0f172a',
  textMuted: '#64748b',
  border: 'rgba(148,163,184,0.35)',
  shadow: '0 20px 50px rgba(15,23,42,0.10)',
};

export default function About() {
  // 🔹 Mobile detection for responsive layout
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const onResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #fdfbff 0, #f5f7fb 40%, #e9edff 100%)',
        padding: isMobile ? '14px 10px 90px' : '20px 16px 40px', // extra bottom for footer nav
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          background: THEME.panel,
          borderRadius: isMobile ? 18 : 24,
          border: `1px solid ${THEME.border}`,
          boxShadow: THEME.shadow,
          padding: isMobile ? '16px 14px 20px' : '22px 20px 28px',
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: isMobile ? 14 : 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              color: THEME.textMuted,
              fontWeight: 700,
            }}
          >
            About Us
          </span>
          <h1
            style={{
              fontSize: isMobile ? 20 : 24,
              lineHeight: 1.25,
              margin: 0,
              color: THEME.text,
            }}
          >
            Eventlane – your smarter way to find and book event venues.
          </h1>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.6,
              margin: 0,
              color: THEME.textMuted,
            }}
          >
            Eventlane is an online venue discovery and booking platform that connects
            people planning events with trusted venues. From weddings and birthdays
            to corporate gatherings and intimate celebrations, we help you find
            the right place—without the endless back-and-forth.
          </p>
        </div>

        {/* Two-column content */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(0, 2.1fr) minmax(0, 1.6fr)',
            gap: isMobile ? 14 : 18,
          }}
        >
          {/* Left side – What we do */}
          <div
            style={{
              padding: isMobile ? 12 : 16,
              borderRadius: 18,
              background: THEME.bg,
              border: `1px solid rgba(148,163,184,0.25)`,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                margin: '0 0 8px',
                color: THEME.text,
              }}
            >
              What we do
            </h2>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                margin: 0,
                color: THEME.textMuted,
              }}
            >
              Our platform lets you:
            </p>
            <ul
              style={{
                margin: '8px 0 0',
                paddingLeft: 18,
                fontSize: 13.5,
                lineHeight: 1.7,
                color: THEME.textMuted,
              }}
            >
              <li>Browse venue listings with photos, descriptions, and pricing.</li>
              <li>Check capacity, event types, and available amenities.</li>
              <li>Send booking or inquiry requests directly to venue owners.</li>
              <li>Compare options and plan your event in one place.</li>
            </ul>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                marginTop: 10,
                color: THEME.textMuted,
              }}
            >
              Eventlane serves as a bridge between customers and venue partners. We
              provide the platform and tools so that both sides can communicate
              clearly and manage event details more efficiently.
            </p>
          </div>

          {/* Right side – How it works */}
          <div
            style={{
              padding: isMobile ? 12 : 16,
              borderRadius: 18,
              background: THEME.accentSoft,
              border: `1px solid rgba(99,91,255,0.22)`,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                margin: '0 0 8px',
                color: THEME.text,
              }}
            >
              How Eventlane works
            </h2>
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13.5,
                lineHeight: 1.7,
                color: THEME.textMuted,
              }}
            >
              <li>Explore venues based on location, budget, and capacity.</li>
              <li>Open a venue page to view full details and photos.</li>
              <li>Send an inquiry or booking request through our platform.</li>
              <li>Coordinate directly with the venue for final confirmation.</li>
            </ol>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                marginTop: 10,
                color: THEME.textMuted,
              }}
            >
              We continuously onboard more venues and improve the booking
              experience so you can focus less on logistics and more on the
              celebration itself.
            </p>
          </div>
        </div>

        {/* Disclaimer / platform note */}
        <div
          style={{
            marginTop: isMobile ? 14 : 18,
            padding: isMobile ? 10 : 14,
            borderRadius: 14,
            background: '#f9fafb',
            border: `1px dashed rgba(148,163,184,0.6)`,
          }}
        >
          <p
            style={{
              fontSize: 12.5,
              margin: 0,
              color: THEME.textMuted,
            }}
          >
            <strong style={{ color: THEME.text }}>Note:</strong> Eventlane is a
            venue listing and booking platform. All venue information, pricing, and
            policies are provided by our venue partners. Any final agreements or
            payments are made between the customer and the venue.
          </p>
        </div>
      </div>
    </div>
  );
}
