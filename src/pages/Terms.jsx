import React from 'react';

export default function Terms() {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
        Terms of Service
      </h1>

      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
        Last updated: {new Date().getFullYear()}
      </p>

      {/* 1. Introduction */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        1. Introduction
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Welcome to Eventlane.ph (&quot;Eventlane&quot;, &quot;we&quot;, &quot;us&quot;, or
        &quot;our&quot;). Eventlane.ph is an online platform that helps users discover and
        book event venues and services (the &quot;Platform&quot;). These Terms of Service
        (&quot;Terms&quot;) govern your access to and use of Eventlane.ph, including our
        website, web app, and any related services (collectively, the &quot;Services&quot;).
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        By accessing or using the Services, creating an account, or clicking &quot;Sign
        Up&quot;, you agree to be bound by these Terms. If you do not agree, please do not
        use the Platform.
      </p>

      {/* 2. Definitions */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        2. Definitions
      </h2>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>
          <strong>&quot;User&quot;</strong> – any person who visits, accesses, or uses the
          Platform, including Guests and Venue Owners.
        </li>
        <li>
          <strong>&quot;Guest&quot;</strong> – a User who searches for, inquires about, or
          books a venue through the Platform.
        </li>
        <li>
          <strong>&quot;Venue Owner&quot;</strong> – a User who lists one or more venues on
          the Platform, including owners, managers, or authorized representatives of a
          place.
        </li>
        <li>
          <strong>&quot;Venue&quot;</strong> – any event space, function hall, room, or
          property listed on the Platform for events or gatherings.
        </li>
        <li>
          <strong>&quot;Booking&quot;</strong> – a confirmed reservation made by a Guest for
          a specific Venue on a specific date and time.
        </li>
        <li>
          <strong>&quot;Reservation Fee&quot;</strong> – a non-refundable fee equal to
          <strong> ten percent (10%) of the full agreed rate of the Venue</strong> for the
          booking. This is collected through the Platform to secure the date. Half of this
          Reservation Fee (5% of the full Venue rate) is treated as the Eventlane platform
          / service fee, and the remaining half (5% of the full Venue rate) is credited
          toward the Venue Owner as part of the total amount payable for the event.
        </li>
        <li>
          <strong>&quot;Platform Fee&quot; or &quot;Commission&quot;</strong> – the portion
          of the Reservation Fee retained by Eventlane as payment for use of the Platform
          and services. Unless otherwise stated in a separate written agreement, the
          Platform Fee is equal to fifty percent (50%) of the Reservation Fee (i.e., 5% of
          the full Venue rate under the standard 10% Reservation Fee model). Eventlane may,
          for certain venues or future pricing structures, apply a different commission rate
          based on the full Venue rate (for example, a standard 10% commission) as described
          in Section 7.
        </li>
        <li>
          <strong>&quot;Founding Partner&quot;</strong> – a Venue Owner who has been
          explicitly approved by Eventlane as part of its early-access or launch program,
          and who is granted a special discounted commission rate as described in Section 7.
        </li>
      </ul>

      {/* 3. Our Role */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        3. Our Role as a Platform
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Eventlane.ph is a venue finder and booking facilitation platform. We connect Guests
        and Venue Owners but we do not own, operate, or manage any of the venues listed on
        the Platform. We do not control how Venue Owners run their properties, and we are
        not a party to the contract between Guests and Venue Owners.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Any agreement for use of a Venue (including pricing, inclusions, extra charges,
        and house rules) is strictly between the Guest and the Venue Owner. Eventlane is
        not responsible for the quality, safety, legality, or suitability of any Venue or
        service listed.
      </p>

      {/* 4. Eligibility & Accounts */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        4. Eligibility and Account Registration
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        To create an account or use certain features of the Platform, you must:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Be at least 18 years old and legally capable of entering into a contract.</li>
        <li>
          Provide accurate, current, and complete information during registration and keep
          your account details up to date.
        </li>
        <li>Maintain the confidentiality of your login credentials.</li>
        <li>
          Be responsible for all activities that occur under your account, whether or not
          authorized by you.
        </li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        We may, at our sole discretion, refuse registration, suspend, or terminate accounts
        that violate these Terms or appear fraudulent or abusive.
      </p>

      {/* 5. Listing Venues */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        5. Venue Listings and Responsibilities of Venue Owners
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        If you are a Venue Owner, by creating a listing on Eventlane.ph, you represent and
        warrant that:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>You have the legal right and authority to offer the Venue for events.</li>
        <li>
          All information in your listing (photos, descriptions, pricing, capacity, rules,
          amenities, location, availability, etc.) is accurate, not misleading, and kept
          up to date.
        </li>
        <li>
          Your Venue complies with applicable laws, regulations, permits, and safety
          requirements (including capacity limits, fire safety, health regulations, and
          business permits).
        </li>
        <li>
          You are solely responsible for setting prices, house rules, inclusions, and any
          extra charges (e.g., overtime, corkage, damages, cleaning).
        </li>
        <li>
          You are solely responsible for any taxes, fees, and government charges related to
          your use of the Platform and income from your Venue.
        </li>
      </ul>

      {/* 6. Booking Process, Reservation Fees & Payments */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        6. Booking Process, Reservation Fees, and Payments
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        When a Guest inquires or requests to book a Venue:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>
          The Guest may see a summary of the Venue details, quoted rates, and any
          applicable Reservation Fee and other charges on the Platform.
        </li>
        <li>
          A Booking is considered confirmed only when the Venue Owner accepts the
          booking request (if applicable) and the required Reservation Fee, equal to
          10% of the full Venue rate, is successfully paid through the Platform.
        </li>
        <li>
          The Reservation Fee secures the date and is non-refundable unless otherwise
          stated in the Venue&apos;s written policy or required by law.
        </li>
        <li>
          Of the Reservation Fee (10% of the full Venue rate), fifty percent (50%)
          is retained by Eventlane as the Platform Fee or commission (5% of the full
          Venue rate under the current model), and the remaining fifty percent (50%)
          is credited toward the Venue Owner as part of the total amount payable for
          the event.
        </li>
        <li>
          The remaining balance (90% of the full Venue rate) and any additional amounts
          (e.g., security deposit, overtime, add-ons, damages) may be settled directly
          between the Guest and the Venue Owner, according to their agreement and
          payment schedule.
        </li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        As a simple example: if the agreed full Venue rate is ₱20,000, the Reservation Fee
        is ₱2,000 (10%). Of that ₱2,000, ₱1,000 (5% of ₱20,000) is retained by Eventlane as
        Platform Fee, and ₱1,000 is credited to the Venue Owner as part of the ₱20,000
        payable. The remaining ₱18,000 is typically paid according to the Venue&apos;s
        balance payment schedule.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Payments processed through the Platform may be handled by third-party payment
        processors. By using these services, you agree to the terms and policies of such
        third parties. Eventlane does not store your full payment card details and is not
        responsible for issues arising from the payment processor&apos;s systems.
      </p>

      {/* 7. Commissions & Service Fees */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        7. Commissions and Platform Service Fees
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Eventlane earns its revenue primarily from the Platform Fee (commission) that is
        built into the Reservation Fee. For each successful booking where a Reservation Fee
        is paid:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>
          The Reservation Fee is 10% of the full Venue rate for that booking; and
        </li>
        <li>
          Under the current model, Eventlane&apos;s Platform Fee is half (50%) of that
          Reservation Fee, equivalent to 5% of the full Venue rate, and the remaining half
          is credited toward the Venue Owner.
        </li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        The Platform Fee is retained by Eventlane as compensation for marketing, software,
        customer support, and other services provided by the Platform. The remaining portion
        of the Reservation Fee is credited to the Venue Owner as part of the total amount
        payable for the booking.
      </p>

      {/* 7.1 Founding Partner Rate */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>
        7.1 Founding Partner Rate
      </h3>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Certain Venue Owners may be approved by Eventlane as <strong>Founding Partners</strong>
        as part of an early-access, pilot, or launch program. For Founding Partners, Eventlane
        may apply a special discounted commission rate equivalent to <strong>5% of the full
        Venue rate</strong> (calculated as 50% of the 10% Reservation Fee), for bookings
        processed through the Platform.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Unless otherwise stated in writing, this Founding Partner rate is intended to remain
        locked for the approved venue(s) as long as:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>The account remains active and in good standing;</li>
        <li>The Venue Owner continues to comply with these Terms and with Eventlane&apos;s policies;</li>
        <li>The listing is not abandoned, misused, or repeatedly involved in policy violations.</li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        The Founding Partner rate is personal to the approved venue(s), is not transferable to
        other venues or new owners, and may be revoked if the Venue Owner violates these Terms
        or misuses the Platform.
      </p>

      {/* 7.2 Standard Commission Rate & Future Adjustments */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>
        7.2 Standard Commission Rate and Future Adjustments
      </h3>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Eventlane reserves the right to introduce and apply a <strong>standard platform
        commission rate of up to ten percent (10%) of the full Venue rate</strong> for newly
        onboarded venues or for specific categories of venues, whether calculated directly on
        the full Venue rate or through a revised Reservation Fee structure.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Any such standard rate or adjustment will generally apply to:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Venues that join the Platform after the new standard rate is announced; and/or</li>
        <li>Venues that are not part of the Founding Partner program.</li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Eventlane may update commission rates, fee structures, and payout methods from
        time to time. When material changes occur, we will provide reasonable notice
        (for example, through the Platform interface or via email). Your continued use
        of the Platform after such changes take effect means you accept the updated fees.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Unless expressly stated otherwise in writing, <strong>Founding Partners will retain
        their discounted rate</strong> even if the standard commission for new venues is
        increased, provided they remain active and in good standing under these Terms.
      </p>

      {/* 8. Cancellations, Changes & Refunds */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        8. Cancellations, Changes, and Refunds
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Each Venue may have its own cancellation, change, and refund policy, which should
        be clearly communicated in the Venue listing or booking agreement. It is the
        responsibility of both Guests and Venue Owners to review and agree on these terms
        before confirming the booking.
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>
          As a general rule, Reservation Fees are non-refundable, except when explicitly
          stated otherwise in the Venue&apos;s policy or required by applicable law.
        </li>
        <li>
          Changes to event dates, guest counts, or inclusions may affect pricing and are
          subject to the Venue Owner&apos;s approval.
        </li>
        <li>
          Any refund decisions for amounts paid to the Venue are primarily between the Guest
          and the Venue Owner, and Eventlane is not obliged to refund amounts directly unless
          clearly specified by Eventlane or required by law.
        </li>
      </ul>

      {/* 9. User Conduct & Prohibited Activities */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        9. User Conduct and Prohibited Activities
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        You agree not to use the Platform to:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Violate any law, regulation, or third-party rights.</li>
        <li>
          Post inaccurate, misleading, or fraudulent information about yourself, your
          Venue, or your event.
        </li>
        <li>
          Harass, abuse, or harm other Users, including sending spam or unwanted
          communications.
        </li>
        <li>
          Upload or share content that is defamatory, obscene, hateful, or inappropriate.
        </li>
        <li>
          Attempt to interfere with the security, integrity, or operation of the
          Platform (e.g., hacking, scraping, using bots or automated systems without
          permission).
        </li>
        <li>
          Circumvent the Platform to avoid paying Eventlane&apos;s commission or fees for
          bookings initiated on Eventlane.
        </li>
      </ul>

      {/* 10. Reviews & Feedback */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        10. Reviews and Feedback
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Guests may be allowed to leave ratings, photos, or reviews for Venues and
        experiences. By posting a review, you agree that:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Your feedback is honest, accurate, and based on your actual experience.</li>
        <li>
          You will not post false, offensive, or defamatory content or use reviews to
          pressure or threaten other Users.
        </li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Eventlane may moderate, hide, or remove reviews that violate these Terms or our
        community standards, but we are not obligated to monitor all content at all times.
      </p>

      {/* 11. Intellectual Property */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        11. Intellectual Property
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        The Platform, including its design, logo, branding, text, graphics, and software,
        is owned or licensed by Eventlane and is protected by intellectual property laws.
        You may not copy, modify, distribute, or create derivative works based on the
        Platform without our prior written consent.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        By posting content (such as photos, listings, or reviews) on the Platform, you
        grant Eventlane a non-exclusive, worldwide, royalty-free license to use, display,
        reproduce, and distribute such content in connection with operating and promoting
        the Platform, subject to our Privacy Policy.
      </p>

      {/* 12. Privacy */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        12. Privacy
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Your use of the Platform is also governed by our Privacy Policy, which explains
        how we collect, use, and protect your personal data. By using the Platform, you
        consent to our collection and use of your data as described in the Privacy Policy.
      </p>

      {/* 13. Third-Party Services */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        13. Third-Party Links and Services
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        The Platform may contain links to third-party websites or services (such as map
        providers, payment gateways, or messaging apps). These are provided for
        convenience only. Eventlane does not endorse, control, or assume responsibility
        for any third-party websites or services. Your use of them is at your own risk and
        subject to their own terms and policies.
      </p>

      {/* 14. Disclaimers */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        14. Disclaimers
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        The Platform and Services are provided on an &quot;as is&quot; and &quot;as
        available&quot; basis. To the fullest extent permitted by law, Eventlane disclaims
        all warranties, express or implied, including but not limited to warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        We do not guarantee that:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>The Platform will be error-free, secure, or available at all times;</li>
        <li>
          Any Venue will meet your expectations, be available on a given date, or be
          suitable for your specific event; or
        </li>
        <li>All content on the Platform is accurate, complete, or up to date.</li>
      </ul>

      {/* 15. Limitation of Liability */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        15. Limitation of Liability
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        To the fullest extent permitted by law, Eventlane, its owners, directors,
        employees, and partners shall not be liable for any indirect, incidental,
        consequential, special, or punitive damages, or any loss of profits, revenue,
        data, or goodwill arising out of or related to your use of the Platform, even if
        we have been advised of the possibility of such damages.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        In any case, our total aggregate liability to you for any claims arising out of or
        related to the Platform shall not exceed the total fees (if any) paid by you to
        Eventlane in the six (6) months preceding the event giving rise to the claim.
      </p>

      {/* 16. Indemnification */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        16. Indemnification
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        You agree to indemnify, defend, and hold harmless Eventlane and its affiliates,
        officers, employees, and partners from and against any claims, demands, damages,
        losses, liabilities, costs, or expenses (including reasonable legal fees) arising
        out of or related to:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Your use or misuse of the Platform;</li>
        <li>Your breach of these Terms or any applicable law;</li>
        <li>
          Your content, listings, or actions as a Guest or Venue Owner, including any
          disputes between Guests and Venue Owners.
        </li>
      </ul>

      {/* 17. Changes to the Services and Terms */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        17. Changes to the Platform and these Terms
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        We may update, modify, or discontinue parts of the Platform at any time, with or
        without notice. We may also update these Terms from time to time. When we do, we
        will post the updated Terms on Eventlane.ph and update the &quot;Last
        updated&quot; date at the top.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        Your continued use of the Platform after any changes take effect means you accept
        the updated Terms. If you do not agree to the changes, you must stop using the
        Platform.
      </p>

      {/* 18. Suspension & Termination */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        18. Suspension and Termination
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        We may, at our sole discretion and without prior notice, suspend or terminate your
        access to the Platform if:
      </p>
      <ul style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, paddingLeft: 20 }}>
        <li>You violate these Terms or any applicable law;</li>
        <li>Your actions pose a risk or potential harm to other Users or to Eventlane;</li>
        <li>We are required to do so by law or by a government authority.</li>
      </ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        You may also choose to stop using the Platform and request account deletion by
        contacting us through our official support channels.
      </p>

      {/* 19. Governing Law & Dispute Resolution */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        19. Governing Law and Dispute Resolution
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        These Terms shall be governed by and construed in accordance with the laws of the
        Republic of the Philippines, without regard to its conflict of law principles.
      </p>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        In case of any dispute arising from or related to these Terms or your use of the
        Platform, the parties shall first attempt to resolve the dispute amicably. If no
        settlement is reached, the dispute shall be submitted to the proper courts of the
        Philippines, unless otherwise required by mandatory law.
      </p>

      {/* 20. Contact Us */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
        20. Contact Us
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
        If you have any questions about these Terms or the Platform, you may contact us
        through our official channels as listed on Eventlane.ph (for example, our contact
        form, email address, or official social media pages).
      </p>


    </div>
  );
}
