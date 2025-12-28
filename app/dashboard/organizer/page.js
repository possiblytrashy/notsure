"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap, TrendingUp, Users, 
  BarChart3, ArrowUpRight, Filter, DownloadCloud,
  Eye, MousePointer2, Share2, Star, Clock, Trash2, Edit3,
  Layers, Activity, Sparkles, ChevronDown, UserPlus,
  BarChart, PieChart, CreditCard, Layout, Grip
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE STATE ---
  const [activeTab, setActiveTab] = useState('events'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data Store
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], // Renamed from contests
    tickets: [], 
    profile: null 
  });

  // --- 2. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  
  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(null); // Holds competition object for adding candidates
  const [showEditCompModal, setShowEditCompModal] = useState(null); // Holds competition object for editing details
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // Track event being edited
const [showEventModal, setShowEventModal] = useState(false); // Reuse your existing modal state
  // Filters
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');

  // Payout/Onboarding Form State
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false
  });

  // Candidate Creation Form State
  const [newCandidate, setNewCandidate] = useState({ name: '', image_url: '', bio: '' });
const [showContestModal, setShowContestModal] = useState(null);
  // Competition Edit Form State
 const [editCompForm, setEditCompForm] = useState({ 
  title: '', 
  description: '', 
  category: '', 
  vote_price: 1.00,
  is_active: true, // This acts as the "Pause Voting" toggle
  image_file: null,
  image_url: '' 
});
  
// Add these to your state definitions
const [uploading, setUploading] = useState(false);

  const uploadImage = async (file, bucket = 'competition-images') => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};

  // Function to handle the actual file upload to Supabase Storage
