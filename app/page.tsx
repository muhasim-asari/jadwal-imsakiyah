"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Moon, MapPin, Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft, Sunset, Sunrise, Search, X, Loader2, Sun, CloudMoon, Quote, Info, Download, Bell, BellOff } from "lucide-react";

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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const lastNotifiedTime = useRef("");

  // 1. Fetch Data dengan Retry Logic
  const fetchWithRetry = async (url: string, retries = 5, delay = 1000): Promise<any> => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengambil data");
      return await res.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  // 1. Ambil Data Jadwal Gabungan (Februari & Maret)
  const fetchData = useCallback(async (cityId: string) => {
    setLoading(true);
    try {
      const resFeb = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/02`);
      const dataFeb = await resFeb.json();

      const resMar = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/03`);
      const dataMar = await resMar.json();

      let combinedJadwal: ScheduleDay[] = [];
      if (dataFeb.status && dataFeb.data.jadwal) combinedJadwal = [...dataFeb.data.jadwal];
      if (dataMar.status && dataMar.data.jadwal) combinedJadwal = [...combinedJadwal, ...dataMar.data.jadwal];

      if (combinedJadwal.length > 0) {
        const startIndex = combinedJadwal.findIndex((day) => {
          const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
          const [d, m] = datePart.split("/").map(Number);
          return d === CONFIG.RAMADAN_START_DAY && m === 2;
        });

        if (startIndex !== -1) {
          // Ambil 30 hari Ramadan + 2 hari perkiraan Idul Fitri (Total 32 baris)
          const ramadanDays = combinedJadwal.slice(startIndex, startIndex + 30);
          setSchedule(ramadanDays);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Inisialisasi & PWA/Notification Setup
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    if (saved) setInfo(JSON.parse(saved));
    fetchData(saved ? JSON.parse(saved).id : info.id);

    if ("Notification" in window) setNotificationPermission(Notification.permission);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [fetchData]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (schedule.length === 0 || notificationPermission !== "granted") return;

      const now = new Date();
      const currentTime = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });

      if (lastNotifiedTime.current === currentTime) return;

      const d = now.getDate();
      const m = now.getMonth() + 1;

      const todayData = schedule.find((day) => {
        const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
        const [sd, sm] = datePart.split("/").map(Number);
        return sd === d && sm === m;
      });

      if (todayData) {
        const prayerTimes = [
          { label: "Imsak", time: todayData.imsak },
          { label: "Subuh", time: todayData.subuh },
          { label: "Dzuhur", time: todayData.dzuhur },
          { label: "Ashar", time: todayData.ashar },
          { label: "Maghrib", time: todayData.maghrib },
          { label: "Isya", time: todayData.isya },
        ];

        const match = prayerTimes.find((p) => p.time === currentTime);
        if (match) {
          new Notification(`Waktunya ${match.label}!`, {
            body: `Sudah masuk waktu ${match.label} untuk wilayah ${info.lokasi}.`,
            icon: "https://jadwal-imsakiyah-dusky.vercel.app/logo-imsakiyah-192.png",
          });
          lastNotifiedTime.current = currentTime;
        }
      }
    }, 30000);
    return () => clearInterval(checkInterval);
  }, [schedule, notificationPermission, info.lokasi]);

  // 3. Handler Search
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

  // 4. Kalender Grid Logic
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
        if (d <= 20) {
          hDate = d + 10; // Melanjutkan dari 10 hari terakhir Feb
        } else if (d === 21 || d === 22) {
          hDate = d === 21 ? 1 : 2;
          label = "SYW*";
        }
      }
      grid.push({ type: "day", date: d, hijri: hDate, label });
    }
    return grid;
  }, [calendarMonth]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10 selection:bg-amber-100">
      {/* HEADER */}
      <header className="bg-emerald-900 text-white p-8 md:p-14 shadow-xl relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6 text-center md:text-left">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black flex items-center gap-3 justify-center md:justify-start">
              <Moon className="text-yellow-400 fill-yellow-400" /> Imsakiyah 1447 H
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md transition-all group font-bold">
                <MapPin size={18} className="text-emerald-400" />
                <span className="uppercase tracking-widest text-sm">{info.lokasi}</span>
              </button>
              <button
                onClick={async () => {
                  const p = await Notification.requestPermission();
                  setNotificationPermission(p);
                }}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-bold shadow-lg ${notificationPermission === "granted" ? "bg-emerald-600" : "bg-white/20"}`}
              >
                {notificationPermission === "granted" ? <Bell size={18} /> : <BellOff size={18} />}
                <span className="uppercase tracking-widest text-sm">{notificationPermission === "granted" ? "Notifikasi On" : "Aktifkan Bel"}</span>
              </button>

              {deferredPrompt && (
                <button
                  onClick={() => {
                    deferredPrompt.prompt();
                    setDeferredPrompt(null);
                  }}
                  className="inline-flex items-center gap-2 bg-amber-500 text-emerald-950 px-6 py-3 rounded-2xl font-bold shadow-lg"
                >
                  <Download size={18} /> <span className="uppercase tracking-widest text-xs">Instal</span>
                </button>
              )}
            </div>
          </div>
          <div className="bg-black/20 px-8 py-5 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 text-emerald-200 text-center">Februari - Maret 2026</p>
            <p className="text-xl font-bold tracking-tight text-white text-center leading-tight">Jadwal Ramadan 1447 H</p>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 text-[18rem] font-black opacity-5 italic select-none text-white">RAMADAN</div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-0 -mt-4 lg:-mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI: KALENDER & HADITS */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
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
                  <div key={`h-${idx}`} className="text-center text-[12px] font-black text-slate-300 py-1 uppercase">
                    {day}
                  </div>
                ))}
                {calendarGrid.map((item, i) => (
                  <CalendarCell key={`c-${i}`} item={item} month={calendarMonth} />
                ))}
              </div>

              {/* KOTAK INFORMASI PENTING */}
              <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <Info size={18} />
                  <span className="text-[14px] font-black uppercase tracking-widest">Sidang Isbat</span>
                </div>
                <p className="text-[12px] leading-relaxed text-amber-800">Idul Fitri 1447 H (21-22 Mar) menunggu hasil Sidang Isbat Pemerintah RI.</p>
              </div>

              {/* KOTAK HADITS */}
              <div className="mt-4 p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 relative overflow-hidden">
                <Quote size={30} className="text-emerald-100 absolute -bottom-2 -right-2 transform rotate-12" />
                <p className="text-[14px] leading-relaxed text-emerald-900 italic font-medium relative z-10">"{HADITS_DATA[calendarMonth === 2 ? 2 : 3].teks}"</p>
                <p className="mt-2 text-[12px] font-black text-emerald-600/60 uppercase tracking-widest text-right relative z-10">— {HADITS_DATA[calendarMonth === 2 ? 2 : 3].riwayat}</p>
              </div>
            </div>
          </aside>

          {/* KOLOM KANAN: JADWAL */}
          <section className="lg:col-span-8">
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

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto mt-12 pb-3 border-t border-slate-200">
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="text-[14px] font-black uppercase tracking-widest text-slate-400">Sumber Data API</p>
            <p className="text-[14px] font-medium text-slate-600">
              Data jadwal sholat bersumber dari <span className="font-bold text-emerald-700">API MyQuran</span> yang merujuk pada data resmi <span className="font-bold text-emerald-700">Kemenag RI</span>.
            </p>
          </div>
          <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">Imsakiyah &copy; {CONFIG.YEAR} / 1447 H</p>
        </div>
      </footer>

      {/* MODAL SEARCH */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-white">
            <div className="flex justify-between items-center mb-6 text-black">
              <h3 className="font-black text-xl tracking-tight uppercase">Pilih Kota</h3>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-all text-black"
              >
                <X size={20} />
              </button>
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
    </div>
  );
}

// --- KOMPONEN PENDUKUNG ---

interface CalendarCellProps {
  item: CalendarItem;
  month: number;
}

function CalendarCell({ item, month }: CalendarCellProps) {
  if (item.type === "empty") return <div className="aspect-square" />;
  const today = new Date();
  const isToday = item.date === today.getDate() && month === today.getMonth() + 1 && today.getFullYear() === 2026;
  const isRamadan = item.hijri !== null;
  const isEidEstimate = item.label === "SYW*";

  return (
    <div
      className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all
      ${isToday ? "bg-amber-600 border-amber-500 text-white shadow-lg z-10 font-bold" : "bg-slate-50/50 border-transparent text-slate-400"}
      ${isRamadan && !isToday && !isEidEstimate ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""}
      ${isEidEstimate && !isToday ? "bg-amber-100 border-amber-200 text-amber-900" : ""}
    `}
    >
      <span className="text-[12px] font-black leading-none">{String(item.date)}</span>
      {isRamadan && (
        <span className={`text-[8px] font-bold mt-0.5 ${isToday ? "text-amber-100" : isEidEstimate ? "text-amber-600" : "text-emerald-500"}`}>
          {String(item.hijri)} {item.label}
        </span>
      )}
    </div>
  );
}

