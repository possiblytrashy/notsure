import LegalLayout from '../LegalLayout';

export const metadata = {
  title: 'Terms and Conditions',
  description: 'OUSTED Terms and Conditions — the rules governing your use of our event ticketing platform.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms and Conditions" lastUpdated={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}>

      <h2 className="legal-h2">1. Acceptance of Terms</h2>
      <p className="legal-p">By accessing or using the OUSTED platform at oustedad.vercel.app (the "Platform"), creating an account, purchasing a ticket, casting a vote, or acting as a reseller, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform.</p>
      <p className="legal-p">We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms.</p>

      <h2 className="legal-h2">2. Description of Services</h2>
      <p className="legal-p">OUSTED is an event ticketing and competition voting platform that provides:</p>
      <ul className="legal-ul">
        <li>Online purchase of tickets to events organised by third-party organisers</li>
        <li>Competition and voting portals for live contests</li>
        <li>A reseller programme allowing approved users to earn 10% commission per ticket sold</li>
        <li>Organiser tools for event creation, ticket tier management, and revenue tracking</li>
      </ul>
      <p className="legal-p">OUSTED acts as a technology intermediary. We are not the organiser, producer, or promoter of any event listed on the Platform unless explicitly stated.</p>

      <h2 className="legal-h2">3. Account Registration</h2>
      <p className="legal-p">You must provide accurate, current, and complete information when creating an account. You must be at least 18 years of age. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.</p>

      <h2 className="legal-h2">4. Ticket Purchases</h2>
      <p className="legal-p"><span className="legal-strong">Pricing:</span> All ticket prices are set by the event organiser. OUSTED adds a platform service fee of 5% on top. Reseller purchases may include an additional commission of up to 10%. The total shown at checkout is the final amount charged.</p>
      <p className="legal-p"><span className="legal-strong">Payment:</span> All payments are processed by Paystack. OUSTED currently receives all payments into its platform account and distributes funds to organisers and resellers according to its internal payout schedule. Payment is made at a period of about 3 business days after the purchase of a ticket or vote. Ousted is not to be held liable for late or delayed payments as this may have been caused by the payment service provider.</p>
      <p className="legal-p"><span className="legal-strong">Delivery:</span> Your ticket will appear in your account dashboard and be emailed upon successful payment. Tickets contain a cryptographically signed QR code. Forged or duplicated QR codes will be rejected at entry.</p>
      <p className="legal-p"><span className="legal-strong">Refunds:</span> All ticket sales are final unless an event is cancelled. In case of cancellation, refunds will be processed within 10 business days. Refunds will be conducted in coordination with the event organizer. Ousted does not guarantee refunds and the likelihood of refunds is very low. Ousted is not to be help responsible for event cancellations. OUSTED does not guarantee refunds for postponed events or where you are unable to attend.</p>

      <h2 className="legal-h2">5. Reseller Programme</h2>
      <p className="legal-p">Approved resellers earn a 10% commission on the base ticket price for each sale through their unique link. Resellers are independent contractors. Commissions are subject to verification. We reserve the right to suspend reseller access and withhold commissions for fraudulent activity or breach of these Terms.</p>

      <h2 className="legal-h2">6. Organiser Obligations</h2>
      <p className="legal-p">Event organisers are solely responsible for the accuracy of event information, delivery of the event as advertised, and compliance with all applicable laws. OUSTED is not liable for cancelled, postponed, or misrepresented events. Organisers indemnify OUSTED against all claims arising from their events.</p>

      <h2 className="legal-h2">7. Prohibited Conduct</h2>
      <ul className="legal-ul">
        <li>Forging, duplicating, or tampering with any QR code or ticket</li>
        <li>Using the Platform for fraudulent, unlawful, or deceptive purposes</li>
        <li>Reverse-engineering or scraping the Platform without authorisation</li>
        <li>Uploading viruses, malware, or malicious code</li>
        <li>Creating multiple accounts to circumvent restrictions</li>
        <li>Reselling tickets at inflated prices outside the authorised programme</li>
      </ul>

      <h2 className="legal-h2">8. Intellectual Property</h2>
      <p className="legal-p">All content on the Platform, including the OUSTED brand, logo, software, and design, is owned by or licensed to OUSTED. You may not reproduce, distribute, or create derivative works without prior written consent.</p>

      <h2 className="legal-h2">9. Limitation of Liability</h2>
      <p className="legal-p">To the maximum extent permitted by law, OUSTED shall not be liable for any indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid for the specific ticket or service giving rise to the claim.</p>

      <h2 className="legal-h2">10. Governing Law</h2>
      <p className="legal-p">These Terms are governed by the laws of Ghana. Disputes shall first be attempted to be resolved through good-faith negotiation, then submitted to the courts of competent jurisdiction in Ghana.</p>

      <h2 className="legal-h2">11. Contact</h2>
      <p className="legal-p">For questions about these Terms, contact us at <a href="mailto:oustedad@gmail.com" style={{ color: '#000', fontWeight: 800 }}>oustedad@gmail.com</a></p>

    </LegalLayout>
  );
}
