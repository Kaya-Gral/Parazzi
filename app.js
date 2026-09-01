/* ═══════════════════════════════════════════════════════════════
   Parazzi — Pharmacy Management PWA  |  app.js
   Supabase auth + performance optimizations + delta sync
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  const state = {
    user: null,
    medicines: [],
    illnesses: [],
    staff: [],
    sales: [],
    orders: [],
    returns: [],
    listings: [],
    tab: 'sell',

    cart: {},
    cmdCart: {},
    filter: 'all',
    sellUnit: 'all',
    cmdUnitFilter: 'all',
    recTab: 'analytics',
    cmdTab: 'new',
    lang: 'en',
    theme: 'auto',
    lowAlert: 10,
    activityReport: false,
    setupStep: 0,
    setupSelected: [],
    checkIn: false,
    inService: [],
    swipeOpen: null,
    salesPage: 0,
    returnsPage: 0,
    pageSize: 50,
    hasMoreSales: true,
    hasMoreReturns: true,
  };

  const UNITS = ['tablets','bottles','ampoules','sachets','syrup','pieces'];
  const RETURN_WINDOW_MS = 5 * 60 * 60 * 1000;

  let _saveTimer, _stockTimer, _sellTimer, _illTimer, _cmdTimer;
  function scheduleSave(){ clearTimeout(_saveTimer); _saveTimer=setTimeout(async()=>{try{await DB.save();}catch(e){}},600); }

  const i18n = {
    en: {
      email:'Email', password:'Password', signIn:'Sign In', signUp:'Sign Up',
      noAccount:'No account?', hasAccount:'Have an account?', createAccount:'Create Account',
      online:'Online',
      centerName:'Center Name', fullName:'Full Name', confirmPassword:'Confirm Password',
      stock:'Stock', sell:'Sell', illnesses:'Illnesses', settings:'Settings',
      searchMed:'Search medicine…', searchIll:'Search illness…',
      all:'All', chipLow:'Low Stock', chipOut:'Out', expiresSoon:'Expiring', chipExpired:'Expired',
      myMedicines:'My Medicines', add:'+ Add', addMedicine:'Add Medicine', save:'Save',
      medicineName:'Medicine Name', dosage:'Dosage', eg500mg:'e.g. 500mg',
      sellPrice:'Sell Price', cost:'Cost', quantity:'Stock', unit:'Unit',
      batchNumber:'Batch Number', expiryDate:'Expiry Date', forIllnesses:'For Illnesses',
      confirmSale:'Confirm Sale', confirm:'Confirm', clearCart:'Clear Cart',
      addIllness:'Add Illness', illnessName:'Illness Name',
      refMeds:'Reference Medicines', addRef:'+ Add', cureMeds:'Cure Medicines',
      cancel:'Cancel', profile:'Profile', management:'Management', manage:'Manage',
      role:'Role', language:'Language', theme:'Theme', lowStockAlert:'Low Stock Alert',
      salesRecords:'Sales Records', commandMedicines:'Command', logOut:'Log Out',
      memberSince:'Member Since', saleDetails:'Sale Details', offline:'offline',
      allUnits:'All Units', unit_tablets:'Tablets', unit_bottles:'Bottles',
      unit_ampoules:'Ampoules', unit_sachets:'Sachets', unit_syrup:'Syrup', unit_pieces:'Pieces',
      tabAnalytics:'Analytics', tabSales:'Sales', tabReturns:'Returns', newOrder:'New Order', myOrders:'My Orders',
      placeOrder:'Place Order', reviewOrder:'Review your order before submitting',
      minOrder:'Minimum order: 5,000 FCFA', setPrices:'Set Prices',
      priceFor:'Set sell prices for received medicines', setupStock:'Setup Your Stock',
      setupDesc:'Select medicines you carry and set your prices', next:'Next', skip:'Skip',
      activityReport:'Activity Report', activate:'Activate', manageStaff:'Manage Staff',
      inService:'In Service', checkIn:'Check In', checkInDesc:'Mark yourself as in service to begin your shift.',
      beginShift:'Begin Shift', revoke:'Revoke',
      activityReportDesc2:'Activity Report tracks when each staff member opens the app, makes sales, or updates stock. For busy doctors and pharmacy owners, this means no more guessing: you can see at a glance who is on duty, when they last checked in, and how active they have been during their shift.',
      activityReportDesc3:'Perfect for multi-staff pharmacies where you cannot be on the floor all day. Stay informed, even when you are away.',
      returnSale:'Return Sale',
      processReturn:'Process Return', returnReason:'Return Reason',
      returnWindow:'Return window closes in',
      returnExpired:'Return window closed', hours:'hours', minutes:'min',
      wrongMedicine:'Wrong medicine', allergic:'Patient allergic', changedPrescription:'Changed prescription',
      expired:'Expired', other:'Other', refundTotal:'Refund Total', returned:'Returned',
      noReturns:'No returns yet', returnDetails:'Return Details',
      dupMedicine:'A medicine with this name and dosage already exists.',
    },
    fr: {
      email:'E-mail', password:'Mot de passe', signIn:'Connexion', signUp:'Inscription',
      noAccount:"Pas de compte ?", hasAccount:'Deja un compte ?', createAccount:'Creer un compte',
      online:'En ligne',
      centerName:'Nom du Centre', fullName:'Nom complet', confirmPassword:'Confirmer le mot de passe',
      stock:'Stock', sell:'Vente', illnesses:'Maladies', settings:'Parametres',
      searchMed:'Rechercher un medicament…', searchIll:'Rechercher une maladie…',
      all:'Tout', chipLow:'Stock Faible', chipOut:'Epuise', expiresSoon:'Expire Bientot', chipExpired:'Expire',
      myMedicines:'Mes Medicaments', add:'+ Ajouter', addMedicine:'Ajouter un Medicament', save:'Enregistrer',
      medicineName:'Nom du Medicament', dosage:'Dosage', eg500mg:'ex. 500mg',
      sellPrice:'Prix de Vente', cost:'Cout', quantity:'Stock', unit:'Unite',
      batchNumber:'Numero de Lot', expiryDate:"Date d'expiration", forIllnesses:'Pour les Maladies',
      confirmSale:'Confirmer la Vente', confirm:'Confirmer', clearCart:'Vider le Panier',
      addIllness:'Ajouter une Maladie', illnessName:'Nom de la Maladie',
      refMeds:'Medicaments de Reference', addRef:'+ Ajouter', cureMeds:'Medicaments Curatifs',
      cancel:'Annuler', profile:'Profil', management:'Gestion', manage:'Gerer',
      role:'Role', language:'Langue', theme:'Theme', lowStockAlert:'Alerte Stock Faible',
      salesRecords:'Historique des Ventes', commandMedicines:'Commander', logOut:'Deconnexion',
      memberSince:'Membre depuis', saleDetails:'Details de la Vente', offline:'hors ligne',
      allUnits:'Toutes les Unites', unit_tablets:'Comprimes', unit_bottles:'Flacons',
      unit_ampoules:'Ampoules', unit_sachets:'Sachets', unit_syrup:'Sirop', unit_pieces:'Pieces',
      tabAnalytics:'Analyses', tabSales:'Ventes', tabReturns:'Retours', newOrder:'Nouvelle Commande', myOrders:'Mes Commandes',
      placeOrder:'Passer la Commande', reviewOrder:'Verifiez votre commande avant de valider',
      minOrder:'Commande minimum : 5 000 FCFA', setPrices:'Fixer les Prix',
      priceFor:'Definissez les prix de vente des medicaments recus', setupStock:'Configurez votre Stock',
      setupDesc:'Selectionnez les medicaments que vous vendez et fixez vos prix', next:'Suivant', skip:'Passer',
      activityReport:'Rapport d Activite', activate:'Activer', manageStaff:'Gerer le Personnel',
      inService:'En Service', checkIn:'Pointage', checkInDesc:'Indiquez que vous etes en service pour commencer votre shift.',
      beginShift:'Commencer le Shift', revoke:'Revoquer',
      activityReportDesc2:'Le Rapport d Activite suit quand chaque membre du personnel ouvre l application, effectue des ventes ou met a jour le stock.',
      activityReportDesc3:'Parfait pour les pharmacies multi-personnel ou vous ne pouvez pas etre sur le terrain toute la journee.',
      returnSale:'Retourner Vente',
      processReturn:'Traiter le Retour', returnReason:'Motif du Retour',
      returnWindow:'Fenetre de retour se ferme dans',
      returnExpired:'Fenetre de retour fermee', hours:'heures', minutes:'min',
      wrongMedicine:'Mauvais medicament', allergic:'Allergie patient', changedPrescription:'Ordonnance modifiee',
      expired:'Expire', other:'Autre', refundTotal:'Total Rembourse', returned:'Retourne',
      noReturns:'Aucun retour', returnDetails:'Details du Retour',
      dupMedicine:'Un medicament avec ce nom et ce dosage existe deja.',
    }
  };

  function t(k){ return (i18n[state.lang]&&i18n[state.lang][k])||i18n.en[k]||k; }

  const $=(s,e=document)=>e.querySelector(s);
  const $$=(s,e=document)=>Array.from(e.querySelectorAll(s));
  const uid=()=>{
    if(typeof crypto!=='undefined'&&crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0;
      const v=c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
  };
  const fmtMoney=n=>`${(n||0).toLocaleString()} FCFA`;
  const fmtNum=n=>(n||0).toLocaleString();
  const fmtDate=d=>new Date(d).toLocaleDateString(state.lang==='fr'?'fr-FR':'en-US',{day:'numeric',month:'short',year:'numeric'});
  const fmtTime=d=>new Date(d).toLocaleTimeString(state.lang==='fr'?'fr-FR':'en-US',{hour:'2-digit',minute:'2-digit'});
  const initials=s=>(s||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const today=()=>new Date().toISOString().split('T')[0];
  const daysUntil=d=>Math.ceil((new Date(d)-new Date())/86400000);
  const timeLeftMs=d=>new Date(d).getTime()+RETURN_WINDOW_MS-Date.now();
  const canManage=()=>state.user&&(state.user.role==='doctor'||state.user.role==='admin');
  const getReturnedQty=(saleId,medId)=>state.returns.filter(r=>r.originalSaleId===saleId).flatMap(r=>r.items).filter(it=>it.medId===medId).reduce((a,it)=>a+it.qty,0);
  const isSaleReturned=saleId=>state.returns.some(r=>r.originalSaleId===saleId);

  /* ─── XSS SANITIZATION ─── */
  function escapeHtml(str){
    if(str==null) return '';
    if(typeof str!=='string') str=String(str);
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function sanitizeInput(str,maxLen=200){
    if(typeof str!=='string') return '';
    return str.replace(/[<>]/g,'').trim().slice(0,maxLen);
  }

  /* ─── STORAGE ─── */
  /* ─── INDEXEDDB STORAGE ─── */
const IDB = {
  _dbPromise: null,
  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('parazzi_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },
  async get(key) {
    try {
      const db = await this._db();
      return new Promise((resolve) => {
        const tx = db.transaction('store', 'readonly');
        const store = tx.objectStore('store');
        const req = store.get(key);
        req.onsuccess = () => {
          try {
            resolve(req.result ? JSON.parse(req.result) : null);
          } catch (e) { resolve(null); }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        store.put(JSON.stringify(value), key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.error('IDB set failed', e); }
  },
  async remove(key) {
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.error('IDB remove failed', e); }
  },
  async clear() {
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.error('IDB clear failed', e); }
  }
};

const DB={
    async load(){
      try{
        const raw=await IDB.get('parazzi_data');
        if(raw){
          let parsed;
          if(typeof raw==='string'&&typeof LZString!=='undefined'){
            try{parsed=JSON.parse(LZString.decompressFromUTF16(raw));}catch(e){parsed=JSON.parse(raw);}
          }else if(typeof raw==='object'){parsed=raw;}
          if(parsed)Object.assign(state,parsed);
        }
      }catch(e){}
      if(!state.tab) state.tab = 'sell';
      state.tab = 'sell';
      if(!state.medicines.length) DB.seed();
      try{
        const c=await IDB.get('parazzi_cart');
        if(c) state.cart=c;
      }catch(e){ state.cart={}; }
      try{
        const l=await IDB.get('parazzi_listings');
        if(l) state.listings=l;
      }catch(e){ state.listings=[]; }
    },
    async save(){
      const payload={
        user:state.user,medicines:state.medicines,illnesses:state.illnesses,
        staff:state.staff,sales:state.sales,orders:state.orders,
        returns:state.returns,lang:state.lang,
        theme:state.theme,lowAlert:state.lowAlert,
        activityReport:state.activityReport,inService:state.inService,
        listings:state.listings
      };
      const compressed=(typeof LZString!=='undefined')?LZString.compressToUTF16(JSON.stringify(payload)):JSON.stringify(payload);
      await IDB.set('parazzi_data',compressed);
      await IDB.set('parazzi_cart',state.cart);
      await IDB.set('parazzi_listings',state.listings);
    },
    seed(){
      state.medicines=[];
      state.illnesses=[];
      state.staff=[];
      state.sales=[];
      state.orders=[];
      state.returns=[];
      state.inService=[];
    }
  };

  /* ─── KEYED DOM DIFFING ─── */
  function renderKeyed(container, items, keyFn, renderFn, emptyHtml) {
    /* remove skeleton placeholders on first real render */
    container.querySelectorAll('.skeleton').forEach(el => el.remove());

    /* clean non-keyed leftovers (analytics HTML, old load-more buttons, etc.) */
    Array.from(container.children).forEach(el => {
      if (!el.dataset.key) el.remove();
    });

    if (!items.length) {
      if (container.innerHTML !== emptyHtml) container.innerHTML = emptyHtml;
      return;
    }
    const existing = new Map();
    Array.from(container.children).forEach(el => {
      const k = el.dataset.key;
      if (k) existing.set(k, el);
    });
    const seen = new Set();
    const creates = [];

    items.forEach(item => {
      const key = String(keyFn(item));
      seen.add(key);
      let html = renderFn(item);
      if (!html.includes('data-key=')) {
        html = html.replace(/^<(\w+)/, `<$1 data-key="${key}"`);
      }
      const el = existing.get(key);
      if (el) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const neu = temp.firstElementChild;
        if (neu && el.outerHTML !== neu.outerHTML) el.outerHTML = html;
      } else {
        creates.push(html);
      }
    });

    existing.forEach((el, k) => { if (!seen.has(k)) el.remove(); });

    if (creates.length) {
      const frag = document.createDocumentFragment();
      creates.forEach(html => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const el = temp.firstElementChild;
        if (el) frag.appendChild(el);
      });
      container.appendChild(frag);
    }

    items.forEach(item => {
      const key = String(keyFn(item));
      const el = container.querySelector(`[data-key="${key}"]`);
      if (el) container.appendChild(el);
    });
  }

  /* ─── ANALYTICS CACHE ─── */
  const analyticsCache = {
    _salesHash: null,
    _returnsHash: null,
    _data: null,

    _hash(arr, keyFn) {
      let h = 0;
      for (let i = 0; i < arr.length; i++) {
        const v = keyFn(arr[i]);
        for (let j = 0; j < v.length; j++) {
          h = ((h << 5) - h + v.charCodeAt(j)) | 0;
        }
      }
      return h;
    },

    get() {
      const sHash = this._hash(state.sales, s => s.id + s.total);
      const rHash = this._hash(state.returns, r => r.id + r.refundTotal);
      if (this._salesHash === sHash && this._returnsHash === rHash && this._data) {
        return this._data;
      }
      this._salesHash = sHash;
      this._returnsHash = rHash;
      this._data = this._compute();
      return this._data;
    },

    invalidate() {
      this._salesHash = null;
      this._returnsHash = null;
    },

    _compute() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const monthName = now.toLocaleDateString(state.lang==='fr'?'fr-FR':'en-US', { month: 'long' });
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const daily = {};
      state.sales.forEach(s => {
        const d = new Date(s.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dayKey = d.getDate();
          daily[dayKey] = (daily[dayKey] || 0) + s.total;
        }
      });

      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (daily[d]) days.push(d);
      }
      const max = Math.max(...Object.values(daily), 1);

      const medMap = {};
      state.sales.forEach(s => s.items.forEach(it => {
        medMap[it.medId] = (medMap[it.medId] || 0) + it.qty;
      }));
      const topMeds = Object.entries(medMap)
        .map(([id, qty]) => {
          const m = state.medicines.find(x => x.id === id);
          return { name: m ? m.name : 'Unknown', qty, rev: qty * (m ? m.price : 0) };
        })
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const totalSales = state.sales.reduce((a, s) => a + s.total, 0);
      const totalItems = state.sales.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
      const totalRefunded = state.returns.reduce((a, r) => a + r.refundTotal, 0);
      const totalRetItems = state.returns.reduce((a, r) => a + r.items.reduce((b, it) => b + it.qty, 0), 0);
      const netCount = state.sales.length - state.returns.length;
      const netRevenue = totalSales - totalRefunded;
      const netItems = totalItems - totalRetItems;

      return { daily, days, max, topMeds, totalSales, totalItems, totalRefunded, totalRetItems, netCount, netRevenue, netItems, monthName, year, month };
    }
  };

  /* ─── SVG ICON HELPER ─── */
  function svgIcon(name, w, h, cls) {
    w = w || 22; h = h || 22; cls = cls || '';
    return `<svg class="${cls}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2"><use href="#icon-${name}"/></svg>`;
  }


  /* ─── AUDIT LOGGING ─── */


  /* ─── TOASTS / UI HELPERS ─── */
  function toast(msg,type='ok'){
    const box=$('#toasts'); if(!box)return;
    const el=document.createElement('div');
    el.className='toast '+(type==='err'?'err':type==='ok'?'ok':'');
    el.textContent=escapeHtml(msg); box.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }
  function openSheet(id){ const el=document.getElementById(id); if(!el)return; el.classList.add('show'); el.style.pointerEvents='all'; }
  function closeSheet(id){ const el=document.getElementById(id); if(!el)return; el.classList.remove('show'); setTimeout(()=>el.style.pointerEvents='none',300); }
  function openActivity(id){ const el=document.getElementById(id); if(el) el.classList.add('show'); }
  function closeActivity(id){ const el=document.getElementById(id); if(el) el.classList.remove('show'); }

  function applyTheme(){
    const pd=window.matchMedia('(prefers-color-scheme: dark)').matches;
    const th=state.theme==='auto'?(pd?'dark':'light'):state.theme;
    document.documentElement.setAttribute('data-theme',th);
    const st=document.getElementById('set-theme'); if(st) st.textContent=state.theme==='auto'?'Auto':state.theme==='dark'?'Dark':'Light';
  }
  function applyLang(){
    $$('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(i18n[state.lang][k]) el.textContent=i18n[state.lang][k]; });
    $$('[data-i18n-placeholder]').forEach(el=>{ const k=el.getAttribute('data-i18n-placeholder'); if(i18n[state.lang][k]) el.placeholder=i18n[state.lang][k]; });
    const al=document.getElementById('auth-lang'); if(al) al.textContent=state.lang.toUpperCase();
    const sl=document.getElementById('set-lang'); if(sl) sl.textContent=state.lang==='en'?'English':'Francais';
    renderStock(); renderSell(); renderIllnesses(); renderRecords(); renderCommand();
    updateOnlineStatus();
  }

  /* ═══ AUTH (Supabase-backed) ═══ */
  async function login(e){
    e.preventDefault();
    const email=$('#in-email').value.trim().toLowerCase().slice(0,320);
    const pass=$('#in-pass').value;
    if(pass.length<6)return showAuthErr('Password too short');

    if(db.isOnline()){
      try{
        const user=await db.signIn(email,pass);
        state.user=user;
        const existing=state.staff.find(s=>s.email===user.email);
        if(!existing){
          state.staff.push({id:user.id,name:user.name,email:user.email,role:user.role,center:user.center,center_id:user.center_id,approved:user.approved,date:user.date});
        }else{
          existing.approved=true; existing.role=user.role; existing.name=user.name; existing.center=user.center; existing.center_id=user.center_id; existing.center_id=user.center_id;
        }
        DB.save();
        $('#auth-overlay').classList.add('hidden');
        const uo=$('#unlock-overlay'); if(uo) uo.style.display='none';
        initApp();
        toast(t('signIn')+' OK');
      }catch(err){
        if(err.message==='Account not approved') return showAuthErr('Account pending approval by center doctor');
        if(err.message==='offline') return showAuthErr('You are offline. Use offline sign-in if you have a previous session.');
        return showAuthErr(err.message||'Login failed');
      }
    }else{
      const user=state.staff.find(s=>s.email===email && s.approved);
      if(!user) return showAuthErr('No offline session found or account not approved');
      state.user=user;
      DB.save();
      $('#auth-overlay').classList.add('hidden');
      initApp();
      toast('Signed in (offline mode)');
    }
  }

  async function signup(e){
    e.preventDefault();
    if(!db.isOnline()) return showAuthErr('Internet connection required for sign up');

    const center=sanitizeInput($('#up-center').value,200);
    const name=sanitizeInput($('#up-name').value,200);
    const email=$('#up-email').value.trim().toLowerCase().slice(0,320);
    const pass=$('#up-pass').value;
    const confirm=$('#up-confirm').value;
    if(pass!==confirm)return showAuthErr('Passwords do not match');

    try{
      const user=await db.signUp(email,pass,name,center);
      state.staff.push({id:user.id,name:user.name,email:user.email,role:user.role,center:user.center,center_id:user.center_id,approved:user.approved,date:user.date});
      DB.save();
      showAuthErr('Account created! Awaiting doctor approval.');
      setTimeout(()=>showLogin(),2500);
    }catch(err){
      showAuthErr(err.message||'Sign up failed');
    }
  }

  function showAuthErr(msg){
    const el=$('#auth-error');
    if(!el)return;
    el.textContent=escapeHtml(msg);
    el.style.display='block';
    setTimeout(()=>el.style.display='none',5000);
  }

  async function logout(){
    await db.signOut();
    // Clear all sensitive in-memory state
    state.user=null;
    state.medicines=[];
    state.illnesses=[];
    state.staff=[];
    state.sales=[];
    state.orders=[];
    state.returns=[];
    state.inService=[];
    state.cart={};
    state.cmdCart={};
    // Wipe IndexedDB completely so no data survives logout
    await IDB.clear();
    location.reload();
  }

  function unlock(){
    const pass=$('#unlock-pass');
    if(!pass||pass.value.length<6)return;
    if(!state.user || !state.user.approved){
      showAuthErr('Session expired. Please log in.');
      setTimeout(()=>logout(),1500);
      return;
    }
    const uo=$('#unlock-overlay'); if(uo) uo.style.display='none';
    initApp();
  }

  function showSignup(){ $('#login-form').classList.add('hidden'); $('#signup-form').classList.remove('hidden'); }
  function showLogin(){ $('#signup-form').classList.add('hidden'); $('#login-form').classList.remove('hidden'); }

  /* NAV */
  const TAB_ORDER = ['stock','sell','illness','settings'];
  function go(tab){
    state.tab = tab;
    const idx = TAB_ORDER.indexOf(tab);
    const track = $('#main-track');
    if(track){
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      track.style.transform = `translateX(-${idx * 25}%)`;
    }
    $$('.nav-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));
    if(tab==='sell')updateFab();
    if(tab==='stock')renderStock();
    if(tab==='sell')renderSell();
    if(tab==='illness')renderIllnesses();
    if(tab==='settings')renderSettings();
    scheduleSave();
  }

  /* MAIN SWIPE GESTURE */
  function initMainSwipe(){
    const slider = document.querySelector('.main-slider');
    const track = $('#main-track');
    if(!slider || !track) return;
    
    // Set initial position
    const idx = TAB_ORDER.indexOf(state.tab);
    track.style.transform = `translateX(-${idx * 25}%)`;
    
    let startX = 0, startY = 0, swiping = false, isHorizontal = false;
    const getWidth = () => slider.offsetWidth;
    
    slider.addEventListener('touchstart', e => {
      // Don't capture if touching chips, inputs, buttons, or inside a sheet/overlay
      if(e.target.closest('.chips') || e.target.closest('input') || e.target.closest('button') || e.target.closest('.overlay') || e.target.closest('.sheet')) return;
      
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
      isHorizontal = false;
      track.style.transition = 'none';
    }, {passive: true});
    
    slider.addEventListener('touchmove', e => {
      if(!swiping) return;
      
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      
      if(!isHorizontal) {
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if(Math.abs(dx) > Math.abs(dy) * 0.8) {
          isHorizontal = true;
        } else {
          swiping = false;
          return;
        }
      }
      
      e.preventDefault();
      
      const baseOffset = -(TAB_ORDER.indexOf(state.tab) * 25);
      const percent = baseOffset + (dx / getWidth()) * 25;
      const clamped = Math.max(-75, Math.min(0, percent));
      track.style.transform = `translateX(${clamped}%)`;
    }, {passive: false});
    
    slider.addEventListener('touchend', e => {
      if(!swiping) return;
      swiping = false;
      
      if(!isHorizontal) return;
      
      const dx = e.changedTouches[0].clientX - startX;
      const width = getWidth();
      const threshold = Math.max(50, width * 0.15);
      const currentIdx = TAB_ORDER.indexOf(state.tab);
      
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      
      if(Math.abs(dx) > threshold) {
        if(dx < 0 && currentIdx < TAB_ORDER.length - 1) go(TAB_ORDER[currentIdx + 1]);
        else if(dx > 0 && currentIdx > 0) go(TAB_ORDER[currentIdx - 1]);
        else go(state.tab);
      } else {
        go(state.tab);
      }
    }, {passive: true});
    
    slider.addEventListener('touchcancel', () => {
      swiping = false;
      isHorizontal = false;
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      go(state.tab);
    }, {passive: true});
  }

  /* STOCK */
  function renderStock(){
    const qel=$('#q-stock');
    const q=(qel?qel.value:'').toLowerCase();
    const list=$('#list-stock');
    if(!list)return;
    let meds=state.medicines.filter(m=>m.name.toLowerCase().includes(q));
    if(state.filter==='low')meds=meds.filter(m=>m.stock>0&&m.stock<=state.lowAlert);
    if(state.filter==='out')meds=meds.filter(m=>m.stock<=0);
    if(state.filter==='exp')meds=meds.filter(m=>{const d=daysUntil(m.expiry);return d>=0&&d<=30;});
    if(state.filter==='expired')meds=meds.filter(m=>daysUntil(m.expiry)<0);
    const showActions=canManage();
    const emptyHtml=`<div class="empty">${svgIcon('medicine',48,48)}<p>${escapeHtml(t('searchMed'))}</p></div>`;
    renderKeyed(list, meds, m=>m.id, m=>{
      const expDays=m.expiry?daysUntil(m.expiry):null; const isLow=m.stock>0&&m.stock<=state.lowAlert; const isExp=m.expiry&&expDays>=0&&expDays<=30; const isExpired=m.expiry&&expDays<0; const cls=isLow?'low':isExpired?'expired-med':''; const qtyCls=isLow?'alert':'';
      const actions=showActions?`<div class="swipe-actions">${m.batch?'<div class="swipe-batch"><span class="swipe-batch-val">'+m.batch+'</span></div>':''}<div class="swipe-btn-row"><button class="swipe-act edit" onclick="App.editMed('${m.id}')" aria-label="Edit">${svgIcon('edit',22,22)}</button><button class="swipe-act del" onclick="App.deleteMed('${m.id}')" aria-label="Delete">${svgIcon('trash',22,22)}</button></div></div>`:'';
      return `<div class="swipe ${showActions?'':'no-actions'}" id="swipe-${m.id}" ${showActions?`ontouchstart="App.handleSwipeStart(event,'${m.id}')" ontouchend="App.handleSwipeEnd(event,'${m.id}')"`:''}>${actions}<div class="swipe-content"><div class="scard ${cls}"><div class="scard-top"><div class="scard-ph">${initials(m.name)}</div><div class="scard-info"><div class="scard-name">${m.name}</div>${m.dose?'<div class="badge-dose">'+m.dose+'</div>':''}</div><div class="scard-qty"><b class="${qtyCls}">${m.stock}</b><span>${m.unit}</span></div></div><div class="scard-line"></div><div class="scard-bot">${isExp?'<span class="badge badge-expiry soon">EXP '+expDays+'d</span>':''}${isExpired?'<span class="badge badge-expiry expired">EXPIRED</span>':''}<span class="expiry-date">${m.expiry?fmtDate(m.expiry):''}</span></div></div></div></div>`;
    }, emptyHtml);
  }
  let swipeX=0,swipeId=null;
  function handleSwipeStart(e,id){ swipeId=id; swipeX=e.touches[0].clientX; }
  function handleSwipeEnd(e,id){ const dx=e.changedTouches[0].clientX-swipeX; const el=document.getElementById('swipe-'+id); if(!el)return; if(dx<-50){el.classList.add('open');state.swipeOpen=id;}else if(dx>50){el.classList.remove('open');state.swipeOpen=null;} }
  function setFilter(f){ state.filter = state.filter === f ? 'all' : f; $$('#stock-chips .chip[data-filter]').forEach(c=>c.classList.toggle('active',c.dataset.filter===state.filter)); renderStock(); }

  function openMedSheet(id=null){
    $('#med-id').value=id||'';
    const mt=$('#med-title');
    if(mt)mt.textContent=id?'Edit Medicine':t('addMedicine');

    const stockInput=$('#med-stock');
    const stockLabel=stockInput?.previousElementSibling;

    if(id){
      const m=state.medicines.find(x=>x.id===id);
      $('#med-name').value=m.name;
      $('#med-dose').value=m.dose;
      $('#med-price').value=m.price;
      $('#med-cost').value=m.cost;
      $('#med-batch').value=m.batch||'';
      $('#med-expiry').value=m.expiry||'';
      if(stockLabel) stockLabel.textContent='Adjust Stock (+/-)';
      stockInput.value='';
      stockInput.placeholder=`Current: ${m.stock}`;
      stockInput.dataset.mode='delta';
      stockInput.dataset.current=m.stock;
    }else{
      $('#med-name').value='';$('#med-dose').value='';$('#med-price').value='';$('#med-cost').value='';
      stockInput.value=0;$('#med-batch').value='';$('#med-expiry').value='';
      if(stockLabel) stockLabel.textContent=t('quantity');
      stockInput.placeholder='';
      stockInput.dataset.mode='absolute';
      delete stockInput.dataset.current;
    }

    const us=$('#med-unit');
    if(us)us.innerHTML=UNITS.map(u=>`<option value="${u}">${u}</option>`).join('');
    const mi=$('#med-ills');
    if(mi)mi.innerHTML=state.illnesses.map(i=>`<label class="check"><input type="checkbox" value="${escapeHtml(i.id)}" ${id&&(state.medicines.find(x=>x.id===id)?.ills||[]).includes(i.name)?'checked':''}><span>${escapeHtml(i.name)}</span></label>`).join('');
    openSheet('sheet-med');
  }

  function saveMed(){
    if(!canManage())return toast('Only doctors can manage medicines','err');
    const id=$('#med-id').value;
    const isEdit=!!id;
    const before=isEdit?JSON.parse(JSON.stringify(state.medicines.find(m=>m.id===id))):{};

    const name=sanitizeInput($('#med-name').value,200);
    const dose=sanitizeInput($('#med-dose').value,100);
    const price=parseInt($('#med-price').value)||0;
    const cost=parseInt($('#med-cost').value)||0;
    const batch=sanitizeInput($('#med-batch').value,100);
    const expiry=$('#med-expiry').value || null;

    if(!name)return toast('Name required','err');
    if(price<0)return toast('Price cannot be negative','err');
    if(cost<0)return toast('Cost cannot be negative','err');
    if(expiry&&daysUntil(expiry)<0){
      if(!confirm('This medicine is already expired. Save anyway?'))return;
    }

    /* Duplicate detection (#15) */
    const dup=state.medicines.find(m=>m.id!==id&&m.name.toLowerCase()===name.toLowerCase()&&m.dose.toLowerCase()===dose.toLowerCase());
    if(dup)return toast(t('dupMedicine'),'err');

    let stock;
    const stockInput=$('#med-stock');
    if(isEdit&&stockInput.dataset.mode==='delta'){
      const delta=parseInt(stockInput.value)||0;
      const current=parseInt(stockInput.dataset.current)||0;
      stock=current+delta;
      if(stock<0)return toast('Resulting stock cannot be negative','err');
    }else{
      stock=parseInt(stockInput.value)||0;
      if(stock<0)return toast('Stock cannot be negative','err');
    }

    const med={
      id:id||uid(),name,dose,price,cost,stock,
      unit:$('#med-unit').value,batch,expiry,
      ills:Array.from($$('#med-ills input:checked')).map(cb=>{const ill=state.illnesses.find(i=>i.id===cb.value);return sanitizeInput(ill?ill.name:cb.value,200);}).filter(Boolean) || null,
      updated_at:new Date().toISOString()
    };

    if(id){const idx=state.medicines.findIndex(m=>m.id===id);state.medicines[idx]=med;}
    else state.medicines.push(med);
    DB.save();

    if(state.user?.center_id){
      const payload={...med,center_id:state.user.center_id};
      if(db.isOnline()){
        db.upsertMedicine(payload, state.user.center_id).catch(()=>queuePending('medicine',payload));
      }else{
        queuePending('medicine',payload);
      }
    }

    const deltaLog=isEdit?{stock_delta:med.stock-(before.stock||0),price:med.price}:{stock:med.stock,price:med.price};
    closeSheet('sheet-med');
    renderStock(); renderSell();
    toast(isEdit?'Updated':'Added');
  }

  function editMed(id){ openMedSheet(id); }

  function deleteMed(id){
    if(!confirm('Delete this medicine permanently?'))return;
    const idx=state.medicines.findIndex(x=>x.id===id);
    if(idx===-1)return;
    const m=state.medicines[idx];
    state.medicines.splice(idx,1);
    if(state.user?.center_id){
      if(db.isOnline()){
        db.deleteMedicine(id,state.user.center_id).catch((err)=>{
          console.error('Delete sync failed:', err);
          queuePending('delete',{id,center_id:state.user.center_id});
        });
      }else{
        queuePending('delete',{id,center_id:state.user.center_id});
      }
    }
    DB.save();
    renderStock(); renderSell();
    toast('Deleted');
  }

  /* SELL */
  function renderSell(){
    const qel=$('#q-sell');
    const q=(qel?qel.value:'').toLowerCase();
    const grid=$('#grid-sell');
    if(!grid)return;
    let meds=state.medicines.filter(m=>m.name.toLowerCase().includes(q));
    if(state.sellUnit!=='all')meds=meds.filter(m=>m.unit===state.sellUnit);
    const emptyHtml=`<div class="empty" style="grid-column:1/-1"><p>No medicines found</p></div>`;
    renderKeyed(grid, meds, m=>m.id, m=>{
      const inCart=state.cart[m.id]||0; const isExpired=m.expiry&&daysUntil(m.expiry)<0; const out=m.stock<=0||isExpired; const doseColor={tablets:'#3b82f6',bottles:'#6b7280',ampoules:'#f59e0b',sachets:'#a855f7',syrup:'#ec4899',pieces:'#0d9488'}[m.unit]||'#0d9488';
      return `<div class="sell ${out?'out':''} ${inCart?'in-cart':''}" data-unit="${m.unit}"><div class="sell-img-wrap">${inCart?`<span class="sell-badge">${inCart}</span>`:''}${m.dose?'<span class="sell-dose-corner" style="background:'+doseColor+';color:#fff">'+m.dose+'</span>':''}<div class="sell-ph">${initials(m.name)}</div></div><div class="sell-body"><div class="sell-name">${m.name}</div><div class="sell-price-row"><span class="sell-price-num">${m.price.toLocaleString()}</span><span class="sell-price-curr">FCFA</span></div><div class="sell-ctrl">${inCart?`<div class="sell-stepper"><button class="sell-stepper-btn minus" onclick="App.cartQty('${m.id}',-1)">-</button><span class="sell-stepper-qty">${inCart}</span><button class="sell-stepper-btn plus" onclick="App.cartQty('${m.id}',1)">+</button></div>`:`<button class="sell-add-btn" onclick="App.cartQty('${m.id}',1)" ${out?'disabled':''}>${svgIcon('plus',20,20)}</button>`}</div></div></div>`;
    }, emptyHtml);
  }
  function setSellUnitFilter(u){ state.sellUnit = state.sellUnit === u ? 'all' : u; $$('#sell-unit-chips .chip[data-unit]').forEach(c=>c.classList.toggle('active',c.dataset.unit===state.sellUnit)); renderSell(); }
  function cartQty(id,delta){ const m=state.medicines.find(x=>x.id===id); if(!m)return; const isExpired=m.expiry&&daysUntil(m.expiry)<0; if(isExpired){toast('Expired medicine cannot be sold','err');return;} const curr=state.cart[id]||0; const next=curr+delta; if(next<=0)delete state.cart[id];else if(next>m.stock){toast('Not enough stock','err');return;}else state.cart[id]=next; renderSell(); updateFab(); }
  function updateFab(){ const total=Object.values(state.cart).reduce((a,b)=>a+b,0); const fab=$('#fab'); if(!fab)return; if(total>0){fab.classList.remove('hidden');$('#fab-badge').textContent=total;}else fab.classList.add('hidden'); }
  function openConfirm(){ const items=Object.entries(state.cart).map(([id,qty])=>{const m=state.medicines.find(x=>x.id===id);return{m,qty,total:qty*m.price};}); const grand=items.reduce((a,it)=>a+it.total,0); $('#confirm-total').textContent=fmtMoney(grand); $('#confirm-list').innerHTML=items.map(it=>`<div class="citem"><div class="citem-ph" style="width:40px;height:40px;border-radius:10px;background:var(--pl);color:var(--p);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">${initials(it.m.name)}</div><div class="citem-info"><div class="citem-name">${escapeHtml(it.m.name)} <span class="citem-dose">${escapeHtml(it.m.dose)}</span></div><div class="citem-sub">${it.qty} x ${fmtMoney(it.m.price)}</div></div><div class="citem-total">${fmtMoney(it.total)}</div></div>`).join(''); openSheet('sheet-confirm'); }

  async function confirmSale(){
    const items=Object.entries(state.cart).map(([id,qty])=>{
      const m=state.medicines.find(x=>x.id===id);
      if(!m) throw new Error('Medicine not found');
      return {medId:id,qty,price:m.price,name:m.name};
    });
    const total=items.reduce((a,it)=>a+it.qty*it.price,0);
    const sale={
      id:uid(),
      center_id:state.user?.center_id,
      date:new Date().toISOString(),
      items,total,
      sold_by:state.user?.name||'Unknown',
      seller_name:state.user?.name||'Unknown'
    };

    const stockBefore=new Map();
    items.forEach(it=>{
      const m=state.medicines.find(x=>x.id===it.medId);
      stockBefore.set(it.medId,m.stock);
      m.stock-=it.qty;
    });
    state.sales.unshift(sale);
    state.cart={};
    DB.save();
    analyticsCache.invalidate();

    closeSheet('sheet-confirm');
    updateFab(); renderStock(); renderSell(); renderRecords();
    toast('Sale confirmed: '+fmtMoney(total));

    if(db.isOnline()&&sale.center_id){
      try{
        const result=await db.createSaleAtomic(sale, state.user.center_id);
        if(Array.isArray(result)){
          result.forEach(row=>{
            const m=state.medicines.find(x=>x.id===row.med_id);
            if(m) m.stock=row.new_stock;
          });
        }
        DB.save(); renderStock(); renderSell();
      }catch(err){
        items.forEach(it=>{
          const m=state.medicines.find(x=>x.id===it.medId);
          if(m){
            const expected=stockBefore.get(it.medId)-it.qty;
            if(m.stock===expected)m.stock=stockBefore.get(it.medId);
          }
        });
        state.sales=state.sales.filter(s=>s.id!==sale.id);
        DB.save();
        updateFab(); renderStock(); renderSell(); renderRecords();
        toast('Sale failed: '+(err.message||'Server error'),'err');
      }
    }else{
      queuePending('sale',sale);
    }
  }

  function clearCart(){ state.cart={}; updateFab(); renderSell(); closeSheet('sheet-confirm'); }

  /* ILLNESSES */
  function renderIllnesses(){ const qel=$('#q-illness'); const q=(qel?qel.value:'').toLowerCase(); const list=$('#list-illness'); if(!list)return; const ills=state.illnesses.filter(i=>i.name.toLowerCase().includes(q));
    renderKeyed(list, ills, i=>i.id, i=>`<div class="icard" onclick="App.openIllDetail('${i.id}')"><div class="icard-icon">${svgIcon('syringe',22,22)}</div><div class="icard-info"><div class="icard-name">${escapeHtml(i.name)}</div><div class="icard-meta">${i.cures.length} cure medicine${i.cures.length!==1?'s':''}</div></div></div>`, `<div class="empty"><p>No illnesses found</p></div>`);
  }
  function openIllSheet(id=null){ if(!id&&!canManage())return toast('Only doctors can add illnesses','err'); $('#ill-id').value=id||''; const it=$('#ill-title'); if(it)it.textContent=id?'Edit Illness':t('addIllness'); if(id){const i=state.illnesses.find(x=>x.id===id);$('#ill-name').value=i.name;renderRefList(i.refs);}else{$('#ill-name').value='';renderRefList([]);} const im=$('#ill-meds'); if(im)im.innerHTML=state.medicines.map(m=>`<label class="check"><input type="checkbox" value="${escapeHtml(m.name)}" ${id&&(state.illnesses.find(x=>x.id===id)?.cures||[]).includes(m.name)?'checked':''}><span>${escapeHtml(m.name)}</span></label>`).join(''); openSheet('sheet-ill'); }
  function saveIll(){ if(!canManage())return toast('Only doctors can manage illnesses','err'); const id=$('#ill-id').value; const ill={id:id||uid(),name:sanitizeInput($('#ill-name').value,200),refs:(state._tempRefs||[]).map(r=>({...r,name:sanitizeInput(r.name,200)})),cures:Array.from($$('#ill-meds input:checked')).map(cb=>sanitizeInput(cb.value,200))}; if(!ill.name)return toast('Name required','err'); if(id){const idx=state.illnesses.findIndex(x=>x.id===id);state.illnesses[idx]=ill;}else state.illnesses.push(ill); state._tempRefs=[]; DB.save(); if(state.user?.center_id){ const payload={...ill,center_id:state.user.center_id}; if(db.isOnline()){ db.upsertIllness(payload,state.user.center_id).catch(()=>queuePending('illness',payload)); }else{ queuePending('illness',payload); } } closeSheet('sheet-ill'); renderIllnesses(); toast(id?'Updated':'Added'); }
  let tempRefs=[];
  function showRefForm(){ const rf=$('#ref-form'); if(rf)rf.classList.remove('hidden'); }
  function hideRefForm(){ const rf=$('#ref-form'); if(rf)rf.classList.add('hidden'); }
  function addRef(){ const name=sanitizeInput($('#ref-name').value,200); const price=parseInt($('#ref-price').value)||0; if(!name)return; tempRefs.push({name,price}); renderRefList(tempRefs); $('#ref-name').value='';$('#ref-price').value='';hideRefForm(); }
  function renderRefList(refs){ state._tempRefs=refs; const rl=$('#ref-list'); if(rl)rl.innerHTML=refs.map((r,i)=>`<div class="ref-item"><b>${escapeHtml(r.name)}</b><span>${r.price?fmtMoney(r.price):''}</span><button class="ref-rm" onclick="App.rmRef(${i})">x</button></div>`).join(''); }
  function rmRef(i){ tempRefs.splice(i,1); renderRefList(tempRefs); }
  function openIllDetail(id){ const i=state.illnesses.find(x=>x.id===id); if(!i)return; $('#ill-detail-title').textContent=escapeHtml(i.name); $('#ill-detail-sub').textContent=i.cures.length+' medicines'; const cures=i.cures.map(c=>{const m=state.medicines.find(x=>x.name===c);return m||{name:c,price:0,stock:0,unit:'-'};}); $('#ill-detail-list').innerHTML=cures.map(m=>`<div class="idetail"><div class="idetail-ph">${initials(m.name)}</div><div class="idetail-info"><div class="idetail-name">${escapeHtml(m.name)}</div><div class="idetail-price">${fmtMoney(m.price)}</div><div class="idetail-stock ${m.stock<=0?'out':m.stock<=state.lowAlert?'low':''}">${m.stock} ${escapeHtml(m.unit)} left</div></div></div>`).join(''); openSheet('sheet-ill-detail'); }

  /* SETTINGS */
  function renderSettings(){ if(!state.user)return; const sn=$('#set-name'),se=$('#set-email'),sa=$('#set-avatar'),sr=$('#set-role'),sal=$('#set-alert'),srec=$('#set-records'); if(sn)sn.textContent=escapeHtml(state.user.name); if(se)se.textContent=escapeHtml(state.user.email); if(sa)sa.textContent=initials(state.user.name); if(sr)sr.textContent=escapeHtml(state.user.role); if(sal)sal.value=state.lowAlert; if(srec)srec.textContent=state.sales.length; const staffRow=$('#staff-row'),roleRow=$('#role-row'),cmdRow=$('#command-row'); if(staffRow)staffRow.style.display=canManage()?'flex':'none'; if(roleRow)roleRow.style.display=state.user.role==='staff'?'flex':'none'; if(cmdRow)cmdRow.style.display=canManage()?'flex':'none'; const ls=$('#last-sync'); if(ls)ls.textContent=_lastSyncTime?fmtTime(new Date(_lastSyncTime)):'-'; }
  function openProfile(){ const u=state.user; if(!u)return; $('#prof-name').textContent=escapeHtml(u.name); $('#prof-center').textContent=escapeHtml(u.center||'-'); $('#prof-email').textContent=escapeHtml(u.email); $('#prof-avatar').textContent=initials(u.name); $('#kv-center').textContent=escapeHtml(u.center||'-'); $('#kv-name').textContent=escapeHtml(u.name); $('#kv-email').textContent=escapeHtml(u.email); $('#kv-date').textContent=fmtDate(u.date); openSheet('sheet-profile'); }
  function toggleLang(){ state.lang=state.lang==='en'?'fr':'en'; DB.save(); applyLang(); scheduleSave(); }
  function toggleTheme(){ const opts=['auto','light','dark']; const idx=(opts.indexOf(state.theme)+1)%3; const before=state.theme; state.theme=opts[idx]; DB.save(); applyTheme(); scheduleSave(); }
  function saveSettings(){ const sal=$('#set-alert'); const before=state.lowAlert; state.lowAlert=sal?(parseInt(sal.value)||10):10; scheduleSave(); toast('Settings saved'); }

  /* MANAGEMENT */
  async function openManagement(){ 
    openActivity('activity-management'); 
    const ars=$('#mgmt-ar-status'); 
    if(ars){ars.textContent=state.activityReport?'Enabled':'Disabled';ars.className='mgmt-status '+(state.activityReport?'enabled':'disabled');} 
    renderInService(); 
    if(db.isOnline() && state.user && canManage() && state.user.center_id){
      try{
        const remoteStaff = await db.fetchStaffByCenter(state.user.center_id);
        remoteStaff.forEach(rs=>{
          const local = state.staff.find(s=>s.id===rs.id);
          if(!local) state.staff.push(rs);
          else { local.approved = rs.approved; local.role = rs.role; local.name = rs.name; }
        });
        DB.save();
      }catch(e){ console.log('Staff sync failed', e); }
    }
  }
  function openStaffFromManagement(){ openActivity('activity-staff'); renderStaffList(); }
  function renderStaffList(){ const sl=$('#staff-list'); if(!sl)return;
    renderKeyed(sl, state.staff, s=>s.id, s=>`<div class="swipe staff-swipe" id="staff-swipe-${s.id}"><div class="swipe-actions staff-swipe-actions"><button class="swipe-act settings" onclick="App.openStaffDetail('${s.id}')" aria-label="Settings">${svgIcon('settings',22,22)}</button></div><div class="swipe-content"><div class="scard staff-card" style="cursor:pointer" onclick="App.openStaffDetail('${s.id}')"><span class="staff-badge ${s.approved?'approved':'pending'}">${s.approved?'Approved':'Pending'}</span><div class="scard-top"><div class="scard-ph">${initials(s.name)}</div><div class="scard-info"><div class="scard-name">${escapeHtml(s.name)}</div><div class="scard-row"><span class="tag">${escapeHtml(s.role)}</span></div></div></div></div></div></div>`, '');
  }
  async function openStaffDetail(id){ 
    const s=state.staff.find(x=>x.id===id); 
    if(!s)return; 
    $('#sd-avatar').textContent=initials(s.name); 
    $('#sd-name').textContent=escapeHtml(s.name); 
    const sdStatus=$('#sd-status'); 
    sdStatus.textContent=s.approved?'Approved':'Pending'; 
    sdStatus.className='sd-status-badge '+(s.approved?'approved':'pending'); 
    $('#sd-email').textContent=escapeHtml(s.email); 
    $('#sd-role').textContent=escapeHtml(s.role); 
    $('#sd-date').textContent=fmtDate(s.date); 
    const btn=$('#sd-revoke-btn'); 
    const canEditStaff = canManage() && s.id!==state.user.id;
    if(!canEditStaff){btn.style.display='none';}
    else{
      btn.style.display='block';
      btn.textContent=s.approved?t('revoke'):'Approve';
      btn.className='btn sd-revoke-btn '+(s.approved?'btn-ghost':'btn-prime'); 
      btn.onclick=async ()=>{
        const beforeApproved=s.approved; 
        s.approved=!s.approved; 
        if(db.isOnline()){
          try{ await db.updateApproval(s.id, s.approved); }
          catch(e){ s.approved=beforeApproved; toast('Sync failed','err'); return; }
        }
        DB.save(); 
        closeSheet('sheet-staff-detail'); 
        renderStaffList(); 
        toast(s.approved?'Approved':'Revoked'); 
      };
    } 
    openSheet('sheet-staff-detail'); 
  }
  function renderInService(){ const isl=$('#in-service-list'); if(!isl)return;
    renderKeyed(isl, state.inService, u=>u.id, u=>`<div class="in-service-item"><div class="in-service-avatar">${initials(u.name)}</div><div class="in-service-info"><div class="in-service-name">${escapeHtml(u.name)}</div><div class="in-service-time">Since ${fmtTime(u.since)}</div></div><div class="in-service-dot"></div></div>`, '<p class="sub" style="padding:12px">No one in service</p>');
  }
  function openActivityReport(){ openSheet('sheet-activity-report'); const btn=$('#ar-toggle-btn'); if(btn)btn.textContent=state.activityReport?'Deactivate':t('activate'); }
  function toggleActivityReport(){ const before=state.activityReport; state.activityReport=!state.activityReport; DB.save(); closeSheet('sheet-activity-report'); openManagement(); toast(state.activityReport?'Activity Report ON':'Activity Report OFF'); }

  /* RECORDS */
  async function openRecords(){ state.salesPage=0; state.returnsPage=0; state.hasMoreSales=true; state.hasMoreReturns=true;
    openActivity('activity-records');
    renderRecords();
    if(state.user?.center_id && db.isOnline()){
      db.fetchSalesSnapshot(state.user.center_id).then(remoteSales=>{
        const existingIds=new Set(state.sales.map(s=>s.id));
        let added=false;
        remoteSales.forEach(rs=>{
          if(!existingIds.has(rs.id)){state.sales.push(rs);added=true;}
        });
        if(added){state.sales.sort((a,b)=>new Date(b.date)-new Date(a.date));DB.save();renderRecords();}
      }).catch(()=>{});
      db.fetchReturnsSnapshot(state.user.center_id).then(remoteReturns=>{
        const existingRetIds=new Set(state.returns.map(r=>r.id));
        let retAdded=false;
        remoteReturns.forEach(rr=>{
          if(!existingRetIds.has(rr.id)){state.returns.push(rr);retAdded=true;}
        });
        if(retAdded){state.returns.sort((a,b)=>new Date(b.date)-new Date(a.date));DB.save();renderRecords();}
      }).catch(()=>{});
    }
  }
  function setRecTab(tab){ state.recTab=tab; $$('#rec-tabs .rec-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); renderRecords(); }
  function renderRecords(){ const summary=$('#rec-summary'); const list=$('#rec-list'); if(!summary||!list)return;
    if(state.recTab==='sales'){ const totalSales=state.sales.reduce((a,s)=>a+s.total,0); const totalItems=state.sales.reduce((a,s)=>a+s.items.reduce((b,it)=>b+it.qty,0),0); summary.innerHTML=`<div class="sum-card"><b>${state.sales.length}</b><span>Sales</span></div><div class="sum-card"><b>${fmtNum(totalSales)}</b><span>Total</span></div><div class="sum-card"><b>${totalItems}</b><span>Items</span></div>`;
      renderKeyed(list, state.sales, s=>s.id, s=>`<div class="rcard" onclick="App.openRecordDetail('${s.id}')"><div class="rcard-icon">${svgIcon('cart',20,20)}</div><div class="rcard-info"><div class="rcard-date">${fmtDate(s.date)}</div><div class="rcard-meta">${s.items.length} items · ${s.seller_name||s.sold_by||'Unknown'}</div></div><div class="rcard-total">${fmtMoney(s.total)}</div></div>`, '<div class="empty">No sales yet</div>');
      if(state.hasMoreSales && !list.querySelector('.btn-load-more')){ list.insertAdjacentHTML('beforeend',`<button class="btn-load-more" onclick="App.loadMoreSales()">Load More</button>`); }
    }else if(state.recTab==='returns'){ const totalRefunded=state.returns.reduce((a,r)=>a+r.refundTotal,0); const totalRetItems=state.returns.reduce((a,r)=>a+r.items.reduce((b,it)=>b+it.qty,0),0); summary.innerHTML=`<div class="sum-card"><b>${state.returns.length}</b><span>Returns</span></div><div class="sum-card"><b>${fmtNum(totalRefunded)}</b><span>Total</span></div><div class="sum-card"><b>${totalRetItems}</b><span>Items</span></div>`;
      renderKeyed(list, state.returns, r=>r.id, r=>`<div class="rcard" onclick="App.openReturnDetail('${r.id}')"><div class="rcard-icon return-icon">${svgIcon('return',20,20)}</div><div class="rcard-info"><div class="rcard-date">${fmtDate(r.date)}</div><div class="rcard-meta">${r.items.length} items · ${r.returnedByName||r.returnedBy||'Unknown'}</div></div><div class="rcard-total" style="color:var(--danger)">-${fmtMoney(r.refundTotal)}</div></div>`, '<div class="empty">'+t('noReturns')+'</div>');
      if(state.hasMoreReturns && !list.querySelector('.btn-load-more')){ list.insertAdjacentHTML('beforeend',`<button class="btn-load-more" onclick="App.loadMoreReturns()">Load More</button>`); }
    }else{
      const cache = analyticsCache.get();
      summary.innerHTML=`<div class="sum-card"><b>${cache.netCount}</b><span>Sold</span></div><div class="sum-card"><b>${fmtNum(cache.netRevenue)}</b><span>Revenue</span></div><div class="sum-card"><b>${cache.netItems}</b><span>Items</span></div>`;
      list.innerHTML=`<div class="analytics-section"><div class="analytics-title">${t('tabAnalytics')}</div><div class="analytics-subtitle">Revenue (${cache.monthName})</div><div class="analytics-bars">${cache.days.map(d=>{ const dt=new Date(cache.year,cache.month,d); const label=dt.toLocaleDateString(state.lang==='fr'?'fr-FR':'en-US',{weekday:'short',day:'numeric'}); return `<div class="analytics-bar-wrap"><div class="analytics-bar-track"><div class="analytics-bar-fill" style="height:${(cache.daily[d]/cache.max*100).toFixed(0)}%"></div></div><span class="analytics-bar-val">${fmtNum(cache.daily[d])}</span><span class="analytics-bar-label">${label}</span></div>`; }).join('')}</div></div><div class="analytics-section"><div class="analytics-subtitle">Top Medicines</div><div class="analytics-top-list">${cache.topMeds.map((m,i)=>`<div class="analytics-top-item"><div class="analytics-top-rank">${i+1}</div><div class="analytics-top-name">${m.name}</div><div class="analytics-top-qty">${m.qty} sold</div><div class="analytics-top-rev">${fmtMoney(m.rev)}</div></div>`).join('')}</div></div>`;
    }
  }
  async function loadMoreSales(){ if(!state.user?.center_id||!state.hasMoreSales)return; state.salesPage++; try{ const more=await db.fetchSalesSnapshot(state.user.center_id,state.salesPage); if(more.length<state.pageSize)state.hasMoreSales=false; state.sales.push(...more); state.sales.sort((a,b)=>new Date(b.date)-new Date(a.date)); DB.save(); renderRecords(); }catch(e){ toast('Failed to load more','err'); } }
  async function loadMoreReturns(){ if(!state.user?.center_id||!state.hasMoreReturns)return; state.returnsPage++; try{ const more=await db.fetchReturnsSnapshot(state.user.center_id,state.returnsPage); if(more.length<state.pageSize)state.hasMoreReturns=false; state.returns.push(...more); state.returns.sort((a,b)=>new Date(b.date)-new Date(a.date)); DB.save(); renderRecords(); }catch(e){ toast('Failed to load more','err'); } }
  function openRecordDetail(id){ const s=state.sales.find(x=>x.id===id); if(!s)return; $('#rd-date').textContent=fmtDate(s.date); $('#rd-time').textContent=fmtTime(s.date)+' · '+escapeHtml(s.seller_name||s.sold_by||'Unknown'); $('#rd-total').textContent=fmtMoney(s.total); $('#rd-list').innerHTML=s.items.map(it=>{const m=state.medicines.find(x=>x.id===it.medId);return `<div class="rd-item"><div class="rd-ph">${initials(m?m.name:'?')}</div><div class="rd-info"><div class="rd-name">${escapeHtml(m?m.name:'Unknown')} <span class="rd-dose">${escapeHtml(m?m.dose:'')}</span></div><div class="rd-sub">${it.qty} x ${fmtMoney(it.price)}</div></div><div class="rd-total">${fmtMoney(it.qty*it.price)}</div></div>`;}).join(''); const tl=timeLeftMs(s.date); const alreadyReturned=isSaleReturned(s.id); const canReturn=tl>0&&!alreadyReturned; const isSeller=(s.seller_name||s.sold_by||'')===(state.user?.name||''); const returnBtn=$('#rd-return-btn'); if(returnBtn){ returnBtn.style.display=(canReturn&&isSeller)?'block':'none'; returnBtn.textContent=alreadyReturned?t('returned'):t('returnSale')+(canReturn?' ('+Math.floor(tl/3600000)+'h '+Math.floor((tl%3600000)/60000)+'m)':''); returnBtn.onclick=()=>openReturnSheet(s.id); } openSheet('sheet-record'); }

  /* RETURNS (5h window) */
  async function openReturnSheet(saleId){ const s=state.sales.find(x=>x.id===saleId); if(!s)return;
  const isSeller=(s.seller_name||s.sold_by||'')===(state.user?.name||'');
  if(!isSeller)return toast('Only the seller can return this sale','err');
  if(isSaleReturned(saleId))return toast('This sale has already been returned','err');
  let serverNow; if(db.isOnline()){ try{ serverNow=await db.getServerTime(); }catch(e){ serverNow=new Date().toISOString(); } }else{ serverNow=new Date().toISOString(); } const tl=new Date(s.date).getTime()+RETURN_WINDOW_MS-new Date(serverNow).getTime(); if(tl<=0)return toast(t('returnExpired'),'err'); state._returnSale=s; $('#return-sale-id').value=saleId; $('#return-title').textContent=t('processReturn'); $('#return-list').innerHTML=s.items.map((it,idx)=>{const m=state.medicines.find(x=>x.id===it.medId); const already=getReturnedQty(saleId,it.medId); const maxRet=it.qty-already; return `<div class="return-item" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:12px;margin-bottom:8px"><div class="rd-ph">${initials(m?m.name:'?')}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">${escapeHtml(m?m.name:'Unknown')} <span class="rd-dose">${escapeHtml(m?m.dose:'')}</span></div><div style="font-size:12px;color:var(--muted)">${it.qty} x ${fmtMoney(it.price)} ${already>0?'<span style="color:var(--danger)">('+already+' returned)</span>':''}</div></div><input type="number" class="cmd-qty" id="return-qty-${idx}" value="" placeholder="0" min="0" max="${maxRet}" style="width:60px" onchange="App.updateReturnTotal()"></div>`;}).join(''); $('#return-reason').innerHTML=[t('wrongMedicine'),t('allergic'),t('changedPrescription'),t('expired'),t('other')].map((r,i)=>`<label class="check" style="padding:10px 14px"><input type="radio" name="return-reason" value="${r}" ${i===0?'checked':''}><span>${r}</span></label>`).join(''); $('#return-restock-wrap').innerHTML=''; updateReturnTotal(); openSheet('sheet-return'); }
  function updateReturnTotal(){ const s=state._returnSale; if(!s)return; let total=0; s.items.forEach((it,idx)=>{const qel=document.getElementById('return-qty-'+idx); const q=parseInt(qel?qel.value:0)||0; total+=q*it.price;}); $('#return-total').textContent=fmtMoney(total); }
  async function submitReturn(){ const s=state._returnSale; if(!s)return; if(isSaleReturned(s.id))return toast('This sale has already been returned','err'); const reasonEl=$('input[name="return-reason"]:checked'); const reason=reasonEl?reasonEl.value:''; let refundTotal=0; const returnItems=[]; const stockBefore=new Map(); s.items.forEach((it,idx)=>{const qel=document.getElementById('return-qty-'+idx); const q=parseInt(qel?qel.value:0)||0; const already=getReturnedQty(s.id,it.medId); const maxAllowed=it.qty-already; if(q>maxAllowed){ toast('Cannot return more than sold for '+it.name,'err'); return; } if(q>0){ refundTotal+=q*it.price; returnItems.push({medId:it.medId,qty:q,price:it.price,reason}); const m=state.medicines.find(x=>x.id===it.medId); if(m){ stockBefore.set(it.medId,m.stock); m.stock+=q;} } }); if(!returnItems.length){return toast('Select items to return','err');} const retId=uid(); const retObj={id:retId,originalSaleId:s.id,date:new Date().toISOString(),items:returnItems,refundTotal,returnedBy:state.user.id,returnedByName:sanitizeInput(state.user.name,200),reason:sanitizeInput(reason,500)}; state.returns.unshift(retObj); state._returnSale=null; DB.save(); closeSheet('sheet-return'); closeSheet('sheet-record'); renderRecords(); renderStock(); toast(t('returned')+': '+fmtMoney(refundTotal)); if(db.isOnline()&&state.user?.center_id){ try{ await db.createReturn(retObj,state.user.center_id); }catch(err){ queuePending('return',retObj); } }else if(state.user?.center_id){ queuePending('return',retObj); } }
  function openReturnDetail(id){ const r=state.returns.find(x=>x.id===id); if(!r)return; $('#rd-date').textContent=fmtDate(r.date); $('#rd-time').textContent=fmtTime(r.date)+' · Returned by '+escapeHtml(r.returnedByName||r.returnedBy||'Unknown'); $('#rd-total').textContent='-'+fmtMoney(r.refundTotal); $('#rd-list').innerHTML=`<div style="text-align:center;margin-bottom:16px;"><button class="btn btn-ghost" onclick="App.openRecordDetail('${r.originalSaleId}')" style="width:auto;display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:10px 18px;">${svgIcon('cart',16,16)} Original Sale</button></div>`+r.items.map(it=>{const m=state.medicines.find(x=>x.id===it.medId);return `<div class="rd-item"><div class="rd-ph">${initials(m?m.name:'?')}</div><div class="rd-info"><div class="rd-name">${escapeHtml(m?m.name:'Unknown')} <span class="rd-dose">${escapeHtml(m?m.dose:'')}</span></div><div class="rd-sub">${it.qty} x ${fmtMoney(it.price)} · ${escapeHtml(it.reason||'')}</div></div><div class="rd-total">-${fmtMoney(it.qty*it.price)}</div></div>`;}).join(''); const returnBtn=$('#rd-return-btn'); if(returnBtn)returnBtn.style.display='none'; openSheet('sheet-record'); }

  /* COMMAND / ORDERS */
  function openCommand(){ openActivity('activity-command'); renderCommand(); }
  function closeCommand(){ closeActivity('activity-command'); }
  function setCommandTab(tab){ 
    state.cmdTab=tab; 
    $$('#cmd-swipe-indicator .cmd-dot').forEach(d=>d.classList.toggle('active',d.dataset.tab===tab)); 
    const track=$('#cmd-track');
    if(track){
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      track.style.transform = tab==='new' ? 'translateX(0%)' : 'translateX(-50%)';
    }
    renderCommand(); 
  }
  function renderCommand(){
    if(state.cmdTab==='new'){
      const qel=$('#q-command');
      const q=(qel?qel.value:'').toLowerCase();
      const cl=$('#command-list');
      if(!cl)return;
      const meds=state.listings.filter(m=>{
        const matchesName=m.name.toLowerCase().includes(q);
        const matchesUnit=state.cmdUnitFilter==='all'||m.unit===state.cmdUnitFilter;
        return matchesName&&matchesUnit;
      });
      cl.innerHTML=meds.map(m=>{const qty=state.cmdCart[m.id]||0; return `<div class="cmd-card ${qty?'in-cart':''}"><div class="cmd-ph">${initials(m.name)}</div><div class="cmd-info"><div class="cmd-name">${escapeHtml(m.name)}</div><div class="cmd-dose">${escapeHtml(m.dose)}</div></div><div class="cmd-price-badge">${fmtMoney(m.price)}</div><input type="number" class="cmd-qty" value="${qty||''}" placeholder="0" min="0" onchange="App.setCmdQty('${m.id}',this.value)"></div>`;}).join('');
      const totalItems=Object.values(state.cmdCart).reduce((a,b)=>a+b,0);
      const fab=$('#cmd-fab');
      if(fab){if(totalItems>0){fab.classList.remove('hidden');$('#cmd-fab-badge').textContent=totalItems;}else fab.classList.add('hidden');}
    }else{
      const col=$('#command-orders-list');
      if(!col)return;
      const statusLabel={pending:'Pending',processing:'Processing',completed:'Completed',cancelled:'Cancelled',received:'Received'};
      col.innerHTML=state.orders.map(o=>{
        const label=statusLabel[o.status]||o.status;
        const canReceive=o.status==='delivered';
        return `<div class="cmd-order-card ${o.status==='received'?'received':''}"><div class="cmd-order-header"><span class="cmd-order-date">${fmtDate(o.date)}</span><span class="cmd-order-status ${o.status}">${label}</span></div><div class="cmd-order-items-list">${o.items.map(it=>{const m=state.medicines.find(x=>x.id===it.medId); const listing=state.listings.find(x=>x.id===it.medId); const name=m?m.name:(it.name||'Unknown'); const dose=m?m.dose:(it.dose||''); return `<div class="cmd-order-item"><div class="cmd-item-ph">${initials(name)}</div><div class="cmd-item-info"><div class="cmd-item-name">${escapeHtml(name)}</div><div class="cmd-item-dose">${escapeHtml(dose)}</div></div></div>`;}).join('')}</div><div class="cmd-order-footer"><div class="cmd-order-total"><span>Total</span><b>${fmtMoney(o.total)}</b></div>${canReceive?`<button class="cmd-received-btn" onclick="App.receiveOrder('${o.id}')">Received</button>`:''}</div></div>`;
      }).join('')||'<div class="empty">No orders yet</div>';
    }
  }
  function setCmdUnitFilter(unit){ state.cmdUnitFilter = state.cmdUnitFilter === unit ? 'all' : unit; $$('#cmd-chips .chip[data-unit]').forEach(c=>c.classList.toggle('active',c.dataset.unit===state.cmdUnitFilter)); renderCommand(); }
  function toggleStockSearch(){ const wrap=$('#stock-search-wrap'); const chip=$('#stock-search-chip'); if(!wrap)return; wrap.classList.toggle('hidden'); if(wrap.classList.contains('hidden')){ $('#q-stock').value=''; if(chip)chip.classList.remove('active-search'); }else{ setTimeout(()=>$('#q-stock').focus(),50); if(chip)chip.classList.add('active-search'); } renderStock(); }
  function toggleSellSearch(){ const wrap=$('#sell-search-wrap'); const chip=$('#sell-search-chip'); if(!wrap)return; wrap.classList.toggle('hidden'); if(wrap.classList.contains('hidden')){ $('#q-sell').value=''; if(chip)chip.classList.remove('active-search'); }else{ setTimeout(()=>$('#q-sell').focus(),50); if(chip)chip.classList.add('active-search'); } renderSell(); }
  function toggleCmdSearch(){ const wrap=$('#cmd-search-wrap'); const chip=$('#cmd-search-chip'); if(!wrap)return; wrap.classList.toggle('hidden'); if(wrap.classList.contains('hidden')){ $('#q-command').value=''; if(chip)chip.classList.remove('active-search'); }else{ setTimeout(()=>$('#q-command').focus(),50); if(chip)chip.classList.add('active-search'); } renderCommand(); }
  function setCmdQty(id,val){ const v=parseInt(val)||0; if(v<=0)delete state.cmdCart[id];else state.cmdCart[id]=v; renderCommand(); }
  function openOrderConfirm(){ const items=Object.entries(state.cmdCart).map(([id,qty])=>{const m=state.listings.find(x=>x.id===id);if(!m)return null;return{m,qty,total:qty*m.price};}).filter(Boolean); const grand=items.reduce((a,it)=>a+it.total,0); $('#cmd-confirm-total').textContent=fmtMoney(grand); $('#cmd-confirm-list').innerHTML=items.map(it=>`<div class="citem"><div class="citem-ph" style="width:40px;height:40px;border-radius:10px;background:var(--pl);color:var(--p);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">${initials(it.m.name)}</div><div class="citem-info"><div class="citem-name">${escapeHtml(it.m.name)}</div><div class="citem-sub">${it.qty} x ${fmtMoney(it.m.price)}</div></div><div class="citem-total">${fmtMoney(it.total)}</div></div>`).join(''); const ok=grand>=5000; const mh=$('#cmd-min-hint'); if(mh)mh.style.display=ok?'none':'block'; const sb=$('#cmd-submit-btn'); if(sb)sb.disabled=!ok; openSheet('sheet-command-confirm'); }
  async function submitOrder(){ const items=Object.entries(state.cmdCart).map(([id,qty])=>{const m=state.listings.find(x=>x.id===id);if(!m)return null;return{medId:id,qty,price:m.price,name:m.name,dose:m.dose};}).filter(Boolean); const total=items.reduce((a,it)=>a+it.qty*it.price,0); if(total<5000)return toast('Minimum 5,000 FCFA','err'); const oid=uid(); const order={id:oid,date:new Date().toISOString(),items,total,status:'pending'}; state.orders.unshift(order); state.cmdCart={}; DB.save(); closeSheet('sheet-command-confirm'); renderCommand(); toast('Order placed: '+fmtMoney(total)); if(db.isOnline()&&state.user?.center_id){ try{ const result=await db.createOrder(order,state.user.center_id,state.user.name); if(result&&result.id){ state.orders=state.orders.filter(o=>o.id!==result.id); order.id=result.id; DB.save(); renderCommand(); } }catch(err){ console.error('Order sync failed:', err); toast('Order saved offline: '+err.message,'err'); queuePending('order',order); } }else if(state.user?.center_id){ queuePending('order',order); } }
  function receiveOrder(id){ const o=state.orders.find(x=>x.id===id); if(!o)return; state._receiveOrder=o; openActivity('activity-receive'); const rc=$('#receive-container'); if(rc)rc.innerHTML=o.items.map(it=>{const m=state.medicines.find(x=>x.id===it.medId)||state.listings.find(x=>x.id===it.medId); const listing=state.listings.find(x=>x.id===it.medId); const mult=listing?listing.multiplier:1; const totalUnits=it.qty*(mult||1); const cost=Math.round((it.qty*it.price)/totalUnits); const name=m?m.name:(it.name||'Unknown'); const dose=m?m.dose:(it.dose||''); return `<div class="recv-card"><div class="recv-header"><div class="recv-avatar">${initials(name)}</div><div class="recv-info"><div class="recv-name">${escapeHtml(name)}</div><div class="recv-dose">${escapeHtml(dose)}</div></div></div><div class="recv-inputs"><div class="recv-field"><label>Sell Price</label><input type="number" class="recv-input" id="recv-price-${it.medId}" value="${m?m.price:(it.price||'')}" placeholder="0"></div><div class="recv-field"><label>Cost</label><input type="number" class="recv-input" id="recv-cost-${it.medId}" value="${cost}" placeholder="0" readonly tabindex="-1" style="background:var(--bg);opacity:.7;cursor:not-allowed"></div></div></div>`;}).join(''); }
  async function saveReceivePrices(){ const o=state._receiveOrder; if(!o)return; const updatedMeds=[]; o.items.forEach(it=>{ let m=state.medicines.find(x=>x.id===it.medId); const listing=state.listings.find(x=>x.id===it.medId); const mult=listing?listing.multiplier:1; const addStock=it.qty*(mult||1); const newPrice=parseInt(document.getElementById('recv-price-'+it.medId).value)||(m?m.price:it.price)||0; const newCost=parseInt(document.getElementById('recv-cost-'+it.medId).value)||0; if(!m){ m={ id:it.medId, name:listing?listing.name:(it.name||'Unknown'), dose:listing?listing.dose:(it.dose||''), price:newPrice, cost:newCost, stock:addStock, unit:listing?listing.unit:'pieces', batch:listing?listing.batch:'', expiry:listing?listing.expiry:null, ills:[], updated_at:new Date().toISOString() }; state.medicines.push(m); }else{ m.price=newPrice; m.cost=newCost; m.stock+=addStock; m.updated_at=new Date().toISOString(); } updatedMeds.push({...m,center_id:state.user.center_id}); }); o.status='completed'; state._receiveOrder=null; DB.save(); if(db.isOnline()&&state.user?.center_id){ try{ for(const med of updatedMeds){ await db.upsertMedicine(med,state.user.center_id); } await db.updateOrderStatus(o.id,'completed',state.user.center_id); }catch(err){ console.error('Receive sync failed:',err); updatedMeds.forEach(m=>queuePending('medicine',m)); queuePending('order_status',{orderId:o.id,status:'completed',center_id:state.user.center_id}); } }else if(state.user?.center_id){ updatedMeds.forEach(m=>queuePending('medicine',m)); queuePending('order_status',{orderId:o.id,status:'completed',center_id:state.user.center_id}); } closeActivity('activity-receive'); renderCommand(); renderStock(); toast('Order received & stock updated'); }
  function closeReceiveSetup(){ closeActivity('activity-receive'); state._receiveOrder=null; }

  /* COMMAND SWIPE GESTURE */
  function initCommandSwipe(){
    const slider = document.querySelector('.cmd-slider');
    const track = $('#cmd-track');
    if(!slider || !track) return;
    
    // Set initial position
    track.style.transform = state.cmdTab === 'new' ? 'translateX(0%)' : 'translateX(-50%)';
    
    let startX = 0, startY = 0, swiping = false, isHorizontal = false;
    const getWidth = () => slider.offsetWidth;
    
    slider.addEventListener('touchstart', e => {
      // Don't capture if touching chips, inputs, or buttons
      if(e.target.closest('.chips') || e.target.closest('input') || e.target.closest('button')) return;
      
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
      isHorizontal = false;
      track.style.transition = 'none';
    }, {passive: true});
    
    slider.addEventListener('touchmove', e => {
      if(!swiping) return;
      
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      
      // First movement: determine direction
      if(!isHorizontal) {
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        
        if(Math.abs(dx) > Math.abs(dy) * 0.8) {
          isHorizontal = true;
        } else {
          swiping = false;
          return;
        }
      }
      
      // Horizontal swipe confirmed - stop browser from interfering
      e.preventDefault();
      
      const baseOffset = state.cmdTab === 'new' ? 0 : -50;
      const percent = baseOffset + (dx / getWidth()) * 50;
      const clamped = Math.max(-55, Math.min(5, percent));
      track.style.transform = `translateX(${clamped}%)`;
    }, {passive: false});
    
    slider.addEventListener('touchend', e => {
      if(!swiping) return;
      swiping = false;
      
      if(!isHorizontal) return;
      
      const dx = e.changedTouches[0].clientX - startX;
      const width = getWidth();
      const threshold = Math.max(50, width * 0.15);
      
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      
      if(Math.abs(dx) > threshold) {
        if(dx < 0 && state.cmdTab === 'new') setCommandTab('history');
        else if(dx > 0 && state.cmdTab === 'history') setCommandTab('new');
        else setCommandTab(state.cmdTab);
      } else {
        setCommandTab(state.cmdTab);
      }
    }, {passive: true});
    
    slider.addEventListener('touchcancel', () => {
      swiping = false;
      isHorizontal = false;
      track.style.transition = 'transform .35s cubic-bezier(.32,.72,0,1)';
      setCommandTab(state.cmdTab);
    }, {passive: true});
  }

  /* CHECK-IN */
  function onCheckInToggle(){ const cb=$('#checkin-toggle'); const btn=$('#checkin-btn'); if(btn)btn.disabled=!cb.checked; }
  function confirmCheckIn(){ const cb=$('#checkin-toggle'); if(!cb||!cb.checked)return; state.checkIn=true; if(!state.inService.find(u=>u.id===state.user.id))state.inService.push({id:state.user.id,name:state.user.name,since:Date.now()}); DB.save(); if(state.user?.center_id){ if(db.isOnline()){ db.logActivity({userId:state.user.id,userName:state.user.name,action:'check_in',metadata:{}},state.user.center_id).catch(()=>{}); } } $('#checkin-overlay').style.display='none'; toast('Checked in!'); }


  /* SUPPLIERS */
  function openSuppliers(){ openActivity('activity-suppliers'); renderSuppliers(); }
  function renderSuppliers(){ const list=$('#supplier-list'); if(!list)return;
    renderKeyed(list, state.suppliers||[], s=>s.id, s=>`<div class="supplier-card" onclick="App.openSupplierSheet('${s.id}')"><div class="supplier-name">${s.name}</div><div class="supplier-meta">${s.address||''}</div><div class="supplier-contact">${s.contact||''}</div></div>`, '<div class="empty">No suppliers yet</div>');
  }
  function openSupplierSheet(id=null){ $('#supplier-id').value=id||''; $('#supplier-title').textContent=id?'Edit Supplier':'Add Supplier'; if(id){const s=state.suppliers?.find(x=>x.id===id); if(s){$('#supplier-name').value=s.name;$('#supplier-contact').value=s.contact||'';$('#supplier-email').value=s.email||'';$('#supplier-address').value=s.address||'';}}else{$('#supplier-name').value='';$('#supplier-contact').value='';$('#supplier-email').value='';$('#supplier-address').value='';} openSheet('sheet-supplier'); }
  function saveSupplier(){ const id=$('#supplier-id').value; const s={id:id||uid(),name:sanitizeInput($('#supplier-name').value,200),contact:sanitizeInput($('#supplier-contact').value,200),email:sanitizeInput($('#supplier-email').value,320),address:sanitizeInput($('#supplier-address').value,500)}; if(!s.name)return toast('Name required','err'); if(!state.suppliers) state.suppliers=[]; if(id){const idx=state.suppliers.findIndex(x=>x.id===id);state.suppliers[idx]=s;}else state.suppliers.push(s); DB.save(); closeSheet('sheet-supplier'); renderSuppliers(); toast(id?'Updated':'Added'); }

  /* ─── PENDING QUEUE ─── */
  let _pendingOpsCache=null; async function _getPending(){ if(_pendingOpsCache!==null)return _pendingOpsCache; _pendingOpsCache=await IDB.get('parazzi_pending')||[]; return _pendingOpsCache; } async function _setPending(ops){ _pendingOpsCache=ops; await IDB.set('parazzi_pending',ops); }

  async function queuePending(type,payload){
    const ops=await _getPending();
    ops.push({type,payload,ts:Date.now(),retries:0});
    await _setPending(ops);
  }

  async function flushPendingByType(type){
    const pendingOps=await _getPending();
    if(!db.isOnline()||pendingOps.length===0||!state.user?.center_id)return;
    const toFlush=pendingOps.filter(o=>o.type===type);
    const rest=pendingOps.filter(o=>o.type!==type);
    const failed=[];
    for(const op of toFlush){
      try{
        if(op.type==='sale'){
          await db.createSaleAtomic(op.payload, state.user.center_id);
        }else if(op.type==='medicine'){
          await db.upsertMedicine(op.payload, state.user.center_id);
        }else if(op.type==='delete'){
          await db.deleteMedicine(op.payload.id,op.payload.center_id);
        }else if(op.type==='illness'){
          await db.upsertIllness(op.payload, state.user.center_id);
        }else if(op.type==='return'){
          await db.createReturn(op.payload, state.user.center_id);
        }else if(op.type==='order'){
          await db.createOrder(op.payload, state.user.center_id, state.user.name);
        }else if(op.type==='order_status'){
          await db.updateOrderStatus(op.payload.orderId, op.payload.status, op.payload.center_id);
        }
      }catch(e){
        op.retries++;
        const msg=e.message||'';
        if(msg.includes('Insufficient stock')){
          toast('Offline sale failed: stock changed while away','err');
          failed.push({...op,failedReason:msg});
        }else if(op.retries<5){
          failed.push(op);
        }else{
          toast('Sync failed: '+msg,'err');
        }
      }
    }
    await _setPending([...rest,...failed]);
    if(failed.length)renderStock();
  }

  async function flushAllPending(){
    if(!db.isOnline())return;
    await flushPendingByType('medicine');
    await flushPendingByType('illness');
    await flushPendingByType('sale');
    await flushPendingByType('return');
    await flushPendingByType('order_status');
    await flushPendingByType('soft_delete');
  }

  let _lastSyncTime=0;
  function reconcileSnapshot(remoteMeds){
    remoteMeds.forEach(rm=>{
      const idx=state.medicines.findIndex(m=>m.id===rm.id);
      if(idx!==-1)state.medicines[idx]=rm;
      else state.medicines.push(rm);
    });
    DB.save();
    renderStock();renderSell();
    _lastSyncTime=Date.now();
  }

  /* ═══ INIT — PERFORMANCE OPTIMIZED ═══ */
  function initApp(){
    applyTheme(); applyLang();
      updateOnlineStatus();

      const stockAdd = document.getElementById('stock-add-btn');
      const illAdd = document.getElementById('illness-add-btn');
      if(stockAdd) stockAdd.style.display = canManage() ? 'inline-flex' : 'none';
      if(illAdd) illAdd.style.display = canManage() ? 'inline-flex' : 'none';

      if(state.user?.center_id){
      db.subscribeToMedicines(state.user.center_id,(payload)=>{
        const {new:remote,eventType}=payload;
        if(!remote)return;
        if(eventType==='DELETE'){
          state.medicines=state.medicines.filter(m=>m.id!==remote.id);
        }else{
          const idx=state.medicines.findIndex(m=>m.id===remote.id);
          if(idx!==-1){
            const editing=document.getElementById('sheet-med').classList.contains('show')&&document.getElementById('med-id').value===remote.id;
            if(!editing)state.medicines[idx]=remote;
          }else{
            state.medicines.push(remote);
          }
        }
        DB.save();
        renderStock();renderSell();
      });
      db.subscribeToSales(state.user.center_id,(payload)=>{
        const {new:remote,eventType}=payload;
        if(!remote||eventType!=='INSERT')return;
        if(!state.sales.find(s=>s.id===remote.local_sale_id)){
          state.sales.unshift({
            id:remote.local_sale_id,
            center_id:remote.center_id,
            date:remote.date,
            items:remote.items,
            total:remote.total,
            seller_name:remote.seller_name
          });
          DB.save();
          if(document.getElementById('activity-records').classList.contains('show'))renderRecords();
        }
      });
      db.subscribeToOrders(state.user.center_id,(payload)=>{
        const {new:remote,eventType}=payload;
        if(!remote)return;
        const idx=state.orders.findIndex(o=>o.id===remote.id);
        const serverItems=(remote.order_items||[]).map(it=>({
          medId:it.listing_id,
          name:it.name||'Unknown',
          dose:it.dosage||'',
          price:it.price||0,
          qty:it.qty||1
        }));
        const order={
          id:remote.id,
          date:remote.created_at,
          items:serverItems.length?serverItems:(idx!==-1?state.orders[idx].items:[]),
          total:remote.total||0,
          status:remote.status||'pending'
        };
        if(idx!==-1){
          const localStatus = state.orders[idx].status;
          if(localStatus==='completed' && order.status!=='completed'){
            order.status = 'completed';
          }
          state.orders[idx]=order;
        }
        else state.orders.unshift(order);
        state.orders=state.orders.filter((o,i,arr)=>arr.findIndex(x=>x.id===o.id)===i);
        state.orders.sort((a,b)=>new Date(b.date)-new Date(a.date));
        DB.save();
        if(document.getElementById('activity-command').classList.contains('show')) renderCommand();
      });
    }

    flushAllPending();

    setInterval(()=>{
      if(document.hidden||!db.isOnline()||!state.user?.center_id)return;
      db.fetchStockSnapshot(state.user.center_id).then(reconcileSnapshot).catch(()=>{});
    },60000);

    // Pull full catalog from server on fresh start
    if(state.user?.center_id && db.isOnline()){
      db.fetchStockSnapshot(state.user.center_id).then(reconcileSnapshot).catch(err=>console.error('Initial stock sync failed', err));
      db.fetchSalesSnapshot(state.user.center_id).then(remoteSales=>{
        const existingIds=new Set(state.sales.map(s=>s.id));
        remoteSales.forEach(rs=>{
          if(!existingIds.has(rs.id))state.sales.push(rs);
        });
        state.sales.sort((a,b)=>new Date(b.date)-new Date(a.date));
        DB.save();
      }).catch(err=>console.error('Initial sales sync failed', err));
      db.fetchReturnsSnapshot(state.user.center_id).then(remoteReturns=>{
        const existingIds=new Set(state.returns.map(r=>r.id));
        remoteReturns.forEach(rr=>{
          if(!existingIds.has(rr.id))state.returns.push(rr);
        });
        state.returns.sort((a,b)=>new Date(b.date)-new Date(a.date));
        DB.save();
      }).catch(err=>console.error('Initial returns sync failed', err));
      db.fetchListings().then(remoteListings=>{
        state.listings=remoteListings;
        DB.save();
        if(document.getElementById('activity-command').classList.contains('show')) renderCommand();
      }).catch(err=>console.error('Initial listings sync failed', err));
      db.fetchOrdersSnapshot(state.user.center_id).then(remoteOrders=>{
        remoteOrders.forEach(ro=>{
          const idx=state.orders.findIndex(o=>o.id===ro.id);
          if(idx!==-1){
            if(!ro.items.length&&state.orders[idx].items.length) ro.items=state.orders[idx].items;
            const localStatus = state.orders[idx].status;
            if(localStatus==='completed' && ro.status!=='completed'){
              ro.status = 'completed';
            }
            state.orders[idx]=ro;
          }else{
            state.orders.push(ro);
          }
        });
        state.orders=state.orders.filter((o,i,arr)=>arr.findIndex(x=>x.id===o.id)===i);
        state.orders.sort((a,b)=>new Date(b.date)-new Date(a.date));
        DB.save();
        if(document.getElementById('activity-command').classList.contains('show')) renderCommand();
      }).catch(err=>console.error('Initial orders sync failed', err));
    }

    const idx = TAB_ORDER.indexOf(state.tab);
    const track = $('#main-track');
    if(track) track.style.transform = `translateX(-${idx * 25}%)`;
    $$('.nav-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));

    if(state.tab==='stock')renderStock();
    else if(state.tab==='sell')renderSell();
    else if(state.tab==='illness')renderIllnesses();
    else if(state.tab==='settings')renderSettings();
    if('requestIdleCallback' in window){
      requestIdleCallback(()=>{ renderRecords(); renderCommand(); });
    } else {
      setTimeout(()=>{ renderRecords(); renderCommand(); }, 100);
    }
  }

  async function restoreSession(){
    if(!db.isOnline() && state.user && state.user.approved) return true;
    if(db.isOnline()){
      try{
        const user = await db.getSession();
        if(user){
          state.user = user;
          const existing = state.staff.find(s=>s.email===user.email);
          if(!existing){
            state.staff.push({id:user.id,name:user.name,email:user.email,role:user.role,center:user.center,center_id:user.center_id,approved:user.approved,date:user.date});
          }else{
            existing.approved = true; existing.role = user.role; existing.name = user.name; existing.center = user.center; existing.center_id = user.center_id;
          }
          DB.save();
          return true;
        }
      }catch(e){}
    }
    if(state.user && state.user.approved) return true;
    return false;
  }

  function debouncedRenderStock(){ clearTimeout(_stockTimer); _stockTimer=setTimeout(renderStock,300); }
  function debouncedRenderSell(){ clearTimeout(_sellTimer); _sellTimer=setTimeout(renderSell,300); }
  function debouncedRenderIllnesses(){ clearTimeout(_illTimer); _illTimer=setTimeout(renderIllnesses,300); }
  function debouncedRenderCommand(){ clearTimeout(_cmdTimer); _cmdTimer=setTimeout(renderCommand,300); }

  /* ─── ONLINE / OFFLINE DETECTION ─── */
  function updateOnlineStatus(){
    const online = navigator.onLine;
    const el = $('#sync-status');
    if(!el) return;
    if(online){
      el.textContent = t('online');
      el.classList.add('live');
      el.classList.remove('offline');
    } else {
      el.textContent = t('offline');
      el.classList.remove('live');
      el.classList.add('offline');
    }
  }

  window.addEventListener('online', ()=>{
    updateOnlineStatus();
    toast('Back online', 'ok');
    flushAllPending();
    if(state.user?.center_id){
      db.fetchStockSnapshot(state.user.center_id).then(reconcileSnapshot).catch(()=>{});
    }
    if(state.user){
      db.getSession().then(u=>{
        if(u && !u.approved){
          toast('Your account was revoked','err');
          setTimeout(()=>logout(),2000);
        }
      }).catch(()=>{});
    }
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && db.isOnline() && state.user?.center_id){
      db.fetchStockSnapshot(state.user.center_id).then(reconcileSnapshot).catch(()=>{});
    }
  });

  window.addEventListener('offline', ()=>{
    updateOnlineStatus();
    toast('You are offline', 'err');
  });

document.addEventListener('DOMContentLoaded', async () => {
    db.init();
    await DB.load();
    applyTheme();

    const hasSession = await restoreSession();

    const sp = $('#splash');
    if(sp) sp.classList.add('hidden');

    if(hasSession){
      $('#auth-overlay').classList.add('hidden');
      initApp();
      initMainSwipe();
      initCommandSwipe();
    }else{
      $('#auth-overlay').classList.remove('hidden');
      updateOnlineStatus();
    }

    window.__onSWUpdate = () => { toast('Update available. Refresh to update.'); };
  });

  return {
    login,signup,showSignup,showLogin,logout,unlock,
    go,toggleLang,toggleTheme,saveSettings,
    renderStock,debouncedRenderStock,setFilter,toggleStockSearch,openMedSheet,saveMed,editMed,deleteMed,closeSheet,
    handleSwipeStart,handleSwipeEnd,
    renderSell,debouncedRenderSell,setSellUnitFilter,toggleSellSearch,cartQty,openConfirm,confirmSale,clearCart,updateFab,
    renderIllnesses,debouncedRenderIllnesses,openIllSheet,saveIll,showRefForm,hideRefForm,addRef,rmRef,openIllDetail,
    openProfile,openManagement,openStaffFromManagement,renderStaffList,openStaffDetail,renderInService,openActivityReport,toggleActivityReport,
    openRecords,setRecTab,renderRecords,openRecordDetail,
    openCommand,closeCommand,setCommandTab,setCmdUnitFilter,toggleCmdSearch,renderCommand,debouncedRenderCommand,setCmdQty,openOrderConfirm,submitOrder,receiveOrder,saveReceivePrices,closeReceiveSetup,
    onCheckInToggle,confirmCheckIn,
    openActivity,closeActivity,
    openReturnSheet,updateReturnTotal,submitReturn,openReturnDetail,

    openSuppliers,renderSuppliers,openSupplierSheet,saveSupplier,
    updateOnlineStatus,
  };
})();
