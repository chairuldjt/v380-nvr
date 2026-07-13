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

echo "[3/3] Menjalankan atau merestart layanan dengan PM2..."
# Gunakan startOrRestart dengan --update-env agar tidak menghapus process existing
# dan mencegah ID auto-increment terus menerus setiap kali script dijalankan
pm2 startOrRestart ecosystem.config.js --update-env

# Simpan konfigurasi PM2 agar otomatis berjalan saat server reboot
pm2 save

echo ""
echo "=========================================="
echo "V380 NVR berhasil dijalankan dengan PM2!"
echo "------------------------------------------"
echo "Akses Dashboard: http://localhost:5050"
echo "Cek Status PM2 : pm2 status"
echo "Cek Logs       : pm2 logs"
echo "Stop Aplikasi  : pm2 stop ecosystem.config.js"
echo "=========================================="
