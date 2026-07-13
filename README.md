# V380 NVR (Network Video Recorder)

An open-source, highly efficient Network Video Recorder (NVR) built specifically for V380 and V380 Pro IP Cameras. It provides a modern web interface for live monitoring, PTZ control, continuous video recording, and playback, eliminating the need for expensive proprietary hardware.

## ✨ Features

- **Live View Monitoring:** Customizable grid layouts (1x1, 2x2, 3x3, 4x4) with responsive UI for both Desktop and Mobile.
- **PTZ Control:** Pan, Tilt, and Zoom your cameras directly from the dashboard.
- **Continuous Recording (24/7):** Rock-solid recording engine utilizing FFmpeg and Matroska (`.mkv`) segmentation. It perfectly handles timestamp gaps native to cheap IP cameras without corrupting files.
- **ONVIF Bypass Mode:** For cameras that support ONVIF, the NVR connects directly to the raw RTSP stream, bypassing the local decoder for near **0% CPU usage**.
- **Playback & Timeline:** Watch past recordings with a visual timeline slider, with selectable playback speeds and clip downloads.
- **Storage Management:** Automatic purging of old recordings based on maximum storage limits (GB) or retention days.
- **Role-Based Access Control:** Secure JWT authentication.
  - *Admin:* Full access to configuration, storage settings, and user management.
  - *Operator:* Read-only access to Live View and Playback.

## 🛠 Tech Stack

- **Frontend:** Next.js 15+ (App Router), React, Tailwind CSS, Shadcn UI
- **Backend:** Node.js, Express, Prisma (SQLite)
- **Video Engine:** FFmpeg, V380Decoder (Custom binary for V380 proprietary streams)

## 📋 Prerequisites

1. **Node.js** (v18 or newer)
2. **FFmpeg** (Must be installed and added to system PATH)
3. **V380Decoder Binaries** (Placed inside `backend/bin/`)

## 🚀 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/chairuldjt/v380-nvr.git
   cd v380-nvr
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   
   # Copy environment file
   cp .env.example .env
   
   # Initialize SQLite Database
   npx prisma db push
   npx prisma generate
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Running the Application (Development Mode)**
   For Windows users, simply run the provided batch script from the root directory:
   ```bash
   ./restart.bat
   ```
   For Linux/macOS users:
   ```bash
   ./restart.sh
   ```

   The web interface will be accessible at `http://localhost:3000`.

5. **Production Deployment (Linux with PM2)**
   It is highly recommended to run the NVR using PM2 in a production environment to ensure processes automatically restart if they crash.
   ```bash
   # Run the provided PM2 setup script (it will build the frontend and start services)
   chmod +x start-pm2.sh
   ./start-pm2.sh
   ```
   
   Helpful PM2 Commands:
   ```bash
   pm2 status             # Show running services
   pm2 logs               # View application logs
   pm2 restart all        # Restart all services
   ```

## ⚙️ Configuration

- **Default Login:**
  - Username: `admin`
  - Password: `admin123`
  *(Generated automatically if you run `npm run seed` in the backend)*
- **Storage Folder:** All video recordings are saved locally inside `backend/recordings/`.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
