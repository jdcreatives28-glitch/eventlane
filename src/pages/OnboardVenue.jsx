// src/pages/OnboardVenue.jsx
import React from 'react';
import VenueOnboardingForm from '../components/VenueOnboardingForm';

export default function OnboardVenue() {
  return (
    <div style={{ padding: 0 }}>
      <VenueOnboardingForm
        onSaved={() => {
          // optional: navigate to list, toast, etc.
          // e.g., navigate('/venue-map');
          console.log('Venue saved!');
        }}
      />
    </div>
  );
}
