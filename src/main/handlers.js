import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { watch } from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
import MarkdownIt from 'markdown-it'

let watchers = new Map()

export function setupHandlers() {
  const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true
  })

  ipcMain.handle('files:export-pdf', async (event, fileName, content) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: fileName.replace('.md', '.pdf'),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) return null

    // Create a hidden window to render the PDF
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                padding: 40px;
                line-height: 1.6;
                color: #333;
              }
              pre {
                background: #f4f4f4;
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
              }
              code {
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
                background: #f4f4f4;
                padding: 2px 4px;
                border-radius: 3px;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              blockquote {
                border-left: 4px solid #ddd;
                padding-left: 15px;
                color: #666;
                margin: 20px 0;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin: 20px 0;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              th {
                background: #f8f8f8;
              }
            </style>
          </head>
          <body>
            ${md.render(content.replace(/<br\s*\/?>/gi, '\n'))}
          </body>
        </html>
      `

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: 'default' }
      })

      await fs.writeFile(filePath, pdf)
      return filePath
    } catch (error) {
      console.error('PDF generation error:', error)
      throw error
    } finally {
      printWindow.close()
    }
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  // --- File Handlers ---
  ipcMain.handle('files:select-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (canceled) return null
    return filePaths[0]
  })

  ipcMain.handle('files:list', async (event, dirPath) => {
    try {
      // Setup watcher for this directory if not already watching
      if (!watchers.has(dirPath)) {
        try {
          const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
            if (filename) {
              const win = BrowserWindow.fromWebContents(event.sender)
              if (win) {
                win.webContents.send('files:changed')
              }
            }
          })
          watchers.set(dirPath, watcher)
        } catch (e) {
          console.warn(`Failed to watch directory ${dirPath}:`, e)
        }
      }

      async function getFiles(dir) {
        const dirents = await fs.readdir(dir, { withFileTypes: true })
        const results = await Promise.all(dirents.map(async (dirent) => {
          const res = path.resolve(dir, dirent.name)
          if (dirent.isDirectory()) {
            if (dirent.name === '.git' || dirent.name === 'node_modules') return []
            // Return the directory itself plus its contents
            const children = await getFiles(res)
            return [
              {
                name: dirent.name,
                path: res,
                id: res,
                type: 'folder'
              },
              ...children
            ]
          } else {
            // Define supported file extensions
            const supportedExtensions = ['.md', '.txt', '.text', '.yml', '.jpg', '.png', '.json']
            const ext = path.extname(dirent.name).toLowerCase()
            
            if (supportedExtensions.includes(ext)) {
              return [{
                name: dirent.name,
                path: res,
                id: res,
                type: 'file'
              }]
            }
            return []
          }
        }))
        return results.flat()
      }
      return await getFiles(dirPath)
    } catch (error) {
      console.error('Error listing files:', error)
      throw error
    }
  })

  ipcMain.handle('files:create-folder', async (_, dirPath, folderName) => {
    try {
      const folderPath = path.join(dirPath, folderName)
      await fs.mkdir(folderPath, { recursive: true })
      return { name: folderName, path: folderPath, id: folderPath, type: 'folder' }
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  })

  ipcMain.handle('files:read', async (_, filePath) => {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error('Error reading file:', error)
      throw error
    }
  })

  ipcMain.handle('files:write', async (_, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return true
    } catch (error) {
      console.error('Error writing file:', error)
      throw error
    }
  })

  ipcMain.handle('files:create', async (_, dirPath, fileName) => {
    try {
      const filePath = path.join(dirPath, fileName.endsWith('.md') ? fileName : `${fileName}.md`)
      await fs.writeFile(filePath, '', 'utf-8')
      return { name: path.basename(filePath), path: filePath, id: filePath }
    } catch (error) {
      console.error('Error creating file:', error)
      throw error
    }
  })

  ipcMain.handle('files:delete', async (_, filePath) => {
    try {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true })
      } else {
        await fs.unlink(filePath)
      }
      return true
    } catch (error) {
      console.error('Error deleting file/folder:', error)
      throw error
    }
  })

  ipcMain.handle('files:move', async (_, oldPath, newPath) => {
    try {
      // Check if destination exists
      try {
        await fs.access(newPath)
        // If exists, throw error or handle conflict (here we throw)
        throw new Error('Destination already exists')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }

      await fs.rename(oldPath, newPath)
      return true
    } catch (error) {
      console.error('Error moving file/folder:', error)
      throw error
    }
  })

  ipcMain.handle('files:search', async (_, dirPaths, query) => {
    try {
      const paths = Array.isArray(dirPaths) ? dirPaths : [dirPaths]
      const results = []

      async function searchDir(currentPath, rootPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)
          
          if (entry.isDirectory()) {
            if (entry.name === '.git' || entry.name === 'node_modules') continue
            await searchDir(fullPath, rootPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            const supportedExtensions = ['.md', '.txt', '.text', '.yml', '.json']
            
            if (supportedExtensions.includes(ext)) {
              const content = await fs.readFile(fullPath, 'utf-8')
              if (entry.name.toLowerCase().includes(query.toLowerCase()) || 
                  content.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  name: entry.name,
                  path: fullPath,
                  id: fullPath,
                  workspacePath: rootPath,
                  workspaceName: path.basename(rootPath),
                  // Simple excerpt
                  excerpt: content.substring(0, 100).replace(/\n/g, ' ') + '...'
                })
              }
            }
          }
        }
      }

      for (const rootPath of paths) {
        if (await fs.stat(rootPath).then(s => s.isDirectory()).catch(() => false)) {
          await searchDir(rootPath, rootPath)
        }
      }

      return results
    } catch (error) {
      console.error('Error searching files:', error)
      throw error
    }
  })

  // --- Git Handlers ---
  ipcMain.handle('git:status', async (_, repoPath) => {
    try {
      const git = simpleGit(repoPath)
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return { isRepo: false }

      const status = await git.status()
      // Check for remote updates (behind/ahead)
      try {
        await git.fetch()
      } catch (e) {
        console.warn('Git fetch failed, skipping remote status')
      }
      const summary = await git.status()

      // Get current user info
      let user = { name: 'Unknown', email: '' }
      try {
        const config = await git.listConfig()
        user.name = config.all['user.name'] || 'Unknown'
        user.email = config.all['user.email'] || ''
      } catch (e) {
        console.warn('Failed to get git user config')
      }

      return {
        isRepo: true,
        not_added: status.not_added,
        modified: status.modified,
        deleted: status.deleted,
        ahead: summary.ahead,
        behind: summary.behind,
        current: summary.current,
        tracking: summary.tracking,
        user
      }
    } catch (error) {
      console.error('Git status error:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('git:sync', async (_, repoPath) => {
    try {
      const git = simpleGit(repoPath)
      
      // 1. Try to pull first
      try {
        await git.pull()
      } catch (pullError) {
        if (pullError.message.includes('conflict')) {
          return { success: false, error: 'CONFLICT', message: '检测到合并冲突，请手动解决' }
        }
        // If no remote yet, ignore pull error
        if (!pullError.message.includes('No remote repository')) {
          throw pullError
        }
      }

      // 2. add -> commit -> push
      const status = await git.status()
      if (status.files.length > 0) {
        await git.add('.')
        await git.commit(`Auto-sync from NoteEver: ${new Date().toLocaleString()}`)
        try {
          await git.push()
        } catch (pushError) {
          if (pushError.message.includes('Authentication failed') || pushError.message.includes('could not read Username')) {
            return { success: false, error: 'AUTH_REQUIRED', message: '需要身份验证，请先登录 Git' }
          }
          if (pushError.message.includes('Could not resolve host') || pushError.message.includes('Connection timed out')) {
            return { success: false, error: 'NETWORK_ERROR', message: '无法连接到远程仓库，请检查网络设置' }
          }
          throw pushError
        }
      }
      
      return { success: true }
    } catch (error) {
      console.error('Git sync error:', error)
      return { success: false, error: 'SYNC_FAILED', message: error.message }
    }
  })

  // --- Background Image Handlers ---
  ipcMain.handle('background:upload', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
      })

      if (canceled || filePaths.length === 0) return null

      const userDataPath = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 'NoteEver', 'backgrounds')
      await fs.mkdir(userDataPath, { recursive: true })

      const sourcePath = filePaths[0]
      const fileName = `${Date.now()}_${path.basename(sourcePath)}`
      const targetPath = path.join(userDataPath, fileName)

      await fs.copyFile(sourcePath, targetPath)
      
      // Return the file path in local-resource format
      return `local-resource://${targetPath}`
    } catch (error) {
      console.error('Error uploading background:', error)
      throw error
    }
  })

  ipcMain.handle('background:list', async () => {
    try {
      const userDataPath = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 'NoteEver', 'backgrounds')
      await fs.mkdir(userDataPath, { recursive: true })
      
      const files = await fs.readdir(userDataPath)
      return files
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => `local-resource://${path.join(userDataPath, f)}`)
    } catch (error) {
      console.error('Error listing backgrounds:', error)
      return []
    }
  })

  ipcMain.handle('background:delete', async (_, bgPath) => {
    try {
      // bgPath is in local-resource:// format
      const actualPath = bgPath.replace('local-resource://', '')
      await fs.unlink(actualPath)
      return true
    } catch (error) {
      console.error('Error deleting background:', error)
      throw error
    }
  })

  ipcMain.handle('git:init', async (_, repoPath) => {
    try {
      const git = simpleGit(repoPath)
      await git.init()
      return { success: true }
    } catch (error) {
      console.error('Git init error:', error)
      throw error
    }
  })

  ipcMain.handle('git:clone', async (_, url, repoPath) => {
    try {
      await simpleGit().clone(url, repoPath)
      return { success: true }
    } catch (error) {
      console.error('Git clone error:', error)
      throw error
    }
  })

  ipcMain.handle('git:login', async (event) => {
    const win = new BrowserWindow({
      width: 600,
      height: 800,
      parent: BrowserWindow.fromWebContents(event.sender),
      modal: true,
      show: false,
      title: 'Git 身份验证',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Handle load failures (like timeouts)
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load login page:', errorCode, errorDescription)
      win.webContents.executeJavaScript(`
        document.body.innerHTML = \`
          <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #333;">
            <h2 style="color: #d32f2f;">网络连接失败</h2>
            <p>无法连接到 GitHub 登录页面 (错误: ${errorDescription})</p>
            <p style="font-size: 14px; color: #666;">请检查您的网络连接或代理设置后重试。</p>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
              重试
            </button>
          </div>
        \`;
      `)
      win.show() // Show the window even if it failed, to show our error message
    })

    win.loadURL('https://github.com/login')
    win.once('ready-to-show', () => win.show())

    return new Promise((resolve) => {
      win.on('closed', () => {
        resolve({ success: true })
      })
    })
  })
}
