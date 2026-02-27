"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Moon, MapPin, Calendar as CalendarIcon, Clock, ChevronRight, Sunset, Sunrise, Search, X, Loader2, Sun, CloudMoon } from "lucide-react";

const CONFIG = {
  YEAR: 2026,
  MONTH: 2,
  START_RAMADAN: 19,
  DEFAULT_ID: "1301",
  DEFAULT_CITY: "JAKARTA",
};

export default function ImsakiyahLengkap() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState({ lokasi: CONFIG.DEFAULT_CITY, id: CONFIG.DEFAULT_ID });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    const loc = saved ? JSON.parse(saved) : info;
    if (saved) setInfo(loc);
    fetchData(loc.id);
  }, []);

  const fetchData = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${id}/${CONFIG.YEAR}/${CONFIG.MONTH}`);
      const result = await res.json();
      if (result.status) setSchedule(result.data.jadwal || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((q: string) => {
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
  }, []);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(CONFIG.YEAR, CONFIG.MONTH - 1, 1).getDay();
    const daysInMonth = new Date(CONFIG.YEAR, CONFIG.MONTH, 0).getDate();
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push({ type: "empty" });
    for (let d = 1; d <= daysInMonth; d++) {
      const hDate = d >= CONFIG.START_RAMADAN ? d - CONFIG.START_RAMADAN + 1 : null;
      grid.push({ type: "day", date: d, hijri: hDate });
    }
    return grid;
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      {/* HEADER */}
      <header className="bg-emerald-900 text-white p-8 md:p-14 shadow-xl relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black mb-4 flex items-center gap-3">
              <Moon className="text-yellow-400 fill-yellow-400" /> Jadwal Ibadah 1447 H
            </h1>
            <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md transition-all font-bold tracking-widest uppercase text-sm">
              <MapPin size={18} className="text-emerald-400" /> {info.lokasi}
            </button>
          </div>
          <div className="bg-black/20 p-5 rounded-[2rem] border border-white/5 backdrop-blur-md text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Februari 2026</p>
            <p className="text-lg font-bold">Ramadan & Sholat</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* KOLOM KIRI: KALENDER */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-white p-6 md:p-8">
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-50 text-sm">
                <h3 className="font-black text-slate-800 uppercase tracking-tighter">Kalender Masehi</h3>
                <CalendarIcon className="text-emerald-600" size={20} />
              </div>
              <div className="grid grid-cols-7 gap-2">
                {["M", "S", "S", "R", "K", "J", "S"].map((day, idx) => (
                  <div key={`header-${day}-${idx}`} className="text-center text-[10px] font-black text-slate-300 py-2">
                    {day}
                  </div>
                ))}
                {calendarGrid.map((item, i) => (
                  <CalendarCell key={`cell-${i}`} item={item} />
                ))}
              </div>
            </div>
          </aside>

          {/* KOLOM KANAN: JADWAL LENGKAP */}
          <section className="lg:col-span-8 space-y-5">
            {loading ? (
              <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center">
                <Loader2 className="animate-spin text-emerald-600" size={40} />
              </div>
            ) : (
              schedule.map((day, idx) => <ScheduleCard key={`schedule-${day.tanggal}-${idx}`} day={day} />)
            )}
          </section>
        </div>
      </main>

      {/* SEARCH MODAL */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl tracking-tight">Pilih Lokasi</h3>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative mb-6">
              <input autoFocus type="text" placeholder="Cari Kota (min. 3 huruf)..." className="w-full pl-12 pr-12 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-black" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} className="text-slate-300" />}</div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {searchResults.map((r, i) => (
                <button
                  key={`city-${r.id}-${i}`}
                  onClick={() => {
                    setInfo({ lokasi: r.lokasi, id: r.id });
                    localStorage.setItem("selectedLocation", JSON.stringify({ lokasi: r.lokasi, id: r.id }));
                    fetchData(r.id);
                    setShowSearch(false);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="w-full p-4 text-left hover:bg-emerald-50 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-transparent hover:border-emerald-100 transition-all"
                >
                  {r.lokasi}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-KOMPONEN ---

function CalendarCell({ item }: { item: any }) {
  if (item.type === "empty") return <div className="aspect-square" />;
  const today = new Date();
  const isToday = item.date === today.getDate() && today.getMonth() === 1 && today.getFullYear() === 2026;
  const isRamadan = item.hijri !== null;

  return (
    <div
      className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all
      ${isToday ? "bg-emerald-600 border-emerald-500 text-white shadow-lg scale-110 z-10" : "bg-slate-50/50 border-transparent text-slate-400"}
      ${isRamadan && !isToday ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""}
    `}
    >
      <span className="text-xs font-black">{String(item.date)}</span>
      {isRamadan && <span className={`text-[7px] font-bold mt-0.5 ${isToday ? "text-emerald-100" : "text-emerald-500"}`}>{String(item.hijri)} RAM</span>}
    </div>
  );
}

