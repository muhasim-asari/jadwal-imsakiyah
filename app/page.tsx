"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Moon, MapPin, Calendar as CalendarIcon, Clock, ChevronRight, Sunset, Sunrise, Search, X, Loader2, Sun, CloudMoon } from "lucide-react";

// --- KONFIGURASI 2026 ---
const CONFIG = {
  YEAR: 2026,
  RAMADAN_START_DAY: 19, // 1 Ramadan jatuh pada 19 Feb 2026
  DEFAULT_ID: "1301",
  DEFAULT_CITY: "JAKARTA",
};

interface SearchResult {
  id: string;
  lokasi: string;
}

export default function App() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState({ lokasi: CONFIG.DEFAULT_CITY, id: CONFIG.DEFAULT_ID });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Ambil Data Jadwal Gabungan (Februari & Maret)
  const fetchData = useCallback(async (cityId: string) => {
    setLoading(true);
    try {
      const resFeb = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/02`);
      const dataFeb = await resFeb.json();

      const resMar = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/03`);
      const dataMar = await resMar.json();

      console.log("Data Februari:", dataFeb);
      console.log("Data Maret:", dataMar);

      let combinedJadwal: any[] = [];
      if (dataFeb.status && dataFeb.data.jadwal) combinedJadwal = [...dataFeb.data.jadwal];
      if (dataMar.status && dataMar.data.jadwal) combinedJadwal = [...combinedJadwal, ...dataMar.data.jadwal];

      if (combinedJadwal.length > 0) {
        const startIndex = combinedJadwal.findIndex((day) => {
          const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
          const [d, m] = datePart.split("/").map(Number);
          return d === CONFIG.RAMADAN_START_DAY && m === 2;
        });

        if (startIndex !== -1) {
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

  // 2. Inisialisasi
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    const loc = saved ? JSON.parse(saved) : info;
    if (saved) setInfo(loc);
    fetchData(loc.id);
  }, [fetchData]);

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

  // 4. Memoized Calendar Grid (Februari)
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(CONFIG.YEAR, 1, 1).getDay();
    const daysInMonth = new Date(CONFIG.YEAR, 2, 0).getDate();
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push({ type: "empty" });
    for (let d = 1; d <= daysInMonth; d++) {
      const hDate = d >= CONFIG.RAMADAN_START_DAY ? d - CONFIG.RAMADAN_START_DAY + 1 : null;
      grid.push({ type: "day", date: d, hijri: hDate });
    }
    return grid;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 selection:bg-emerald-100">
      {/* HEADER */}
      <header className="bg-emerald-900 text-white p-8 md:p-14 shadow-xl relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
          <div className="text-center md:text-left space-y-4">
            <h1 className="text-3xl md:text-5xl font-black flex items-center gap-3 justify-center md:justify-start">
              <Moon className="text-yellow-400 fill-yellow-400" /> Imsakiyah 1447 H
            </h1>
            <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md transition-all group font-bold">
              <MapPin size={18} className="text-emerald-400" />
              <span className="uppercase tracking-widest text-sm">{info.lokasi}</span>
            </button>
          </div>
          <div className="bg-black/20 px-8 py-5 rounded-[2.5rem] border border-white/5 backdrop-blur-md text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 text-emerald-200">Februari - Maret 2026</p>
            <p className="text-xl font-bold tracking-tight">Edisi Ramadhan 1447 H</p>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 text-[18rem] font-black opacity-5 italic select-none text-white">RAMADAN</div>
      </header>

      <main className="max-w-7xl mx-auto px-4 -mt-10 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* KOLOM KIRI: KALENDER (STAY 1 COLUMN) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-white p-6 text-black">
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-50">
                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Februari 2026</h3>
                <CalendarIcon className="text-emerald-600" size={16} />
              </div>
              <div className="grid grid-cols-7 gap-1">
                {["M", "S", "S", "R", "K", "J", "S"].map((day, idx) => (
                  <div key={`h-${idx}`} className="text-center text-[9px] font-black text-slate-300 py-1">
                    {day}
                  </div>
                ))}
                {calendarGrid.map((item, i) => (
                  <CalendarCell key={`c-${i}`} item={item} />
                ))}
              </div>
              <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                <p className="text-[10px] text-emerald-600 font-black uppercase mb-1 tracking-widest">Awal Ramadhan</p>
                <p className="text-xs font-bold text-emerald-700">Kamis, 19 Feb 2026</p>
              </div>
            </div>
          </aside>

          {/* KOLOM KANAN: JADWAL (2 COLUMN CARD LAYOUT) */}
          <section className="lg:col-span-8">
            {loading ? (
              <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center shadow-xl w-full">
                <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center">Menyinkronkan Waktu Ibadah...</p>
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

      {/* MODAL SEARCH */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-white">
            <div className="flex justify-between items-center mb-6 text-black">
              <h3 className="font-black text-xl tracking-tight uppercase">Ganti Wilayah</h3>
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
              <input autoFocus type="text" placeholder="Cari nama kota/kabupaten..." className="w-full pl-12 pr-12 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-black transition-all" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} className="text-slate-300" />}</div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar text-black">
              {searchResults.map((r) => (
                <button
                  key={`city-${r.id}`}
                  onClick={() => {
                    const newLoc = { lokasi: r.lokasi, id: r.id };
                    setInfo(newLoc);
                    localStorage.setItem("selectedLocation", JSON.stringify(newLoc));
                    fetchData(r.id);
                    setShowSearch(false);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full p-4 text-left hover:bg-emerald-50 rounded-2xl font-bold uppercase text-[10px] tracking-widest border border-transparent hover:border-emerald-100 transition-all flex justify-between items-center group"
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

function CalendarCell({ item }: { item: any }) {
  if (item.type === "empty") return <div className="aspect-square" />;
  const today = new Date();
  const isToday = item.date === today.getDate() && today.getMonth() === 1 && today.getFullYear() === 2026;
  const isRamadan = item.hijri !== null;

  return (
    <div
      className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all
      ${isToday ? "bg-emerald-600 border-emerald-500 text-white shadow-lg z-10 font-bold" : "bg-slate-50/50 border-transparent text-slate-400"}
      ${isRamadan && !isToday ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""}
    `}
    >
      <span className="text-[10px] font-black leading-none">{String(item.date)}</span>
      {isRamadan && <span className={`text-[6px] font-bold mt-0.5 ${isToday ? "text-emerald-100" : "text-emerald-500"}`}>{String(item.hijri)}</span>}
    </div>
  );
}

function ScheduleCard({ day, ramadanIdx }: { day: any; ramadanIdx: number }) {
  const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
  const [d, m, y] = datePart.split("/").map(Number);
  const today = new Date();
  const isToday = d === today.getDate() && m === today.getMonth() + 1 && y === today.getFullYear();

  return (
    <div
      className={`bg-white rounded-[2rem] p-5 shadow-sm border transition-all duration-300 
      ${isToday ? "ring-4 ring-amber-500/20 border-amber-500 bg-amber-50/20" : "border-slate-100 hover:border-emerald-100"}
    `}
    >
      <div className="flex justify-between items-center mb-5 text-black">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center font-black ${isToday ? "bg-amber-600": "bg-emerald-600"} text-white shadow-md`}>
            <span className="text-lg leading-none">{String(ramadanIdx)}</span>
            <span className="text-[6px] uppercase tracking-tighter">RAM</span>
          </div>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isToday ? "text-amber-600" : "text-emerald-600"} mb-0.5`}>Ramadhan Hari Ke-{String(ramadanIdx)}</p>
            <h4 className="font-bold text-slate-800 tracking-tight leading-none text-sm">{day.tanggal}</h4>
          </div>
        </div>
        {isToday && <div className="bg-amber-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full tracking-[0.1em] animate-pulse shadow-md uppercase">Hari Ini</div>}
      </div>

      {/* Grid Jadwal - Dibuat 3 kolom agar pas di kartu yang lebarnya 1/2 */}
      <div className="grid grid-cols-3 gap-2">
        <TimeBox label="Imsak" time={day.imsak} icon={<Moon size={10} />} />
        <TimeBox label="Subuh" time={day.subuh} icon={<Sunrise size={10} />} />
        <TimeBox label="Dzuhur" time={day.dzuhur} icon={<Sun size={10} />} />
        <TimeBox label="Ashar" time={day.ashar} icon={<Sun size={10} />} />
        <TimeBox label="Maghrib" time={day.maghrib} icon={<Sunset size={10} />} isHighlight />
        <TimeBox label="Isya" time={day.isya} icon={<CloudMoon size={10} />} />
      </div>
    </div>
  );
}

function TimeBox({ label, time, icon, isHighlight = false }: { label: string; time: string; icon: React.ReactNode; isHighlight?: boolean }) {
  return (
    <div
      className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center
      ${isHighlight ? "bg-emerald-700 border-emerald-800 text-white shadow-lg" : "bg-slate-50 border-slate-100 text-slate-600"}
    `}
    >
      <div className={`mb-1 ${isHighlight ? "text-emerald-200" : "text-slate-400"}`}>{icon}</div>
      <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${isHighlight ? "text-emerald-200 opacity-80" : "opacity-60"}`}>{label}</p>
      <p className={`text-xs font-black tracking-tighter ${isHighlight ? "text-white" : "text-slate-800"}`}>{time}</p>
    </div>
  );
}
