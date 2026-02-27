"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Moon, MapPin, Calendar as CalendarIcon, Clock, ChevronRight, Sunset, Sunrise, Search, X, Loader2, Sun, CloudMoon } from "lucide-react";

// --- KONFIGURASI 2026 ---
const CONFIG = {
  YEAR: 2026,
  START_MONTH: 2, // Februari
  END_MONTH: 3, // Maret
  RAMADAN_START_DAY: 19, // 1 Ramadan jatuh pada 19 Feb 2026
  DEFAULT_ID: "1301",
  DEFAULT_CITY: "JAKARTA",
};

export default function App() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState({ lokasi: CONFIG.DEFAULT_CITY, id: CONFIG.DEFAULT_ID });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // 1. Ambil Data Jadwal & Filter khusus Ramadan (30 Hari)
  const fetchData = useCallback(async (cityId) => {
    setLoading(true);
    try {
      // Mengambil data Februari 2026
      const resFeb = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/02`);
      const dataFeb = await resFeb.json();

      // Mengambil data Maret 2026
      const resMar = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/2026/03`);
      const dataMar = await resMar.json();

      let combinedJadwal = [];
      if (dataFeb.status && dataFeb.data.jadwal) combinedJadwal = [...dataFeb.data.jadwal];
      if (dataMar.status && dataMar.data.jadwal) combinedJadwal = [...combinedJadwal, ...dataMar.data.jadwal];

      if (combinedJadwal.length > 0) {
        // Cari index mulai (19 Februari)
        const startIndex = combinedJadwal.findIndex((day) => {
          const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
          const [d, m] = datePart.split("/").map(Number);
          return d === CONFIG.RAMADAN_START_DAY && m === 2;
        });

        if (startIndex !== -1) {
          // Ambil 30 hari sejak 1 Ramadan
          const ramadanDays = combinedJadwal.slice(startIndex, startIndex + 30);
          setSchedule(ramadanDays);
        } else {
          setSchedule([]);
        }
      } else {
        setSchedule([]);
      }
    } catch (err) {
      console.error("Gagal mengambil data:", err);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Efek Inisialisasi
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    const loc = saved ? JSON.parse(saved) : info;
    if (saved) setInfo(loc);
    fetchData(loc.id);
  }, [fetchData]);

  // 3. Handler Pencarian Lokasi
  const handleSearch = (q) => {
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
      } catch (err) {
        console.error("Gagal cari kota:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  // 4. Kalender Masehi Mini (Tetap menampilkan Februari sebagai bulan mulai)
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(CONFIG.YEAR, CONFIG.START_MONTH - 1, 1).getDay();
    const daysInMonth = new Date(CONFIG.YEAR, CONFIG.START_MONTH, 0).getDate();
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
      {/* HEADER BANNER */}
      <header className="bg-emerald-900 text-white p-8 md:p-14 shadow-xl relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6 text-center md:text-left">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3 justify-center md:justify-start">
              <Moon className="text-yellow-400 fill-yellow-400" /> Jadwal Imsakiyah 1447 H
            </h1>
            <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md transition-all group font-bold">
              <MapPin size={18} className="text-emerald-400" />
              <span className="uppercase tracking-widest text-sm">{info.lokasi}</span>
            </button>
          </div>
          <div className="bg-black/20 px-8 py-5 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 text-emerald-200">Februari - Maret 2026</p>
            <p className="text-xl font-bold tracking-tight text-emerald-100">Ramadhan 1447 H</p>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 text-[12rem] font-black opacity-5 italic select-none text-white">1447</div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* KOLOM KIRI: KALENDER MASEHI MINI */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-white p-6 md:p-8 text-black">
              <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-50">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Februari 2026</h3>
                <CalendarIcon className="text-emerald-600" size={18} />
              </div>
              <div className="grid grid-cols-7 gap-2">
                {["M", "S", "S", "R", "K", "J", "S"].map((day, idx) => (
                  <div key={`head-${idx}`} className="text-center text-[10px] font-black text-slate-300 py-2">
                    {day}
                  </div>
                ))}
                {calendarGrid.map((item, i) => (
                  <CalendarCell key={`cell-${i}`} item={item} />
                ))}
              </div>
              <div className="mt-8 p-5 bg-emerald-50 rounded-3xl border border-emerald-100 text-center text-black">
                <p className="text-[10px] text-emerald-600 font-black uppercase mb-1 tracking-widest">Informasi Utama</p>
                <p className="text-sm font-bold text-emerald-700">1 Ramadhan: 19 Februari 2026</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Berakhir sekitar 20 Maret 2026</p>
              </div>
            </div>
          </aside>

          {/* KOLOM KANAN: JADWAL RAMADAN (30 HARI) */}
          <section className="lg:col-span-8 space-y-5">
            {loading ? (
              <div className="bg-white rounded-[2.5rem] p-20 flex flex-col items-center shadow-xl text-black">
                <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center">Menyusun Jadwal Ibadah...</p>
              </div>
            ) : schedule.length > 0 ? (
              schedule.map((day, idx) => <ScheduleCard key={`day-${idx}-${day.tanggal}`} day={day} ramadanIdx={idx + 1} />)
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] text-center border-2 border-dashed border-slate-200 text-black">
                <p className="text-slate-400 font-medium">Jadwal tidak ditemukan untuk wilayah ini pada periode tersebut.</p>
                <button onClick={() => fetchData(info.id)} className="mt-4 text-emerald-600 font-bold text-sm underline underline-offset-4">
                  Coba Muat Ulang
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* SEARCH MODAL */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-white">
            <div className="flex justify-between items-center mb-6 text-black">
              <h3 className="font-black text-xl tracking-tight uppercase">Cari Wilayah</h3>
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
              <input autoFocus type="text" placeholder="Masukkan nama kota..." className="w-full pl-12 pr-12 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-black transition-all" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2">{isSearching ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} className="text-slate-300" />}</div>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
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

function CalendarCell({ item }) {
  if (item.type === "empty") return <div className="aspect-square" />;

  const today = new Date();
  const isToday = item.date === today.getDate() && today.getMonth() === 1 && today.getFullYear() === 2026;
  const isRamadan = item.hijri !== null;

  return (
    <div
      className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all
      ${isToday ? "bg-emerald-600 border-emerald-500 text-white shadow-lg scale-110 z-10 font-bold" : "bg-slate-50/50 border-transparent text-slate-400"}
      ${isRamadan && !isToday ? "bg-emerald-50 border-emerald-100 text-emerald-800" : ""}
    `}
    >
      <span className="text-xs font-black leading-none">{String(item.date)}</span>
      {isRamadan && <span className={`text-[7px] font-bold mt-0.5 ${isToday ? "text-emerald-100" : "text-emerald-500"}`}>{String(item.hijri)} RAM</span>}
    </div>
  );
}

function ScheduleCard({ day, ramadanIdx }) {
  // Parsing ulang untuk pengecekan hari ini (Bisa Februari atau Maret)
  const datePart = day.tanggal.includes(", ") ? day.tanggal.split(", ")[1] : day.tanggal;
  const [dayInt, monthInt, yearInt] = datePart.split("/").map(Number);

  const today = new Date();
  const isToday = dayInt === today.getDate() && monthInt === today.getMonth() + 1 && yearInt === today.getFullYear();

  return (
    <div className={`bg-white rounded-[2.5rem] p-7 shadow-sm border transition-all duration-300 ${isToday ? "ring-4 ring-emerald-500/20 border-emerald-500 bg-emerald-50/20 scale-[1.01]" : "border-slate-100 hover:border-emerald-200"}`}>
      <div className="flex justify-between items-start mb-6 text-black">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center font-black bg-emerald-600 text-white shadow-lg">
            <span className="text-xl leading-none">{String(ramadanIdx)}</span>
            <span className="text-[7px] uppercase tracking-tighter">RAM</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Ramadhan ke-{String(ramadanIdx)}</p>
            <h4 className="font-bold text-slate-800 tracking-tight leading-none text-lg">{day.tanggal}</h4>
          </div>
        </div>
        {isToday && (
          <div className="bg-emerald-600 text-white text-[8px] font-black px-4 py-2 rounded-full tracking-[0.2em] animate-pulse shadow-md uppercase flex items-center gap-2">
            <Clock size={12} /> Hari Ini
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <TimeBox label="Imsak" time={day.imsak} icon={<Moon size={12} />} />
        <TimeBox label="Subuh" time={day.subuh} icon={<Sunrise size={12} />} />
        <TimeBox label="Dzuhur" time={day.dzuhur} icon={<Sun size={12} />} />
        <TimeBox label="Ashar" time={day.ashar} icon={<Sun size={12} />} />
        <TimeBox label="Maghrib" time={day.maghrib} icon={<Sunset size={12} />} isHighlight />
        <TimeBox label="Isya" time={day.isya} icon={<CloudMoon size={12} />} />
      </div>
    </div>
  );
}

function TimeBox({ label, time, icon, isHighlight = false }) {
  return (
    <div
      className={`p-4 rounded-[1.5rem] border transition-all flex flex-col items-center text-center
      ${isHighlight ? "bg-emerald-700 border-emerald-800 text-white shadow-lg scale-105" : "bg-slate-50 border-slate-100 text-slate-600"}
    `}
    >
      <div className={`mb-2 ${isHighlight ? "text-emerald-200" : "text-slate-400"}`}>{icon}</div>
      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isHighlight ? "text-emerald-200 opacity-80" : "opacity-60"}`}>{label}</p>
      <p className={`text-sm font-black tracking-tighter ${isHighlight ? "text-white" : "text-slate-800"}`}>{time}</p>
    </div>
  );
}
