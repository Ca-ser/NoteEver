import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
console.log('Preload script loading, version: 1.29.0')
const api = {
  // Dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // File operations
  selectDirectory: () => ipcRenderer.invoke('files:select-directory'),
  listFiles: (dirPath) => ipcRenderer.invoke('files:list', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('files:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('files:write', filePath, content),
  createFile: (dirPath, fileName) => ipcRenderer.invoke('files:create', dirPath, fileName),
  createFolder: (dirPath, folderName) => ipcRenderer.invoke('files:create-folder', dirPath, folderName),
  deleteFile: (filePath) => ipcRenderer.invoke('files:delete', filePath),
  moveFile: (oldPath, newPath) => ipcRenderer.invoke('files:move', oldPath, newPath),
  searchFiles: (dirPath, query) => ipcRenderer.invoke('files:search', dirPath, query),
  exportPDF: (fileName, content) => ipcRenderer.invoke('files:export-pdf', fileName, content),
  
  // Git operations
  gitStatus: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
  gitSync: (repoPath) => ipcRenderer.invoke('git:sync', repoPath),
  gitInit: (repoPath) => ipcRenderer.invoke('git:init', repoPath),
  gitClone: (url, repoPath) => ipcRenderer.invoke('git:clone', url, repoPath),
  gitLogin: () => ipcRenderer.invoke('git:login'),
  
  // Background operations
  uploadBackground: () => ipcRenderer.invoke('background:upload'),
  listBackgrounds: () => ipcRenderer.invoke('background:list'),
  deleteBackground: (bgPath) => ipcRenderer.invoke('background:delete'),
  
  // Events
  onFilesChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('files:changed', listener)
    return () => ipcRenderer.removeListener('files:changed', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
