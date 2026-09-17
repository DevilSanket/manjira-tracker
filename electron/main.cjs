const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let server = null;
let serverPort = null;

// MIME type dictionary for offline loopback static server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

function startStaticServer(distPath) {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let safePath = decodeURI(req.url.split('?')[0]);
        if (safePath === '/' || safePath === '') {
          safePath = '/index.html';
        }

        let filePath = path.join(distPath, safePath);

        // Security check: ensure filePath is inside distPath
        if (!filePath.startsWith(distPath)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        // If file doesn't exist, fallback to index.html for SPA routing
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distPath, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const fileStream = fs.createReadStream(filePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        fileStream.pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.message);
      }
    });

    // Listen on 127.0.0.1 with port 0 to automatically acquire an open port
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      serverPort = address.port;
      console.log(`[Electron] Internal offline server active at http://127.0.0.1:${serverPort}`);
      resolve(serverPort);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'Manjira Tracker',
    backgroundColor: '#020617', // Slate 950
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000';

  if (isDev && process.env.USE_DEV_SERVER === 'true') {
    console.log(`[Electron] Loading development URL: ${devUrl}`);
    await mainWindow.loadURL(devUrl);
  } else {
    // Production / Packaged: serve dist folder via internal loopback server
    const distPath = path.join(__dirname, '../dist');
    if (!server) {
      await startStaticServer(distPath);
    }
    await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
