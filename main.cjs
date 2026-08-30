const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'favicon/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Hide the default electron menu bar
  win.setMenu(null);

  // Load the root index.html which routes to Viewer/Editor/Embed
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for "Save As" - Opens Native Windows Save Dialog
ipcMain.handle('save-file-dialog', async (event, content, defaultFilename) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultFilename || 'scene.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }
  return null; // User cancelled
});

// IPC Handler for "Save" - Overwrites silently without dialog
ipcMain.handle('save-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save file natively:', error);
    return false;
  }
});
