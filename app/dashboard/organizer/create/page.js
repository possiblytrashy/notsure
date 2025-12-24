"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Upload, Plus, Trash2, X, AlertCircle } from 'lucide-react';

export default function AdvancedCreateEvent() {
  const [form, setForm] = useState({ title: '', date: '', location: '', description: '' });
  const [tiers, setTiers] = useState([{ name: 'General Admission', price: '', capacity: '' }]);
  const [images, setImages] = useState([]); // Local file objects
  const [previews, setPreviews] = useState([]); // Preview URLs
  const [uploading, setUploading] = useState(false);

  // 1. Cleanup Object URLs to prevent memory leaks
  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      alert("Maximum 5 images allowed");
      return;
    }
    setImages(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const addTier = () => setTiers([...tiers, { name: '', price: '', capacity: '' }]);
  const removeTier = (index) => setTiers(tiers.filter((_, i) => i !== index));

  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) return alert("Please upload at least one image.");
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // 2. Optimized Upload to Supabase Storage
      const uploadedUrls = await Promise.all(
        images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${Date.now()}-${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('event-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(filePath);
          
          return publicUrl;
        })
      );

      // 3. Save Event to DB
      const { error } = await supabase.from('events').insert([{
        ...form,
        organizer_id: user.id,
        images: uploadedUrls,
        ticket_tiers: tiers,
        price: parseFloat(tiers[0]?.price || 0)
      }]);

      if (error) throw error;
      window.location.href = '/dashboard/organizer';
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        {/* HEADER */}
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '10px' }}>Create Experience</h1>
          <p style={{ color: '#666' }}>Fill in the details to launch your next event.</p>
        </div>

        {/* IMAGE UPLOAD */}
        <div style={sectionS}>
          <input type="file" multiple accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={dropzoneS}>
            <Upload size={32} style={{ marginBottom: '12px', color: '#000' }} />
            <p style={{ fontWeight: 700, margin: 0 }}>Upload Media</p>
            <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Drag & drop or click (Up to 5 images)</p>
          </label>
          
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
              {previews.map((url, i) => (
                <div key={i} style={thumbContainerS}>
                  <img src={url} alt="preview" style={thumbS} />
                  <button type="button" onClick={() => removeImage(i)} style={removeBtnS}><X size={14}/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EVENT INFO */}
        <div style={sectionS}>
          <h2 style={sectionTitleS}>Basic Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={labelS}>Event Title</label>
              <input required placeholder="E.g. Summer Solstice Festival" style={inputS} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div>
              <label style={labelS}>Description</label>
              <textarea required placeholder="What makes this event special?" style={{...inputS, height: '120px', resize: 'none'}} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelS}>Date & Time</label>
                <input required placeholder="Dec 28, 7:00 PM" style={inputS} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div>
                <label style={labelS}>Venue / Location</label>
                <input required placeholder="City Hall or Remote" style={inputS} onChange={e => setForm({...form, location: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        {/* TICKET CLASSES */}
        <div style={sectionS}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={sectionTitleS}>Ticket Tiers</h2>
            <button type="button" onClick={addTier} style={addTierBtnS}><Plus size={16}/> Add Tier</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tiers.map((tier, i) => (
              <div key={i} style={tierRowS}>
                <input placeholder="Tier Name" style={inputS} value={tier.name} onChange={e => updateTier(i, 'name', e.target.value)} />
                <input type="number" placeholder="Price" style={inputS} value={tier.price} onChange={e => updateTier(i, 'price', e.target.value)} />
                <input type="number" placeholder="Qty" style={inputS} value={tier.capacity} onChange={e => updateTier(i, 'capacity', e.target.value)} />
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(i)} style={iconBtnS}><Trash2 size={18}/></button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={uploading} style={submitBtnS}>
          {uploading ? 'PUBLISHING...' : 'LAUNCH EXPERIENCE'}
        </button>
      </form>
    </div>
  );
}

// STYLES
const sectionS = { background: '#fff', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' };
const sectionTitleS = { fontWeight: 800, fontSize: '18px', margin: 0 };
const labelS = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#666' };
const inputS = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '15px', outline: 'none', transition: 'border 0.2s' };
const dropzoneS = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', borderRadius: '20px', border: '2px dashed #e5e7eb', cursor: 'pointer', background: '#fafafa' };
const thumbContainerS = { position: 'relative', width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' };
const thumbS = { width: '100%', height: '100%', objectFit: 'cover' };
const removeBtnS = { position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addTierBtnS = { background: '#000', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' };
const tierRowS = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '10px', alignItems: 'center' };
const iconBtnS = { border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' };
const submitBtnS = { background: '#000', color: '#fff', padding: '20px', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '16px', cursor: 'pointer', marginTop: '10px' };
