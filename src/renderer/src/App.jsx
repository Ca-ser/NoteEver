import { useState, useEffect, useCallback, useRef } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import StatusBar from './components/StatusBar'
import BottomBar from './components/BottomBar'
import { FileText, Folder, List, Menu } from 'lucide-react'

// Reusable Resize Handle Component
export const ResizeHandle = ({ direction = 'horizontal', className = '' }) => {
  return (
    <Separator
      className={`relative flex items-center justify-center bg-transparent hover:bg-blue-50/50 transition-colors z-50 group ${
        direction === 'horizontal' ? 'w-[8px] cursor-col-resize' : 'h-[8px] cursor-row-resize'
      } ${className}`}
    >
      {/* Visible line */}
      <div 
        className={`bg-slate-200 group-hover:bg-blue-400 transition-colors ${
          direction === 'horizontal' ? 'w-[1px] h-full' : 'h-[1px] w-full'
        }`} 
      />
    </Separator>
  )
}

function App() {
  const [activeFile, setActiveFile] = useState(null)
  const [workspace, setWorkspace] = useState(localStorage.getItem('workspace') || null)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [background, setBackground] = useState(localStorage.getItem('app-background') || null)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [isFocusMode, setIsFocusMode] = useState(false)
  const layoutTimerRef = useRef(null)
  
  // Sidebar modules visibility state
  const [sidebarModules, setSidebarModules] = useState({
    workspace: true,
    files: true,
    outline: true
  })
  
  // Check if all sidebar modules are hidden
  const isSidebarEmpty = Object.values(sidebarModules).every(value => !value)
  
  // Toggle sidebar module visibility
  const toggleSidebarModule = (module) => {
    setSidebarModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }))
  }
  
  useEffect(() => {
    if (isFocusMode) {
      const wasAnyModuleVisible = Object.values(sidebarModules).some(v => v)
      if (wasAnyModuleVisible) {
        setSidebarModules({ workspace: false, files: false, outline: false })
      }
    }
  }, [isFocusMode])

  // Layout persistence with proper debounce
  const onLayout = useCallback((sizes) => {
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    layoutTimerRef.current = setTimeout(() => {
      localStorage.setItem('react-resizable-panels:layout', JSON.stringify(sizes))
    }, 200)
  }, [])

  const handleBackgroundChange = (bgPath) => {
    setBackground(bgPath)
    if (bgPath) {
      localStorage.setItem('app-background', bgPath)
    } else {
      localStorage.removeItem('app-background')
    }
  }

  // 强制使用新的默认布局值
  localStorage.removeItem('react-resizable-panels:layout')
  const defaultLayout = JSON.parse(localStorage.getItem('react-resizable-panels:layout') || '[30, 75]')

  useEffect(() => {
    return () => {
      if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    }
  }, [])

  useEffect(() => {
    console.log('App mounted, workspace:', workspace)
    window.onerror = (msg, url, line, col, error) => {
      console.error('Global error:', msg)
      setError(`Global error: ${msg}\nAt: ${url}:${line}:${col}`)
    }
    
    // Check if preload script loaded
    if (!window.api) {
      setError('Preload API not found. The application cannot communicate with the system.')
    }
  }, [])

  if (error) {
    return (
      <div className="p-10 bg-red-50 text-red-700 h-screen overflow-auto">
        <h1 className="text-2xl font-bold mb-4">应用启动错误</h1>
        <pre className="whitespace-pre-wrap bg-white p-4 border border-red-200 rounded">{error}</pre>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div 
      className={`flex flex-col h-screen w-screen text-slate-900 overflow-hidden relative ${background ? '' : 'bg-white'}`}
      style={background ? {
        backgroundImage: `url("${background.replace(/\\/g, '/')}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : {}}
    >
      {background && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm pointer-events-none z-0" />
      )}
      
      <div className="relative z-10 flex flex-col h-full">
        <StatusBar 
          workspace={workspace} 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onBackgroundChange={handleBackgroundChange}
          currentBackground={background}
        />
        
        <div className="flex-1 overflow-hidden relative">
          <Group orientation="horizontal" onLayoutChange={onLayout}>
            {/* Left Sidebar Control Panel */}
            <Panel defaultSize={35} minSize={35} maxSize={35}>
              <div className="h-full bg-slate-100 border-r border-slate-200 flex flex-col items-center justify-start py-4 gap-4">
                <button
                  onClick={() => toggleSidebarModule('workspace')}
                  className={`p-2 rounded-lg transition-all ${sidebarModules.workspace ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                  title="知识库列表"
                >
                  <Folder size={18} />
                </button>
                <button
                  onClick={() => toggleSidebarModule('files')}
                  className={`p-2 rounded-lg transition-all ${sidebarModules.files ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                  title="文档列表"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => toggleSidebarModule('outline')}
                  className={`p-2 rounded-lg transition-all ${sidebarModules.outline ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                  title="大纲"
                >
                  <Menu size={18} />
                </button>
              </div>
            </Panel>
            
            <ResizeHandle direction="horizontal" />
            
            {/* Main Sidebar Content */}
            {!isSidebarEmpty && (
              <Panel defaultSize={defaultLayout[0]} minSize={'0%'} maxSize={'100%'}>
                <Sidebar 
                  onFileSelect={setActiveFile} 
                  activeFile={activeFile} 
                  workspace={workspace}
                  setWorkspace={setWorkspace}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  modules={sidebarModules}
                />
              </Panel>
            )}
            
            {!isSidebarEmpty && <ResizeHandle direction="horizontal" />}
            
            {/* Main Content Area */}
            <Panel defaultSize={isSidebarEmpty ? 100 : defaultLayout[1]} minSize={20}>
              <main className={`h-full overflow-auto relative ${background ? 'bg-transparent' : 'bg-white'}`}>
                {activeFile ? (
                  <Editor 
                    file={activeFile} 
                    onCursorChange={setCursorPos} 
                    isFocusMode={isFocusMode}
                    onFocusModeChange={setIsFocusMode}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="flex flex-col items-center gap-4 max-w-md">
                      <div className="p-6 bg-slate-50 rounded-full">
                        <FileText size={64} className="text-slate-300" strokeWidth={1} />
                      </div>
                      <h2 className="text-xl font-semibold text-slate-700">选择或创建一个文件开始编辑</h2>
                      <p className="text-slate-500">从左侧文档列表中选择一个现有文件，或点击"新建"按钮创建一个新的Markdown文档</p>
                    </div>
                  </div>
                )}
              </main>
            </Panel>
          </Group>
        </div>

        <BottomBar cursorPos={cursorPos} />
      </div>
    </div>
  )
}

export default App
