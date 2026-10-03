const { app, BrowserWindow, Tray, Menu, shell, dialog, Notification, utilityProcess } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

const PORT = 5050;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

// Stabilize Chromium/Electron under Wine and older Windows graphics stacks.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-features', 'UseDComp,DirectComposition');

function log(...args) {
  try {
    const logDir = app.getPath('userData');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'app.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${args.join(' ')}\n`);
  } catch (e) {}
  console.log(...args);
}

function getIconPath() {
  const isDev = !app.isPackaged;
  const basePath = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath;

  const candidates = [
    path.join(basePath, 'frontend', 'public', 'favicon.ico'),
    path.join(basePath, 'frontend', 'out', 'favicon.ico'),
    path.join(__dirname, 'icon.ico'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return undefined;
}

function startBackend() {
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(PORT);

  const isDev = !app.isPackaged;
  const candidatePaths = [
    isDev ? path.join(__dirname, '..', 'backend', 'dist', 'index.js') : '',
    path.join(process.resourcesPath, 'backend', 'dist', 'index.js'),
    path.join(__dirname, '..', 'backend', 'dist', 'index.js'),
  ].filter(Boolean);

  const backendPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

  try {
    log('[Electron] Loading backend in-process via require:', backendPath);
    require(backendPath);
    log('[Electron] Backend module loaded successfully in-process.');
  } catch (err) {
    log('[Electron] In-process require failed, falling back to utilityProcess.fork:', err.message);
    try {
      backendProcess = utilityProcess.fork(backendPath, [], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(PORT),
        },
        stdio: 'inherit',
      });

      backendProcess.on('error', (e) => {
        log('[Electron] Error spawning backend process:', e.message);
      });

      backendProcess.on('exit', (code) => {
        log(`[Electron] Backend process exited with code ${code}`);
        if (!isQuitting && code !== 0) {
          dialog.showErrorBox(
            'V380 NVR Service Terhenti',
            `Service backend NVR berhenti tidak normal (Code: ${code}).`
          );
        }
      });
    } catch (forkErr) {
      log('[Electron] Both in-process and utilityProcess failed:', forkErr.message);
    }
  }
}

function waitForServer(callback, retries = 30) {
  const req = http.get(`${SERVER_URL}/health`, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(callback, retries - 1), 600);
    }
  });

  req.on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(callback, retries - 1), 600);
    } else {
      dialog.showErrorBox(
        'Gagal Membuka Server',
        'V380 NVR Server gagal online dalam batas waktu yang ditentukan.'
      );
      app.quit();
    }
  });
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'V380 NVR Desktop',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'V380 NVR',
            body: 'NVR tetap merekam di latar belakang. Klik ikon di tray untuk membuka jendela.',
            icon: iconPath,
          }).show();
        }
      } catch (e) {
        console.warn('[Electron] Notification error ignored:', e.message);
      }
    }
    return false;
  });
}

function createTray() {
  try {
    const iconPath = getIconPath();
    if (!iconPath) return;

    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Buka Dashboard NVR',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Buka Folder Rekaman',
        click: () => {
          const isDev = !app.isPackaged;
          const recDir = path.join(
            isDev ? path.join(__dirname, '..') : process.resourcesPath,
            'backend',
            'recordings'
          );
          if (fs.existsSync(recDir)) {
            shell.openPath(recDir);
          } else {
            dialog.showMessageBox({
              type: 'info',
              message: 'Folder rekaman belum dibuat atau masih kosong.',
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Keluar & Hentikan NVR',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('V380 NVR - Continuous Recording Active');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('[Electron] System tray initialization skipped:', err.message);
  }
}

// Single instance lock agar aplikasi tidak jalan dobel
const gotTheLock = app.requestSingleInstanceLock();
log('requestSingleInstanceLock result:', gotTheLock);

if (!gotTheLock) {
  log('Another instance detected. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Second instance attempted.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    log('app.whenReady reached. Starting backend...');
    startBackend();
    waitForServer(() => {
      log('Server is healthy! Creating window and tray...');
      createWindow();
      createTray();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (backendProcess) {
      console.log('[Electron] Terminating backend process before quit...');
      backendProcess.kill();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'win32' && isQuitting) {
      app.quit();
    }
  });
}
