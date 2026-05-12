import { app, BrowserWindow, protocol, net } from 'electron';
import * as path from 'path';
import * as url from 'url';

const isDev = !app.isPackaged;

function waitForUrl(targetUrl: string, timeout = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      fetch(targetUrl)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${targetUrl}`));
          setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

function createWindow(loadUrl: string): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(loadUrl);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  if (isDev) {
    const devUrl = 'http://localhost:5173';
    console.log('[electron] waiting for Vite + backend...');
    await Promise.all([
      waitForUrl(devUrl),
      waitForUrl('http://localhost:8080/health'),
    ]);
    createWindow(devUrl);
  } else {
    // Serve the built frontend from app resources via a custom protocol
    // so that react-router history-mode navigation works correctly.
    protocol.handle('app', (request) => {
      const { pathname } = new url.URL(request.url);
      const distDir = path.join(__dirname, '../../frontend/dist');
      const filePath = path.join(distDir, pathname);
      // For SPA routes that don't map to a real file, serve index.html
      return net.fetch(url.pathToFileURL(filePath).toString()).catch(() =>
        net.fetch(url.pathToFileURL(path.join(distDir, 'index.html')).toString())
      );
    });
    createWindow('app://app/index.html');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(isDev ? 'http://localhost:5173' : 'app://app/index.html');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
