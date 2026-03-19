"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Minus } from 'lucide-react';

const categories = [
  {
    name: "💸 Revenue & Pricing",
    rows: [
      { feature: "Organizer keeps",            ousted: "100% of their set price",    other: "80–90% after platform cut" },
      { feature: "Platform fee",               ousted: "5% added on top by buyer",   other: "10–20% deducted from organizer" },
      { feature: "Fee transparency",           ousted: "Full breakdown at checkout",  other: "Revealed on final screen" },
      { feature: "Reseller commission",        ousted: "10% — paid by buyer",        other: "Not available or costs extra" },
      { feature: "Setup / monthly cost",       ousted: "Free — pay only when you sell","other": "Monthly subscriptions from $30+" },
      { feature: "Payout timeline",            ousted: "Admin ledger, transfer anytime","other": "7–30 day rolling holds" },
    ],
  },
  {
    name: "🎟️ Tickets & Entry",
    rows: [
      { feature: "Ticket format",              ousted: "Digital QR in personal vault", other: "Email PDF or basic link" },
      { feature: "QR security",               ousted: "HMAC-signed by server",        other: "Plain barcode / static QR" },
      { feature: "NFC entry",                 ousted: "Write ticket to NFC tag",       other: "Not available" },
      { feature: "Offline entry",             ousted: "NFC & screenshot both work",    other: "Requires internet" },
      { feature: "Multi-tier ticketing",      ousted: "Unlimited tiers, any price",    other: "Limited tiers or paid upgrade" },
      { feature: "Ticket capacity controls",  ousted: "Per-tier max quantities",       other: "Event-level only" },
      { feature: "Waitlist",                  ousted: "Built-in, auto-position",       other: "Manual or not available" },
    ],
  },
  {
    name: "📲 Wallet & Calendar",
    rows: [
      { feature: "Google Wallet",             ousted: "One-tap save to wallet",        other: "Not available" },
      { feature: "Calendar download",         ousted: ".ics with reminders included",  other: "Not available" },
      { feature: "Apple Wallet",              ousted: ".ics (works on iOS natively)",  other: "Paid tier or not available" },
      { feature: "Transport integration",     ousted: "Uber, Bolt, Yango, Google Maps","other": "Not available" },
    ],
  },
  {
    name: "🤝 Resellers & Growth",
    rows: [
      { feature: "Reseller network",          ousted: "Built-in, self-serve signup",   other: "Not available" },
      { feature: "Reseller link tracking",    ousted: "Clicks, conversions, earnings", other: "Not available" },
      { feature: "Reseller onboarding",       ousted: "MoMo or bank, instant",         other: "Not available" },
      { feature: "Social sharing tools",      ousted: "Native share sheet per ticket", other: "Basic URL share" },
    ],
  },
  {
    name: "🏆 Competitions & Voting",
    rows: [
      { feature: "Live voting portal",        ousted: "Full competition system",        other: "Not available" },
      { feature: "Real-time leaderboard",     ousted: "Updates per vote, no refresh",  other: "Not available" },
      { feature: "Multiple contests",         ousted: "Unlimited categories",          other: "Not available" },
      { feature: "Vote pricing",              ousted: "Organizer sets per-vote price", other: "Not available" },
    ],
  },
  {
    name: "⚡ Automations & Integrations",
    rows: [
      { feature: "Webhook automations",       ousted: "Native, HMAC-signed delivery",  other: "Requires paid Zapier plan" },
      { feature: "Trigger events",            ousted: "Sale, scan, low stock, sold out","other": "Not available natively" },
      { feature: "Test webhook delivery",     ousted: "Built-in test-fire tool",       other: "Manual testing only" },
      { feature: "Blog / content tools",      ousted: "Organizer blog built-in",        other: "External CMS required" },
    ],
  },
  {
    name: "🔒 Security & Admin",
    rows: [
      { feature: "Gate scanner",              ousted: "Dedicated, no login needed",    other: "Requires event app install" },
      { feature: "HMAC-signed QRs",           ousted: "Yes — server-side signature",  other: "No" },
      { feature: "Duplicate scan detection",  ousted: "Atomic DB lock, instant deny",  other: "Varies — race conditions possible" },
      { feature: "Admin payout ledger",       ousted: "Full breakdown per event",      other: "Opaque aggregate reports" },
      { feature: "Organizer dashboard",       ousted: "Real-time analytics + maps",    other: "Basic counts" },
    ],
  },
];

