#!/bin/bash

echo "=========================================="
echo "   V380 NVR - PM2 Production Start (Linux)"
echo "=========================================="
echo ""

# Pastikan PM2 sudah diinstal
if ! command -v pm2 &> /dev/null
then
    echo "[!] PM2 belum diinstal. Menginstal PM2 secara global..."
    sudo npm install -g pm2
fi

echo "[1/3] Menyiapkan folder logs..."
mkdir -p logs

echo "[2/3] Membangun (Build) Frontend Next.js untuk Production..."
cd frontend
npm run build
cd ..

echo "[3/3] Menjalankan layanan dengan PM2..."
# Hentikan dan hapus instance lama jika ada
pm2 delete ecosystem.config.js 2>/dev/null || true

# Jalankan dengan ecosystem.config.js
pm2 start ecosystem.config.js

# Simpan konfigurasi PM2 agar otomatis berjalan saat server reboot
pm2 save

echo ""
echo "=========================================="
echo "V380 NVR berhasil dijalankan dengan PM2!"
echo "------------------------------------------"
echo "Akses Dashboard: http://localhost:3000"
echo "Cek Status PM2 : pm2 status"
echo "Cek Logs       : pm2 logs"
echo "Stop Aplikasi  : pm2 stop ecosystem.config.js"
echo "=========================================="
