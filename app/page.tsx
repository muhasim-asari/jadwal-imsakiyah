"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  Moon, MapPin, Calendar as CalendarIcon, Clock, 
  ChevronRight, ChevronLeft, Sunset, Sunrise, Search, X, Loader2, Sun, CloudMoon, Quote, Info, Download, Bell, BellOff, LayoutGrid, CalendarDays, ChevronDown, ChevronUp, CheckCircle, AlertCircle
} from "lucide-react";

// --- INTERFACES ---
interface Config {
  YEAR: number;
  RAMADAN_START_DAY: number;
  DEFAULT_ID: string;
  DEFAULT_CITY: string;
}

interface HaditsItem {
  teks: string;
  riwayat: string;
}

interface LocationInfo {
  lokasi: string;
  id: string;
}

interface SearchResult {
  id: string;
  lokasi: string;
}

interface ScheduleDay {
  tanggal: string;
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
}

interface CalendarItem {
  type: "empty" | "day";
  date?: number;
  hijri?: number | null;
  label?: string;
}

interface ScheduledNotification {
  prayerName: string;
  scheduledTime: Date;
  notified: boolean;
}

// --- KONFIGURASI 2026 ---
const CONFIG: Config = {
  YEAR: 2026,
  RAMADAN_START_DAY: 19, // 1 Ramadan jatuh pada 19 Feb 2026
  DEFAULT_ID: "1301",
  DEFAULT_CITY: "JAKARTA",
};

const HADITS_DATA: Record<number, HaditsItem> = {
  2: {
    teks: "Barangsiapa yang berpuasa Ramadhan karena iman dan mengharap pahala, maka diampuni dosa-dosanya yang telah lalu.",
    riwayat: "HR. Bukhari & Muslim",
  },
  3: {
    teks: "Carilah Lailatul Qadr pada malam-malam ganjil di sepuluh hari terakhir bulan Ramadhan.",
    riwayat: "HR. Bukhari",
  },
};