export default function CompareClient() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 20px 80px' }}>
      <style>{`
        @media(max-width:640px){.compare-grid{grid-template-columns:1fr!important;gap:6px!important}}
        @media(max-width:500px){.row-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Back */}
      <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32, padding: 0 }}>
        <ArrowLeft size={13} /> BACK TO HOME
      </button>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(231,60,126,.06)', border: '1px solid rgba(231,60,126,.2)', borderRadius: 100, padding: '5px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#e73c7e', letterSpacing: '1.5px' }}>THE HONEST COMPARISON</span>
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 950, letterSpacing: '-2.5px', margin: '0 0 14px', lineHeight: 1 }}>
          How OUSTED compares<br/>
          <span style={{ WebkitTextStroke: '1.5px #000', WebkitTextFillColor: 'transparent' }}>to the alternatives.</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: 16, fontWeight: 600, maxWidth: 480, margin: '0 auto' }}>
          We built OUSTED because existing platforms charge too much, pay out too slowly, and build features for themselves — not for organizers.
        </p>
      </div>

      {/* Top stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 44 }} className="compare-grid">
        {[
          { v: '100%',  l: 'of your price,\nyou keep' },
          { v: '5%',    l: 'transparent\nbuyer fee' },
          { v: '0',     l: 'monthly\nsubscription' },
          { v: '∞',     l: 'ticket tiers\n& resellers' },
        ].map(({ v, l }) => (
          <div key={v} style={{ background: '#000', borderRadius: 22, padding: '22px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 36, fontWeight: 950, color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>{v}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.35)', fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{l}</p>
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4, scrollbarWidth: 'none' }}>
        {categories.map((cat, i) => (
          <button key={i} onClick={() => setActiveCategory(i)}
            style={{ padding: '9px 16px', borderRadius: 100, border: 'none', background: activeCategory === i ? '#000' : 'rgba(255,255,255,.8)', color: activeCategory === i ? '#fff' : '#64748b', fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, backdropFilter: 'blur(10px)' }}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.04)' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', background: '#000' }}>
          <div style={{ padding: '14px 20px' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,.3)', letterSpacing: '1.5px' }}>FEATURE</p>
          </div>
          <div style={{ padding: '14px 20px', borderLeft: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🖤</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 950, color: '#fff', letterSpacing: '-.3px' }}>OUSTED</p>
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderLeft: '1px solid rgba(255,255,255,.08)' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,.3)', letterSpacing: '1.5px' }}>TYPICAL ALTERNATIVES</p>
          </div>
        </div>

        {/* Rows */}
        {categories[activeCategory].rows.map(({ feature, ousted, other }, i) => (
          <div key={feature} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155' }}>{feature}</p>
            </div>
            <div style={{ padding: '14px 20px', borderLeft: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={10} color="#16a34a" strokeWidth={3} />
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#15803d', lineHeight: 1.4 }}>{ousted}</p>
            </div>
            <div style={{ padding: '14px 20px', borderLeft: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: other === 'Not available' ? '#fef2f2' : '#fffbeb', border: `1px solid ${other === 'Not available' ? '#fecaca' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {other === 'Not available'
                  ? <X size={10} color="#dc2626" strokeWidth={3} />
                  : <Minus size={10} color="#d97706" strokeWidth={3} />}
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: other === 'Not available' ? '#94a3b8' : '#78716c', lineHeight: 1.4 }}>{other}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>
        Comparison based on publicly available information. "Typical alternatives" reflects common patterns across major platforms — individual platforms vary.
      </p>

      {/* CTA */}
      <div style={{ marginTop: 52, background: 'linear-gradient(135deg,#000,#1a0010)', borderRadius: 28, padding: '40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 950, color: '#fff', margin: '0 0 10px', letterSpacing: '-1.5px' }}>Ready to switch?</h2>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, fontWeight: 600, margin: '0 0 24px' }}>Set up your first event in under 5 minutes. No monthly fees, no contracts.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ background: '#e73c7e', color: '#fff', padding: '14px 28px', borderRadius: 16, fontWeight: 900, textDecoration: 'none', fontSize: 14 }}>Start Free →</a>
          <a href="/" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', padding: '14px 22px', borderRadius: 16, fontWeight: 900, textDecoration: 'none', fontSize: 14, border: '1px solid rgba(255,255,255,.1)' }}>Browse Events</a>
        </div>
      </div>
    </div>
  );
}
