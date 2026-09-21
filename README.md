# Daily Traffic Report Generator — PERURI DCC

App buat generate format "Daily Traffic Layanan PERURI Digital Contact
Center" (Month-to-Date) otomatis dari 3 raw report, langsung siap copas ke
WhatsApp.

## Cara pakai

1. Upload 3 file raw (.xlsx atau .csv, komposisi kolom sama):
   - `report_ticket_*` — sumber COF/ACD/AHT Email & WhatsApp + Top KIP
   - `report_detail_interaction_voice_*` — sumber metrik Voice
   - `report_detail_interaction_*` — sumber Response Time Email & WhatsApp
2. Kalau raw .xlsx-nya keimpor dengan angka/tanggal berawalan tanda kutip
   (`'`, misal dari export Omnix/monitoring tiket), centang opsi "Raw pakai
   format tanda kutip" di bawah area upload. File `.csv` selalu dicek
   otomatis tanpa perlu centang ini (CSV gak punya tipe cell asli, jadi
   semua kolom program dicek).
3. Pilih tanggal report (metrik dihitung Month-to-Date: tanggal 1 bulan itu
   sampai tanggal yang dipilih, inklusif).
4. Isi manual bagian "Kehadiran SDM Layanan" (gak ada di raw manapun).
5. Klik **Generate Report**, lalu **Copy**. Dua grafik otomatis ikut
   ke-generate di bawahnya:
   - **Grafik Harian** — stacked bar Voice/Email/WhatsApp per hari (MTD)
   - **Grafik Response Time Harian** — line chart pergerakan Response Time
     per hari, Email (oranye) vs WhatsApp (hijau), dari raw detail
     interaction yang sama (logic sort+shift IN/OUT), dipecah per hari
     bukan di-rata-rata MTD

   Tombol **Download PNG** di kedua grafik selalu render ulang di canvas
   resolusi tetap (lebar menyesuaikan jumlah hari, font gak ikut menyusut di
   HP) supaya hasil gambarnya tetap rapi dan gak miring labelnya, dari
   device manapun di-generate-nya.

## Logic perhitungan (ringkas)

- **Voice**: COF = total baris interaksi voice (bulan berjalan s/d tanggal
  terpilih). ACD = baris yang event-nya bukan ABANDON/ABANDONED. AHT = rata2
  talktime (detik) dari baris ACD. SCR = ACD/COF, target selalu 90.00%.
- **Email**: dari raw ticket, exclude `source_name = "EOS Monitoring"`. COF =
  ACD = jumlah tiket channel Email. AHT = rata2 `date_end_interaction -
  date_start_interaction` (detik).
- **WhatsApp**: sama seperti Email, tapi COF/ACD digabung dengan tiket
  channel "Manual" (tetap exclude EOS Monitoring). AHT tetap dihitung dari
  channel WhatsApp saja (Manual tidak ikut AHT).
- **Response Time (Email & WhatsApp)**: dari raw detail interaction. Semua
  baris di-sort by `session_id` lalu kronologis. Tiap baris OUT yang
  didahului baris IN/OUT di session yang sama dihitung selisih
  `date_received`-nya terhadap baris sebelumnya. Nilai itu digeser satu baris
  ke atas (supaya nempel ke tanggal baris sebelumnya), lalu dirata-rata per
  channel.
- **Top 5 KIP All Channel**: dari raw ticket (excl EOS Monitoring, semua
  channel), dikelompokkan by `mainCategory - subCategory - detailSubCategory`,
  persentase terhadap total tiket dalam scope MTD tsb.

Detail lengkap ada di `src/lib/*.js` — tiap file punya komentar penjelasan
logic yang sudah divalidasi manual terhadap raw data asli.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output ada di folder `dist/`.

## Deploy ke Cloudflare Pages (gratis, gampang, satset)

### Opsi A — Drag & drop langsung (paling cepat, gak perlu GitHub)

1. Jalanin `npm run build` di lokal (atau pakai folder `dist/` yang udah
   di-build).
2. Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers &
   Pages** → **Create** → tab **Pages** → **Upload assets**.
3. Drag folder `dist/` (isi-nya, bukan foldernya) ke area upload.
4. Selesai — langsung dapet URL `*.pages.dev`.

### Opsi B — Connect ke GitHub (auto-deploy tiap push, mirip Netlify)

1. Push project ini (tanpa `node_modules` & `dist`, sudah ada di
   `.gitignore`) ke repo GitHub baru.
2. Di Cloudflare dashboard → **Workers & Pages** → **Create** → tab
   **Pages** → **Connect to Git** → pilih repo-nya.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. Setiap kali push ke branch utama, otomatis re-deploy.

Gak butuh env var atau Cloudflare Worker apapun — semua parsing Excel dan
perhitungan jalan 100% di browser (client-side), jadi cocok banget buat
hosting statis kayak Cloudflare Pages / GitHub Pages / Vercel.
