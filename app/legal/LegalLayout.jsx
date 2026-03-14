"use client";

export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Back */}
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#94a3b8', textDecoration: 'none', marginBottom: 32, letterSpacing: '.5px' }}>
        ← BACK TO OUSTED
      </a>

      {/* Header */}
      <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '2px solid #f1f5f9' }}>
        <div style={{ display: 'inline-block', background: '#000', color: '#CDA434', fontSize: 9, fontWeight: 900, padding: '4px 12px', borderRadius: 20, letterSpacing: '2px', marginBottom: 14 }}>
          LEGAL
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 950, letterSpacing: '-1px', margin: '0 0 10px', color: '#000', lineHeight: 1.1 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Last updated: {lastUpdated}</p>
      </div>

      {/* Content */}
      <div style={{ color: '#1e293b', lineHeight: 1.75, fontSize: 15 }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 60, padding: '24px', background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b', fontWeight: 600 }}>Questions about this document?</p>
        <a href="mailto:legal@ousted.live" style={{ fontSize: 14, fontWeight: 900, color: '#000', textDecoration: 'none' }}>legal@ousted.live</a>
      </div>

      <style>{`
        .legal-h2 { font-size: 18px; font-weight: 900; color: #000; margin: 36px 0 12px; letter-spacing: -.3px; }
        .legal-p { margin: 0 0 16px; }
        .legal-ul { padding-left: 20px; margin: 0 0 16px; }
        .legal-ul li { margin-bottom: 8px; }
        .legal-strong { font-weight: 800; }
      `}</style>
    </div>
  );
}