export default function App() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [info, setInfo] = useState<LocationInfo>({ lokasi: CONFIG.DEFAULT_CITY, id: CONFIG.DEFAULT_ID });
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<'jadwal' | 'kalender'>('jadwal');
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [notificationError, setNotificationError] = useState<string>("");
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState<boolean>(false);
  const scheduledNotificationsRef = useRef<ScheduledNotification[]>([]);
  const lastNotifiedPrayer = useRef<string>("");

  // 1. Ambil Data Jadwal Gabungan (Februari & Maret)
  const fetchData = useCallback(async (cityId: string) => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      // Fetch current month and next month dynamically
      const monthsToFetch = [];
      for (let m = currentMonth; m <= currentMonth + 1 && m <= 12; m++) {
        monthsToFetch.push(m);
      }
      
      let combinedJadwal: ScheduleDay[] = [];
      
      for (const month of monthsToFetch) {
        const monthStr = month.toString().padStart(2, '0');
        const res = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/${currentYear}/${monthStr}`);
        const data = await res.json();
        if (data.status && data.data.jadwal) {
          combinedJadwal = [...combinedJadwal, ...data.data.jadwal];
        }
      }

      if (combinedJadwal.length > 0) {
        const startIndex = combinedJadwal.findIndex((day) => {
          const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
          const [d, m] = datePart.split("/").map(Number);
          return d === CONFIG.RAMADAN_START_DAY && m === 2;
        });

        if (startIndex !== -1) {
          // Ambil 32 hari (30 Ramadan + 2 Perkiraan Syawal)
          setSchedule(combinedJadwal.slice(startIndex, startIndex + 32));
        } else {
          // If Ramadan not found, use all available data
          setSchedule(combinedJadwal);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Register Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);
          setIsServiceWorkerReady(true);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // 3. Inisialisasi & PWA/Notification Setup
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    if (saved) setInfo(JSON.parse(saved));
    fetchData(saved ? JSON.parse(saved).id : info.id);

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      setNotificationStatus(Notification.permission as 'default' | 'granted' | 'denied');
    }

    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    return () => {
      // Cleanup scheduled notifications
      scheduledNotificationsRef.current = [];
    };
  }, [fetchData, info.id]);

  // 4. Function to show notification (works even when tab is in background)
  const showNotification = useCallback(async (prayerName: string, location: string) => {
    if (lastNotifiedPrayer.current === prayerName) return;
    
    const title = `Waktunya ${prayerName}!`;
    const body = `Sudah masuk waktu ${prayerName} untuk wilayah ${location}.`;
    const icon = "/logo-imsakiyah.png";

    // Try Service Worker first (works in background)
    if (isServiceWorkerReady && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        icon,
      });
    }

    // Also try regular Notification API as fallback
    if (notificationPermission === "granted") {
      try {
        new Notification(title, {
          body,
          icon,
          badge: icon,
          tag: `prayer-${prayerName}`,
          requireInteraction: true,
        } as NotificationOptions);
      } catch (err) {
        console.error("Notification error:", err);
      }
    }

    lastNotifiedPrayer.current = prayerName;
  }, [isServiceWorkerReady, notificationPermission]);

  // 5. Notifikasi Sholat - Improved with exact time scheduling
  useEffect(() => {
    if (schedule.length === 0) return;

    const checkAndNotify = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;
      
      const d = now.getDate();
      const m = now.getMonth() + 1;
      const todayData = schedule.find((day) => {
        const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
        const [sd, sm] = datePart.split("/").map(Number);
        return sd === d && sm === m;
      });

      if (!todayData) return;

      // Parse prayer times and check if current time matches
      const prayerTimes = [
        { label: "Imsak", time: todayData.imsak },
        { label: "Subuh", time: todayData.subuh },
        { label: "Dhuha", time: todayData.dhuha },
        { label: "Dzuhur", time: todayData.dzuhur },
        { label: "Ashar", time: todayData.ashar },
        { label: "Maghrib", time: todayData.maghrib },
        { label: "Isya", time: todayData.isya },
      ];

      for (const prayer of prayerTimes) {
        if (!prayer.time) continue;
        
        const [ph, pm] = prayer.time.split(":").map(Number);
        const prayerTimeInMinutes = ph * 60 + pm;
        
        // Check if current time is within 1 minute of prayer time
        const diff = Math.abs(currentTimeInMinutes - prayerTimeInMinutes);
        
        if (diff === 0 || (diff === 1 && currentTimeInMinutes > prayerTimeInMinutes)) {
          if (notificationPermission === "granted") {
            showNotification(prayer.label, info.lokasi);
          }
        }
      }
    };

    // Check immediately
    checkAndNotify();

    // Then check every 10 seconds (more frequent for better accuracy)
    const checkInterval = setInterval(checkAndNotify, 10000);
    
    return () => clearInterval(checkInterval);
  }, [schedule, notificationPermission, info.lokasi, showNotification]);

  // Handle notification permission request
  const handleNotificationRequest = async () => {
    setNotificationError("");
    
    if (!("Notification" in window)) {
      setNotificationError("Browser tidak mendukung notifikasi");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationStatus(permission as 'default' | 'granted' | 'denied');
      
      if (permission === "denied") {
        setNotificationError("Notifikasi diblokir. Silakan aktifkan di pengaturan browser.");
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      setNotificationError("Gagal meminta izin notifikasi");
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (q.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${q}`);
        const result = await res.json();
        setSearchResults(result.status ? result.data : []);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const calendarGrid = useMemo<CalendarItem[]>(() => {
    const firstDay = new Date(CONFIG.YEAR, calendarMonth - 1, 1).getDay();
    const daysInMonth = new Date(CONFIG.YEAR, calendarMonth, 0).getDate();
    const grid: CalendarItem[] = [];
    for (let i = 0; i < firstDay; i++) grid.push({ type: "empty" });
    for (let d = 1; d <= daysInMonth; d++) {
      let hDate: number | null = null;
      let label = "RAM";
      if (calendarMonth === 2) {
        hDate = d >= CONFIG.RAMADAN_START_DAY ? d - CONFIG.RAMADAN_START_DAY + 1 : null;
      } else if (calendarMonth === 3) {
        if (d <= 20) hDate = d + 10;
        else if (d === 21 || d === 22) { hDate = d === 21 ? 1 : 2; label = "SYW*"; }
      }
      grid.push({ type: "day", date: d, hijri: hDate, label });
    }
    return grid;
  }, [calendarMonth]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 lg:pb-10 selection:bg-amber-100">
      {/* HEADER */}
      <header className="bg-emerald-900 text-white p-8 md:p-14 shadow-xl relative overflow-hidden">
        <h1 className="text-3xl md:text-5xl font-black flex items-center mb-3 gap-3 justify-center md:justify-start">
          Imsakiyah 1447 H
        </h1>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6 text-center md:text-left">
          <div className="space-y-4 order-2 md:order-1">
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md transition-all group font-bold">
                <MapPin size={18} className="text-emerald-400" />
                <span className="uppercase tracking-widest text-sm">{info.lokasi}</span>
              </button>
              
              {/* FIXED: Notification Button with proper icon and status */}
              <button
                onClick={handleNotificationRequest}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-bold shadow-lg ${
                  notificationPermission === "granted" 
                    ? "bg-amber-600 border-amber-500" 
                    : notificationPermission === "denied"
                    ? "bg-red-500/80 border-red-500"
                    : "bg-white/20 border-white/10"
                }`}
              >
                {notificationPermission === "granted" ? (
                  <Bell size={18} className="animate-bounce" />
                ) : notificationPermission === "denied" ? (
                  <AlertCircle size={18} />
                ) : (
                  <BellOff size={18} />
                )}
                <span className="uppercase tracking-widest text-sm">
                  {notificationPermission === "granted" 
                    ? "Notifikasi Aktif" 
                    : notificationPermission === "denied"
                    ? "Notifikasi Diblokir"
                    : "Aktifkan Bel"}
                </span>
              </button>
              
              {deferredPrompt && (
                <button onClick={() => { deferredPrompt.prompt(); setDeferredPrompt(null); }} className="inline-flex items-center gap-2 bg-amber-500 text-emerald-950 px-6 py-3 rounded-2xl font-bold shadow-lg">
                  <Download size={18} /> <span className="uppercase tracking-widest text-xs">Pasang App</span>
                </button>
              )}
            </div>
            
            {/* Notification Error Message */}
            {notificationError && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-xl">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-xs text-red-300">{notificationError}</span>
              </div>
            )}
            
            {/* Service Worker Status */}
            {isServiceWorkerReady && notificationPermission === "granted" && (
              <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-xl">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-xs text-emerald-300">Notifikasi latar belakang aktif</span>
              </div>
            )}
          </div>
          <div className="bg-black/20 px-8 py-5 rounded-[2.5rem] border border-white/5 backdrop-blur-md order-1 md:order-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 text-emerald-200 text-center">Februari - Maret 2026</p>
            <p className="text-xl font-bold tracking-tight text-white text-center leading-tight">Jadwal Ramadan & Syawal</p>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 text-[18rem] font-black opacity-5 italic select-none text-white pointer-events-none">RAMADAN</div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-0 -mt-6 lg:-mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* KOLOM KIRI / TAB KALENDER */}
          <aside className={`lg:col-span-4 lg:sticky lg:top-8 space-y-6 ${activeTab === 'kalender' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-white p-6 text-black">
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-50">
                <button onClick={() => setCalendarMonth(2)} className={`p-1 rounded-full transition-colors ${calendarMonth === 3 ? "hover:bg-slate-100" : "opacity-20 cursor-default"}`}>
                  <ChevronLeft size={16} />
                </button>
                <h3 className="font-black text-slate-800 uppercase text-[14px] tracking-widest text-center flex-1">{calendarMonth === 2 ? "Februari" : "Maret"} 2026</h3>
                <button onClick={() => setCalendarMonth(3)} className={`p-1 rounded-full transition-colors ${calendarMonth === 2 ? "hover:bg-slate-100" : "opacity-20 cursor-default"}`}>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["M", "S", "S", "R", "K", "J", "S"].map((day, idx) => (
                  <div key={`h-${idx}`} className="text-center text-[12px] font-black text-slate-300 py-1 uppercase">{day}</div>
                ))}
                {calendarGrid.map((item, i) => (
                  <CalendarCell key={`c-${i}`} item={item} month={calendarMonth} />
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <Info size={18} />
                  <span className="text-[14px] font-black uppercase tracking-widest text-amber-700">Sidang Isbat</span>
                </div>
                <p className="text-[12px] leading-relaxed text-amber-800">Tanggal 21-22 Maret (1-2 Syawal) menunggu hasil Sidang Isbat Kemenag RI.</p>
              </div>

              <div className="mt-4 p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 relative overflow-hidden text-black">
                <Quote size={30} className="text-emerald-100 absolute -bottom-2 -right-2 transform rotate-12" />
                <p className="text-[14px] leading-relaxed text-emerald-900 italic font-medium relative z-10">"{HADITS_DATA[calendarMonth === 2 ? 2 : 3].teks}"</p>
                <p className="mt-2 text-[12px] font-black text-emerald-600/60 uppercase tracking-widest text-right relative z-10 text-emerald-700">— {HADITS_DATA[calendarMonth === 2 ? 2 : 3].riwayat}</p>
              </div>
            </div>
          </aside>

          {/* KOLOM KANAN / TAB JADWAL */}
          <section className={`lg:col-span-8 ${activeTab === 'jadwal' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden lg:block'}`}>
            {loading ? (
              <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center shadow-xl w-full">
                <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center">Menyiapkan Jadwal Penuh...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {schedule.map((day, idx) => (
                  <ScheduleCard key={`card-${idx}`} day={day} ramadanIdx={idx + 1} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* FOOTER (Hanya Desktop) */}
      <footer className="max-w-7xl mx-auto mt-12 pb-3 border-t border-slate-200 hidden lg:block">
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="text-[14px] font-black uppercase tracking-widest text-slate-400">Sumber Data API</p>
            <p className="text-[14px] font-medium text-slate-600">
              Data bersumber dari <span className="font-bold text-emerald-700">API MyQuran</span> (Kemenag RI). Dapat diakses secara offline.
            </p>
          </div>
          <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">Imsakiyah &copy; {CONFIG.YEAR} / 1447 H</p>
        </div>
      </footer>

      {/* SEARCH MODAL */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-white">
            <div className="flex justify-between items-center mb-6 text-black">
              <h3 className="font-black text-xl tracking-tight uppercase">Pilih Kota</h3>
              <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(""); }} className="p-2 hover:bg-slate-100 rounded-full transition-all text-black"><X size={20} /></button>
            </div>
            <div className="relative mb-6">
              <input autoFocus type="text" placeholder="Cari nama kota..." className="w-full pl-12 pr-12 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-black transition-all" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} className="text-slate-300" />}</div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar text-black">
              {searchResults.map((r) => (
                <button
                  key={`city-${r.id}`}
                  onClick={() => {
                    const newLoc: LocationInfo = { lokasi: r.lokasi, id: r.id };
                    setInfo(newLoc);
                    localStorage.setItem("selectedLocation", JSON.stringify(newLoc));
                    fetchData(r.id);
                    setShowSearch(false);
                    setSearchResults([]);
                    setSearchQuery("");
                    // Reset notification state when location changes
                    lastNotifiedPrayer.current = "";
                  }}
                  className="w-full p-4 text-left hover:bg-emerald-50 rounded-2xl font-bold uppercase text-[12px] tracking-widest border border-transparent hover:border-emerald-100 transition-all flex justify-between items-center group"
                >
                  <span className="text-slate-700 group-hover:text-emerald-700">{r.lokasi}</span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MENU KHUSUS PWA / BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-0 left-0 right-0 z-[50] lg:hidden bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-20 max-w-md mx-auto px-6">
          <button 
            onClick={() => setActiveTab('jadwal')}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 h-full relative ${activeTab === 'jadwal' ? 'text-emerald-700' : 'text-slate-400'}`}
          >
            {activeTab === 'jadwal' && <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-10 h-1 bg-emerald-700 rounded-b-full shadow-lg shadow-emerald-700/50" />}
            <LayoutGrid size={24} className={activeTab === 'jadwal' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] font-black uppercase tracking-widest">Jadwal</span>
          </button>

          <div className="w-12 h-12 -mt-10 bg-emerald-900 rounded-full flex items-center justify-center shadow-lg shadow-emerald-900/40 border-4 border-slate-50 relative z-10">
            <Moon size={20} className="text-yellow-400 fill-yellow-400 animate-pulse" />
          </div>

          <button 
            onClick={() => setActiveTab('kalender')}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 h-full relative ${activeTab === 'kalender' ? 'text-emerald-700' : 'text-slate-400'}`}
          >
            {activeTab === 'kalender' && <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-10 h-1 bg-emerald-700 rounded-b-full shadow-lg shadow-emerald-700/50" />}
            <CalendarDays size={24} className={activeTab === 'kalender' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] font-black uppercase tracking-widest">Kalender</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// --- KOMPONEN PENDUKUNG ---

function CalendarCell({ item, month }: { item: CalendarItem; month: number }) {
  if (item.type === "empty") return <div className="aspect-square" />;
  const today = new Date();
  const isToday = item.date === today.getDate() && month === today.getMonth() + 1 && today.getFullYear() === 2026;
  const isRamadan = item.hijri !== null;
  const isEidEstimate = item.label === "SYW*";

  return (
    <div className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${isToday ? "bg-amber-600 border-amber-500 animate-pulse text-white shadow-lg z-10 font-bold scale-110" : "bg-slate-50/50 border-transparent text-slate-400"} ${isRamadan && !isToday && !isEidEstimate ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""} ${isEidEstimate && !isToday ? "bg-amber-100 border-amber-200 text-amber-900" : ""}`}>
      <span className="text-[12px] font-black leading-none">{String(item.date)}</span>
      {isRamadan && <span className={`text-[8px] font-bold mt-0.5 ${isToday ? "text-amber-100" : isEidEstimate ? "text-amber-600" : "text-emerald-500"}`}>{String(item.hijri)} {item.label}</span>}
    </div>
  );
}

function ScheduleCard({ day, ramadanIdx }: { day: ScheduleDay; ramadanIdx: number }) {
  const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
  const [d, m, y] = datePart.split("/").map(Number);
  
  // Hitung apakah hari ini sudah lewat
  const scheduleDate = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const isToday = scheduleDate.getTime() === today.getTime();
  const isPast = scheduleDate.getTime() < today.getTime();
  const isEid = ramadanIdx > 30;

  // State untuk collapse
  const [isExpanded, setIsExpanded] = useState(!isPast);

  const labelKeterangan = isEid ? `Idul Fitri Ke-${ramadanIdx - 30}*` : `Ramadhan Hari Ke-${ramadanIdx}`;

  return (
    <div className={`bg-white rounded-[2rem] p-5 shadow-sm border transition-all duration-300 
      ${isToday ? "ring-4 ring-amber-500/20 border-amber-500 bg-amber-50/20" : "border-slate-100 hover:border-emerald-100"}
      ${isEid && !isToday ? "border-amber-200 bg-amber-50/30" : ""}
      ${isPast && !isExpanded ? "grayscale-[0.5]" : ""}
    `}>
      <div 
        className={`flex justify-between items-center text-black ${isExpanded ? "mb-5" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center font-black ${isToday ? "bg-amber-600" : isEid ? "bg-amber-500" : isPast ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white"} ${!isPast ? "text-white shadow-md" : ""} transition-colors`}>
            <span className="text-lg leading-none">{isEid ? ramadanIdx - 30 : String(ramadanIdx)}</span>
            <span className="text-[6px] uppercase tracking-tighter">{isEid ? "SYW" : "RAM"}</span>
          </div>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isToday ? "text-amber-600" : isEid ? "text-amber-600" : isPast ? "text-slate-400" : "text-emerald-600"} mb-0.5`}>
              {labelKeterangan} {isPast && !isExpanded && "(Selesai)"}
            </p>
            <h4 className={`font-bold tracking-tight leading-none ${isExpanded ? "text-sm text-slate-800" : "text-xs text-slate-500"}`}>{day.tanggal}</h4>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isToday && <div className="bg-amber-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full tracking-[0.1em] animate-pulse shadow-md uppercase">Hari Ini</div>}
          <div className="text-slate-300">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <TimeBox label="Imsak" time={day.imsak} icon={<Moon size={22} />} activeToday={isToday} isEid={isEid} />
          <TimeBox label="Subuh" time={day.subuh} icon={<Sunrise size={22} />} activeToday={isToday} isEid={isEid} />
          <TimeBox label="Dhuha" time={day.dhuha} icon={<Sun size={22} />} activeToday={isToday} isEid={isEid} />
          <TimeBox label="Dzuhur" time={day.dzuhur} icon={<Sun size={22} />} activeToday={isToday} isEid={isEid} />
          <TimeBox label="Ashar" time={day.ashar} icon={<Sun size={22} />} activeToday={isToday} isEid={isEid} />
          <TimeBox label="Maghrib" time={day.maghrib} icon={<Sunset size={22} />} isHighlight activeToday={isToday} isEid={isEid} />
          <TimeBox label="Isya" time={day.isya} icon={<CloudMoon size={22} />} activeToday={isToday} isEid={isEid} />
        </div>
      )}
    </div>
  );
}

interface TimeBoxProps {
  label: string;
  time: string;
  icon: React.ReactNode;
  isHighlight?: boolean;
  activeToday?: boolean;
  isEid?: boolean;
}

function TimeBox({ label, time, icon, isHighlight = false, activeToday = false, isEid = false }: TimeBoxProps) {
  const highlightColor = isEid ? "bg-amber-500 border-amber-600 text-white" : "bg-emerald-700 border-emerald-800 text-white shadow-lg";
  const activeTodayColor = "bg-slate-50 border-slate-100 text-slate-600";
  const eidTodayColor = "bg-amber-50 border-amber-200 text-amber-900";
  const finalStyle = isHighlight && !activeToday ? highlightColor : isHighlight && activeToday ? "bg-amber-600 border-amber-700 text-white shadow-lg" : activeToday ? activeTodayColor : isEid ? eidTodayColor : "bg-slate-50 border-slate-100 text-slate-600";

  // Handle missing time
  if (!time) {
    return (
      <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100 text-slate-300 flex flex-col items-center text-center opacity-50">
        <div className="mb-1 opacity-70">{icon}</div>
        <p className="text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-80">{label}</p>
        <p className="text-xs font-black tracking-tighter">-</p>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center ${finalStyle}`}>
      <div className={`mb-1 opacity-70`}>{icon}</div>
      <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-80`}>{label}</p>
      <p className="text-xs font-black tracking-tighter">{time}</p>
    </div>
  );
}

