const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (content, defaultFilename) => ipcRenderer.invoke('save-file-dialog', content, defaultFilename),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  getPathForFile: (file) => {
    try {
      if (webUtils && webUtils.getPathForFile) {
        return webUtils.getPathForFile(file);
      }
      return file.path; // Fallback
    } catch (e) {
      return file.path;
    }
  }
});
