#!/bin/bash

echo "=========================================="
echo "   V380 NVR - Restarting Services (Linux)"
echo "=========================================="
echo ""

echo "[1/3] Mematikan proses NodeJS dan NextJS yang sedang berjalan..."
# Mematikan proses node (backend & frontend) pada port yang spesifik atau global node process
pkill -f "node" || true
pkill -f "next" || true
echo "  - Proses lama berhasil dibersihkan."
echo ""

echo "[2/3] Menjalankan Backend API..."
cd backend
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "  - Backend Server berjalan di background (PID: $BACKEND_PID, Port 4000)."
echo ""

echo "[3/3] Menjalankan Frontend Next.js..."
cd frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "  - Frontend App berjalan di background (PID: $FRONTEND_PID, Port 5050)."
echo ""

echo "=========================================="
echo "SEMUA SERVICE BERHASIL DI-RESTART!"
echo "Silakan akses http://localhost:5050"
echo "Untuk menghentikan jalankan command: pkill -f node"
echo "=========================================="
