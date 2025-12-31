"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

// UI & Icons
import { 
  X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, 
  Loader2, ChevronLeft, Upload, Zap, FileText,
  CheckCircle2, AlertCircle, Info, Sparkles,
  ShieldCheck, Globe, Lock, Eye, Save,
  Layers, Settings, HelpCircle, Navigation,
  Smartphone, MousePointer2, Tag, Percent
} from 'lucide-react';

// CSS Imports
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function CreateEvent() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const geocoderContainerRef = useRef(null);

  // --- 1. STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);
  const [organizerSubaccount, setOrganizerSubaccount] = useState(null);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  // Event Data State
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    hour: '08',
    minute: '00',
    period: 'PM',
    location_name: '', 
    lat: 5.6037, // Accra
    lng: -0.1870,
    category: 'Entertainment',
    image_urls: [], 
    is_published: true,
    terms_accepted: true,
    visibility: 'public'
  });

  // Map settings
  const [viewState, setViewState] = useState({
    latitude: 5.6037,
    longitude: -0.1870,
    zoom: 13,
    pitch: 45,
    bearing: 0
  });

  // Multi-tier State
  const [tiers, setTiers] = useState([
    { 
      id: crypto.randomUUID(), 
      name: 'Standard Access', 
      price: '', 
      capacity: '', 
      description: 'General admission to the experience',
      perks: []
    }
  ]);

  // --- 2. AUTHENTICATION & ONBOARDING CHECK ---
  useEffect(() => {
    const initialize = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Verify Paystack Payout Setup (Crucial for 5% split)
      const { data: profile } = await supabase
        .from('profiles')
        .select('paystack_subaccount_code, business_name')
        .eq('id', user.id)
        .single();

      if (!profile?.paystack_subaccount_code) {
        setFormError("Action Required: Payout Account not detected. Please complete onboarding in Settings.");
      } else {
        setOrganizerSubaccount(profile.paystack_subaccount_code);
      }
    };
    initialize();
  }, [router]);

  // --- 3. MAPBOX GEOCODER INITIALIZATION ---
  useEffect(() => {
    if (!geocoderContainerRef.current || !MAPBOX_TOKEN) return;

    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      types: 'address,poi,place',
      placeholder: 'Search venue (e.g. Polo Beach Club)',
      proximity: { longitude: -0.1870, latitude: 5.6037 }
    });

    geocoder.addTo(geocoderContainerRef.current);

    geocoder.on('result', (e) => {
      const [lng, lat] = e.result.center;
      setEventData(prev => ({
        ...prev,
        location_name: e.result.place_name,
        lat: lat,
        lng: lng
      }));
      setViewState(prev => ({ ...prev, latitude: lat, longitude: lng, zoom: 16 }));
    });

    return () => {
      if (geocoderContainerRef.current) geocoderContainerRef.current.innerHTML = '';
    };
  }, []);

  // --- 4. MEDIA HANDLING (SUPABASE STORAGE) ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFormError(null);
    const uploadedUrls = [...eventData.image_urls];

    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) throw new Error("File too large (Max 5MB)");
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }
      setEventData(prev => ({ ...prev, image_urls: uploadedUrls }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const filtered = eventData.image_urls.filter((_, i) => i !== index);
    setEventData({ ...eventData, image_urls: filtered });
  };

  // --- 5. TIER MANAGEMENT ---
  const addTier = () => {
    setTiers([...tiers, { id: crypto.randomUUID(), name: '', price: '', capacity: '', description: '' }]);
  };

  const removeTier = (id) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter(t => t.id !== id));
    } else {
      setFormError("Event must have at least one ticket tier.");
    }
  };

  const updateTier = (id, field, value) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- 6. SUBMISSION LOGIC ---
  const validateForm = () => {
    if (!eventData.title.trim()) throw new Error("Event title is required.");
    if (!eventData.date) throw new Error("Event date is required.");
    if (eventData.image_urls.length === 0) throw new Error("At least one event poster is required.");
    if (!eventData.location_name) throw new Error("Please select a venue location.");
    
    tiers.forEach(tier => {
      if (!tier.name || !tier.price || !tier.capacity) {
        throw new Error("Please complete all ticket tier details.");
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!organizerSubaccount) return;
    
    setLoading(true);
    setFormError(null);

    try {
      validateForm();

      // Step 1: Create Main Event Record
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          organizer_id: user.id,
          title: eventData.title,
          description: eventData.description,
          event_date: eventData.date,
          event_time: `${eventData.hour}:${eventData.minute} ${eventData.period}`,
          location_name: eventData.location_name,
          latitude: eventData.lat,
          longitude: eventData.lng,
          image_urls: eventData.image_urls,
          paystack_subaccount: organizerSubaccount,
          category: eventData.category,
          is_published: eventData.is_published,
          visibility: eventData.visibility
        }])
        .select().single();

      if (eventError) throw eventError;

      // Step 2: Bulk Insert Tiers
      const tiersPayload = tiers.map(t => ({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price),
        max_capacity: parseInt(t.capacity),
        description: t.description
      }));

      const { error: tiersError } = await supabase.from('ticket_tiers').insert(tiersPayload);
      if (tiersError) throw tiersError;

      setSuccess(true);
      setTimeout(() => router.push('/dashboard/organizer'), 2000);

    } catch (err) {
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // --- 7. STYLING (THE LUXURY SYSTEM) ---
  const styles = {
    wrapper: { background: '#fcfdfe', minHeight: '100vh', padding: '40px 20px 120px' },
    container: { maxWidth: '1240px', margin: '0 auto' },
    sidebarCard: { background: '#fff', borderRadius: '28px', padding: '24px', border: '1px solid #f1f5f9', position: 'sticky', top: '24px' },
    mainCard: { background: '#fff', borderRadius: '32px', padding: '32px', border: '1px solid #f1f5f9', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' },
    label: { fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'block' },
    input: { width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontWeight: '600', fontSize: '15px', outline: 'none', transition: 'border 0.2s' },
    iconBox: (color) => ({ width: '42px', height: '42px', borderRadius: '12px', background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }),
    dropZone: (active) => ({ border: active ? '2px solid #0ea5e9' : '2px dashed #e2e8f0', background: active ? '#f0f9ff' : '#f8fafc', borderRadius: '24px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.3s' }),
    submitBtn: { width: '100%', background: '#000', color: '#fff', padding: '20px', borderRadius: '20px', fontWeight: '900', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '16px' }
  };

  return (
    <div style={styles.wrapper}>
      <style>{`
        .mapboxgl-ctrl-geocoder { width: 100% !important; max-width: none !important; box-shadow: none !important; border: 2px solid #f1f5f9 !important; border-radius: 16px !important; background: #f8fafc !important; }
        .mapboxgl-ctrl-geocoder--input { padding: 16px 16px 16px 45px !important; font-weight: 600 !important; }
        .mapboxgl-ctrl-geocoder--icon-search { left: 15px !important; top: 15px !important; }
        @media (max-width: 1024px) { .layout-grid { display: flex !important; flex-direction: column !important; } }
      `}</style>

      <div style={styles.container}>
        <div style={{ marginBottom: '40px' }}>
          <button onClick={() => router.back()} style={{ border: 'none', background: 'none', color: '#64748b', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <ChevronLeft size={18} /> BACK TO DASHBOARD
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '15px' }}>
            <h1 style={{ fontSize: '38px', fontWeight: '950', letterSpacing: '-0.04em', margin: 0 }}>Create Experience</h1>
            <div style={{ background: '#4ade8020', color: '#16a34a', padding: '6px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={14} /> VERIFIED ORGANIZER
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '20px', borderRadius: '20px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '600' }}>
            <AlertCircle size={20} /> {formError}
          </div>
        )}

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', color: '#166534', padding: '20px', borderRadius: '20px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '600' }}>
            <CheckCircle2 size={20} /> Experience published successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="layout-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '40px', alignItems: 'start' }}>
          
          <div className="form-main">
            {/* --- MEDIA SECTION --- */}
            <div style={styles.mainCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={styles.iconBox('#8b5cf6')}><ImageIcon size={22} /></div>
                <h2 style={{ fontSize: '20px', fontWeight: '850', margin: 0 }}>Visual Identity</h2>
              </div>

              <div 
                style={styles.dropZone(dragActive)}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                {uploading ? (
                  <div style={{ textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={32} color="#0ea5e9" />
                    <p style={{ fontWeight: '800', fontSize: '13px', marginTop: '10px' }}>Uploading Media...</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#fff', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                      <Upload size={20} color="#64748b" />
                    </div>
                    <p style={{ fontWeight: '800', color: '#0f172a', margin: '0 0 4px' }}>Drop event posters here</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>PNG, JPG or WEBP (Max 5MB)</p>
                  </div>
                )}
                <input type="file" multiple ref={fileInputRef} hidden onChange={(e) => handleFileUpload(e.target.files)} accept="image/*" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px', marginTop: '24px' }}>
                {eventData.image_urls.map((url, i) => (
                  <div key={url} style={{ height: '140px', borderRadius: '18px', position: 'relative', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Poster" />
                    <button type="button" onClick={() => removeImage(i)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '8px', color: '#fff', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                      <X size={14} />
                    </button>
                    {i === 0 && <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: '#000', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: '900' }}>COVER</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* --- CORE DETAILS --- */}
            <div style={styles.mainCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={styles.iconBox('#0ea5e9')}><FileText size={22} /></div>
                <h2 style={{ fontSize: '20px', fontWeight: '850', margin: 0 }}>Experience Details</h2>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={styles.label}>EXPERIENCE TITLE</label>
                <input style={styles.input} placeholder="e.g. The Garden Party: All White Edition" value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={styles.label}>DATE</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="date" style={{ ...styles.input, paddingLeft: '48px' }} onChange={e => setEventData({...eventData, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label style={styles.label}>TIME</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', flex: 1, background: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '16px', padding: '4px' }}>
                      <input style={{ width: '45px', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '15px' }} maxLength="2" value={eventData.hour} onChange={e => setEventData({...eventData, hour: e.target.value})} />
                      <span style={{ display: 'flex', alignItems: 'center', fontWeight: '900', color: '#cbd5e1' }}>:</span>
                      <input style={{ width: '45px', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '15px' }} maxLength="2" value={eventData.minute} onChange={e => setEventData({...eventData, minute: e.target.value})} />
                    </div>
                    <button type="button" onClick={() => setEventData({...eventData, period: eventData.period === 'AM' ? 'PM' : 'AM'})} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', width: '50px', fontWeight: '900', fontSize: '12px' }}>
                      {eventData.period}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={styles.label}>DESCRIPTION</label>
                <textarea 
                  style={{ ...styles.input, height: '140px', resize: 'none', lineHeight: '1.6' }} 
                  placeholder="Share what makes this experience unique. What should guests expect?"
                  value={eventData.description}
                  onChange={e => setEventData({...eventData, description: e.target.value})}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={styles.label}>CATEGORY</label>
                  <select style={styles.input} value={eventData.category} onChange={e => setEventData({...eventData, category: e.target.value})}>
                    <option>Nightlife</option>
                    <option>Gala</option>
                    <option>Concert</option>
                    <option>Beach Experience</option>
                    <option>Brunch</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>VISIBILITY</label>
                  <select style={styles.input} value={eventData.visibility} onChange={e => setEventData({...eventData, visibility: e.target.value})}>
                    <option value="public">Public (Visible to all)</option>
                    <option value="private">Private (Link only)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* --- LOCATION SECTION --- */}
            <div style={styles.mainCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={styles.iconBox('#f43f5e')}><MapPin size={22} /></div>
                <h2 style={{ fontSize: '20px', fontWeight: '850', margin: 0 }}>Venue & Logistics</h2>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={styles.label}>LOCATION SEARCH</label>
                <div ref={geocoderContainerRef} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <Navigation size={14} color="#0ea5e9" />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                    {eventData.location_name || "Enter a venue address above..."}
                  </span>
                </div>
              </div>

              <div style={{ height: '440px', borderRadius: '24px', overflow: 'hidden', border: '2px solid #f1f5f9', position: 'relative' }}>
                <Map
                  {...viewState}
                  onMove={evt => setViewState(evt.viewState)}
                  mapStyle="mapbox://styles/mapbox/dark-v11"
                  mapboxAccessToken={MAPBOX_TOKEN}
                  onDblClick={(e) => setEventData({...eventData, lat: e.lngLat.lat, lng: e.lngLat.lng})}
                >
                  <Marker 
                    longitude={eventData.lng} 
                    latitude={eventData.lat} 
                    anchor="bottom" 
                    draggable 
                    onDragEnd={e => setEventData({...eventData, lat: e.lngLat.lat, lng: e.lngLat.lng})} 
                  >
                    <div style={{ background: '#fff', padding: '5px', borderRadius: '50%', boxShadow: '0 0 20px rgba(0,0,0,0.3)' }}>
                      <div style={{ background: '#000', width: '12px', height: '12px', borderRadius: '50%' }} />
                    </div>
                  </Marker>
                  <NavigationControl position="top-right" />
                  <GeolocateControl position="top-right" />
                  <FullscreenControl position="top-right" />
                </Map>
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: '#fff', padding: '10px 15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: '800' }}>
                   DRAG PIN TO EXACT ENTRANCE
                </div>
              </div>
            </div>
          </div>

          <div className="form-sidebar">
            {/* --- TICKETING TICKET TIER --- */}
            <div style={styles.sidebarCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={styles.iconBox('#f59e0b')}><Ticket size={22} /></div>
                <h2 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>Access Tiers</h2>
              </div>

              {tiers.map((tier, index) => (
                <div key={tier.id} style={{ background: '#f8fafc', padding: '20px', borderRadius: '24px', marginBottom: '16px', border: '1px solid #f1f5f9', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: '#cbd5e1', letterSpacing: '0.1em' }}>TIER #{index + 1}</span>
                    <button type="button" onClick={() => removeTier(tier.id)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ ...styles.label, fontSize: '9px' }}>TIER NAME</label>
                    <input style={{ ...styles.input, padding: '12px' }} placeholder="e.g. VIP Table for 4" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ ...styles.label, fontSize: '9px' }}>PRICE (GHS)</label>
                      <input style={{ ...styles.input, padding: '12px' }} type="number" placeholder="0.00" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ ...styles.label, fontSize: '9px' }}>CAPACITY</label>
                      <input style={{ ...styles.input, padding: '12px' }} type="number" placeholder="100" value={tier.capacity} onChange={e => updateTier(tier.id, 'capacity', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addTier} style={{ width: '100%', padding: '16px', borderRadius: '18px', border: '2px dashed #e2e8f0', background: 'none', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
                <Plus size={16} /> ADD ANOTHER TIER
              </button>

              {/* PAYOUT SUMMARY */}
              <div style={{ background: '#0f172a', borderRadius: '24px', padding: '24px', color: '#fff' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(74, 222, 128, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Percent size={18} color="#4ade80" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '800' }}>Platform Commission</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
                      A 5% service fee is automatically applied to every sale via Paystack split.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={18} color="#38bdf8" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '800' }}>Secure Payouts</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
                      Funds are settled directly to subaccount: <br/><strong style={{color: '#fff'}}>{organizerSubaccount || "LINKING..."}</strong>
                    </p>
                  </div>
                </div>

                <button disabled={loading || !organizerSubaccount} style={styles.submitBtn}>
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Sparkles size={18} />
                      PUBLISH EXPERIENCE
                    </>
                  )}
                </button>
                
                <p style={{ textAlign: 'center', fontSize: '10px', color: '#475569', fontWeight: '700', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                   <Lock size={10}/> SECURE 256-BIT ENCRYPTED PUBLISHING
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '20px', borderRadius: '24px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
               <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={16} color="#94a3b8"/> Need Assistance?
               </h4>
               <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600', lineHeight: '1.5' }}>
                  Contact our concierge support for help with large scale event logistics or table management.
               </p>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
