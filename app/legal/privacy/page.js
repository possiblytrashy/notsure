import LegalLayout from '../LegalLayout';

export const metadata = {
  title: 'Privacy Policy',
  description: 'OUSTED Privacy Policy — how we collect, use, and protect your personal information.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}>

      <h2 className="legal-h2">1. Introduction</h2>
      <p className="legal-p">OUSTED ("we", "us", "our") operates the platform at ousted.live. This Privacy Policy explains how we collect, use, store, and share your personal information. By using the Platform, you consent to the practices described here.</p>

      <h2 className="legal-h2">2. Information We Collect</h2>
      <p className="legal-p"><span className="legal-strong">Information you provide:</span></p>
      <ul className="legal-ul">
        <li>Account information: name, email address, phone number</li>
        <li>Payment information: processed entirely by Paystack — we do not store your card details</li>
        <li>Event and ticket information: events attended, ticket tiers purchased</li>
        <li>Reseller information: business name, mobile money or bank details for payout</li>
        <li>Communications: messages sent through support channels</li>
      </ul>
      <p className="legal-p"><span className="legal-strong">Information collected automatically:</span></p>
      <ul className="legal-ul">
        <li>Device information: IP address, browser type, operating system</li>
        <li>Usage data: pages visited, features used, time on Platform</li>
        <li>Transaction data: payment references, purchases, vote counts</li>
      </ul>

      <h2 className="legal-h2">3. How We Use Your Information</h2>
      <ul className="legal-ul">
        <li>Create and manage your account</li>
        <li>Process ticket purchases and issue tickets</li>
        <li>Process vote transactions and record results</li>
        <li>Pay out reseller commissions and organiser revenue</li>
        <li>Send transactional emails (ticket confirmations, receipts)</li>
        <li>Detect and prevent fraud, including QR code forgery</li>
        <li>Improve and personalise the Platform</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2 className="legal-h2">4. How We Share Your Information</h2>
      <p className="legal-p">We do not sell your personal information. We may share it with:</p>
      <ul className="legal-ul">
        <li><span className="legal-strong">Paystack</span> — for payment processing, subject to their Privacy Policy</li>
        <li><span className="legal-strong">Supabase</span> — our database and authentication provider; data stored securely in their infrastructure</li>
        <li><span className="legal-strong">Event organisers</span> — your name and email may be shared with the organiser of events you purchase tickets for, for entry management purposes only</li>
        <li><span className="legal-strong">Law enforcement or regulators</span> — when required by law or to protect our legal rights</li>
      </ul>

      <h2 className="legal-h2">5. Data Retention</h2>
      <p className="legal-p">We retain your personal information for as long as your account is active and for 7 years thereafter, as required for financial record-keeping. You may request deletion by contacting legal@ousted.live, subject to legal retention obligations.</p>

      <h2 className="legal-h2">6. Your Rights</h2>
      <p className="legal-p">You have the right to:</p>
      <ul className="legal-ul">
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate or incomplete data</li>
        <li>Request deletion of your personal data (subject to legal obligations)</li>
        <li>Object to or restrict our processing of your data</li>
        <li>Receive a copy of your data in a portable format</li>
      </ul>
      <p className="legal-p">To exercise any right, contact <a href="mailto:legal@ousted.live" style={{ color: '#000', fontWeight: 800 }}>legal@ousted.live</a>. We will respond within 30 days.</p>

      <h2 className="legal-h2">7. Cookies</h2>
      <p className="legal-p">We use essential cookies necessary for the Platform to function (such as session authentication). We do not use third-party advertising cookies. You can control cookies through your browser settings, though disabling essential cookies may impair Platform functionality.</p>

      <h2 className="legal-h2">8. Security</h2>
      <p className="legal-p">We implement appropriate technical and organisational measures to protect your personal data, including SSL/TLS encryption, cryptographically signed QR codes, and secure third-party infrastructure. No system is completely secure, and we cannot guarantee absolute security.</p>

      <h2 className="legal-h2">9. Children</h2>
      <p className="legal-p">The Platform is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, contact us immediately at <a href="mailto:legal@ousted.live" style={{ color: '#000', fontWeight: 800 }}>legal@ousted.live</a>.</p>

      <h2 className="legal-h2">10. Changes to This Policy</h2>
      <p className="legal-p">We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by prominent notice on the Platform. Continued use after changes constitutes acceptance of the updated Policy.</p>

      <h2 className="legal-h2">11. Contact</h2>
      <p className="legal-p">Data Controller: OUSTED<br />Contact: <a href="mailto:legal@ousted.live" style={{ color: '#000', fontWeight: 800 }}>legal@ousted.live</a></p>

    </LegalLayout>
  );
}