interface ScheduleCardProps {
  day: ScheduleDay;
  ramadanIdx: number;
}

function ScheduleCard({ day, ramadanIdx }: ScheduleCardProps) {
  const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
  const [d, m, y] = datePart.split("/").map(Number);
  const today = new Date();
  const isToday = d === today.getDate() && m === today.getMonth() + 1 && y === today.getFullYear();

  // Deteksi Idul Fitri (Hari ke-31 dan ke-32)
  const isEid = ramadanIdx > 30;
  const labelKeterangan = isEid ? `Idul Fitri Ke-${ramadanIdx - 30}*` : `Ramadhan Hari Ke-${ramadanIdx}`;

  return (
    <div
      className={`bg-white rounded-[2rem] p-5 shadow-sm border transition-all duration-300 
      ${isToday ? "ring-4 ring-amber-500/20 border-amber-500 bg-amber-50/20" : "border-slate-100 hover:border-emerald-100"}
      ${isEid && !isToday ? "border-amber-200 bg-amber-50/30" : ""}
    `}
    >
      <div className="flex justify-between items-center mb-5 text-black">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center font-black ${isToday ? "bg-amber-600" : isEid ? "bg-amber-500" : "bg-emerald-600"} text-white shadow-md transition-colors`}>
            <span className="text-lg leading-none">{isEid ? ramadanIdx - 30 : String(ramadanIdx)}</span>
            <span className="text-[6px] uppercase tracking-tighter">{isEid ? "SYW" : "RAM"}</span>
          </div>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isToday ? "text-amber-600" : isEid ? "text-amber-600" : "text-emerald-600"} mb-0.5`}>{labelKeterangan}</p>
            <h4 className="font-bold text-slate-800 tracking-tight leading-none text-sm">{day.tanggal}</h4>
          </div>
        </div>
        {isToday && <div className="bg-amber-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full tracking-[0.1em] animate-pulse shadow-md uppercase">Hari Ini</div>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <TimeBox label="Imsak" time={day.imsak} icon={<Moon size={22} />} activeToday={isToday} isEid={isEid} />
        <TimeBox label="Subuh" time={day.subuh} icon={<Sunrise size={22} />} activeToday={isToday} isEid={isEid} />
        <TimeBox label="Dzuhur" time={day.dzuhur} icon={<Sun size={22} />} activeToday={isToday} isEid={isEid} />
        <TimeBox label="Ashar" time={day.ashar} icon={<Sun size={22} />} activeToday={isToday} isEid={isEid} />
        <TimeBox label="Maghrib" time={day.maghrib} icon={<Sunset size={22} />} isHighlight activeToday={isToday} isEid={isEid} />
        <TimeBox label="Isya" time={day.isya} icon={<CloudMoon size={22} />} activeToday={isToday} isEid={isEid} />
      </div>
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

  return (
    <div className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center ${finalStyle}`}>
      <div className={`mb-1 opacity-70`}>{icon}</div>
      <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-80`}>{label}</p>
      <p className={`text-xs font-black tracking-tighter`}>{time}</p>
    </div>
  );
}
