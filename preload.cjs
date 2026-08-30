const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (content, defaultFilename) => ipcRenderer.invoke('save-file-dialog', content, defaultFilename),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content)
});
