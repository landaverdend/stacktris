import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';

const isDev = !app.isPackaged;
let backend: ChildProcess | null = null;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function waitForUrl(url: string, timeout = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${url}`));
          setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

function spawnBackend(port: number): ChildProcess {
  const entry = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'dist', 'index.js')
    : path.join(__dirname, '../../backend/dist/index.js');

  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });
  child.on('error', (err) => console.error('[electron] backend spawn error:', err));
  return child;
}

function createWindow(url: string): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(url);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  let url: string;

  if (isDev) {
    url = 'http://localhost:5173';
    console.log('[electron] dev mode — waiting for Vite + backend...');
    await Promise.all([
      waitForUrl(url),
      waitForUrl('http://localhost:8080/health'),
    ]);
  } else {
    const port = await freePort();
    console.log(`[electron] prod mode — starting backend on port ${port}`);
    backend = spawnBackend(port);
    await waitForUrl(`http://localhost:${port}/health`);
    url = `http://localhost:${port}`;
  }

  createWindow(url);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  backend?.kill();
});