function ScheduleCard({ day }: { day: any }) {
  const dayInt = parseInt(day.tanggal.split("/")[0]) || 0;
  const isRamadan = dayInt >= CONFIG.START_RAMADAN;
  const ramadanDay = isRamadan ? dayInt - CONFIG.START_RAMADAN + 1 : null;
  const today = new Date();
  const isToday = dayInt === today.getDate() && today.getMonth() === 1 && today.getFullYear() === 2026;

  return (
    <div className={`bg-white rounded-[2.5rem] p-7 shadow-sm border transition-all duration-300 ${isToday ? "ring-4 ring-emerald-500/20 border-emerald-500 bg-emerald-50/20" : "border-slate-100 hover:border-emerald-100"}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl flex flex-col items-center justify-center font-black ${isRamadan ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-400"}`}>
            <span className="text-xl leading-none">{String(dayInt)}</span>
            <span className="text-[8px] uppercase">Feb</span>
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isRamadan ? "text-emerald-600" : "text-slate-400"}`}>{isRamadan ? `${String(ramadanDay)} Ramadan 1447 H` : "Sya'ban 1447 H"}</p>
            <h4 className="font-bold text-slate-800 tracking-tight leading-none mt-1 text-lg">{day.tanggal}</h4>
          </div>
        </div>
        {isToday && (
          <div className="bg-emerald-600 text-white text-[9px] font-black px-4 py-2 rounded-full tracking-widest animate-pulse shadow-md uppercase flex items-center gap-2">
            <Clock size={12} /> Hari Ini
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <TimeBox label="Imsak" time={day.imsak} active={isRamadan} icon={<Moon size={12} />} />
        <TimeBox label="Subuh" time={day.subuh} active={isRamadan} icon={<Sunrise size={12} />} />
        <TimeBox label="Dzuhur" time={day.dzuhur} active={true} icon={<Sun size={12} />} />
        <TimeBox label="Ashar" time={day.ashar} active={true} icon={<Sun size={12} />} />
        <TimeBox label="Maghrib" time={day.maghrib} active={isRamadan} icon={<Sunset size={12} />} isMaghrib />
        <TimeBox label="Isya" time={day.isya} active={true} icon={<CloudMoon size={12} />} />
      </div>
    </div>
  );
}

function TimeBox({ label, time, active, icon, isMaghrib = false }: { label: string; time: string; active: boolean; icon: any; isMaghrib?: boolean }) {
  return (
    <div
      className={`p-4 rounded-[1.5rem] border transition-all flex flex-col items-center text-center
      ${isMaghrib && active ? "bg-emerald-700 border-emerald-800 text-white shadow-lg scale-105" : active ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-slate-50 border-slate-100 text-slate-400"}
    `}
    >
      <div className="mb-2 opacity-70">{icon}</div>
      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isMaghrib && active ? "text-emerald-200" : ""}`}>{label}</p>
      <p className={`text-sm font-black tracking-tighter ${isMaghrib && active ? "text-white" : ""}`}>{time}</p>
    </div>
  );
}
