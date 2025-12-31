"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Map, { Marker, NavigationControl } from 'react-map-gl';

// UI & Icons
import { 
  X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, 
  Loader2, ChevronLeft, Upload, FileText,
  CheckCircle2, AlertCircle, Sparkles,
  ShieldCheck, Lock, Percent, Search, Map as MapIcon,
  Info, Eye, EyeOff, Settings, CreditCard,
  ChevronRight, HelpCircle, ArrowRight
} from 'lucide-react';

// CSS Imports
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

/**
 * CREATE EVENT COMPONENT
 * Features:
 * - Luxury UI Design System
 * - Multi-tier Ticketing Support
 * - Paystack Subaccount Integration (5% Split)
 * - Mapbox Geocoding & Manual Location Override
 * - Supabase Storage for High-Res Media
 */

export default function CreateEvent() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // --- 1. STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);
  const [organizerSubaccount, setOrganizerSubaccount] = useState(null);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Event Data State
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    hour: '08',
    minute: '00',
    period: 'PM',
    location_name: '', 
    lat: 5.6037, // Default Accra
    lng: -0.1870,
    category: 'Entertainment',
    image_urls: [], 
    is_published: true,
    visibility: 'public'
  });

  // Tiers State
  const [tiers, setTiers] = useState([
    { 
      id: crypto.randomUUID(), 
      name: 'Standard Access', 
      price: '', 
      capacity: '', 
      description: 'General admission to the experience'
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
        .select('paystack_subaccount_code')
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

  // --- 3. LOCATION LOGIC ---
  const handleMapClick = (e) => {
    const { lng, lat } = e.lngLat;
    setEventData(prev => ({ ...prev, lat, lng }));
  };

  const handleManualSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setEventData(prev => ({
          ...prev,
          location_name: data.features[0].place_name,
          lat,
          lng
        }));
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setFormError("Could not find that location on the map.");
    } finally {
      setIsSearching(false);
    }
  };

  // --- 4. MEDIA HANDLING (SUPABASE STORAGE) ---
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFormError(null);
    const uploadedUrls = [...eventData.image_urls];

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error("File too large (Max 10MB for luxury themes)");
        
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
    }
  };

  const updateTier = (id, field, value) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- 6. SUBMISSION LOGIC ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!organizerSubaccount) {
      setFormError("Payout account missing. Please check settings.");
      return;
    }
    
    setLoading(true);
    setFormError(null);

    try {
      if (!eventData.title) throw new Error("Please provide an experience title.");
      if (!eventData.location_name) throw new Error("A venue name or address is required.");
      if (eventData.image_urls.length === 0) throw new Error("Upload at least one promotional image.");

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

      // Step 2: Bulk Insert Ticket Tiers
      const tiersPayload = tiers.map(t => ({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price) || 0,
        max_capacity: parseInt(t.capacity) || 0,
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

  // --- 7. STYLING OBJECT (LUXURY SYSTEM) ---
  const styles = {
    wrapper: { 
      background: '#fcfdfe', 
      minHeight: '100vh', 
      padding: '40px 20px 120px',
      fontFamily: 'inherit'
    },
    container: { 
      maxWidth: '1240px', 
      margin: '0 auto' 
    },
    mainCard: { 
      background: '#fff', 
      borderRadius: '32px', 
      padding: '36px', 
      border: '1px solid #f1f5f9', 
      marginBottom: '28px', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.02)' 
    },
    sidebarCard: { 
      background: '#fff', 
      borderRadius: '28px', 
      padding: '28px', 
      border: '1px solid #f1f5f9', 
      position: 'sticky', 
      top: '32px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.02)'
    },
    label: { 
      fontSize: '11px', 
      fontWeight: '900', 
      color: '#94a3b8', 
      textTransform: 'uppercase', 
      letterSpacing: '0.1em', 
      marginBottom: '12px', 
      display: 'block' 
    },
    input: { 
      width: '100%', 
      padding: '18px', 
      borderRadius: '18px', 
      border: '2px solid #f1f5f9', 
      background: '#f8fafc', 
      fontWeight: '600', 
      fontSize: '16px', 
      outline: 'none', 
      transition: 'all 0.2s ease',
      color: '#0f172a'
    },
    iconBox: (color) => ({ 
      width: '46px', 
      height: '46px', 
      borderRadius: '14px', 
      background: `${color}10`, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      color: color 
    }),
    submitBtn: { 
      width: '100%', 
      background: '#000', 
      color: '#fff', 
      padding: '22px', 
      borderRadius: '22px', 
      fontWeight: '900', 
      border: 'none', 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '12px', 
      fontSize: '17px',
      transition: 'transform 0.2s ease',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
    },
    locationBar: { 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'center', 
      background: '#f8fafc', 
      padding: '10px', 
      borderRadius: '22px', 
      border: '2px solid #f1f5f9' 
    },
    mapModalOverlay: { 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(15, 23, 42, 0.92)', 
      backdropFilter: 'blur(12px)', 
      zIndex: 2000, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '24px' 
    },
    mapModalContent: { 
      background: '#fff', 
      width: '100%', 
      maxWidth: '1000px', 
      borderRadius: '40px', 
      overflow: 'hidden', 
      position: 'relative',
      boxShadow: '0 30px 100px rgba(0,0,0,0.4)'
    },
    tierCard: {
      background: '#f8fafc',
      padding: '24px',
      borderRadius: '24px',
      marginBottom: '20px',
      border: '1px solid #f1f5f9',
      transition: 'all 0.3s ease'
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* --- HEADER --- */}
        <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <button 
              onClick={() => router.back()} 
              style={{ border: 'none', background: 'none', color: '#94a3b8', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '0.05em' }}
            >
              <ChevronLeft size={16} strokeWidth={3} /> RETURN TO PORTAL
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
              <h1 style={{ fontSize: '42px', fontWeight: '950', letterSpacing: '-0.05em', margin: 0, color: '#0f172a' }}>Create Experience</h1>
              <div style={{ background: '#000', color: '#fff', padding: '6px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={12} /> PREMIUM
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'none' }}>
            {/* Optional draft status indicators */}
          </div>
        </div>

        {/* --- ALERTS --- */}
        {formError && (
          <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', color: '#be123c', padding: '24px', borderRadius: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '15px', fontWeight: '700', boxShadow: '0 10px 30px rgba(225, 29, 72, 0.05)' }}>
            <div style={{ background: '#be123c', color: '#fff', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={18} />
            </div>
            {formError}
          </div>
        )}

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', padding: '24px', borderRadius: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '15px', fontWeight: '700', boxShadow: '0 10px 30px rgba(22, 163, 74, 0.05)' }}>
            <div style={{ background: '#15803d', color: '#fff', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
            Your experience is now live. Redirecting to management console...
          </div>
        )}

        {/* --- FORM GRID --- */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '48px', alignItems: 'start' }}>
          
          <div className="main-content-flow">
            {/* Visuals Section */}
            <div style={styles.mainCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={styles.iconBox('#8b5cf6')}><ImageIcon size={24} /></div>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>Aesthetics</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>High-resolution posters for the experience</p>
                  </div>
                </div>
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: '14px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <Plus size={16} /> ADD IMAGES
                </button>
              </div>

              <div 
                style={{ 
                  border: '2px dashed #e2e8f0', 
                  background: '#f8fafc', 
                  borderRadius: '28px', 
                  minHeight: '220px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => fileInputRef.current.click()}
              >
                {uploading ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '60px', height: '60px', margin: '0 auto 16px' }}>
                      <Loader2 className="animate-spin" size={60} strokeWidth={1} color="#000" />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: '900', fontSize: '10px' }}>%</div>
                    </div>
                    <p style={{ fontWeight: '900', fontSize: '14px', color: '#0f172a' }}>OPTIMIZING ASSETS</p>
                  </div>
                ) : eventData.image_urls.length === 0 ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#fff', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}>
                      <Upload size={24} color="#64748b" />
                    </div>
                    <p style={{ fontWeight: '850', color: '#0f172a', margin: '0 0 6px', fontSize: '16px' }}>Drop your promotional media</p>
                    <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>4K/High-Res supported (Max 10MB per file)</p>
                  </div>
                ) : (
                  <div style={{ width: '100%', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
                    {eventData.image_urls.map((url, i) => (
                      <div key={url} style={{ height: '160px', borderRadius: '20px', position: 'relative', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Poster" />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 40%)' }} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }} style={{ position: 'absolute', top: '10px', right: '10px', background: '#fff', border: 'none', borderRadius: '10px', color: '#ef4444', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <div style={{ height: '160px', borderRadius: '20px', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                       <Plus size={24} />
                    </div>
                  </div>
                )}
                <input type="file" multiple ref={fileInputRef} hidden onChange={(e) => handleFileUpload(e.target.files)} accept="image/*" />
              </div>
            </div>

            {/* Core Details Section */}
            <div style={styles.mainCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
                <div style={styles.iconBox('#0ea5e9')}><FileText size={24} /></div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#0f172a' }}>Experience Info</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>The narrative and logistics of your event</p>
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={styles.label}>EXPERIENCE TITLE</label>
                <input style={styles.input} placeholder="Enter a name that commands attention..." value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={styles.label}>VENUE LOCATION</label>
                <div style={styles.locationBar}>
                  <div style={{ padding: '0 12px', color: '#0ea5e9' }}>
                    <MapPin size={22} strokeWidth={2.5} />
                  </div>
                  <input 
                    style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontWeight: '700', fontSize: '16px', color: '#0f172a' }} 
                    placeholder="Enter venue name manually..."
                    value={eventData.location_name}
                    onChange={(e) => setEventData({...eventData, location_name: e.target.value})}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowMapModal(true)}
                    style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}
                  >
                    <MapIcon size={16} /> PICK ON MAP
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '32px' }}>
                <div>
                  <label style={styles.label}>EVENT DATE</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={18} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="date" style={{ ...styles.input, paddingLeft: '50px' }} onChange={e => setEventData({...eventData, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label style={styles.label}>START TIME</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', flex: 1, background: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '18px', padding: '6px' }}>
                      <input style={{ width: '100%', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '16px' }} value={eventData.hour} onChange={e => setEventData({...eventData, hour: e.target.value})} maxLength="2" />
                      <span style={{ alignSelf: 'center', fontWeight: '950', color: '#cbd5e1' }}>:</span>
                      <input style={{ width: '100%', border: 'none', background: 'none', textAlign: 'center', fontWeight: '800', fontSize: '16px' }} value={eventData.minute} onChange={e => setEventData({...eventData, minute: e.target.value})} maxLength="2" />
                    </div>
                    <button type="button" onClick={() => setEventData({...eventData, period: eventData.period === 'AM' ? 'PM' : 'AM'})} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', width: '70px', fontWeight: '900', cursor: 'pointer', letterSpacing: '0.1em' }}>
                      {eventData.period}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={styles.label}>DESCRIPTION & PROGRAM</label>
                <textarea 
                  style={{ ...styles.input, height: '180px', resize: 'none', lineHeight: '1.6' }} 
                  placeholder="Elaborate on the exclusivity, the schedule, or the dress code..."
                  value={eventData.description}
                  onChange={e => setEventData({...eventData, description: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* --- SIDEBAR --- */}
          <div className="sidebar-sticky">
            <div style={styles.sidebarCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                <div style={styles.iconBox('#f59e0b')}><Ticket size={24} /></div>
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: '900', margin: 0, color: '#0f172a' }}>Access Tiers</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Manage invitation levels</p>
                </div>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px', marginBottom: '24px' }}>
                {tiers.map((tier, index) => (
                  <div key={tier.id} style={styles.tierCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: index === 0 ? '#10b981' : '#f59e0b' }} />
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', letterSpacing: '0.05em' }}>TIER {index + 1}</span>
                      </div>
                      <button type="button" onClick={() => removeTier(tier.id)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div style={{ marginBottom: '14px' }}>
                      <input style={{ ...styles.input, padding: '14px', fontSize: '14px', border: '1px solid #e2e8f0' }} placeholder="Tier Label (e.g. VIP Access)" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', fontSize: '14px', color: '#94a3b8' }}>GH₵</span>
                        <input style={{ ...styles.input, padding: '14px 14px 14px 45px', fontSize: '14px', border: '1px solid #e2e8f0' }} type="number" placeholder="0.00" value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Ticket size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input style={{ ...styles.input, padding: '14px 14px 14px 40px', fontSize: '14px', border: '1px solid #e2e8f0' }} type="number" placeholder="Qty" value={tier.capacity} onChange={e => updateTier(tier.id, 'capacity', e.target.value)} />
                      </div>
                    </div>
                    <textarea 
                      style={{ ...styles.input, height: '70px', padding: '12px', fontSize: '13px', border: '1px solid #e2e8f0', resize: 'none' }} 
                      placeholder="Benefits included..."
                      value={tier.description}
                      onChange={e => updateTier(tier.id, 'description', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button type="button" onClick={addTier} style={{ width: '100%', padding: '18px', borderRadius: '20px', border: '2px dashed #cbd5e1', background: 'none', fontWeight: '800', color: '#64748b', cursor: 'pointer', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Plus size={18} /> ADD ACCESS TIER
              </button>

              <div style={{ background: '#0f172a', borderRadius: '28px', padding: '28px', color: '#fff', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '28px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '900' }}>Smart Split Payout</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', fontWeight: '500' }}>Your 95% revenue is sent instantly to your bank. Our 5% fee is handled at checkout.</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', marginBottom: '24px' }}>
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
                  disabled={loading || !organizerSubaccount} 
                  style={{ 
                    ...styles.submitBtn, 
                    background: loading ? '#334155' : '#fff', 
                    color: '#000',
                    opacity: organizerSubaccount ? 1 : 0.5 
                  }}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <>PUBLISH EXPERIENCE <ArrowRight size={18} /></>
                  )}
                </button>
                
                {!organizerSubaccount && (
                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#fca5a5', fontWeight: '800', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Lock size={12} /> ONBOARDING REQUIRED
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* --- MAP MODAL SYSTEM --- */}
      {showMapModal && (
        <div style={styles.mapModalOverlay}>
          <div style={styles.mapModalContent}>
            {/* Modal Header */}
            <div style={{ padding: '30px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontWeight: '950', fontSize: '24px', letterSpacing: '-0.02em' }}>Spatial Positioning</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>Define the exact coordinates for the luxury concierge</p>
              </div>
              <button 
                onClick={() => setShowMapModal(false)} 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s' }}
              >
                <X size={22}/>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px 40px' }}>
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '24px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={20} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    style={{ ...styles.input, paddingLeft: '54px', border: '2px solid #000' }} 
                    placeholder="Search venue (e.g. Polo Club Accra)" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleManualSearch} 
                  style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '20px', padding: '0 32px', fontWeight: '900', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  {isSearching ? <Loader2 className="animate-spin" size={18}/> : <><Search size={18}/> LOCATE</>}
                </button>
              </div>

              {/* Map Engine */}
              <div style={{ height: '480px', borderRadius: '32px', overflow: 'hidden', border: '1px solid #f1f5f9', position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)' }}>
                <Map
                  initialViewState={{ 
                    latitude: eventData.lat, 
                    longitude: eventData.lng, 
                    zoom: 15 
                  }}
                  latitude={eventData.lat}
                  longitude={eventData.lng}
                  onMove={e => setEventData(prev => ({ ...prev, lat: e.viewState.latitude, lng: e.viewState.longitude }))}
                  onClick={handleMapClick}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/dark-v11"
                  mapboxAccessToken={MAPBOX_TOKEN}
                >
                  <Marker 
                    latitude={eventData.lat} 
                    longitude={eventData.lng} 
                    draggable 
                    onDragEnd={handleMapClick}
                  >
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ 
                        background: '#fff', 
                        padding: '8px 16px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: '900', 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        marginBottom: '8px',
                        whiteSpace: 'nowrap',
                        border: '1px solid #000'
                      }}>
                        EVENT CENTERED HERE
                      </div>
                      <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                         <div style={{ width: '14px', height: '14px', background: '#000', border: '3px solid #fff', borderRadius: '50%' }} />
                      </div>
                    </div>
                  </Marker>
                  <NavigationControl position="top-right" />
                </Map>
                
                <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', padding: '16px 24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                   <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ background: '#f8fafc', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <MapPin size={18} color="#000" />
                      </div>
                      <div>
                         <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>COORDINATES</p>
                         <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{eventData.lat.toFixed(5)}, {eventData.lng.toFixed(5)}</p>
                      </div>
                   </div>
                   <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600', maxWidth: '300px', textAlign: 'right' }}>
                     Click anywhere or drag the pin to set the destination.
                   </p>
                </div>
              </div>

              {/* Action */}
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ ...styles.submitBtn, marginTop: '32px' }}
              >
                CONFIRM THIS POSITION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
