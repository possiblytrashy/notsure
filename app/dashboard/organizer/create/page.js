"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  X, Plus, Trash2, Image as ImageIcon,
  MapPin, Calendar, Ticket,
  Loader2, ChevronLeft, Upload, FileText,
  CheckCircle2, AlertCircle, Sparkles,
  ShieldCheck, Lock, Map as MapIcon,
  ArrowRight
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import dynamic from 'next/dynamic';
import { useMap, useMapEvents } from 'react-leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import('react-leaflet').then(m => m.Marker),       { ssr: false });

// ── Luxury map pin ────────────────────────────────────────────
const getLuxuryIcon = () => {
  if (typeof window === 'undefined') return null;
  const L = require('leaflet');
  return L.divIcon({
    className: 'luxury-pin',
    html: `<div style="width:20px;height:20px;background:#000;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,.4)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// ── Map logic (search + click) ────────────────────────────────
const MapLogic = ({ setEventData }) => {
  const map = useMap();
  useMapEvents({
    click(e) {
      setEventData(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng }));
    },
  });
  useEffect(() => {
    let searchControl;
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        const { GeoSearchControl, OpenStreetMapProvider } = await import('leaflet-geosearch');
        const provider = new OpenStreetMapProvider();
        searchControl = new GeoSearchControl({
          provider,
          style: 'bar',
          showMarker: false,
          animateZoom: true,
          searchLabel: 'Search venue or address…',
        });
        map.addControl(searchControl);
        map.on('geosearch/showlocation', (result) => {
          setEventData(prev => ({
            ...prev,
            location: result.location.label,
            lat: result.location.y,
            lng: result.location.x,
          }));
        });
      } catch (e) {
        console.error('GeoSearch load error', e);
      }
    })();
    return () => {
      if (searchControl) {
        try { map.removeControl(searchControl); } catch (_) {}
      }
    };
  }, [map, setEventData]);
  return null;
};

// ── Main component ────────────────────────────────────────────
export default function CreateEvent() {
  const router      = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [user, setUser]                 = useState(null);
  const [orgSubaccount, setOrgSubaccount] = useState(null);
  const [formError, setFormError]       = useState(null);
  const [success, setSuccess]           = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const [eventData, setEventData] = useState({
    title: '', description: '', date: '',
    hour: '08', minute: '00', period: 'PM',
    location: '', lat: null, lng: null,
    category: 'Entertainment', images: [], is_published: true,
  });

  const [tiers, setTiers] = useState([{
    id: crypto.randomUUID(),
    name: 'Standard Access', price: '', capacity: '',
    description: 'General admission to the experience',
  }]);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push('/login'); return; }
      setUser(user);
      const { data: profile } = await supabase
        .from('profiles').select('paystack_subaccount_code').eq('id', user.id).single();
      if (!profile?.paystack_subaccount_code) {
        setFormError('Action Required: Payout account not set up. Complete onboarding in Settings.');
      } else {
        setOrgSubaccount(profile.paystack_subaccount_code);
      }
    })();
  }, [router]);

  // ESC closes modal
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setShowMapModal(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── File upload ───────────────────────────────────────────
  const handleFileUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true); setFormError(null);
    const urls = [...eventData.images];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error('File too large (max 10 MB)');
        const ext      = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: up } = await supabase.storage.from('event-images').upload(fileName, file);
        if (up) throw up;
        const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(fileName);
        urls.push(publicUrl);
      }
      setEventData(prev => ({ ...prev, images: urls }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Tiers ─────────────────────────────────────────────────
  const addTier    = () => setTiers(t => [...t, { id: crypto.randomUUID(), name: '', price: '', capacity: '', description: '' }]);
  const removeTier = (id) => { if (tiers.length > 1) setTiers(t => t.filter(x => x.id !== id)); };
  const updateTier = (id, field, val) => setTiers(t => t.map(x => x.id === id ? { ...x, [field]: val } : x));

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgSubaccount) { setFormError('Payout account missing. Please check settings.'); return; }
    setLoading(true); setFormError(null);
    try {
      if (!eventData.title)         throw new Error('Experience title is required.');
      if (!eventData.location)      throw new Error('A venue name or address is required.');
      if (!eventData.images.length) throw new Error('Upload at least one promotional image.');

      const { data: ev, error: evErr } = await supabase.from('events').insert([{
        organizer_id:          user.id,
        title:                 eventData.title,
        description:           eventData.description,
        date:                  eventData.date,
        time:                  `${eventData.hour}:${eventData.minute} ${eventData.period}`,
        location:              eventData.location,
        lat:                   eventData.lat,
        lng:                   eventData.lng,
        images:                eventData.images,
        organizer_subaccount:  orgSubaccount,
        category:              eventData.category,
        is_published:          eventData.is_published,
      }]).select().single();
      if (evErr) throw evErr;

      const { error: tiersErr } = await supabase.from('ticket_tiers').insert(
        tiers.map(t => ({
          event_id:     ev.id,
          name:         t.name,
          price:        parseFloat(t.price) || 0,
          max_quantity: parseInt(t.capacity) || 0,
          description:  t.description,
        }))
      );
      if (tiersErr) throw tiersErr;

      setSuccess(true);
      setTimeout(() => router.push('/dashboard/organizer'), 2000);
    } catch (err) {
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input style ────────────────────────────────────
  const inp = {
    width: '100%', padding: '16px', borderRadius: '16px',
    border: '2px solid #f1f5f9', background: '#f8fafc',
    fontWeight: '600', fontSize: '16px', outline: 'none',
    color: '#0f172a', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const iconBox = (color) => ({
    width: '42px', height: '42px', borderRadius: '13px',
    background: `${color}18`, display: 'flex',
    alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
  });

  const label = {
    fontSize: '11px', fontWeight: '900', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    marginBottom: '10px', display: 'block',
  };

  const card = {
    background: '#fff', borderRadius: '28px',
    padding: 'clamp(18px,4vw,32px)',
    border: '1px solid #f1f5f9', marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: 'clamp(14px,4vw,40px) clamp(12px,3vw,20px) 100px', fontFamily: 'inherit' }}>
      <style>{`
        /* ── Create-event mobile fixes ── */
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .ce-form-grid{display:grid;grid-template-columns:1.8fr 1fr;gap:32px;align-items:start}
        .ce-sidebar{position:sticky;top:24px}
        .ce-date-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .ce-tier-price-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .ce-location-bar{display:flex;gap:10px;align-items:center;background:#f8fafc;padding:8px;border-radius:20px;border:2px solid #f1f5f9}
        .ce-location-input{background:none;border:none;outline:none;flex:1;font-weight:700;font-size:16px;color:#0f172a;min-width:0;font-family:inherit}
        .ce-map-btn{background:#000;color:#fff;border:none;padding:11px 16px;border-radius:14px;font-weight:900;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12px;white-space:nowrap;flex-shrink:0}
        .ce-img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:16px;width:100%;padding:16px}

        /* Map modal */
        .ce-map-overlay{position:fixed;inset:0;background:rgba(15,23,42,.92);backdrop-filter:blur(12px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:clamp(8px,3vw,24px)}
        .ce-map-modal{background:#fff;width:100%;max-width:980px;border-radius:clamp(20px,4vw,36px);overflow:hidden;position:relative;box-shadow:0 30px 100px rgba(0,0,0,.4);max-height:calc(100dvh - 16px);display:flex;flex-direction:column}
        .ce-map-header{padding:clamp(14px,3vw,28px) clamp(16px,4vw,36px);border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fff;flex-shrink:0}
        .ce-map-body{padding:clamp(14px,3vw,28px) clamp(16px,4vw,36px);overflow-y:auto;flex:1}
        .ce-map-container{height:clamp(260px,45vw,480px);border-radius:24px;overflow:hidden;border:1px solid #f1f5f9;position:relative}
        .ce-coord-bar{position:absolute;bottom:14px;left:14px;right:14px;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);padding:12px 16px;border-radius:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #f1f5f9;z-index:1000;flex-wrap:wrap;gap:8px}
        .ce-confirm-btn{width:100%;background:#000;color:#fff;padding:18px;border-radius:18px;font-weight:900;border:none;cursor:pointer;font-size:15px;margin-top:18px;font-family:inherit}

        @media(max-width:768px){
          .ce-form-grid{grid-template-columns:1fr!important;gap:0}
          .ce-sidebar{position:static!important;top:auto}
        }
        @media(max-width:520px){
          .ce-date-row{grid-template-columns:1fr!important;gap:14px}
          .ce-tier-price-row{grid-template-columns:1fr 1fr!important}
          .ce-location-bar{flex-wrap:wrap;border-radius:16px}
          .ce-location-input{width:100%;min-height:44px}
          .ce-map-btn{width:100%;justify-content:center}
          .ce-img-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px}
        }
        /* Leaflet geosearch mobile */
        .leaflet-control-geosearch{width:calc(100% - 20px)!important;left:10px!important;right:10px!important}
        .leaflet-control-geosearch form input{font-size:15px!important}
        /* Leaflet zoom control — keep visible on mobile */
        .leaflet-control-zoom{margin:8px!important}
      `}</style>

      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 'clamp(20px,4vw,44px)' }}>
          <button
            onClick={() => router.back()}
            style={{ border: 'none', background: 'none', color: '#94a3b8', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', letterSpacing: '0.05em', padding: '0 0 12px', fontFamily: 'inherit' }}
          >
            <ChevronLeft size={15} strokeWidth={3} /> RETURN TO PORTAL
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(26px,6vw,42px)', fontWeight: '950', letterSpacing: '-0.04em', margin: 0, color: '#0f172a' }}>
              Create Experience
            </h1>
            <div style={{ background: '#000', color: '#fff', padding: '5px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={11} /> PREMIUM
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        {formError && (
          <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', color: '#be123c', padding: '18px 20px', borderRadius: '20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', fontWeight: '700' }}>
            <div style={{ background: '#be123c', color: '#fff', width: '30px', height: '30px', minWidth: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={16} />
            </div>
            <span>{formError}</span>
          </div>
        )}
        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', padding: '18px 20px', borderRadius: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700' }}>
            <div style={{ background: '#15803d', color: '#fff', width: '30px', height: '30px', minWidth: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
            Your experience is live! Redirecting…
          </div>
        )}

        {/* ── Form grid ── */}
        <form onSubmit={handleSubmit} className="ce-form-grid">

          {/* ── Main column ── */}
          <div>

            {/* Aesthetics / images */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={iconBox('#8b5cf6')}><ImageIcon size={20} /></div>
                  <div>
                    <h2 style={{ fontSize: 'clamp(16px,3vw,20px)', fontWeight: '900', margin: 0, color: '#0f172a' }}>Aesthetics</h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>High-res promotional media</p>
                  </div>
                </div>
                <button type="button" onClick={() => fileInputRef.current.click()}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
                  <Plus size={14} /> ADD IMAGES
                </button>
              </div>

              <div
                style={{ border: '2px dashed #e2e8f0', background: '#f8fafc', borderRadius: '22px', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => fileInputRef.current.click()}
              >
                {uploading ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <Loader2 style={{ animation: 'spin .8s linear infinite' }} size={40} strokeWidth={1.5} color="#000" />
                    <p style={{ fontWeight: '900', fontSize: '13px', color: '#0f172a', margin: '12px 0 0' }}>UPLOADING…</p>
                  </div>
                ) : eventData.images.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                    <div style={{ background: '#fff', width: '56px', height: '56px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                      <Upload size={22} color="#64748b" />
                    </div>
                    <p style={{ fontWeight: '850', color: '#0f172a', margin: '0 0 5px', fontSize: '15px' }}>Drop promotional media</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', margin: 0 }}>Max 10 MB per file</p>
                  </div>
                ) : (
                  <div className="ce-img-grid">
                    {eventData.images.map((url, i) => (
                      <div key={url} style={{ height: '120px', borderRadius: '16px', position: 'relative', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Poster" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setEventData(p => ({ ...p, images: p.images.filter((_, j) => j !== i) })); }}
                          style={{ position: 'absolute', top: '8px', right: '8px', background: '#fff', border: 'none', borderRadius: '8px', color: '#ef4444', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <div style={{ height: '120px', borderRadius: '16px', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <Plus size={22} />
                    </div>
                  </div>
                )}
                <input type="file" multiple ref={fileInputRef} hidden onChange={e => handleFileUpload(e.target.files)} accept="image/*" />
              </div>
            </div>

            {/* Core details */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div style={iconBox('#0ea5e9')}><FileText size={20} /></div>
                <div>
                  <h2 style={{ fontSize: 'clamp(16px,3vw,20px)', fontWeight: '900', margin: 0, color: '#0f172a' }}>Experience Info</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Narrative and logistics</p>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={label}>EXPERIENCE TITLE</label>
                <input style={inp} placeholder="A name that commands attention…" value={eventData.title} onChange={e => setEventData(p => ({ ...p, title: e.target.value }))} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={label}>VENUE LOCATION</label>
                <div className="ce-location-bar">
                  <div style={{ padding: '0 10px', color: '#0ea5e9', flexShrink: 0 }}>
                    <MapPin size={20} strokeWidth={2.5} />
                  </div>
                  <input
                    className="ce-location-input"
                    placeholder="Enter venue name…"
                    value={eventData.location}
                    onChange={e => setEventData(p => ({ ...p, location: e.target.value }))}
                  />
                  <button type="button" className="ce-map-btn" onClick={() => setShowMapModal(true)}>
                    <MapIcon size={15} /> PICK ON MAP
                  </button>
                </div>
                {eventData.lat != null && (
                  <p style={{ margin: '6px 0 0 8px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                    📍 {eventData.lat.toFixed(5)}, {eventData.lng.toFixed(5)}
                  </p>
                )}
              </div>

              <div className="ce-date-row" style={{ marginBottom: '24px' }}>
                <div>
                  <label style={label}>EVENT DATE</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input type="date" style={{ ...inp, paddingLeft: '46px' }} onChange={e => setEventData(p => ({ ...p, date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={label}>START TIME</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ display: 'flex', flex: 1, background: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '16px', padding: '4px 8px', alignItems: 'center', minWidth: 0 }}>
                      <input style={{ width: '100%', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '16px', outline: 'none', minWidth: 0, fontFamily: 'inherit' }} value={eventData.hour} onChange={e => setEventData(p => ({ ...p, hour: e.target.value }))} maxLength="2" placeholder="08" />
                      <span style={{ fontWeight: '950', color: '#cbd5e1', flexShrink: 0 }}>:</span>
                      <input style={{ width: '100%', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '16px', outline: 'none', minWidth: 0, fontFamily: 'inherit' }} value={eventData.minute} onChange={e => setEventData(p => ({ ...p, minute: e.target.value }))} maxLength="2" placeholder="00" />
                    </div>
                    <button type="button" onClick={() => setEventData(p => ({ ...p, period: p.period === 'AM' ? 'PM' : 'AM' }))}
                      style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', width: '60px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.1em', fontSize: '13px', flexShrink: 0, fontFamily: 'inherit' }}>
                      {eventData.period}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label style={label}>DESCRIPTION &amp; PROGRAM</label>
                <textarea
                  style={{ ...inp, height: '160px', resize: 'vertical', lineHeight: '1.6' }}
                  placeholder="Elaborate on the schedule, dress code, or exclusivity…"
                  value={eventData.description}
                  onChange={e => setEventData(p => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="ce-sidebar">
            <div style={{ background: '#fff', borderRadius: '28px', padding: 'clamp(18px,3vw,28px)', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={iconBox('#f59e0b')}><Ticket size={20} /></div>
                <div>
                  <h2 style={{ fontSize: 'clamp(15px,3vw,19px)', fontWeight: '900', margin: 0, color: '#0f172a' }}>Access Tiers</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Manage invitation levels</p>
                </div>
              </div>

              <div style={{ maxHeight: '460px', overflowY: 'auto', paddingRight: '2px', marginBottom: '20px' }}>
                {tiers.map((tier, index) => (
                  <div key={tier.id} style={{ background: '#f8fafc', padding: 'clamp(14px,3vw,20px)', borderRadius: '20px', marginBottom: '16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: index === 0 ? '#10b981' : '#f59e0b' }} />
                        <span style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', letterSpacing: '0.05em' }}>TIER {index + 1}</span>
                      </div>
                      <button type="button" onClick={() => removeTier(tier.id)}
                        style={{ background: '#fee2e2', border: 'none', color: '#ef4444', width: '26px', height: '26px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <input style={{ ...inp, padding: '13px', fontSize: '14px', border: '1px solid #e2e8f0' }} placeholder="Tier Label (e.g. VIP Access)" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} />
                    </div>

                    <div className="ce-tier-price-row" style={{ marginBottom: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', fontSize: '13px', color: '#94a3b8' }}>GH₵</span>
                        <input style={{ ...inp, padding: '13px 12px 13px 42px', fontSize: '14px', border: '1px solid #e2e8f0' }} type="number" placeholder="0.00" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Ticket size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input style={{ ...inp, padding: '13px 12px 13px 34px', fontSize: '14px', border: '1px solid #e2e8f0' }} type="number" placeholder="Qty" value={tier.capacity} onChange={e => updateTier(tier.id, 'capacity', e.target.value)} />
                      </div>
                    </div>

                    <textarea
                      style={{ ...inp, height: '64px', padding: '11px', fontSize: '13px', border: '1px solid #e2e8f0', resize: 'none' }}
                      placeholder="Benefits included…"
                      value={tier.description}
                      onChange={e => updateTier(tier.id, 'description', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button type="button" onClick={addTier}
                style={{ width: '100%', padding: '16px', borderRadius: '18px', border: '2px dashed #cbd5e1', background: 'none', fontWeight: '800', color: '#64748b', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontFamily: 'inherit' }}>
                <Plus size={16} /> ADD ACCESS TIER
              </button>

              {/* Payout info + submit */}
              <div style={{ background: '#0f172a', borderRadius: '24px', padding: 'clamp(18px,3vw,26px)', color: '#fff', boxShadow: '0 16px 40px rgba(15,23,42,.2)' }}>
                <div style={{ display: 'flex', gap: '14px', marginBottom: '22px' }}>
                  <div style={{ width: '38px', height: '38px', minWidth: '38px', borderRadius: '11px', background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 5px', fontSize: '14px', fontWeight: '900' }}>Smart Split Payout</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', fontWeight: '500' }}>Your 95% sent instantly to your bank. 5% platform fee collected at checkout.</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: '18px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Visibility</span>
                    <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '900' }}>PUBLIC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Processing</span>
                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: '900' }}>PAYSTACK SECURE</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !orgSubaccount}
                  style={{ width: '100%', background: loading ? '#334155' : '#fff', color: '#000', padding: '18px', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: loading || !orgSubaccount ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '15px', opacity: orgSubaccount ? 1 : 0.5, fontFamily: 'inherit', boxSizing: 'border-box' }}
                >
                  {loading ? <Loader2 style={{ animation: 'spin .8s linear infinite' }} size={20} /> : <>PUBLISH EXPERIENCE <ArrowRight size={16} /></>}
                </button>

                {!orgSubaccount && (
                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#fca5a5', fontWeight: '800', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <Lock size={11} /> ONBOARDING REQUIRED
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Map modal ── */}
      {showMapModal && (
        <div className="ce-map-overlay" onClick={() => setShowMapModal(false)}>
          <div className="ce-map-modal" onClick={e => e.stopPropagation()}>

            <div className="ce-map-header">
              <div>
                <h3 style={{ margin: '0 0 3px', fontWeight: '950', fontSize: 'clamp(16px,3vw,22px)', letterSpacing: '-0.02em' }}>Pick Location</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Click the map or search to pin your venue</p>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '13px', width: '42px', height: '42px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, marginLeft: '12px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ce-map-body">
              <div className="ce-map-container">
                <MapContainer
                  center={[eventData.lat ?? 5.6037, eventData.lng ?? -0.187]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution="&copy; CARTO"
                  />
                  <MapLogic setEventData={setEventData} />
                  {eventData.lat != null && eventData.lng != null && (
                    <Marker position={[eventData.lat, eventData.lng]} icon={getLuxuryIcon()} />
                  )}
                </MapContainer>

                <div className="ce-coord-bar">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ background: '#f8fafc', width: '32px', height: '32px', minWidth: '32px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={15} color="#000" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>COORDINATES</p>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                        {eventData.lat != null ? `${eventData.lat.toFixed(5)}, ${eventData.lng.toFixed(5)}` : 'Click map to pin'}
                      </p>
                    </div>
                  </div>
                  {eventData.location && (
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {eventData.location}
                    </p>
                  )}
                </div>
              </div>

              <button className="ce-confirm-btn" onClick={() => setShowMapModal(false)}>
                ✓ CONFIRM THIS LOCATION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
