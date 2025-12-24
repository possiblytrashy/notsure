"use client";
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Upload, Plus, Trash2, X, CreditCard } from 'lucide-react';

export default function AdvancedCreateEvent() {
  const [form, setForm] = useState({ title: '', date: '', location: '', description: '' });
  const [tiers, setTiers] = useState([{ name: 'General Admission', price: '', capacity: '' }]);
  const [images, setImages] = useState([]); // Local file objects
  const [uploading, setUploading] = useState(false);

  // Handle Local Image Selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setImages([...images, ...files]);
  };

  const addTier = () => setTiers([...tiers, { name: '', price: '', capacity: '' }]);
  const removeTier = (index) => setTiers(tiers.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Upload Images to Supabase Storage
      const uploadedUrls = [];
      for (const file of images) {
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('event-images')
          .upload(`${user.id}/${fileName}`, file);
        
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(data.path);
          uploadedUrls.push(publicUrl);
        }
      }

      // 2. Save Event with Tiers and Image URLs
      const { error } = await supabase.from('events').insert([{
        ...form,
        organizer_id: user.id,
        images: uploadedUrls,
        ticket_tiers: tiers,
        price: tiers[0]?.price || 0 // Default price for the feed
      }]);

      if (!error) window.location.href = '/dashboard/organizer';
      else alert(error.message);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '120px 20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* IMAGE UPLOAD BOX */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px', border: '2px dashed #ddd', textAlign: 'center' }}>
          <input type="file" multiple accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
            <Upload size={40} style={{ marginBottom: '10px', color: '#666' }} />
            <p style={{ fontWeight: 800 }}>Drag & Drop or Click to Upload Images</p>
            <p style={{ fontSize: '12px', color: '#888' }}>Upload up to 5 high-quality photos</p>
          </label>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            {images.map((file, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '12px', background: '#eee', overflow: 'hidden' }}>
                <img src={URL.createObjectURL(file)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'black', border: 'none', color: 'white', borderRadius: '50%', cursor: 'pointer' }}><X size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* EVENT INFO */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontWeight: 900 }}>Event Details</h2>
          <input required placeholder="Event Name" style={inputS} onChange={e => setForm({...form, title: e.target.value})} />
          <textarea required placeholder="Description" style={{...inputS, height: '100px'}} onChange={e => setForm({...form, description: e.target.value})} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <input required placeholder="Date (Dec 28)" style={inputS} onChange={e => setForm({...form, date: e.target.value})} />
            <input required placeholder="Location" style={inputS} onChange={e => setForm({...form, location: e.target.value})} />
          </div>
        </div>

        {/* TICKET CLASSES */}
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontWeight: 900 }}>Ticket Tiers</h2>
            <button type="button" onClick={addTier} style={{ background: '#f0f9ff', color: '#0ea5e9', border: 'none', padding: '10px 15px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>+ Add Tier</button>
          </div>
          
          {tiers.map((tier, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <input placeholder="Tier Name (e.g. VIP)" style={inputS} value={tier.name} onChange={e => {
                const newTiers = [...tiers]; newTiers[i].name = e.target.value; setTiers(newTiers);
              }} />
              <input type="number" placeholder="Price" style={inputS} value={tier.price} onChange={e => {
                const newTiers = [...tiers]; newTiers[i].price = e.target.value; setTiers(newTiers);
              }} />
              <input type="number" placeholder="Qty" style={inputS} value={tier.capacity} onChange={e => {
                const newTiers = [...tiers]; newTiers[i].capacity = e.target.value; setTiers(newTiers);
              }} />
              <button type="button" onClick={() => removeTier(i)} style={{ border: 'none', background: 'none', color: '#ff4444', cursor: 'pointer' }}><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={uploading} style={{ background: '#000', color: '#fff', padding: '25px', borderRadius: '25px', border: 'none', fontWeight: 900, fontSize: '18px', cursor: 'pointer' }}>
          {uploading ? 'UPLOADING EVENT...' : 'LAUNCH EXPERIENCE'}
        </button>
      </form>
    </div>
  );
}

const inputS = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', fontSize: '15px', outline: 'none' };
