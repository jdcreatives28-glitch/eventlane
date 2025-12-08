// src/pages/Contact.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.from('contact_messages').insert([
        {
          name,
          email,
          message,
        },
      ]);

      if (error) {
        console.error('Error inserting contact message:', error);
        alert('Something went wrong while sending your message. Please try again.');
      } else {
        alert('Thank you for your message! We will contact you via email as soon as possible.');
        setName('');
        setEmail('');
        setMessage('');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #fdfbff 0, #f5f7fb 40%, #e9edff 100%)',
        padding: isMobile ? '14px 10px 90px' : '20px 16px 40px', // extra bottom space for mobile footer nav
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
            Contact
          </span>
          <h1
            style={{
              fontSize: isMobile ? 20 : 24,
              lineHeight: 1.25,
              margin: 0,
              color: THEME.text,
            }}
          >
            Get in touch with the EventLane team.
          </h1>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.6,
              margin: 0,
              color: THEME.textMuted,
            }}
          >
            For questions about bookings, venue partnerships, or technical issues,
            you can reach us using the details below. We’ll do our best to respond
            as soon as possible within our operating hours.
          </p>
        </div>

        {/* Contact info + form */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(0, 1.4fr) minmax(0, 2fr)',
            gap: isMobile ? 14 : 18,
          }}
        >
          {/* Contact info block */}
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
              Contact information
            </h2>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13.5,
                color: THEME.textMuted,
              }}
            >
              <li>
                <strong style={{ color: THEME.text }}>Email:</strong>{' '}
                <a
                  href="mailto:support@eventlane.ph"
                  style={{
                    color: THEME.accent,
                    textDecoration: 'none',
                  }}
                >
                  jdcreatives28@gmail.com
                </a>
              </li>
              <li>
                <strong style={{ color: THEME.text }}>Phone:</strong>{' '}
                <span>+63 975 707 7028</span>
              </li>
              <li>
                <strong style={{ color: THEME.text }}>Business Address:</strong>{' '}
                <span>Balanga City, Bataan, Philippines</span>
              </li>

            </ul>

            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                background: '#f9fafb',
                border: `1px dashed rgba(148,163,184,0.7)`,
                fontSize: 12.5,
                color: THEME.textMuted,
              }}
            >
              For venue owners who want to list their place on EventLane, please
              contact us via email with your venue details, location, and preferred
              contact person.
            </div>
          </div>

          {/* Contact form connected to Supabase */}
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
              Send us a message
            </h2>
            <p
              style={{
                fontSize: 12.5,
                margin: '0 0 10px',
                color: THEME.textMuted,
              }}
            >
              Fill out this quick form and we’ll reach out via email.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: THEME.text,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: 10,
                    border: `1px solid rgba(148,163,184,0.7)`,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: THEME.text,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: 10,
                    border: `1px solid rgba(148,163,184,0.7)`,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: THEME.text,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="How can we help you?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: 10,
                    border: `1px solid rgba(148,163,184,0.7)`,
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 4,
                  padding: '8px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  background: 'linear-gradient(135deg, #635bff, #ff6ad5)',
                  color: '#ffffff',
                  boxShadow: '0 12px 30px rgba(99,91,255,0.35)',
                }}
              >
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
