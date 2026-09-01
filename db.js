/* ═══════════════════════════════════════════════════════════════
   Parazzi — Supabase DB Layer  |  db.js
   Auth, profiles, centers, medicines, illnesses, returns & sales sync.
   App data stays localStorage-first with cloud sync.
   ═══════════════════════════════════════════════════════════════ */

const db = (() => {
  const SUPABASE_URL = 'https://vngtzjotadtychkgvqvr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ3R6am90YWR0eWNoa2d2cXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDM5NjIsImV4cCI6MjEwMzM3OTk2Mn0.bGozIGzpBqY8SmzgGOY8hSPRA-sLT8PzAkPJEVFQ4a8';

  let client = null;
  let _sessionCache = null;
  let _sessionTs = 0;
  const SESSION_CACHE_MS = 5 * 60 * 1000;

  /* ─── INPUT SANITIZATION ─── */
  const SANITIZE_MAX_STRING = 500;
  const SANITIZE_MAX_EMAIL = 254;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function sanitizeString(str, maxLen = SANITIZE_MAX_STRING) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim()
      .slice(0, maxLen);
  }

  function sanitizeEmail(email) {
    const cleaned = sanitizeString(email, SANITIZE_MAX_EMAIL).toLowerCase();
    if (!EMAIL_RE.test(cleaned)) throw new Error('Invalid email format');
    return cleaned;
  }

  function sanitizeObject(obj, schema) {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    for (const [key, type] of Object.entries(schema)) {
      const val = obj[key];
      if (type === 'string') out[key] = sanitizeString(val);
      else if (type === 'email') out[key] = sanitizeEmail(val);
      else if (type === 'number') out[key] = typeof val === 'number' ? val : (parseInt(val, 10) || 0);
      else if (type === 'boolean') out[key] = !!val;
      else if (type === 'array') out[key] = Array.isArray(val) ? val : [];
      else if (type === 'json') out[key] = val && typeof val === 'object' ? val : {};
      else out[key] = val;
    }
    return out;
  }

  function validateMedicine(med) {
    const out = sanitizeObject(med, {
      id: 'string',
      name: 'string',
      dose: 'string',
      batch: 'string',
      unit: 'string',
      expiry: 'string',
      ills: 'array',
      price: 'number',
      cost: 'number',
      stock: 'number',
      center_id: 'string',
      updated_at: 'string'
    });
    if (!out.name) throw new Error('Medicine name required');
    if (out.price < 0 || out.price > 99999999) throw new Error('Invalid price');
    if (out.cost < 0 || out.cost > 99999999) throw new Error('Invalid cost');
    if (out.stock < 0 || out.stock > 999999) throw new Error('Invalid stock');
    return out;
  }

  function validateIllness(ill) {
    const out = sanitizeObject(ill, {
      id: 'string',
      name: 'string',
      refs: 'array',
      cures: 'array',
      center_id: 'string'
    });
    if (!out.name) throw new Error('Illness name required');
    return out;
  }

  function validateSale(sale) {
    const out = sanitizeObject(sale, {
      id: 'string',
      center_id: 'string',
      date: 'string',
      items: 'array',
      total: 'number',
      seller_name: 'string',
      sold_by: 'string'
    });
    if (!Array.isArray(out.items) || out.items.length === 0) throw new Error('Sale must have items');
    if (out.total < 0 || out.total > 999999999) throw new Error('Invalid sale total');
    out.items = out.items.map(it => ({
      medId: sanitizeString(it.medId || it.med_id || ''),
      qty: Math.max(0, Math.min(99999, parseInt(it.qty, 10) || 0)),
      price: Math.max(0, Math.min(99999999, parseInt(it.price, 10) || 0)),
      name: sanitizeString(it.name || '')
    }));
    return out;
  }

  function validateReturn(ret) {
    const out = sanitizeObject(ret, {
      id: 'string',
      originalSaleId: 'string',
      date: 'string',
      items: 'array',
      refundTotal: 'number',
      reason: 'string',
      returnedBy: 'string',
      returnedByName: 'string'
    });
    if (!Array.isArray(out.items) || out.items.length === 0) throw new Error('Return must have items');
    if (out.refundTotal < 0 || out.refundTotal > 999999999) throw new Error('Invalid refund total');
    out.items = out.items.map(it => ({
      medId: sanitizeString(it.medId || it.med_id || ''),
      qty: Math.max(0, Math.min(99999, parseInt(it.qty, 10) || 0)),
      price: Math.max(0, Math.min(99999999, parseInt(it.price, 10) || 0)),
      reason: sanitizeString(it.reason || '')
    }));
    return out;
  }

  function validateActivity(activity) {
    return sanitizeObject(activity, {
      userId: 'string',
      userName: 'string',
      action: 'string',
      metadata: 'json'
    });
  }


  function init() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Supabase credentials missing. Check config.js');
      return;
    }
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase library not loaded');
    }
  }

  function isOnline() {
    return navigator.onLine;
  }

  /* ─── INPUT SANITIZATION ─── */
  function sanitizeStr(str, maxLen=500) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
  }

  /* ─── ERROR BOUNDARY ─── */
  async function safe(promise, fallback) {
    try {
      const result = await promise;
      return { data: result, error: null };
    } catch (error) {
      console.error('[db.safe]', error);
      return { data: fallback !== undefined ? fallback : null, error };
    }
  }

  function _cacheSession(user) {
    _sessionCache = user;
    _sessionTs = Date.now();
  }

  function _getCachedSession() {
    if (_sessionCache && (Date.now() - _sessionTs) < SESSION_CACHE_MS) {
      return _sessionCache;
    }
    return null;
  }

  /* ─── AUTH ─── */
  async function signUp(email, password, name, centerName) {
    if (!isOnline()) throw new Error('Internet required for sign up');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

    const cleanCenter = sanitizeString(centerName, 200);
    const cleanName = sanitizeString(name, 200);
    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = typeof password === 'string' ? password.slice(0, 128) : '';
    if (cleanPassword.length < 6) throw new Error('Password too short');

    const { data: existingCenter, error: cErr } = await client
      .from('acenters')
      .select('*')
      .ilike('name', cleanCenter)
      .single();

    if (cErr && cErr.code !== 'PGRST116') throw cErr;

    const { data: authData, error: authErr } = await client.auth.signUp({
      email: cleanEmail,
      password: cleanPassword
    });
    if (authErr) throw authErr;

    const userId = authData.user.id;
    let centerId, centerRecord;

    if (existingCenter) {
      centerId = existingCenter.id;
      centerRecord = existingCenter;
    } else {
      const { data: newCenter, error: ncErr } = await client
        .from('acenters')
        .insert([{ name: cleanCenter, created_by: userId }])
        .select()
        .single();
      if (ncErr) throw ncErr;
      centerId = newCenter.id;
      centerRecord = newCenter;
    }

    const role = existingCenter ? 'staff' : 'doctor';

    const { error: pErr } = await client.from('profiles').upsert([{
      user_id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
      center_id: centerId,
      approved: false
    }], { onConflict: 'user_id' });
    if (pErr) throw pErr;

    return {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
      center: sanitizeString(centerRecord.name, 200),
      center_id: centerId,
      approved: false,
      date: new Date().toISOString().split('T')[0]
    };
  }

  async function signIn(email, password) {
    if (!isOnline()) throw new Error('offline');

    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = typeof password === 'string' ? password.slice(0, 128) : '';

    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });
    if (authErr) throw authErr;

    const { data: profile, error: pErr } = await client
      .from('profiles')
      .select('*, acenters(name)')
      .eq('user_id', authData.user.id)
      .single();

    if (pErr) throw pErr;
    if (!profile) throw new Error('Profile not found');
    if (!profile.approved) throw new Error('Account not approved');

    const user = {
      id: profile.user_id,
      name: sanitizeString(profile.name, 200),
      email: sanitizeString(profile.email, 254),
      role: sanitizeString(profile.role, 50),
      center: sanitizeString(profile.acenters?.name || '', 200),
      center_id: profile.center_id,
      approved: !!profile.approved,
      date: profile.created_at
    };

    _cacheSession(user);
    return user;
  }

  async function getSession() {
    if (!client) return null;
    const cached = _getCachedSession();
    if (cached) return cached;
    if (!isOnline()) return null;

    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;

    const { data: profile, error: pErr } = await client
      .from('profiles')
      .select('*, acenters(name)')
      .eq('user_id', session.user.id)
      .single();

    if (pErr || !profile || !profile.approved) return null;

    const user = {
      id: profile.user_id,
      name: sanitizeString(profile.name, 200),
      email: sanitizeString(profile.email, 254),
      role: sanitizeString(profile.role, 50),
      center: sanitizeString(profile.acenters?.name || '', 200),
      center_id: profile.center_id,
      approved: !!profile.approved,
      date: profile.created_at
    };

    _cacheSession(user);
    return user;
  }

  async function signOut() {
    _sessionCache = null;
    _sessionTs = 0;
    if (client) await client.auth.signOut();
  }

  /* ─── STAFF ─── */
  async function fetchStaffByCenter(centerId) {
    if (!isOnline() || !client || !centerId) return [];
    const { data, error } = await safe(
      client.from('profiles').select('*').eq('center_id', centerId),
      { data: [] }
    );
    return (data?.data || []).map(p => ({
      id: p.user_id,
      name: sanitizeStr(p.name, 200),
      email: p.email,
      role: sanitizeStr(p.role, 50),
      center_id: p.center_id,
      approved: p.approved,
      date: p.created_at
    }));
  }

  async function updateApproval(userId, approved) {
    if (!isOnline() || !client) throw new Error('offline');
    const { error } = await client
      .from('profiles')
      .update({ approved })
      .eq('user_id', userId);
    if (error) throw error;
  }

  /* ─── MEDICINES ─── */
  async function upsertMedicine(med, centerId) {
    if (!isOnline() || !client) throw new Error('offline');
    const payload = { ...med };
    if (centerId !== undefined) payload.center_id = centerId;
    delete payload.updated_at;
    // Sanitize string fields
    if (payload.name) payload.name = sanitizeStr(payload.name, 200);
    if (payload.dose) payload.dose = sanitizeStr(payload.dose, 100);
    if (payload.batch) payload.batch = sanitizeStr(payload.batch, 100);
    if (payload.unit) payload.unit = sanitizeStr(payload.unit, 50);
    if (Array.isArray(payload.ills)) payload.ills = payload.ills.map(n => sanitizeStr(n, 200));
    const { error } = await client.from('medicines').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  async function deleteMedicine(medId, centerId) {
    if (!isOnline() || !client) throw new Error('offline');
    const { error } = await client.from('medicines')
      .delete()
      .eq('id', medId)
      .eq('center_id', centerId);
    if (error) throw error;
  }

  /* ─── ILLNESSES ─── */
  async function upsertIllness(ill, centerId) {
    if (!isOnline() || !client) throw new Error('offline');
    const payload = { ...ill };
    if (centerId !== undefined) payload.center_id = centerId;
    delete payload.updated_at;
    if (payload.name) payload.name = sanitizeStr(payload.name, 200);
    if (Array.isArray(payload.refs)) payload.refs = payload.refs.map(r => ({...r, name: sanitizeStr(r.name, 200)}));
    if (Array.isArray(payload.cures)) payload.cures = payload.cures.map(n => sanitizeStr(n, 200));
    const { error } = await client.from('illnesses').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  /* ─── RETURNS ─── */
  async function createReturn(ret, centerId) {
    if (!isOnline() || !client) throw new Error('offline');
    const { data, error } = await client.rpc('process_return', {
      p_center_id: centerId,
      p_sale_id: ret.originalSaleId,
      p_items: ret.items,
      p_refund_total: ret.refundTotal,
      p_reason: sanitizeStr(ret.reason, 500),
      p_returned_by_name: sanitizeStr(ret.returnedByName, 200) || null
    });
    if (error) throw error;
    return data;
  }

  /* ─── ACTIVITY ─── */
  async function logActivity(activity, centerId) {
    if (!isOnline() || !client) return;
    await client.from('staff_activity').insert({
      center_id: centerId,
      user_id: activity.userId,
      user_name: sanitizeStr(activity.userName, 200),
      action: sanitizeStr(activity.action, 100),
      metadata: activity.metadata || {}
    });
  }

  /* ─── SALES (atomic stock decrement) ─── */
  async function createSaleAtomic(sale, centerId) {
    if (!isOnline() || !client) throw new Error('offline');
    const { data, error } = await client.rpc('create_sale_with_stock', {
      p_center_id: centerId,
      p_local_sale_id: sale.id,
      p_date: sale.date,
      p_items: sale.items,
      p_total: sale.total,
      p_seller_name: sanitizeStr(sale.seller_name, 200) || null
    });
    if (error) throw error;
    if (!data) throw new Error('Stock insufficient');
    return data;
  }

  /* ─── REALTIME ─── */
  function subscribeToMedicines(centerId, callback) {
    if (!client || !centerId) return;
    try {
      return client
        .channel('medicines-' + centerId)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'medicines',
          filter: 'center_id=eq.' + centerId
        }, callback)
        .subscribe();
    } catch (e) {
      console.warn('Realtime not available', e);
    }
  }

  function subscribeToSales(centerId, callback) {
    if (!client || !centerId) return;
    try {
      return client
        .channel('sales-' + centerId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: 'center_id=eq.' + centerId
        }, callback)
        .subscribe();
    } catch (e) {
      console.warn('Sales realtime not available', e);
    }
  }

  function subscribeToOrders(centerId, callback) {
    if (!client || !centerId) return;
    try {
      return client
        .channel('orders-' + centerId)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'center_id=eq.' + centerId
        }, callback)
        .subscribe();
    } catch (e) {
      console.warn('Orders realtime not available', e);
    }
  }

  /* ─── STOCK SNAPSHOT ─── */
  async function fetchStockSnapshot(centerId) {
    if (!isOnline() || !client || !centerId) return [];
    const { data, error } = await safe(
      client.from('medicines').select('*').eq('center_id', centerId),
      { data: [] }
    );
    const rows = data?.data || [];
    return rows.map(r => ({
      ...r,
      name: sanitizeStr(r.name, 200),
      dose: sanitizeStr(r.dose, 100),
      batch: sanitizeStr(r.batch, 100),
      unit: sanitizeStr(r.unit, 50),
      ills: Array.isArray(r.ills) ? r.ills.map(n => sanitizeStr(n, 200)) : r.ills
    }));
  }

  /* ─── SALES SNAPSHOT ─── */
  async function fetchSalesSnapshot(centerId, page = 0, pageSize = 50) {
    if (!isOnline() || !client || !centerId) return [];
    const { data, error } = await safe(
      client.from('sales').select('*').eq('center_id', centerId).order('date', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1),
      { data: [] }
    );
    return (data?.data || []).map(s => ({
      id: s.local_sale_id,
      center_id: s.center_id,
      date: s.date,
      items: s.items,
      total: s.total,
      seller_name: sanitizeStr(s.seller_name, 200)
    }));
  }

  /* ─── RETURNS SNAPSHOT ─── */
  async function fetchReturnsSnapshot(centerId, page = 0, pageSize = 50) {
    if (!isOnline() || !client || !centerId) return [];
    const { data, error } = await safe(
      client.from('returns').select('*').eq('center_id', centerId).order('date', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1),
      { data: [] }
    );
    return (data?.data || []).map(r => ({
      id: r.id,
      originalSaleId: r.original_sale_id,
      date: r.date,
      items: r.items,
      refundTotal: r.refund_total,
      reason: sanitizeStr(r.reason, 500),
      returnedBy: r.returned_by,
      returnedByName: sanitizeStr(r.returned_by_name, 200)
    }));
  }

  /* ─── ORDERS SNAPSHOT ─── */
  async function fetchOrdersSnapshot(centerId) {
    if (!isOnline() || !client || !centerId) return [];
    const { data, error } = await safe(
      client.from('orders').select('*, order_items(*)').eq('center_id', centerId).order('created_at', { ascending: false }),
      { data: [] }
    );
    if (error) { console.error('fetchOrdersSnapshot error:', error); return []; }
    return (data?.data || []).map(o => ({
      id: o.id,
      date: o.created_at,
      items: (o.order_items || []).map(it => ({
        medId: it.listing_id,
        name: sanitizeStr(it.name, 200),
        dose: sanitizeStr(it.dosage, 100),
        price: it.price || 0,
        qty: it.qty || 1
      })),
      total: o.total || 0,
      status: o.status || 'pending'
    }));
  }

  /* ─── UPDATE ORDER STATUS ─── */
  async function updateOrderStatus(orderId, status, centerId) {
    if (!isOnline() || !client || !orderId) throw new Error('offline');
    const { error } = await client.from('orders').update({ status }).eq('id', orderId).eq('center_id', centerId);
    if (error) { console.error('updateOrderStatus error:', error); throw error; }
  }

  /* ─── GLOBAL LISTINGS (admin catalog) ─── */
  async function fetchListings() {
    if (!isOnline() || !client) return [];
    const { data, error } = await client
      .from('medicine_listings')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchListings error', error); return []; }
    return (data || []).map(l => ({
      id: l.id,
      name: sanitizeStr(l.name, 200),
      dose: sanitizeStr(l.dosage, 100),
      price: l.price || 0,
      unit: l.unit || 'pieces',
      batch: sanitizeStr(l.batch_number, 100),
      expiry: l.expiry_date || null,
      photo: l.photo || null,
      multiplier: l.multiplier || 1
    }));
  }

  /* ─── CREATE ORDER ─── */
  async function createOrder(order, centerId, centerName) {
    if (!isOnline() || !client || !centerId) throw new Error('offline');
    const { data, error } = await client.from('orders').insert({
      center_id: centerId,
      center_name: sanitizeStr(centerName, 200),
      status: 'pending',
      total: order.total || 0
    }).select().single();
    if (error) { console.error('createOrder insert error:', error); throw error; }
    const orderId = data.id;
    if (order.items && order.items.length) {
      const orderItems = order.items.map(it => ({
        order_id: orderId,
        listing_id: it.medId,
        name: sanitizeStr(it.name, 200),
        dosage: sanitizeStr(it.dose, 100),
        price: it.price || 0,
        qty: it.qty || 1
      }));
      const { error: itemsErr } = await client.from('order_items').insert(orderItems);
      if (itemsErr) {
        console.error('createOrder items error:', itemsErr);
        await client.from('orders').delete().eq('id', orderId);
        throw itemsErr;
      }
    }
    return data;
  }

  /* ─── SERVER TIME ─── */
  async function getServerTime() {
    if (!isOnline() || !client) return new Date().toISOString();
    try {
      const { data, error } = await client.rpc('get_server_time');
      if (error) throw error;
      return data;
    } catch (e) {
      return new Date().toISOString();
    }
  }

  return {
    init,
    isOnline,
    signUp,
    signIn,
    getSession,
    signOut,
    fetchStaffByCenter,
    updateApproval,

    upsertMedicine,
    deleteMedicine,
    upsertIllness,
    createReturn,
    createOrder,
    logActivity,
    createSaleAtomic,
    subscribeToMedicines,
    subscribeToSales,
    subscribeToOrders,
    fetchStockSnapshot,
    fetchSalesSnapshot,
    fetchReturnsSnapshot,
    fetchOrdersSnapshot,
    fetchListings,
    getServerTime
  };
})();

window.db = db;
