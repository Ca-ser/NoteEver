import { useState, useEffect } from 'react'
import { 
  CheckCircle as CloudCheck, 
  CloudUpload as CloudArrowUp, 
  CloudDownload as CloudArrowDown, 
  RefreshCw, 
  AlertCircle, 
  Github,
  User,
  Search,
  X,
  Save,
  Send,
  GitCommit,
  ArrowUp,
  ArrowDown,
  Palette,
  Image as ImageIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon
} from 'lucide-react'

function StatusBar({ workspace, searchQuery, setSearchQuery, onBackgroundChange, currentBackground }) {
  const [gitStatus, setGitStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [isGitMenuOpen, setIsGitMenuOpen] = useState(false)
  const [isBgMenuOpen, setIsBgMenuOpen] = useState(false)
  const [backgrounds, setBackgrounds] = useState([])
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isGitMenuOpen && !event.target.closest('.git-menu-container')) {
        setIsGitMenuOpen(false)
      }
      if (isBgMenuOpen && !event.target.closest('.bg-menu-container')) {
        setIsBgMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isGitMenuOpen, isBgMenuOpen])

  const loadBackgrounds = async () => {
    try {
      if (!window.api || typeof window.api.listBackgrounds !== 'function') {
        console.warn('API listBackgrounds not found in window.api')
        return
      }
      const bgs = await window.api.listBackgrounds()
      setBackgrounds(bgs)
    } catch (err) {
      console.error('Failed to load backgrounds:', err)
    }
  }

  useEffect(() => {
    loadBackgrounds()
  }, [])

  const handleUploadBg = async () => {
    try {
      if (!window.api || typeof window.api.uploadBackground !== 'function') {
        console.error('API uploadBackground not found')
        return
      }
      const newBg = await window.api.uploadBackground()
      if (newBg) {
        await loadBackgrounds()
        // 确保上传后立即应用该背景
        onBackgroundChange(newBg)
      }
    } catch (err) {
      console.error('Upload background failed:', err)
    }
  }

  const handleDeleteBg = async (e, bgPath) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      if (!window.api || typeof window.api.deleteBackground !== 'function') {
        console.error('API deleteBackground not found')
        return
      }
      
      const success = await window.api.deleteBackground(bgPath)
      if (success) {
        await loadBackgrounds()
        // 如果删除的是当前背景，重置为默认
        if (currentBackground === bgPath) {
          onBackgroundChange(null)
        }
      }
    } catch (err) {
      console.error('Delete background failed:', err)
    }
  }

  const checkStatus = async (force = false) => {
    if (!workspace) return
    if (isPaused && !force) return

    try {
      const status = await window.api.gitStatus(workspace)
      setGitStatus(status)
      setError(null)
      setRetryCount(0) // Reset on success
      setIsPaused(false)
    } catch (err) {
      console.error('Failed to get git status:', err)
      const nextRetryCount = retryCount + 1
      setRetryCount(nextRetryCount)
      
      if (nextRetryCount >= 5) {
        setIsPaused(true)
        setError('连接中断，请手动同步')
      } else {
        setError('Git 状态获取失败')
      }
    }
  }

  useEffect(() => {
    setRetryCount(0)
    setIsPaused(false)
    checkStatus()
    const timer = setInterval(() => checkStatus(), 30000) // Poll every 30s
    return () => clearInterval(timer)
  }, [workspace])

  const handleSync = async () => {
    if (!workspace || syncing) return
    setSyncing(true)
    setError(null)
    setIsPaused(false) // Resume on manual sync
    setRetryCount(0)

    try {
      const result = await window.api.gitSync(workspace)
      if (!result.success) {
        if (result.error === 'AUTH_REQUIRED') {
          await window.api.gitLogin()
          // Retry sync after login attempt
          await handleSync()
          return
        }
        setError(result.message || '同步失败')
      }
      await checkStatus(true)
    } catch (err) {
      console.error('Sync failed:', err)
      setError('同步过程中出现错误')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogin = async () => {
    await window.api.gitLogin()
    checkStatus()
  }

  const handleGitAction = async (action) => {
    if (!workspace || syncing) return
    setSyncing(true)
    setIsGitMenuOpen(false)
    try {
      let result
      switch (action) {
        case 'commit':
          result = await window.api.gitCommit(workspace)
          break
        case 'push':
          result = await window.api.gitPush(workspace)
          break
        case 'pull':
          result = await window.api.gitSync(workspace) // gitSync includes pull
          break
        default:
          break
      }
      if (result && !result.success) {
        setError(result.message || '操作失败')
      }
      await checkStatus(true)
    } catch (err) {
      console.error(`Git ${action} failed:`, err)
      setError(`Git ${action} 失败`)
    } finally {
      setSyncing(false)
    }
  }

  const getStatusDisplay = () => {
    if (!workspace) return { icon: <AlertCircle size={12} />, text: '未选择工作区', color: 'text-slate-400' }
    if (error) return { icon: <AlertCircle size={12} className="text-red-500" />, text: error, color: 'text-red-500' }
    if (syncing) return { icon: <RefreshCw size={12} className="animate-spin text-blue-500" />, text: '正在同步...', color: 'text-blue-500' }
    if (gitStatus && !gitStatus.isRepo) return { icon: <Github size={12} />, text: '非 Git 仓库', color: 'text-slate-400' }

    const hasChanges = (gitStatus?.modified?.length > 0 || gitStatus?.not_added?.length > 0 || gitStatus?.deleted?.length > 0)
    
    if (gitStatus?.behind > 0) return { icon: <CloudArrowDown size={12} className="text-orange-500" />, text: '有远程更新', color: 'text-orange-500' }
    if (hasChanges || gitStatus?.ahead > 0) return { icon: <CloudArrowUp size={12} className="text-blue-500" />, text: '有本地更改', color: 'text-blue-500' }
    
    if (!gitStatus) return { icon: <RefreshCw size={12} className="animate-spin text-slate-400" />, text: '加载中...', color: 'text-slate-400' }
    
    return { icon: <CloudCheck size={12} className="text-green-500" />, text: '已同步', color: 'text-green-500' }
  }

  const status = getStatusDisplay()

  return (
    <div className={`h-9 border-b border-slate-200 flex items-center justify-between px-3 text-xs transition-colors relative z-[1000] ${currentBackground ? 'bg-white/80 backdrop-blur-md' : 'bg-white'}`}>
      <div className="flex items-center gap-3 min-w-[150px]">
        <div className="relative bg-menu-container">
          <span 
            className="font-semibold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-1 whitespace-nowrap"
            onClick={() => setIsBgMenuOpen(!isBgMenuOpen)}
          >
            NoteEver
          </span>
          
          {isBgMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-[1001] p-3">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700">更换背景</span>
                <button 
                  onClick={handleUploadBg}
                  className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                  title="上传本地图片"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                <div 
                  onClick={() => onBackgroundChange(null)}
                  className={`relative aspect-video rounded border-2 cursor-pointer group flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 transition-all ${!currentBackground ? 'border-blue-500 shadow-sm' : 'border-transparent'}`}
                >
                  <ImageIcon size={20} className="text-slate-400" />
                  <span className="text-[10px] mt-1 text-slate-500">默认背景</span>
                </div>
                
                {backgrounds.map((bg, idx) => (
                  <div 
                    key={idx}
                    onClick={() => onBackgroundChange(bg)}
                    className={`relative aspect-video rounded border-2 cursor-pointer group overflow-hidden transition-all ${currentBackground === bg ? 'border-blue-500 shadow-sm' : 'border-transparent hover:border-slate-300'}`}
                  >
                    <img 
                      src={bg.replace(/\\/g, '/')}
                      alt="Background" 
                      className="w-full h-full object-cover"
                      onError={(e) => console.error('Image load error:', bg)}
                    />
                    <button 
                      onClick={(e) => handleDeleteBg(e, bg)}
                      className="absolute top-1 right-1 p-1 bg-black/40 hover:bg-red-500 text-white rounded transition-all z-10 opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon size={12} />
                    </button>
                    {currentBackground === bg && (
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <div className="bg-blue-500 text-white p-0.5 rounded-full">
                          <CloudCheck size={12} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {backgrounds.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-500 italic">暂无自定义背景</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 ${status.color} whitespace-nowrap`}>
          {status.icon}
          <span className="whitespace-nowrap">{status.text}</span>
        </div>
        {gitStatus?.current && (
          <span className="text-xs text-slate-500 whitespace-nowrap">分支: {gitStatus.current}</span>
        )}
      </div>

      <div className="flex-1 max-w-md px-3">
        <div className="relative flex items-center h-7 px-3 bg-slate-100 rounded">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜索笔记内容..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-0 bg-transparent border-none text-xs focus:outline-none transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-1 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        {gitStatus?.user ? (
          <div className="flex items-center gap-1.5 px-2 py-1 text-slate-600 hover:text-slate-700 transition-colors cursor-default whitespace-nowrap" title={`Git User: ${gitStatus.user.name} <${gitStatus.user.email}>`}>
            <User size={14} />
            <span className="text-xs font-medium whitespace-nowrap">{gitStatus.user.name}</span>
          </div>
        ) : (
          workspace && gitStatus?.isRepo && (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors whitespace-nowrap"
            >
              <Github size={14} />
              <span className="whitespace-nowrap">登录 Git</span>
            </button>
          )
        )}
        
        {workspace && gitStatus?.isRepo && (
          <div className="relative git-menu-container">
            <button 
              onClick={() => setIsGitMenuOpen(!isGitMenuOpen)}
              disabled={syncing}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              title="Git 操作"
            >
              <Save size={14} />
              <span className="whitespace-nowrap">保存</span>
            </button>

            {isGitMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded shadow-lg z-[1001] py-1">
                <button
                  onClick={() => handleGitAction('commit')}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <GitCommit size={14} />
                  <span>提交更改</span>
                </button>
                <button
                  onClick={() => handleGitAction('push')}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ArrowUp size={14} />
                  <span>推送到远程</span>
                </button>
                <button
                  onClick={() => handleGitAction('pull')}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ArrowDown size={14} />
                  <span>拉取更新</span>
                </button>
              </div>
            )}
          </div>
        )}

        <button 
          onClick={handleSync}
          disabled={!workspace || syncing || !gitStatus?.isRepo}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-white transition-all duration-200 ease-in-out whitespace-nowrap ${
            !workspace || syncing || !gitStatus?.isRepo 
              ? 'bg-slate-300 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          <RefreshCw size={14} className={`${syncing ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-500 ease-in-out'}`} />
          <span className="whitespace-nowrap">同步</span>
        </button>
      </div>
    </div>
  )
}

export default StatusBar
