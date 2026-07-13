@echo off
echo ==========================================
echo    V380 NVR - Restarting Services (Win)
echo ==========================================
echo.

echo [1/3] Mematikan proses NodeJS dan NextJS yang sedang berjalan...
:: Mencari dan mematikan semua proses node.exe
taskkill /f /im node.exe >nul 2>&1
echo   - Proses lama berhasil dibersihkan.
echo.

echo [2/3] Menjalankan Backend API...
cd backend
:: Jalankan backend di background
start "V380 Backend Server" cmd /c "npm run dev"
cd ..
echo   - Backend Server berjalan di jendela baru (Port 4000).
echo.

echo [3/3] Menjalankan Frontend Next.js...
cd frontend
:: Jalankan frontend di background
start "V380 Frontend App" cmd /c "npm run dev"
cd ..
echo   - Frontend App berjalan di jendela baru (Port 5050).
echo.

echo ==========================================
echo SEMUA SERVICE BERHASIL DI-RESTART!
echo Silakan akses http://localhost:5050
echo ==========================================
pause
