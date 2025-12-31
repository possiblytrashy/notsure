"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { useJsApiLoader, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { 
  Save, X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, AlertCircle, 
  CheckCircle2, Loader2, ChevronLeft, Info,
  Layers, CreditCard, Sparkles, Upload, CloudLightning,
  Eye, Settings, HelpCircle, ShieldCheck, Zap,
  FileText, Tag, Globe, Lock, User, ChevronUp, ChevronDown,
  Navigation
} from 'lucide-react';

// --- CONFIG ---
// --- CONFIG ---
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; 
const libraries = ['places'];

export default function CreateEvent() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  // --- GOOGLE MAPS LOADER ---
 // --- GOOGLE MAPS LOADER ---
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "", // Prevents crash if undefined
    libraries: libraries,
  });

  if (loadError) {
    return <div>Error loading maps. Please check your connection or API configuration.</div>;
  }

  // --- 1. STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [organizerSubaccount, setOrganizerSubaccount] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    hour: '12',
    minute: '00',
    period: 'PM',
    location: '', 
    lat: 5.6037, // Default Accra Coords for Initial View
    lng: -0.1870,
    category: 'Entertainment',
    image_urls: [], 
    is_published: true,
  });

  const [tiers, setTiers] = useState([
    { 
      id: crypto.randomUUID(), 
      name: 'Regular', 
      price: '', 
      capacity: '', 
      description: 'Standard entry to the experience' 
    }
  ]);

  // --- 2. AUTH & SECURITY ---
  useEffect(() => {
    const checkUserAndPayouts = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('paystack_subaccount_code')
        .eq('id', user.id)
        .single();

      if (!profile?.paystack_subaccount_code) {
        setFormError("No Payout Account detected. Visit Settings to link your Bank/MoMo before publishing.");
      } else {
        setOrganizerSubaccount(profile.paystack_subaccount_code);
      }
    };
    checkUserAndPayouts();
  }, [router]);

  // --- 3. LOCATION & MAP LOGIC ---
  const onPlaceSelected = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      setEventData(prev => ({
        ...prev,
        location: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      }));
      setShowMap(true);
    }
  };

  const onMapClick = (e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    setEventData(prev => ({ ...prev, lat: newLat, lng: newLng }));
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        setEventData(prev => ({ ...prev, location: results[0].formatted_address }));
      }
    });
  };

  // --- 4. MEDIA UPLOAD LOGIC ---
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > 5 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setFormError(null);
    let newUrls = [...eventData.image_urls];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100));

        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      setEventData(prev => ({ ...prev, image_urls: newUrls }));
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      setFormError("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

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
    if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    const filtered = eventData.image_urls.filter((_, i) => i !== index);
    setEventData({ ...eventData, image_urls: filtered });
  };

  // --- 5. TIER DYNAMICS ---
  const addTier = () => {
    setTiers([...tiers, { id: crypto.randomUUID(), name: '', price: '', capacity: '', description: '' }]);
  };

  const removeTier = (id) => {
    if (tiers.length > 1) setTiers(tiers.filter(t => t.id !== id));
    else setFormError("At least one ticket tier is required.");
  };

  const updateTier = (id, field, value) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- 6. SUBMISSION ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!organizerSubaccount) {
      setFormError("Payout account missing. Split cannot be initialized.");
      return;
    }

    const invalidTier = tiers.find(t => !t.name || !t.price || !t.capacity);
    if (invalidTier) {
      setFormError("Ensure all tiers have a name, price, and quantity.");
      return;
    }

    if (!eventData.title.trim() || !eventData.date || eventData.image_urls.length === 0) {
      setFormError("Missing required fields or images.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    const formattedTime = `${eventData.hour}:${eventData.minute} ${eventData.period}`;

    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          organizer_id: user.id,
          organizer_subaccount: organizerSubaccount,
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          time: formattedTime,
          location: eventData.location,
          lat: eventData.lat,
          lng: eventData.lng,
          category: eventData.category,
          images: eventData.image_urls,
          is_published: eventData.is_published
        }])
        .select().single();

      if (eventError) throw eventError;

      const tiersPayload = tiers.map(t => ({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price),
        max_quantity: parseInt(t.capacity),
        description: t.description || 'Access'
      }));

      const { error: tiersError } = await supabase.from('ticket_tiers').insert(tiersPayload);
      if (tiersError) throw tiersError;

      router.push('/dashboard/organizer');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 7. STYLING (RETAINED FROM ORIGINAL) ---
  const styles = {
    pageContainer: { padding: '24px 16px 100px', maxWidth: '1280px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#fcfdfe', fontFamily: '"Inter", sans-serif', boxSizing: 'border-box' },
    topHeader: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' },
    backBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    mainTitle: { fontSize: '28px', fontWeight: '950', letterSpacing: '-0.04em', margin: '0', color: '#000' },
    errorBanner: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '16px', color: '#991b1b', fontSize: '13px', fontWeight: '600', marginBottom: '24px' },
    formSection: { backgroundColor: '#ffffff', borderRadius: '24px', padding: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '20px' },
    sectionTitleRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
    iconBox: (color) => ({ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }),
    sectionHeading: { fontSize: '17px', fontWeight: '800', margin: '0' },
    dropZone: (active) => ({ width: '100%', minHeight: '160px', borderRadius: '20px', border: active ? '3px solid #0ea5e9' : '2px dashed #e2e8f0', backgroundColor: active ? '#f0f9ff' : '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.3s' }),
    imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginTop: '12px' },
    imageThumb: { position: 'relative', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', width: '100%' },
    label: { fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: { width: '100%', backgroundColor: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' },
    textarea: { width: '100%', backgroundColor: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '600', outline: 'none', minHeight: '100px', boxSizing: 'border-box' },
    timePickerContainer: { display: 'flex', gap: '6px', alignItems: 'center' },
    timeInput: { width: '42px', textAlign: 'center', padding: '12px 4px', borderRadius: '12px', border: '2px solid #f1f5f9', fontSize: '15px', fontWeight: '800', backgroundColor: '#f8fafc' },
    periodWrapper: { display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '14px' },
    periodToggle: (active) => ({ padding: '8px 10px', borderRadius: '10px', border: 'none', backgroundColor: active ? '#000' : 'transparent', color: active ? '#fff' : '#64748b', fontWeight: '800', fontSize: '11px' }),
    tierCard: { backgroundColor: '#f8fafc', borderRadius: '20px', padding: '16px', border: '1px solid #f1f5f9', marginBottom: '12px' },
    publishCard: { backgroundColor: '#0f172a', borderRadius: '24px', padding: '24px', color: '#fff' },
    submitBtn: { width: '100%', backgroundColor: '#fff', color: '#0f172a', border: 'none', padding: '18px', borderRadius: '16px', fontSize: '15px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' },
    mapContainer: { width: '100%', height: '240px', borderRadius: '20px', overflow: 'hidden', marginTop: '15px', border: '2px solid #f1f5f9' }
  };

  return (
    <div style={styles.pageContainer}>
      <style>{`
        @media (min-width: 1024px) {
          .create-form-layout { display: grid !important; grid-template-columns: 1.4fr 1fr !important; gap: 40px !important; }
          .publish-column { position: sticky !important; top: 20px; height: fit-content; }
        }
        input:focus, textarea:focus { border-color: #000 !important; }
      `}</style>

      <div style={styles.topHeader}>
        <button style={styles.backBtn} onClick={() => router.back()}><ChevronLeft size={18} /> BACK</button>
        <h1 style={styles.mainTitle}>New Experience</h1>
      </div>

      {formError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={18} style={{flexShrink:0}}/>
          <span>{formError}</span>
          {!organizerSubaccount && <button onClick={() => router.push('/dashboard/settings')} style={{ marginLeft: 'auto', background: '#991b1b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '8px', fontSize: '11px' }}>Link Now</button>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="create-form-layout" style={{display:'flex', flexDirection:'column'}}>
        <div className="main-column">
          
          {/* MEDIA SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#8b5cf6')}><ImageIcon size={20} /></div>
              <h2 style={styles.sectionHeading}>Gallery & Posters</h2>
            </div>
            <div 
              style={styles.dropZone(dragActive)} 
              onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              {uploading ? (
                <div style={{textAlign:'center'}}><Loader2 className="animate-spin" size={24} /> <p style={{fontSize:12}}>Uploading... {uploadProgress}%</p></div>
              ) : (
                <div style={{textAlign:'center'}}><Upload size={24} color="#94a3b8" style={{marginBottom:8}}/><p style={{fontWeight:800, fontSize:13, margin:0}}>Upload Images</p></div>
              )}
              <input type="file" multiple ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={(e) => handleFileUpload(e.target.files)} />
            </div>
            <div style={styles.imageGrid}>
              {eventData.image_urls.map((url, idx) => (
                <div key={idx} style={styles.imageThumb}>
                  <img src={url} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  <button type="button" onClick={() => removeImage(idx)} style={{position:'absolute', top:2, right:2, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:4, padding:2}}><X size={10}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* DETAILS SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#0ea5e9')}><FileText size={20} /></div>
              <h2 style={styles.sectionHeading}>Event Information</h2>
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Title</label>
              <input style={styles.input} placeholder="e.g. Moonlight Gala" value={eventData.title} onChange={(e) => setEventData({...eventData, title: e.target.value})} />
            </div>

            <div style={{display:'flex', gap:12}}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Date</label>
                <input type="date" style={styles.input} value={eventData.date} onChange={(e) => setEventData({...eventData, date: e.target.value})} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Start Time</label>
                <div style={styles.timePickerContainer}>
                  <input style={styles.timeInput} maxLength="2" value={eventData.hour} onChange={e => setEventData({...eventData, hour: e.target.value})} />
                  <span style={{fontWeight:900}}>:</span>
                  <input style={styles.timeInput} maxLength="2" value={eventData.minute} onChange={e => setEventData({...eventData, minute: e.target.value})} />
                  <div style={styles.periodWrapper}>
                    <button type="button" style={styles.periodToggle(eventData.period === 'AM')} onClick={() => setEventData({...eventData, period:'AM'})}>AM</button>
                    <button type="button" style={styles.periodToggle(eventData.period === 'PM')} onClick={() => setEventData({...eventData, period:'PM'})}>PM</button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOCATION WITH MAP PINNING */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Venue & Precise Location</label>
              {isLoaded ? (
                <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={onPlaceSelected}>
                  <div style={{position:'relative'}}>
                    <MapPin size={16} style={{position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', zIndex:10}}/>
                    <input style={{...styles.input, paddingLeft:40}} placeholder="Search venue..." value={eventData.location} onChange={e => setEventData({...eventData, location: e.target.value})}/>
                  </div>
                </Autocomplete>
              ) : <div style={styles.input}>Loading Maps...</div>}
              
              <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:10, fontWeight:800, color:'#64748b'}}>RIDESHARING TIP: Pin the exact entrance</span>
                <button type="button" onClick={() => setShowMap(!showMap)} style={{background:'#000', color:'#fff', border:'none', padding:'6px 12px', borderRadius:8, fontSize:10, fontWeight:900}}>{showMap ? "Hide Map" : "Pin on Map"}</button>
              </div>

              {showMap && isLoaded && (
                <div style={styles.mapContainer}>
                  <GoogleMap 
                    mapContainerStyle={{width:'100%', height:'100%'}} 
                    center={{lat: eventData.lat, lng: eventData.lng}} 
                    zoom={15} 
                    onClick={onMapClick}
                    options={{disableDefaultUI:true, zoomControl:true}}
                  >
                    <Marker position={{lat: eventData.lat, lng: eventData.lng}}/>
                  </GoogleMap>
                </div>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Description</label>
              <textarea style={styles.textarea} placeholder="What makes this special?" value={eventData.description} onChange={(e) => setEventData({...eventData, description: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="publish-column">
          {/* TICKETS SECTION */}
          <div style={styles.formSection}>
            <div style={styles.sectionTitleRow}>
              <div style={styles.iconBox('#f59e0b')}><Ticket size={20} /></div>
              <h2 style={styles.sectionHeading}>Ticket Tiers</h2>
            </div>
            {tiers.map((tier) => (
              <div key={tier.id} style={styles.tierCard}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <input style={{background:'none', border:'none', borderBottom:'2px solid #e2e8f0', fontSize:15, fontWeight:900, padding:'4px 0', outline:'none', width:'100%', marginBottom:12}} placeholder="Tier Name" value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} />
                  <button type="button" onClick={() => removeTier(tier.id)} style={{background:'none', border:'none', color:'#fca5a5', paddingBottom:12}}><Trash2 size={16}/></button>
                </div>
                <div style={{display:'flex', gap:12}}>
                  <div style={styles.inputGroup}><label style={styles.label}>Price (GHS)</label><input type="number" style={styles.input} value={tier.price} onChange={e => updateTier(tier.id, 'price', e.target.value)} /></div>
                  <div style={styles.inputGroup}><label style={styles.label}>Qty</label><input type="number" style={styles.input} value={tier.capacity} onChange={e => updateTier(tier.id, 'capacity', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addTier} style={{width:'100%', padding:14, borderRadius:14, border:'2px dashed #e2e8f0', background:'none', color:'#64748b', fontWeight:800, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}><Plus size={14}/> ADD TIER</button>
          </div>

          {/* FINAL PUBLISH SECTION */}
          <div style={styles.publishCard}>
             <div style={{display:'flex', gap:16, marginBottom:20}}>
                <div style={styles.iconBox('#4ade80')}><Zap size={20}/></div>
                <div>
                   <h3 style={{margin:0, fontWeight:900, fontSize:16}}>Publish Experience</h3>
                   <p style={{margin:0, color:'#94a3b8', fontSize:12}}>5% Commission Split is Active.</p>
                </div>
             </div>
             <button type="submit" style={styles.submitBtn} disabled={loading || uploading}>
                {loading ? <Loader2 className="animate-spin" size={20}/> : <><CheckCircle2 size={20}/> PUBLISH NOW</>}
             </button>
             <div style={{display:'flex', justifyContent:'center', marginTop:14, color:'#4ade80', fontSize:10, fontWeight:800, gap:5}}>
                <ShieldCheck size={12}/> SECURE GATEWAY ENABLED
             </div>
          </div>
        </div>
      </form>
    </div>
  );
}
