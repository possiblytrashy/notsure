// Apple Wallet .pkpass generation
// Uses archiver (already common in Node) to build the ZIP-based pkpass format
// Requires signing with Apple certificate — instructions below
// Env: APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID, APPLE_WALLET_CERT_PEM, APPLE_WALLET_KEY_PEM, APPLE_WALLET_WWDR_PEM

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

export const runtime = 'nodejs';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

function fmtDate(d, t) {
  if (!d) return 'TBA';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (t ? ` · ${t.substring(0, 5)}` : '');
}

// Build SHA1 manifest for pkpass
function buildManifest(files) {
  const manifest = {};
  for (const [name, content] of Object.entries(files)) {
    manifest[name] = crypto.createHash('sha1').update(content).digest('hex');
  }
  return JSON.stringify(manifest);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  const email = searchParams.get('email');
  if (!ref || !email) return NextResponse.json({ error: 'Missing ref or email' }, { status: 400 });

  const requiredEnvs = ['APPLE_WALLET_PASS_TYPE_ID', 'APPLE_WALLET_TEAM_ID', 'APPLE_WALLET_CERT_PEM', 'APPLE_WALLET_KEY_PEM', 'APPLE_WALLET_WWDR_PEM'];
  const missing = requiredEnvs.filter(e => !process.env[e]);
  if (missing.length) {
    return NextResponse.json({
      error: 'Apple Wallet not configured',
      missing,
      instructions: [
        '1. Enroll in Apple Developer Program ($99/yr) at developer.apple.com',
        '2. Create a Pass Type ID under Certificates, Identifiers & Profiles',
        '3. Create a Pass Type Certificate and download the .cer file',
        '4. Export your signing key as PEM: openssl pkcs12 -in cert.p12 -out key.pem -nocerts -nodes',
        '5. Convert cert: openssl x509 -in cert.cer -inform DER -out cert.pem -outform PEM',
        '6. Download WWDR cert from https://www.apple.com/certificateauthority/',
        '7. Set all 5 env vars in Vercel (paste PEM contents, preserving newlines with \\n)',
      ]
    }, { status: 501 });
  }

  const supabase = db();
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, events!event_id(id,title,date,time,location,image_url), ticket_tiers:tier_id(name)')
    .eq('reference', ref)
    .eq('guest_email', email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  if (ticket.status !== 'valid') return NextResponse.json({ error: 'Ticket is not valid' }, { status: 400 });

  const ev = ticket.events || {};
  const tier = ticket.ticket_tiers?.name || ticket.tier_name || 'General Admission';

  // Build pass.json
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_WALLET_PASS_TYPE_ID,
    serialNumber: ref,
    teamIdentifier: process.env.APPLE_WALLET_TEAM_ID,
    organizationName: 'OUSTED',
    description: `${ev.title || 'Event'} Ticket`,
    backgroundColor: 'rgb(5, 5, 5)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(205, 164, 52)',
    logoText: 'OUSTED',
    barcodes: [{
      message: `REF:${ref}`,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: ref,
    }],
    eventTicket: {
      primaryFields: [{
        key: 'event', label: 'EVENT', value: ev.title || 'Event',
      }],
      secondaryFields: [
        { key: 'date', label: 'DATE', value: fmtDate(ev.date, ev.time) },
        { key: 'tier', label: 'TYPE', value: tier },
      ],
      auxiliaryFields: [
        { key: 'venue', label: 'VENUE', value: ev.location || 'TBA' },
        { key: 'holder', label: 'HOLDER', value: ticket.guest_name || 'Guest' },
      ],
      backFields: [
        { key: 'ref', label: 'REFERENCE', value: ref },
        { key: 'terms', label: 'TERMS', value: `This ticket is non-transferable and valid for one entry only. Powered by OUSTED — ${SITE_URL}` },
      ],
    },
    webServiceURL: `${SITE_URL}/api/wallet/apple/updates`,
    authenticationToken: crypto.createHash('sha256').update(ref).digest('hex').substring(0, 16),
    relevantDate: ev.date ? `${ev.date}T${ev.time || '00:00'}+00:00` : undefined,
  };

  const passJsonBuf = Buffer.from(JSON.stringify(passJson));
  const manifest = buildManifest({ 'pass.json': passJsonBuf });
  const manifestBuf = Buffer.from(manifest);

  // Sign the manifest with PKCS7 detached signature
  let signatureBuf;
  try {
    const { execSync } = await import('child_process');
    const tmpDir = tmpdir();
    const manifestPath = join(tmpDir, `ousted_manifest_${ref}.json`);
    const sigPath = join(tmpDir, `ousted_sig_${ref}.p7s`);
    const certPath = join(tmpDir, `ousted_cert_${ref}.pem`);
    const keyPath = join(tmpDir, `ousted_key_${ref}.pem`);
    const wwdrPath = join(tmpDir, `ousted_wwdr_${ref}.pem`);

    writeFileSync(manifestPath, manifestBuf);
    writeFileSync(certPath, (process.env.APPLE_WALLET_CERT_PEM || '').replace(/\\n/g, '\n'));
    writeFileSync(keyPath, (process.env.APPLE_WALLET_KEY_PEM || '').replace(/\\n/g, '\n'));
    writeFileSync(wwdrPath, (process.env.APPLE_WALLET_WWDR_PEM || '').replace(/\\n/g, '\n'));

    execSync(`openssl smime -sign -signer ${certPath} -inkey ${keyPath} -certfile ${wwdrPath} -in ${manifestPath} -out ${sigPath} -outform DER -binary -nodetach`);
    signatureBuf = readFileSync(sigPath);

    // Cleanup
    [manifestPath, sigPath, certPath, keyPath, wwdrPath].forEach(f => { try { unlinkSync(f); } catch {} });
  } catch (err) {
    console.error('[Apple Wallet] Signing error:', err.message);
    return NextResponse.json({ error: 'Failed to sign pass: ' + err.message }, { status: 500 });
  }

  // Build .pkpass ZIP in memory
  const JSZip = await import('jszip').catch(() => { throw new Error('jszip not installed. Run: npm install jszip'); });
  const zip = new JSZip.default();
  zip.file('pass.json', passJsonBuf);
  zip.file('manifest.json', manifestBuf);
  zip.file('signature', signatureBuf);

  const pkpassBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return new Response(pkpassBuf, {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="ousted-${ref}.pkpass"`,
      'Cache-Control': 'no-store',
    },
  });
}
