import LegalLayout from '../LegalLayout';

export const metadata = {
  title: 'User Agreement',
  description: 'OUSTED User Agreement — the operational rules governing your individual use of the platform.',
  robots: { index: true, follow: true },
};

export default function UserAgreementPage() {
  return (
    <LegalLayout title="User Agreement" lastUpdated={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}>

      <h2 className="legal-h2">1. Nature of This Agreement</h2>
      <p className="legal-p">This User Agreement governs the specific relationship between you as an individual user and OUSTED. It supplements and should be read together with our Terms and Conditions and Privacy Policy. In the event of conflict, the Terms and Conditions take precedence.</p>

      <h2 className="legal-h2">2. Account Responsibilities</h2>
      <p className="legal-p">You are solely responsible for all activities conducted through your account. You must:</p>
      <ul className="legal-ul">
        <li>Keep your password secure and not share it with any third party</li>
        <li>Log out from shared devices after use</li>
        <li>Immediately report any suspected unauthorised use to <a href="mailto:oustedad@gmail.com" style={{ color: '#000', fontWeight: 800 }}>oustedad@gmail.com</a></li>
        <li>Ensure all information you provide is accurate and up to date</li>
      </ul>
      <p className="legal-p">OUSTED will not be liable for any loss or damage arising from your failure to comply with these obligations.</p>

      <h2 className="legal-h2">3. Ticket Use and Entry</h2>
      <p className="legal-p">Tickets purchased on OUSTED are:</p>
      <ul className="legal-ul">
        <li>Personal and non-transferable unless the Platform expressly permits transfer</li>
        <li>Valid for a single entry only — QR codes are cryptographically signed and invalidated upon scan</li>
        <li>Void if tampered with, duplicated, forged, or purchased through unauthorised channels</li>
      </ul>
      <p className="legal-p">Presentation of a forged or invalid ticket will result in denial of entry. OUSTED is not responsible for tickets purchased from unauthorised third-party sellers. You are responsible for arriving with a valid, accessible copy of your ticket. Technical difficulties with your device do not entitle you to a replacement ticket or entry.</p>

      <h2 className="legal-h2">4. Voting and Competitions</h2>
      <p className="legal-p">When you participate in a voting event:</p>
      <ul className="legal-ul">
        <li>You confirm your votes are genuine and not automated or artificially inflated</li>
        <li>Vote purchases are final and non-refundable once submitted</li>
        <li>You agree not to attempt to manipulate, hack, or exploit the voting system</li>
        <li>Competition results are determined solely by vote count as recorded by our platform</li>
      </ul>
      <p className="legal-p">OUSTED reserves the right to disqualify votes it reasonably believes to be fraudulent or automated, without refund.</p>

      <h2 className="legal-h2">5. Reseller Conduct</h2>
      <p className="legal-p">If you participate in the Reseller Programme:</p>
      <ul className="legal-ul">
        <li>You act as an independent contractor, not an employee or agent of OUSTED</li>
        <li>You must represent all events, ticket prices, and terms accurately</li>
        <li>You must not make false or misleading representations about OUSTED</li>
        <li>Commissions are subject to verification and may be withheld in cases of suspected fraud</li>
        <li>Reseller access may be terminated at any time for breach of these terms</li>
      </ul>

      <h2 className="legal-h2">6. Acceptable Use</h2>
      <p className="legal-p">You agree to use the Platform only for lawful purposes and in a manner that does not:</p>
      <ul className="legal-ul">
        <li>Infringe the rights of any third party</li>
        <li>Violate any applicable law or regulation in your jurisdiction</li>
        <li>Compromise the security, integrity, or availability of the Platform</li>
        <li>Impersonate any person or entity</li>
      </ul>

      <h2 className="legal-h2">7. Dispute Resolution Between Users</h2>
      <p className="legal-p">OUSTED is not responsible for resolving disputes between attendees and event organisers. If you have a dispute with an organiser regarding an event, contact the organiser directly. OUSTED may, at its sole discretion, mediate disputes but is under no obligation to do so.</p>

      <h2 className="legal-h2">8. Disclaimer of Warranties</h2>
      <p className="legal-p">The Platform is provided "as is" and "as available" without warranties of any kind. OUSTED does not warrant that the Platform will be uninterrupted, error-free, or free of viruses.</p>

      <h2 className="legal-h2">9. Force Majeure</h2>
      <p className="legal-p">OUSTED shall not be liable for any failure or delay due to causes beyond its reasonable control, including natural disasters, acts of government, power failures, internet outages, or pandemics.</p>

      <h2 className="legal-h2">10. Entire Agreement</h2>
      <p className="legal-p">This Agreement, together with the Terms and Conditions and Privacy Policy, constitutes the entire agreement between you and OUSTED with respect to your use of the Platform.</p>

      <h2 className="legal-h2">11. Severability</h2>
      <p className="legal-p">If any provision of this Agreement is found to be unenforceable, the remaining provisions will continue in full force and effect.</p>

      <h2 className="legal-h2">12. Contact</h2>
      <p className="legal-p">For questions about this Agreement: <a href="mailto:legal@ousted.live" style={{ color: '#000', fontWeight: 800 }}>legal@ousted.live</a></p>

    </LegalLayout>
  );
}
