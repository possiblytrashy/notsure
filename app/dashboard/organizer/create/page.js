"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, X, Plus, Trash2, Image as ImageIcon, 
  MapPin, Calendar, Clock, Ticket, AlertCircle, 
  CheckCircle2, Loader2, ChevronLeft, Info,
  Layers, CreditCard, Sparkles, Globe
} from 'lucide-react';

export default function CreateEvent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // --- 1. FORM STATE ---
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'Entertainment',
    image_url: '',
    is_published: true
  });

  // --- 2. DYNAMIC TICKET TIERS STATE ---
  const [tiers, setTiers] = useState([
    { name: 'Regular', price: '', capacity: '', description: 'Standard entry' }
  ]);

  // --- 3. AUTH & INITIALIZATION ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    };
    checkUser();
  }, [router]);

  // --- 4. TIER MANAGEMENT LOGIC ---
  const addTier = () => {
    setTiers([...tiers, { name: '', price: '', capacity: '', description: '' }]);
  };

  const removeTier = (index) => {
    if (tiers.length === 1) return alert("You must have at least one ticket tier.");
    const newTiers = tiers.filter((_, i) => i !== index);
    setTiers(newTiers);
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  // --- 5. THE SUBMISSION ENGINE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Step A: Insert the Event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          organizer_id: user.id,
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          time: eventData.time,
          location: eventData.location,
          category: eventData.category,
          images: eventData.image_url ? [eventData.image_url] : [],
          is_published: eventData.is_published
        }])
        .select()
        .single();

      if (eventError) throw eventError;

      // Step B: Insert the Ticket Tiers
      const tiersWithEventId = tiers.map(tier => ({
        event_id: event.id,
        name: tier.name,
        price: parseFloat(tier.price) || 0,
        capacity: parseInt(tier.capacity) || 0,
        description: tier.description
      }));

      const { error: tiersError } = await supabase
        .from('ticket_tiers')
        .insert(tiersWithEventId);

      if (tiersError) throw tiersError;

      alert("Event Published Successfully!");
      router.push('/dashboard/organizer');

    } catch (err) {
      console.error("Creation Error:", err);
      alert(err.message || "Failed to create event. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageContainer}>
      {/* HEADER SECTION */}
      <div style={topHeader}>
        <button style={backBtn} onClick={() => router.back()}>
          <ChevronLeft size={20}/> BACK TO DASHBOARD
        </button>
        <div style={headerText}>
          <h1 style={mainTitle}>Create New Experience</h1>
          <p style={subTitle}>Fill in the details to launch your event on OUSTED.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={formLayout}>
        {/* LEFT COLUMN: CORE DETAILS */}
        <div style={formColumn}>
          <div style={formSection}>
            <div style={sectionTitleRow}>
              <div style={iconBox}><Info size={18} color="#0ea5e9"/></div>
              <h2 style={sectionHeading}>Basic Information</h2>
            </div>
            
            <div style={inputGroup}>
              <label style={label}>EVENT TITLE</label>
              <input 
                style={input} 
                placeholder="e.g. Afrobeat Night Live" 
                value={eventData.title}
                onChange={(e) => setEventData({...eventData, title: e.target.value})}
                required
              />
            </div>

            <div style={inputRow}>
              <div style={inputGroup}>
                <label style={label}>DATE</label>
                <div style={inputIconWrap}>
                  <Calendar size={16} style={innerIcon}/>
                  <input 
                    type="date" 
                    style={iconInput} 
                    value={eventData.date}
                    onChange={(e) => setEventData({...eventData, date: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div style={inputGroup}>
                <label style={label}>START TIME</label>
                <div style={inputIconWrap}>
                  <Clock size={16} style={innerIcon}/>
                  <input 
                    type="time" 
                    style={iconInput} 
                    value={eventData.time}
                    onChange={(e) => setEventData({...eventData, time: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            <div style={inputGroup}>
              <label style={label}>LOCATION / VENUE</label>
              <div style={inputIconWrap}>
                <MapPin size={16} style={innerIcon}/>
                <input 
                  style={iconInput} 
                  placeholder="e.g. Independence Square, Accra" 
                  value={eventData.location}
                  onChange={(e) => setEventData({...eventData, location: e.target.value})}
                  required
                />
              </div>
            </div>

            <div style={inputGroup}>
              <label style={label}>DESCRIPTION</label>
              <textarea 
                style={textarea} 
                rows="5"
                placeholder="Tell your guests what to expect..."
                value={eventData.description}
                onChange={(e) => setEventData({...eventData, description: e.target.value})}
              ></textarea>
            </div>
          </div>

          <div style={formSection}>
            <div style={sectionTitleRow}>
              <div style={iconBox}><ImageIcon size={18} color="#8b5cf6"/></div>
              <h2 style={sectionHeading}>Event Media</h2>
            </div>
            <div style={inputGroup}>
              <label style={label}>COVER IMAGE URL</label>
              <input 
                style={input} 
                placeholder="https://images.unsplash.com/your-event-photo" 
                value={eventData.image_url}
                onChange={(e) => setEventData({...eventData, image_url: e.target.value})}
              />
              <p style={hint}>Pro Tip: Use high-quality 16:9 aspect ratio images.</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TICKETING */}
        <div style={formColumn}>
          <div style={formSection}>
            <div style={sectionTitleRow}>
              <div style={iconBox}><Ticket size={18} color="#f59e0b"/></div>
              <h2 style={sectionHeading}>Ticketing & Capacity</h2>
            </div>

            <div style={tiersContainer}>
              {tiers.map((tier, index) => (
                <div key={index} style={tierCard}>
                  <div style={tierHeader}>
                    <h4 style={tierCount}>TIER #{index + 1}</h4>
                    <button type="button" onClick={() => removeTier(index)} style={removeBtn}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                  
                  <div style={inputGroup}>
                    <input 
                      style={tierInputBold} 
                      placeholder="Tier Name (e.g. VIP)" 
                      value={tier.name}
                      onChange={(e) => updateTier(index, 'name', e.target.value)}
                      required
                    />
                  </div>

                  <div style={inputRow}>
                    <div style={inputGroup}>
                      <label style={miniLabel}>PRICE (GHS)</label>
                      <input 
                        type="number" 
                        style={input} 
                        placeholder="0.00"
                        value={tier.price}
                        onChange={(e) => updateTier(index, 'price', e.target.value)}
                        required
                      />
                    </div>
                    <div style={inputGroup}>
                      <label style={miniLabel}>CAPACITY</label>
                      <input 
                        type="number" 
                        style={input} 
                        placeholder="100"
                        value={tier.capacity}
                        onChange={(e) => updateTier(index, 'capacity', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addTier} style={addTierBtn}>
              <Plus size={18}/> ADD ANOTHER TICKET TYPE
            </button>
          </div>

          <div style={publishCard}>
            <div style={publishInfo}>
              <Sparkles size={24} color="#0ea5e9"/>
              <div>
                <h4 style={publishTitle}>Ready to launch?</h4>
                <p style={publishText}>Once published, your event will be live for ticket purchases.</p>
              </div>
            </div>
            <button type="submit" style={submitBtn} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20}/> : <><CheckCircle2 size={20}/> PUBLISH EVENT</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// --- FULL STYLESHEET (PRODUCTION-READY) ---

const pageContainer = { padding: '40px 20px 100px', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Inter", sans-serif' };
const topHeader = { marginBottom: '40px' };
const backBtn = { background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' };
const headerText = { borderLeft: '4px solid #000', paddingLeft: '20px' };
const mainTitle = { margin: 0, fontSize: '32px', fontWeight: 950, letterSpacing: '-1.5px' };
const subTitle = { margin: '5px 0 0', color: '#64748b', fontSize: '15px' };

const formLayout = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '40px', alignItems: 'start' };
const formColumn = { display: 'flex', flexDirection: 'column', gap: '30px' };
const formSection = { background: '#fff', borderRadius: '35px', border: '1px solid #f1f5f9', padding: '35px', boxShadow: '0 10px 25px rgba(0,0,0,0.02)' };

const sectionTitleRow = { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' };
const iconBox = { width: '40px', height: '40px', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sectionHeading = { margin: 0, fontSize: '18px', fontWeight: 900 };

const inputGroup = { marginBottom: '20px', flex: 1 };
const label = { display: 'block', fontSize: '11px', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', letterSpacing: '1px' };
const miniLabel = { display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' };
const input = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '14px 18px', borderRadius: '15px', fontSize: '15px', fontWeight: 600, outline: 'none', transition: '0.2s' };
const textarea = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '14px 18px', borderRadius: '15px', fontSize: '15px', fontWeight: 600, outline: 'none', fontFamily: 'inherit' };
const inputRow = { display: 'flex', gap: '20px' };

const inputIconWrap = { position: 'relative', width: '100%' };
const innerIcon = { position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const iconInput = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '14px 18px 14px 45px', borderRadius: '15px', fontSize: '15px', fontWeight: 600, outline: 'none' };
const hint = { fontSize: '12px', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' };

const tiersContainer = { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' };
const tierCard = { background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' };
const tierHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const tierCount = { margin: 0, fontSize: '10px', fontWeight: 900, color: '#0ea5e9' };
const removeBtn = { background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' };
const tierInputBold = { width: '100%', background: 'none', border: 'none', borderBottom: '2px solid #e2e8f0', padding: '10px 0', fontSize: '18px', fontWeight: 900, outline: 'none' };

const addTierBtn = { width: '100%', background: 'none', border: '2px dashed #e2e8f0', padding: '15px', borderRadius: '15px', color: '#64748b', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

const publishCard = { background: '#000', borderRadius: '35px', padding: '35px', color: '#fff', position: 'sticky', top: '20px' };
const publishInfo = { display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center' };
const publishTitle = { margin: 0, fontSize: '18px', fontWeight: 900 };
const publishText = { margin: '5px 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 };
const submitBtn = { width: '100%', background: '#fff', color: '#000', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: 900, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
