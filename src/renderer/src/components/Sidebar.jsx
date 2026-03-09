import { useState, useEffect, useCallback, useRef } from 'react'
import { Panel, Group } from 'react-resizable-panels'
import { ResizeHandle } from '../App'
import { 
  FolderOpen, 
  FileText, 
  Search, 
  Tag, 
  ChevronDown, 
  Plus, 
  Settings, 
  Trash2, 
  X,
  Folder,
  ChevronRight,
  List,
  Image as ImageIcon,
  FileCode,
  File
} from 'lucide-react'

function Sidebar({ onFileSelect, activeFile, workspace, setWorkspace, searchQuery, setSearchQuery, modules = { workspace: true, files: true, outline: true } }) {
  const [workspaces, setWorkspaces] = useState(() => {
    const saved = localStorage.getItem('workspaces')
    return saved ? JSON.parse(saved) : []
  })
  const [files, setFiles] = useState([])
  const [fileTree, setFileTree] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createType, setCreateType] = useState('file') // 'file' or 'folder'
  const [newFileName, setNewFileName] = useState('')
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true)
  const [isFilesOpen, setIsFilesOpen] = useState(true)
  const [isOutlineOpen, setIsOutlineOpen] = useState(true)
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']))

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isNewDropdownOpen && !event.target.closest('.new-dropdown-container')) {
        setIsNewDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isNewDropdownOpen])
  const [viewMode, setViewMode] = useState('tree') // 'tree' or 'list'
  const [outline, setOutline] = useState([])
  const verticalLayoutTimerRef = useRef(null)

  useEffect(() => {
    const parseOutline = () => {
      if (!activeFile) {
        setOutline([])
        return
      }
      
      // Only support markdown files for outline to avoid garbled content or showing comments as headings
      const isMarkdown = activeFile?.name?.toLowerCase().endsWith('.md')
      if (!isMarkdown) {
        setOutline([])
        return
      }

      window.api.readFile(activeFile.path).then(content => {
        const lines = content.split('\n')
        const headings = lines
          .filter(line => line.startsWith('#'))
          .map((line, index) => {
            const level = line.match(/^#+/)[0].length
            const text = line.replace(/^#+\s*/, '')
            return { id: `heading-${index}`, level, text }
          })
        setOutline(headings)
      })
    }
    parseOutline()
  }, [activeFile])

  useEffect(() => {
    localStorage.setItem('workspaces', JSON.stringify(workspaces))
  }, [workspaces])

  const buildFileTree = (fileList) => {
    const root = { name: 'root', children: [], type: 'folder', path: workspace }
    fileList.forEach(item => {
      const relativePath = item.path.replace(workspace, '').replace(/^[\\/]/, '')
      if (!relativePath) return

      const parts = relativePath.split(/[\\/]/)
      let current = root
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1
        
        // Ensure current has children array
        if (!current.children) {
          current.children = []
        }

        let existing = current.children.find(c => c.name === part)

        if (isLast) {
          if (!existing) {
            // If it's a folder from fileList, ensure it has children
            const newItem = { ...item }
            if (newItem.type === 'folder' && !newItem.children) {
              newItem.children = []
            }
            current.children.push(newItem)
          } else if (item.type === 'folder' && existing.type === 'folder') {
            // If it already exists as a folder (created by a child file), 
            // we just make sure it has the properties from the folder item
            Object.assign(existing, item)
            if (!existing.children) existing.children = []
          }
        } else {
          if (!existing) {
            const folderPath = current.path.endsWith('/') || current.path.endsWith('\\') 
              ? `${current.path}${part}` 
              : `${current.path}/${part}`
            existing = { name: part, children: [], type: 'folder', path: folderPath }
            current.children.push(existing)
          } else {
            // Ensure existing folder has children array if it's going to be a parent
            if (!existing.children) {
              existing.children = []
            }
          }
          current = existing
        }
      })
    })
    return root.children
  }

  const loadFiles = useCallback(async () => {
    if (!workspace) {
      setFiles([])
      setFileTree([])
      return
    }
    try {
      const fileList = await window.api.listFiles(workspace)
      setFiles(fileList)
      const tree = buildFileTree(fileList)
      setFileTree(tree)
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }, [workspace])

  useEffect(() => {
    // 监听来自主进程的文件变化通知
    const removeListener = window.api.onFilesChanged(() => {
      loadFiles();
    });
    
    return () => removeListener();
  }, [loadFiles])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase()
    switch (ext) {
      case 'md':
      case 'txt':
      case 'text':
        return <FileText size={14} className="shrink-0" />
      case 'yml':
      case 'yaml':
        return <FileCode size={14} className="shrink-0 text-orange-500" />
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        return <ImageIcon size={14} className="shrink-0 text-purple-500" />
      default:
        return <File size={14} className="shrink-0" />
    }
  }

  const handleDragStart = (e, node) => {
    e.stopPropagation()
    e.dataTransfer.setData('application/json', JSON.stringify({
      path: node.path,
      name: node.name,
      type: node.type
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    if (node.type === 'folder') {
      e.dataTransfer.dropEffect = 'move'
      e.currentTarget.classList.add('bg-blue-100')
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('bg-blue-100')
  }

  const handleDrop = async (e, targetNode) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.classList.remove('bg-blue-100')

    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    try {
      const sourceNode = JSON.parse(data)
      
      if (sourceNode.path === targetNode.path) return
      if (targetNode.type !== 'folder') return
      
      // Prevent moving parent into child
      if (sourceNode.type === 'folder' && targetNode.path.startsWith(sourceNode.path)) {
        return
      }

      // Determine separator
      const sep = targetNode.path.includes('\\') ? '\\' : '/'
      // Ensure no double separator
      const targetPath = targetNode.path.endsWith(sep) ? targetNode.path : targetNode.path + sep
      const newPath = targetPath + sourceNode.name
      
      if (newPath === sourceNode.path) return

      if (typeof window.api.moveFile !== 'function') {
        console.error('API Error: window.api.moveFile is not defined')
        alert('移动文件失败：API 未就绪，请尝试重启应用')
        return
      }

      await window.api.moveFile(sourceNode.path, newPath)
      
      // Update active file path if it was moved
      if (activeFile && activeFile.path === sourceNode.path) {
         onFileSelect({ ...activeFile, path: newPath })
      }
      
      await loadFiles()
    } catch (error) {
      console.error('Move failed:', error)
    }
  }

  const renderTree = (nodes, level = 0) => {
    if (!nodes || !Array.isArray(nodes)) return null
    return nodes.map(node => {
      const isExpanded = expandedFolders.has(node.path)
      if (node.type === 'folder') {
        return (
          <div key={node.path} className="overflow-hidden">
            <div 
              onClick={() => toggleFolder(node.path)}
              draggable
              onDragStart={(e) => handleDragStart(e, node)}
              onDragOver={(e) => handleDragOver(e, node)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, node)}
              className="group flex items-center gap-2 px-6 py-0.25 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer transition-all duration-200"
              style={{ paddingLeft: `${(level + 1) * 16}px` }}
            >
              <ChevronRight size={16} className={`transform transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-90' : ''}`} />
              <Folder size={16} className="text-blue-500 transition-colors duration-200" />
              <span className="truncate flex-1 transition-colors duration-200">{node.name}</span>
              <button
                onClick={(e) => handleDeleteItem(e, node)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 transition-all duration-200 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {renderTree(node.children, level + 1)}
            </div>
          </div>
        )
      } else {
        return (
          <div
            key={node.id}
            onClick={() => onFileSelect(node)}
            draggable
            onDragStart={(e) => handleDragStart(e, node)}
            className={`group w-full flex items-center gap-2 px-6 py-0.25 text-sm cursor-pointer transition-all duration-200 border-r-2 ${
              activeFile?.id === node.id
                ? 'bg-blue-50 text-blue-700 border-blue-600'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
            style={{ paddingLeft: `${(level + 1) * 16 + 14}px`, paddingRight: '16px' }}
          >
            {getFileIcon(node.name)}
            <div className="flex-1 min-w-0">
              <div className="truncate transition-colors duration-200">{node.name}</div>
            </div>
            <button
              onClick={(e) => handleDeleteItem(e, node)}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 transition-all duration-200 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      }
    })
  }

  useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim().length > 0 && workspaces.length > 0) {
        const results = await window.api.searchFiles(workspaces, searchQuery)
        setSearchResults(results)
      } else {
        setSearchResults(null)
      }
    }
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, workspaces])

  const handleAddWorkspace = async () => {
    const path = await window.api.openDirectory()
    if (path && !workspaces.includes(path)) {
      const newWorkspaces = [...workspaces, path]
      setWorkspaces(newWorkspaces)
      if (!workspace) {
        setWorkspace(path)
        localStorage.setItem('workspace', path)
      }
    }
  }

  const handleSwitchWorkspace = (path) => {
    if (workspace === path) return
    setWorkspace(path)
    onFileSelect(null) // Clear active file when switching workspace
    localStorage.setItem('workspace', path)
  }

  const handleRemoveWorkspace = (e, path) => {
    e.stopPropagation()
    const newWorkspaces = workspaces.filter(w => w !== path)
    setWorkspaces(newWorkspaces)
    if (workspace === path) {
      const nextWorkspace = newWorkspaces[0] || null
      setWorkspace(nextWorkspace)
      onFileSelect(null) // Clear active file when removing current workspace
      if (nextWorkspace) {
        localStorage.setItem('workspace', nextWorkspace)
      } else {
        localStorage.removeItem('workspace')
      }
    }
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    if (!newFileName.trim() || !workspace) return
    try {
      if (createType === 'file') {
        const newFile = await window.api.createFile(workspace, newFileName)
        await loadFiles()
        onFileSelect(newFile)
      } else {
        await window.api.createFolder(workspace, newFileName)
        await loadFiles()
      }
      setNewFileName('')
      setIsCreating(false)
    } catch (error) {
      console.error(`Failed to create ${createType}:`, error)
    }
  }

  const handleDeleteItem = async (e, item) => {
    e.stopPropagation()
    const typeLabel = item.type === 'folder' ? '文件夹' : '文件'
    if (!confirm(`确定要删除 ${typeLabel} "${item.name}" 吗？\n${item.type === 'folder' ? '注意：文件夹及其所有内容将被永久删除。' : ''}`)) return
    try {
      await window.api.deleteFile(item.path)
      await loadFiles()
      if (activeFile?.id === item.id || (item.type === 'folder' && activeFile?.path.startsWith(item.path))) {
        onFileSelect(null)
      }
    } catch (error) {
      console.error(`Failed to delete ${item.type}:`, error)
    }
  }

  const displayFiles = searchResults || files

  // Vertical layout persistence with proper debounce
  const onVerticalLayout = useCallback((sizes) => {
    if (verticalLayoutTimerRef.current) clearTimeout(verticalLayoutTimerRef.current)
    verticalLayoutTimerRef.current = setTimeout(() => {
      localStorage.setItem('react-resizable-panels:sidebar-layout', JSON.stringify(sizes))
    }, 200)
  }, [])

  const defaultVerticalLayout = JSON.parse(
    localStorage.getItem('react-resizable-panels:sidebar-layout') || '[25, 50, 25]'
  )

  useEffect(() => {
    return () => {
      if (verticalLayoutTimerRef.current) clearTimeout(verticalLayoutTimerRef.current)
    }
  }, [])

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-slate-50`}>
      <Group orientation="vertical" onLayoutChange={onVerticalLayout}>
        {/* Section 1: Knowledge Base List */}
        {modules.workspace && (
          <>
            <Panel defaultSize={defaultVerticalLayout[0]} minSize={10} collapsible>
              <div className="h-full flex flex-col border-b border-slate-200">
                <div className="p-2 space-y-2 overflow-hidden flex flex-col h-full">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <Folder size={14} className="text-blue-500" />
                      <span>知识库列表</span>
                    </div>
                    <button 
                      onClick={handleAddWorkspace} 
                      className="p-1 text-slate-500 hover:bg-slate-200 hover:text-blue-600 rounded transition-all"
                      title="添加知识库"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto flex-1">
                    {workspaces.length > 0 ? (
                      workspaces.map(path => (
                        <div 
                          key={path}
                          onClick={() => handleSwitchWorkspace(path)}
                          className={`group relative flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition-all ${
                            workspace === path 
                              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:shadow-sm'
                          }`}
                        >
                          <span className="truncate flex-1 whitespace-nowrap" title={path}>
                            {path.split(/[\\/]/).pop()}
                          </span>
                          <button 
                            onClick={(e) => handleRemoveWorkspace(e, path)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <button 
                        onClick={handleAddWorkspace}
                        className="w-full py-2 bg-white text-blue-600 border border-blue-200 border-dashed rounded text-xs font-medium hover:bg-blue-50 transition-all"
                      >
                        <div className="flex items-center gap-1 justify-center">
                          <Folder size={16} className="text-blue-400" />
                          <span>添加知识库目录</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <ResizeHandle direction="vertical" />
          </>
        )}

        {/* Section 2: Document List */}
        {modules.files && (
          <>
            <Panel defaultSize={defaultVerticalLayout[1]} minSize={20} collapsible>
              <div className="h-full flex flex-col border-b border-slate-200 overflow-hidden">
                <div className={`px-2 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0 backdrop-blur-sm z-10 border-b border-slate-200 bg-white/80`}>
                  <div className="flex items-center gap-1">
                    <FolderOpen size={14} className="text-blue-500" />
                    <span className="whitespace-nowrap">{searchResults ? '搜索结果' : '文档列表'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!searchResults && (
                      <>
                        <div className="relative new-dropdown-container">
                          <button 
                            disabled={!workspace}
                            onClick={() => setIsNewDropdownOpen(!isNewDropdownOpen)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            <Plus size={14} />
                            <span>新建</span>
                          </button>
                          
                          {isNewDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded shadow-lg z-20 py-1">
                              <button
                                onClick={() => { setIsCreating(true); setCreateType('file'); setIsNewDropdownOpen(false); }}
                                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors text-left"
                              >
                                <FileText size={14} />
                                <span>新建文档</span>
                              </button>
                              <button
                                onClick={() => { setIsCreating(true); setCreateType('folder'); setIsNewDropdownOpen(false); }}
                                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors text-left"
                              >
                                <Folder size={14} />
                                <span>新建文件夹</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button 
                            onClick={() => setViewMode('tree')} 
                            className={`p-1.5 rounded ${viewMode === 'tree' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="树状视图"
                          >
                            <Folder size={14} />
                          </button>
                          <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="列表视图"
                          >
                            <List size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto py-1">
                  {isCreating && (
                    <div className="px-2 py-1 border-b border-slate-200 bg-white mb-1">
                      <form onSubmit={handleCreateItem} className="flex gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          placeholder={createType === 'file' ? "文件名..." : "文件夹名..."}
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                          onBlur={() => !newFileName && setIsCreating(false)}
                        />
                        <button type="submit" className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                          <Plus size={14} />
                        </button>
                      </form>
                    </div>
                  )}
                  
                  <div className="space-y-0.5">
                    {searchResults ? (
                      searchResults.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => {
                            if (file.workspacePath && file.workspacePath !== workspace) {
                              handleSwitchWorkspace(file.workspacePath)
                            }
                            onFileSelect(file)
                          }}
                          className={`group w-full flex flex-col gap-0.5 px-4 py-1.5 text-xs cursor-pointer transition-colors ${
                            activeFile?.id === file.id
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {getFileIcon(file.name)}
                            <div className="flex-1 truncate font-medium">{file.name}</div>
                            {file.workspaceName && (
                              <span className="text-[10px] px-1 py-0.5 bg-slate-100 text-slate-600 rounded-full shrink-0 whitespace-nowrap">
                                {file.workspaceName}
                              </span>
                            )}
                          </div>
                          {file.excerpt && (
                            <div className="text-xs text-slate-500 line-clamp-1 pl-4">{file.excerpt}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      viewMode === 'tree' ? renderTree(fileTree) : (
                        files.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => onFileSelect(file)}
                            className={`group w-full flex items-center gap-1.5 px-4 py-1.5 text-xs cursor-pointer transition-colors ${
                              activeFile?.id === file.id
                                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {getFileIcon(file.name)}
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{file.name}</div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteItem(e, file)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )
                    )}
                    {workspace && ((searchResults && searchResults.length === 0) || (!searchResults && files.length === 0)) && (
                      <div className="px-4 py-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Folder size={24} className="text-slate-300" />
                          <p className="text-xs text-slate-500 whitespace-nowrap">{searchResults ? '未找到相关文档' : '此目录下没有 Markdown 文件'}</p>
                          {!searchResults && (
                            <button 
                              onClick={() => { setIsCreating(true); setCreateType('file'); }}
                              className="mt-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1">
                                <Plus size={14} />
                                <span>新建文档</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {!workspace && (
                      <div className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FolderOpen size={28} className="text-slate-300" />
                          <p className="text-xs text-slate-500 whitespace-nowrap">请先添加或选择一个知识库</p>
                          <button 
                            onClick={handleAddWorkspace}
                            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              <Plus size={14} />
                              <span>添加知识库</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <ResizeHandle direction="vertical" />
          </>
        )}

        {/* Section 3: Outline */}
        {modules.outline && (
          <Panel defaultSize={defaultVerticalLayout[2]} minSize={10} collapsible>
            <div className="h-full flex flex-col overflow-hidden">
              <div className={`px-2 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0 border-b border-slate-200 bg-white/80`}>
                <div className="flex items-center gap-1">
                  <List size={14} className="text-blue-500" />
                  <span className="whitespace-nowrap">大纲</span>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-1">
                {outline.length > 0 ? (
                  <div className="space-y-0.5">
                    {outline.map(item => (
                      <div 
                        key={item.id}
                        className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors truncate whitespace-nowrap"
                        style={{ paddingLeft: `${item.level * 12}px` }}
                      >
                        {item.text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                    <List size={20} className="text-slate-300" />
                    <p className="text-xs text-slate-500 whitespace-nowrap">{activeFile ? '暂无大纲内容' : '选择文件以查看大纲'}</p>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        )}
      </Group>
    </div>
  )
}

export default Sidebar