const uploadToSupabase = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `competition-images/${fileName}`;

  const { error: uploadError, data } = await supabase.storage
    .from('event-assets') // Make sure this bucket exists in Supabase
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('event-assets')
    .getPublicUrl(filePath);

  return publicUrl;
};


  
  // --- 3. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.push('/login');
        return;
      }

      const user = authData.user;

      // 2. Parallel Data Fetching
      // Note the nested select for competitions -> contests -> candidates
      const [profileRes, eventsRes, compsRes, ticketsRes] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select(`
          *,
          contests (
            *,
            candidates (*)
          )
        `).eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events!inner(title, organizer_id)').eq('events.organizer_id', user.id),
      ]);

      clearTimeout(timeoutId);

      const getRes = (res) => (res.status === 'fulfilled' ? res.value.data : []);
      const getSingle = (res) => (res.status === 'fulfilled' ? res.value.data : null);

      const profileData = getSingle(profileRes);
      const eventsData = getRes(eventsRes);
      const rawCompsData = getRes(compsRes); // Now contains nested contests & candidates
      const ticketsData = getRes(ticketsRes);


      // 3. Data Mapping 
      // Since Supabase did the nesting, we just ensure it's formatted for our Luxury UI
      setData({
        events: eventsData || [],
        competitions: rawCompsData || [],
        tickets: ticketsData || [],
        profile: { ...user, ...profileData }
      });

      // 4. Onboarding State
      if (profileData) {
        setPaystackConfig({
          businessName: profileData.business_name || "",
          bankCode: profileData.bank_code || "",
          accountNumber: profileData.account_number || "",
          subaccountCode: profileData.paystack_subaccount_code || "",
          isVerified: !!profileData.paystack_subaccount_code
        });
      }

    } catch (err) {
      console.error("Dashboard engine crashed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);
useEffect(() => {
  loadDashboardData();
}, [loadDashboardData]);
  // --- 4. COMPUTED ANALYTICS (95/5 SPLIT) ---
  const stats = useMemo(() => {
    const totalGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    // Vote calculation
    const totalVotes = data.competitions.reduce((acc, c) => 
      acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0);
    
    const scannedCount = data.tickets.filter(t => t.is_scanned).length;
    
    return {
      totalGross,
      organizerShare: totalGross * 0.95, // 95% to Organizer
      platformFee: totalGross * 0.05,    // 5% Platform Fee
      ticketCount: data.tickets.length,
      activeEvents: data.events.length,
      activeComps: data.competitions.length,
      totalVotes,
      avgTicketValue: data.tickets.length ? totalGross / data.tickets.length : 0,
      checkInRate: data.tickets.length ? Math.round((scannedCount / data.tickets.length) * 100) : 0
    };
  }, [data]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => {
      const matchesSearch = t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                            t.reference?.toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
      return matchesSearch && matchesEvent;
    });
  }, [data.tickets, ticketSearch, selectedEventFilter]);


  // --- 5. ACTION HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const copyLink = (path, id) => {
    const url = `${window.location.origin}/${path}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  // Payout Onboarding Save
  const saveOnboardingDetails = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
        // In a real app, this triggers a backend function to create the Paystack Subaccount
        updated_at: new Date().toISOString()
      }).eq('id', data.profile.id);

      if (error) throw error;
      
      setShowSettingsModal(false);
      loadDashboardData(true); // Silent refresh
      alert("Settings saved. Verifying with Paystack...");
    } catch (err) {
      alert("Update failed. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };
// --- EVENT ACTIONS ---

// --- EVENT ACTIONS ---

const deleteEvent = async (eventId) => {
  if (!confirm("Are you sure? This will delete the event and all associated data forever.")) return;

  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    // Remove from local state instantly
    setData(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== eventId)
    }));
    
  } catch (error) {
    console.error("Delete error:", error);
    alert("Could not delete event. Check your database RLS policies.");
  }
};

const handleEditSubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const updatedFields = Object.fromEntries(formData.entries());

  try {
    const { error } = await supabase
      .from('events')
      .update(updatedFields)
      .eq('id', editingEvent.id);

    if (error) throw error;

    // Sync UI
    setData(prev => ({
      ...prev,
      events: prev.events.map(ev => ev.id === editingEvent.id ? { ...ev, ...updatedFields } : ev)
    }));

    setShowEventModal(false);
    setEditingEvent(null);
  } catch (error) {
    console.error("Update error:", error);
  }
};
  // Add Candidate
  const addCandidate = async (compId) => {
    if (!newCandidate.name) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('candidates').insert([
        { 
          contest_id: compId, 
          name: newCandidate.name, 
          image_url: newCandidate.image_url, 
          vote_count: 0 
        }
      ]);
      if (error) throw error;
      setNewCandidate({ name: '', image_url: '', bio: '' });
      setShowCandidateModal(null);
      loadDashboardData(true);
    } catch (err) {
      alert("Failed to add candidate.");
    } finally {
      setIsProcessing(false);
    }
  };

 const openEditCompModal = (comp) => {
    setEditCompForm({
      title: comp.title || '',
      description: comp.description || '',
      category: comp.category || '',
      vote_price: comp.vote_price || 1.00,
      is_active: comp.is_active ?? true,
      image_url: comp.image_url || ''
    });
    setShowEditCompModal(comp);
  };

  // Updated Save function to handle file upload
  
  const saveCompEdit = async () => {
  setIsProcessing(true);
  try {
    let finalImageUrl = editCompForm.image_url;

    // 1. Handle New Image Upload if selected
    if (editCompForm.image_file) {
      const file = editCompForm.image_file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `competition-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('event-assets')
        .getPublicUrl(filePath);
        
      finalImageUrl = urlData.publicUrl;
    }

    // 2. Update Database (Deep Level)
    const { error } = await supabase
      .from('competitions')
      .update({
        title: editCompForm.title,
        description: editCompForm.description,
        is_active: editCompForm.is_active, // Toggle for pausing voting
        image_url: finalImageUrl,
      })
      .eq('id', showEditCompModal.id);

    if (error) throw error;
    
    setShowEditCompModal(null);
    loadDashboardData(true); // Refresh UI
  } catch (err) {
    console.error(err);
    alert("Failed to update competition.");
  } finally {
    setIsProcessing(false);
  }
};

  const deleteCandidate = async (candId) => {
    if (!confirm("Are you sure? This will delete all votes for this nominee.")) return;
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', candId);
      if (error) throw error;
      loadDashboardData(true);
    } catch (err) {
      alert("Delete failed.");
    }
  };

  const deleteEntireCompetition = async (compId) => {
    if (!confirm("DANGER: This will delete the competition and all categories/nominees. Continue?")) return;
    try {
      const { error } = await supabase.from('competitions').delete().eq('id', compId);
      if (error) throw error;
      setShowEditCompModal(null);
      loadDashboardData(true);
    } catch (err) {
      alert("Could not delete competition.");
    }
  };

  const updateCategoryPrice = async (contestId, newPrice) => {
    const { error } = await supabase
      .from('contests')
      .update({ vote_price: parseFloat(newPrice) })
      .eq('id', contestId);
    if (!error) loadDashboardData(true);
  };

  const updateCategorySettings = async (contestId, updates) => {
    const { error } = await supabase
      .from('contests')
      .update({ is_active: updates.isActive })
      .eq('id', contestId);
    if (!error) loadDashboardData(true);
  };

  const deleteCategory = async (contestId) => {
    if (!confirm("Delete this category and all its nominees?")) return;
    const { error } = await supabase
      .from('contests')
      .delete()
      .eq('id', contestId);
    if (!error) loadDashboardData(true);
  };

  const updateCategoryName = async (contestId, newTitle) => {
  if (!newTitle) return;
  const { error } = await supabase
    .from('contests')
    .update({ title: newTitle })
    .eq('id', contestId);
    
  if (!error) loadDashboardData(true);
  else alert("Failed to rename category.");
};
  // --- 6. LOADING SKELETON ---
  if (loading) return (
    <div style={skeletonStyles.wrapper}>
       <div style={skeletonStyles.header}>
          <div style={skeletonStyles.block(200, 40)}></div>
          <div style={skeletonStyles.block(50, 50, '50%')}></div>
       </div>
       <div style={skeletonStyles.hero}></div>
       <div style={skeletonStyles.grid}>
         {[1,2,3].map(i => <div key={i} style={skeletonStyles.card}></div>)}
       </div>
       <p style={loadingText}>SYNCING LUXURY ASSETS...</p>
    </div>
  );

  // --- 7. RENDER DASHBOARD ---
  return (
    <div style={mainWrapper}>
      
      {/* HEADER SECTION */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgeLuxury}>ORGANIZER</span></h1>
          <p style={subLabel}>System v2.5 • Luxury Event Management</p>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               <div style={dot(paystackConfig.subaccountCode)}></div>
               {paystackConfig.subaccountCode ? 'PAYOUTS ACTIVE (95/5)' : 'ACTION REQUIRED: SETUP PAYOUT'}
             </div>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* FINANCE HERO (95/5 SPLIT) */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={balanceInfo}>
              <p style={financeLabel}>YOUR EARNINGS (95% SHARE)</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={iconCircleGold}><Sparkles size={24} color="#d4af37"/></div>
          </div>
          <div style={statsRow}>
            <div style={miniStat}><TrendingUp size={14}/> <span>Automatic Settlement</span></div>
            <div style={autoPayoutTag}>
              <Zap size={14} fill={paystackConfig.subaccountCode ? "#0ea5e9" : "#ccc"}/> 
              {paystackConfig.subaccountCode ? 'Paystack Connected' : 'Payouts Paused'}
            </div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={16}/> EDIT PAYOUT & BANK SETTINGS
          </button>
        </div>

        <div style={quickStatsGrid}>
          <div style={glassStatCard}>
            <div style={glassHeader}><Ticket size={20} color="#0ea5e9"/><span style={statPercent}>+12%</span></div>
            <p style={statLabel}>TICKETS SOLD</p>
            <h3 style={statVal}>{stats.ticketCount}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><Trophy size={20} color="#8b5cf6"/><span style={statPercent}>Hot</span></div>
            <p style={statLabel}>COMPETITIONS</p>
            <h3 style={statVal}>{stats.activeComps}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><BarChart3 size={20} color="#f59e0b"/><span style={statPercent}>Active</span></div>
            <p style={statLabel}>AVG. TICKET VALUE</p>
            <h3 style={statVal}>GHS {stats.avgTicketValue.toFixed(2)}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><ShieldCheck size={20} color="#16a34a"/><span style={statPercent}>{stats.checkInRate}%</span></div>
            <p style={statLabel}>CHECK-IN RATE</p>
            <h3 style={statVal}>{stats.checkInRate}%</h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={tabBar}>
        {['events', 'sales', 'competitions', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* VIEWPORT AREA */}
      <div style={viewPort}>
        
        {/* 1. EVENTS VIEW */}
      {activeTab === 'events' && (
  <div style={fadeAnim}>
    <div style={viewHeader}>
      <h2 style={viewTitle}>Event Management</h2>
      <button style={addBtn} onClick={() => { setEditingEvent(null); setShowEventModal(true); }}>
        <Plus size={18}/> NEW EVENT
      </button>
    </div>

    <div style={contestGrid}>
      {data.events.map((event) => (
        <div key={event.id} style={itemCard}>
          {/* IMAGE SECTION */}
          <div style={itemImage(event.images?.[0])}>
            <div style={imageOverlay}>
              <div style={cardQuickActions}>
                <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                  {copying === event.id ? <Check size={14} color="#22c55e"/> : <LinkIcon size={14}/>}
                </button>
                <button style={miniAction} onClick={() => setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/events/${event.id}`)}>
                  <QrCode size={14}/>
                </button>
              </div>
            </div>
          </div>

          {/* BODY SECTION */}
          <div style={itemBody}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={itemTitle}>{event.title}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* EDIT BUTTON */}
                <button 
                  style={circleAction} 
                  onClick={() => {
                    setEditingEvent(event); 
                    setShowEventModal(true);
                  }}
                >
                  <Edit3 size={16} />
                </button>

                {/* DELETE BUTTON */}
                <button 
                  style={{ ...circleAction, color: '#ef4444' }} 
                  onClick={() => deleteEvent(event.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div style={itemMeta}>
              <span style={metaLine}><Calendar size={14}/> {new Date(event.date).toLocaleDateString()}</span>
              <span style={metaLine}><MapPin size={14}/> {event.location}</span>
            </div>

            <div style={cardActionRow}>
              <button 
                style={fullWidthBtn} 
                onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}
              >
                VIEW SALES LEDGER
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
    
    {data.events.length === 0 && (
      <div style={emptyState}>No events created yet. Start by clicking the button above.</div>
    )}
  </div>
)}

  {/* 2. SALES LEDGER VIEW */}
      {activeTab === 'sales' && (
        <div style={fadeAnim}>
          <div style={viewHeader}>
            <h2 style={viewTitle}>Sales Ledger</h2>
            <div style={filterGroup}>
              <div style={searchBox}>
                <Search size={18} color="#94a3b8" />
                <input style={searchInputField} placeholder="Guest or Ref..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} />
              </div>
              <select style={eventDropdown} value={selectedEventFilter} onChange={(e) => setSelectedEventFilter(e.target.value)}>
                <option value="all">All Events</option>
                {data.events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <button style={outlineBtn}><Download size={16} /> EXPORT CSV</button>
            </div>
          </div>
          <div style={tableWrapper}>
            <table style={dataTable}>
              <thead>
                <tr>
                  <th style={tableTh}>GUEST / REFERENCE</th>
                  <th style={tableTh}>EVENT</th>
                  <th style={tableTh}>GROSS (100%)</th>
                  <th style={tableTh}>YOUR NET (95%)</th>
                  <th style={tableTh}>STATUS</th>
                  <th style={tableTh}>DATE</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t.id} style={tableTr}>
                    <td style={tableTd}>
                      <p style={guestBold}>{t.guest_name}</p>
                      <p style={guestMuted}>{t.reference}</p>
                    </td>
                    <td style={tableTd}>{t.events?.title}</td>
                    <td style={tableTd}>GHS {t.amount}</td>
                    <td style={{ ...tableTd, fontWeight: 900, color: '#16a34a' }}>
                      GHS {(t.amount * 0.95).toFixed(2)}
                    </td>
                    <td style={tableTd}>
                      {t.is_scanned ? <span style={scannedPill}>CHECKED IN</span> : <span style={activePill}>VALID</span>}
                    </td>
                    <td style={tableTd}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTickets.length === 0 && <div style={emptyTableState}>No sales records found matching your filters.</div>}
          </div>
        </div>
      )}

   {/* CATEGORY (CONTEST) MAPPING */}
{/* CATEGORY (CONTEST) MAPPING */}
{/* 3. COMPETITIONS VIEW */}
{activeTab === 'competitions' && (
  <div style={fadeAnim}>
    <div style={viewHeader}>
      <h2 style={viewTitle}>Competition Management</h2>
      <button style={addBtn} onClick={() => setShowContestModal(true)}>
        <Plus size={18}/> NEW COMPETITION
      </button>
    </div>

    <div style={contestGrid}>
      {data.competitions.map((comp) => (
        <div key={comp.id} style={contestCard}>
          <div style={contestHeader}>
            <div style={{ flex: 1 }}>
              <span style={badgeLuxuryAlt}>COMPETITION</span>
              <h3 style={{ margin: '10px 0 5px', fontSize: '22px', fontWeight: 950 }}>{comp.title}</h3>
              <p style={perfSub}>{comp.description}</p>
            </div>
            <button style={circleAction} onClick={() => openEditCompModal(comp)}>
              <Settings size={18} />
            </button>
          </div>

          <div style={divider}></div>

          {/* CATEGORY (CONTEST) MAPPING - NOW INSIDE THE COMP LOOP */}
          {comp.contests?.map((contest) => (
            <CategoryItem 
              key={contest.id} 
              contest={contest} 
              comp={comp} 
              updateCategoryName={updateCategoryName}
              updateCategoryPrice={updateCategoryPrice}
              updateCategorySettings={updateCategorySettings}
              deleteCategory={deleteCategory}
              setShowCandidateModal={setShowCandidateModal}
              deleteCandidate={deleteCandidate}
              fieldLabel={fieldLabel}
              miniAction={miniAction}
              modalInput={modalInput}
              inputStack={inputStack}
              twoColumnGrid={twoColumnGrid}
              toggleStyle={toggleStyle}
              deleteMiniBtn={deleteMiniBtn}
              candidateList={candidateList}
              candidateRow={candidateRow}
              rankNum={rankNum}
              candInfo={candInfo}
              candName={candName}
              voteBarContainer={voteBarContainer}
              voteBarFill={voteBarFill}
              candVotes={candVotes}
            />
          ))}

          {(!comp.contests || comp.contests.length === 0) && (
            <div style={emptySmall}>No categories created. Edit competition to add one.</div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
      {/* 4. ANALYTICS VIEW */}
      {activeTab === 'analytics' && (
        <div style={fadeAnim}>
          <div style={sectionTitleRow}>
            <h2 style={viewTitle}>Performance Insights</h2>
            <div style={activityBadge}><Activity size={14} /> LIVE ENGINE</div>
          </div>
          <div style={analyticsGrid}>
            {data.events.map(event => {
              const eventSales = data.tickets.filter(t => t.event_id === event.id);
              const revenue = eventSales.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
              const scanned = eventSales.filter(t => t.is_scanned).length;
              const rate = eventSales.length ? Math.round((scanned / eventSales.length) * 100) : 0;
              return (
                <div key={event.id} style={eventPerformanceCard}>
                  <div style={perfHeader}><h4 style={perfName}>{event.title}</h4></div>
                  <div style={perfMain}>
                    <p style={perfLabel}>Gross Revenue</p>
                    <h3 style={perfValue}>GHS {revenue.toLocaleString()}</h3>
                  </div>
                  <div style={perfFooter}>
                    <div style={progressBar}><div style={progressFill(rate)}></div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Config</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20} /></button>
            </div>
            <div style={modalBody}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS LEGAL NAME</label>
                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({ ...paystackConfig, businessName: e.target.value })} />
              </div>
              <button style={actionSubmitBtn(isProcessing)} onClick={saveOnboardingDetails} disabled={isProcessing}>
                {isProcessing ? 'UPDATING...' : 'CONFIRM SETTINGS'}
              </button>
            </div>
          </div>
        </div>
      )}
{showEventModal && (
  <div style={modalOverlay}>
    <div style={luxuryModal}>
      <div style={modalHeader}>
        <h2 style={viewTitle}>{editingEvent ? 'EDIT EVENT' : 'CREATE NEW EVENT'}</h2>
        <button onClick={() => { setShowEventModal(false); setEditingEvent(null); }} style={circleAction}><X /></button>
      </div>

      <form onSubmit={handleEditSubmit} style={{ marginTop: '20px' }}>
        <div style={inputStack}>
          <label style={fieldLabel}>EVENT TITLE</label>
          <input 
            name="title"
            style={modalInput} 
            defaultValue={editingEvent?.title || ''} 
            placeholder="e.g. Luxury Gala 2025"
            required
          />
        </div>

        <div style={twoColumnGrid}>
          <div style={inputStack}>
            <label style={fieldLabel}>LOCATION</label>
            <input 
              name="location"
              style={modalInput} 
              defaultValue={editingEvent?.location || ''} 
              placeholder="Venue Name"
            />
          </div>
          <div style={inputStack}>
            <label style={fieldLabel}>DATE</label>
            <input 
              name="date"
              type="date" 
              style={modalInput} 
              defaultValue={editingEvent?.date || ''} 
            />
          </div>
        </div>

        <div style={inputStack}>
          <label style={fieldLabel}>DESCRIPTION</label>
          <textarea 
            name="description"
            style={{ ...modalInput, height: '100px', resize: 'none' }} 
            defaultValue={editingEvent?.description || ''}
          />
        </div>

        <button type="submit" style={actionBtnFull}>
          {editingEvent ? 'SAVE CHANGES' : 'PUBLISH EVENT'}
        </button>
      </form>
    </div>
  </div>
)}

      {showCandidateModal && (
        <div style={overlay} onClick={() => setShowCandidateModal(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Add Nominee</h2>
              <button style={closeBtn} onClick={() => setShowCandidateModal(null)}><X size={20} /></button>
            </div>
            <div style={modalBody}>
              <input style={modalInput} value={newCandidate.name} onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })} placeholder="Name" />
              <button style={actionSubmitBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)} disabled={isProcessing}>ADD</button>
            </div>
          </div>
        </div>
      )}

      {showEditCompModal && (
  <div style={overlay} onClick={() => setShowEditCompModal(null)}>
    <div style={modal} onClick={e => e.stopPropagation()}>
      <div style={modalHead}>
        <h2 style={modalTitle}>Manage Competition</h2>
        <button style={closeBtn} onClick={() => setShowEditCompModal(null)}><X size={20} /></button>
      </div>
      <div style={modalBody}>
        <div style={inputStack}>
          <label style={fieldLabel}>TITLE</label>
          <input style={modalInput} value={editCompForm.title} onChange={(e) => setEditCompForm({ ...editCompForm, title: e.target.value })} />
        </div>
        
        <div style={twoColumnGrid}>
          <div style={inputStack}>
            <label style={fieldLabel}>VOTE PRICE (GHS)</label>
            <input type="number" style={modalInput} value={editCompForm.vote_price} onChange={(e) => setEditCompForm({ ...editCompForm, vote_price: e.target.value })} />
          </div>
          <div style={inputStack}>
             <label style={fieldLabel}>VOTING STATUS</label>
             <button 
               style={toggleStyle(editCompForm.is_active)} 
               onClick={() => setEditCompForm({...editCompForm, is_active: !editCompForm.is_active})}
             >
               {editCompForm.is_active ? 'ACTIVE' : 'PAUSED'}
             </button>
          </div>
        </div>

        <button style={actionSubmitBtn(isProcessing)} onClick={saveCompEdit}>
          {isProcessing ? 'SAVING...' : 'UPDATE SETTINGS'}
        </button>

        {/* Deep Level Delete Option */}
        <div style={dangerZone}>
          <p style={dangerLabel}>DANGER ZONE</p>
          <button style={deleteFullBtn} onClick={() => deleteEntireCompetition(showEditCompModal.id)}>
            <Trash2 size={16} /> DELETE ENTIRE COMPETITION
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Portal QR</h2>
              <button style={closeBtn} onClick={() => setShowQR(null)}><X size={20} /></button>
            </div>
            <img src={showQR} alt="QR" style={{ width: '200px', margin: '0 auto' }} />
          </div>
        </div>
      )}
    </div>
        </div>
  );
}

// --- LUXURY STYLES ---
const skeletonStyles = {
  wrapper: { height: '100vh', display: 'flex', flexDirection: 'column', padding: '50px 30px', background: '#fcfcfc', maxWidth: '1440px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '60px' },
  block: (w, h, r = '12px') => ({ width: w, height: h, background: '#eee', borderRadius: r, animation: 'pulse 1.5s infinite ease-in-out' }),
  hero: { width: '100%', height: '250px', background: '#e0e0e0', borderRadius: '30px', marginBottom: '60px', animation: 'pulse 1.5s infinite ease-in-out' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' },
  card: { height: '300px', background: '#f5f5f5', borderRadius: '24px', animation: 'pulse 1.5s infinite ease-in-out' }
};
// CSS Injection for Skeleton Animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`;
  document.head.appendChild(styleSheet);
}

const mainWrapper = { padding: '50px 30px', maxWidth: '1440px', margin: '0 auto', background: '#fcfcfc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
const loadingText = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px', textAlign: 'center', marginTop: '20px' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' };
const logoText = { fontSize: '30px', fontWeight: 950, letterSpacing: '-2px', margin: 0 };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px' };
const subLabel = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' };
const headerActions = { display: 'flex', gap: '20px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700, color: '#000' };
const onboardingBadge = (on) => ({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 800, color: on ? '#16a34a' : '#e11d48', marginTop: '6px' });
const dot = (on) => ({ width: '6px', height: '6px', borderRadius: '50%', background: on ? '#16a34a' : '#e11d48' });
const circleAction = { width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.4fr 2fr', gap: '30px', marginBottom: '60px' };
const balanceCard = { background: '#000', borderRadius: '30px', padding: '50px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const balanceInfo = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px' };
const balanceValue = { fontSize: '56px', fontWeight: 950, margin: '20px 0', letterSpacing: '-3px' };
const iconCircleGold = { width: '64px', height: '64px', borderRadius: '22px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statsRow = { display: 'flex', gap: '25px', marginBottom: '30px' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#16a34a' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0ea5e9', fontWeight: 600 };
const settingsIconBtn = { padding: '15px 30px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start' };
const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '30px', borderRadius: '25px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' };
const glassHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const statPercent = { fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px' };
const statLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', margin: '0 0 8px', letterSpacing: '1px' };
const statVal = { fontSize: '28px', fontWeight: 950, margin: 0, color: '#000' };
const tabBar = { display: 'flex', gap: '45px', borderBottom: '1px solid #eee', marginBottom: '60px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '4px solid #000' : '4px solid transparent', transition: '0.3s' });
const viewPort = { minHeight: '600px' };
const fadeAnim = { animation: 'fadeIn 0.6s ease' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' };
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const itemCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden', transition: '0.3s' };
const itemImage = (url) => ({ height: '240px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imageOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))' };
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' };
const miniAction = { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 12px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748b', fontWeight: 600 };
const cardActionRow = { display: 'flex', gap: '10px' };
const fullWidthBtn = { flex: 1, padding: '12px', background: '#000', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };
const editBtnCircle = { width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const emptyState = { gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#94a3b8', border: '2px dashed #eee', borderRadius: '24px' };
const filterGroup = { display: 'flex', gap: '15px', alignItems: 'center' };
const searchBox = { display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', padding: '10px 15px', borderRadius: '12px' };
const searchInputField = { border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, width: '150px' };
const eventDropdown = { padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '13px', fontWeight: 600, outline: 'none' };
const outlineBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' };
const tableWrapper = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '20px 25px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', borderBottom: '1px solid #f0f0f0' };
const tableTr = { borderBottom: '1px solid #f8f8f8' };
const tableTd = { padding: '20px 25px', fontSize: '13px', fontWeight: 600, color: '#334155' };
const guestBold = { margin: 0, fontWeight: 800, color: '#000' };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8', marginTop: '4px' };
const scannedPill = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#f0f9ff', color: '#0ea5e9', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 };
const emptyTableState = { padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '30px' };
const contestCard = { background: '#fff', borderRadius: '30px', border: '1px solid #f0f0f0', overflow: 'hidden', padding: '30px', display: 'flex', flexDirection: 'column' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' };
const badgeLuxuryAlt = { fontSize: '10px', fontWeight: 900, background: '#000', color: '#fff', display: 'inline-block', padding: '4px 10px', borderRadius: '6px' };
const perfSub = { margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' };
const metaTag = { fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' };
const divider = { height: '1px', background: '#f1f5f9', width: '100%', marginBottom: '25px' };
const candidateList = { display: 'flex', flexDirection: 'column', gap: '15px' };
const candidateRow = { display: 'flex', alignItems: 'center', gap: '15px' };
const rankNum = { fontSize: '14px', fontWeight: 900, color: '#cbd5e1', width: '30px' };
const candInfo = { flex: 1 };
const candName = { margin: '0 0 6px', fontSize: '13px', fontWeight: 700 };
const voteBarContainer = { height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' };
const voteBarFill = (percentage) => ({
  width: `${percentage}%`,
  height: '100%',
  backgroundColor: '#d4af37', // Luxury Gold
  transition: 'width 1s ease-in-out'
});
const candVotes = { fontSize: '12px', fontWeight: 900, width: '60px', textAlign: 'right' };
const emptySmall = { fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px' };
const sectionTitleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const activityBadge = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '6px 12px', borderRadius: '20px' };
const analyticsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' };
const eventPerformanceCard = { background: '#fff', border: '1px solid #f0f0f0', borderRadius: '24px', padding: '25px' };
const perfHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const perfName = { margin: 0, fontSize: '15px', fontWeight: 800 };
const perfTag = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', border: '1px solid #eee', padding: '4px 8px', borderRadius: '6px' };
const perfMain = { marginBottom: '25px' };
const perfLabel = { fontSize: '12px', color: '#64748b', margin: '0 0 5px' };
const perfValue = { fontSize: '24px', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-1px' };
const shareRow = { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '8px 12px', borderRadius: '8px' };
const perfFooter = { marginTop: 'auto' };
const progressBar = { height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' };
const progressFill = (pct) => ({ height: '100%', width: `${pct}%`, background: '#16a34a' });
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' };
const modal = { background: '#fff', width: '450px', borderRadius: '30px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' };
const modalTitle = { margin: 0, fontSize: '20px', fontWeight: 900 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const onboardingPromo = { display: 'flex', gap: '15px', background: '#f0f9ff', padding: '15px', borderRadius: '16px', color: '#0ea5e9', marginBottom: '25px', alignItems: 'center' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldLabel = { fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '1px' };
const modalInput = { padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', fontWeight: 600, width: '100%' };
const actionSubmitBtn = (loading) => ({ padding: '16px', background: loading ? '#94a3b8' : '#000', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', marginTop: '10px' });
const settingToggleRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px',
  background: '#f8fafc',
  borderRadius: '15px',
  marginBottom: '20px',
  border: '1px solid #e2e8f0'
};

const toggleStyle = (isActive) => ({
  padding: '8px 16px',
  borderRadius: '10px',
  border: 'none',
  fontWeight: 900,
  fontSize: '11px',
  cursor: 'pointer',
  background: isActive ? '#22c55e' : '#ef4444',
  color: '#fff',
  transition: 'all 0.2s ease'
});

const deleteMiniBtn = {
  background: 'none',
  border: 'none',
  color: '#cbd5e1',
  cursor: 'pointer',
  padding: '5px',
  borderRadius: '5px',
  transition: 'all 0.2s',
  hover: { color: '#ef4444' } // Use CSS for hover
};

const twoColumnGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '15px'
};

const uploadContainer = {
  border: '2px dashed #e2e8f0',
  padding: '15px',
  borderRadius: '8px',
  textAlign: 'center',
  background: '#fff'
};

const previewThumb = {
  width: '60px',
  height: '60px',
  borderRadius: '4px',
  objectFit: 'cover',
  marginBottom: '10px'
};

const dangerZone = {
  marginTop: '30px',
  padding: '15px',
  borderTop: '1px solid #fee2e2',
  backgroundColor: '#fff5f5',
  borderRadius: '0 0 12px 12px'
};

const deleteFullBtn = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#ef4444',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
};
const fileInputStyle = {
  fontSize: '12px',
  color: '#64748b',
  width: '100%',
  marginTop: '8px',
  cursor: 'pointer'
};

const dangerLabel = {
  fontSize: '11px',
  fontWeight: '900',
  color: '#ef4444',
  letterSpacing: '1.5px',
  marginBottom: '10px',
  textTransform: 'uppercase'
};
const modalOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px'
};

const luxuryModal = {
  background: '#fff',
  width: '100%',
  maxWidth: '600px',
  borderRadius: '40px',
  padding: '40px',
  position: 'relative',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  animation: 'modalSlideUp 0.4s ease-out'
};

const modalHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '30px',
  borderBottom: '1px solid #f0f0f0',
  paddingBottom: '20px'
};

const actionBtnFull = {
  width: '100%',
  padding: '18px',
  background: '#000',
  color: '#fff',
  border: 'none',
  borderRadius: '20px',
  fontWeight: 900,
  fontSize: '16px',
  cursor: 'pointer',
  marginTop: '20px',
  transition: 'transform 0.2s ease'
};
// This MUST be outside the main OrganizerDashboard function
function CategoryItem({ 
  contest, comp, updateCategoryName, updateCategoryPrice, 
  updateCategorySettings, deleteCategory, setShowCandidateModal, 
  deleteCandidate, fieldLabel, miniAction, modalInput, 
  inputStack, twoColumnGrid, toggleStyle, deleteMiniBtn, 
  candidateList, candidateRow, rankNum, candInfo, 
  candName, voteBarContainer, voteBarFill, candVotes 
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Safety check to prevent ReferenceError if comp is missing
  if (!comp) return null;

  return (
    <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={fieldLabel}>CATEGORY</span>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{contest.title}</h4>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
            style={{ ...miniAction, width: 'auto', padding: '0 15px', gap: '8px', fontSize: '11px', fontWeight: 800 }}
          >
            {isSettingsOpen ? <ChevronDown size={14} /> : <Settings size={14} />}
            {isSettingsOpen ? 'CLOSE SETTINGS' : 'EDIT CATEGORY'}
          </button>
          
          <button 
            style={{ ...miniAction, background: '#0ea5e9', color: 'white' }} 
            onClick={() => setShowCandidateModal(contest)}
            title="Add Nominee"
          >
            <UserPlus size={16} />
          </button>
        </div>
      </div>

      {/* NESTED SETTINGS PANEL */}
      {isSettingsOpen && (
        <div style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
          <div style={twoColumnGrid}>
            <div style={inputStack}>
              <label style={fieldLabel}>RENAME CATEGORY</label>
              <input 
                style={modalInput} 
                defaultValue={contest.title} 
                onBlur={(e) => updateCategoryName(contest.id, e.target.value)} 
              />
            </div>
            <div style={inputStack}>
              <label style={fieldLabel}>VOTE PRICE (GHS)</label>
              <input 
                type="number" 
                step="0.01"
                style={modalInput} 
                defaultValue={contest.vote_price} 
                onBlur={(e) => updateCategoryPrice(contest.id, e.target.value)} 
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
             <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={fieldLabel}>STATUS:</span>
                <button 
                  onClick={() => updateCategorySettings(contest.id, { isActive: !contest.is_active })}
                  style={toggleStyle(contest.is_active)}
                >
                  {contest.is_active ? 'ACTIVE' : 'PAUSED'}
                </button>
             </div>
             <button onClick={() => deleteCategory(contest.id)} style={{ ...deleteMiniBtn, color: '#ef4444', fontWeight: 700 }}>
               <Trash2 size={14} /> DELETE CATEGORY
             </button>
          </div>
        </div>
      )}

      {/* NOMINEE LIST */}
      <div style={{ ...candidateList, marginTop: '20px' }}>
        {contest.candidates?.sort((a, b) => b.vote_count - a.vote_count).map((cand, idx) => (
          <div key={cand.id} style={candidateRow}>
            <span style={rankNum}>#{idx + 1}</span>
            <div style={candInfo}>
              <p style={candName}>{cand.name}</p>
              <div style={voteBarContainer}>
                <div style={voteBarFill(idx === 0 ? 100 : (cand.vote_count / Math.max(contest.candidates[0]?.vote_count || 1, 1)) * 100)}></div>
              </div>
            </div>
            <p style={candVotes}>{cand.vote_count}</p>
            <button style={deleteMiniBtn} onClick={() => deleteCandidate(cand.id)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
