import { useEffect, useState, useCallback, useRef } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { defaultValueCtx, Editor as MilkdownEditor, rootCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { math } from '@milkdown/plugin-math'
import { diagram } from '@milkdown/plugin-diagram'
import { history } from '@milkdown/plugin-history'
import { Download, Maximize2, Minimize2, FileText, Save, Code2 } from 'lucide-react'

import 'katex/dist/katex.min.css'

const formatJSON = (text) => {
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    return text
  }
}

const EditorComponent = ({ content, onChange, onCursorChange }) => {
  const editor = useEditor((root) => {
    return MilkdownEditor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, content)
        ctx.set(editorViewOptionsCtx, {
          editable: () => true,
        })
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            onChange(markdown)
          }
        })
        ctx.get(listenerCtx).selectionUpdated((ctx, doc, selection) => {
          try {
            if (!selection) return
            const { from } = selection
            const resolvedPos = doc.type ? doc.resolve(from) : null
            if (resolvedPos) {
              const line = resolvedPos.index(0) + 1
              const col = resolvedPos.parentOffset + 1
              onCursorChange({ line, col })
            }
          } catch (e) {
            console.warn('Failed to update cursor position:', e)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(math)
      .use(diagram)
      .use(history)
  }, [])

  return <Milkdown />
}

function Editor({ file, onCursorChange, isFocusMode, onFocusModeChange }) {
  const [currentContent, setCurrentContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 })
  const editorRef = useRef(null)

  const isJsonFile = file?.path?.split('.').pop().toLowerCase() === 'json'

  const handleContextMenu = useCallback((e) => {
    if (isJsonFile) {
      e.preventDefault()
      setContextMenu({ show: true, x: e.clientX, y: e.clientY })
    }
  }, [isJsonFile])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0 })
  }, [])

  const handleFormatJSON = useCallback(() => {
    const formatted = formatJSON(currentContent)
    if (formatted !== currentContent) {
      setCurrentContent(formatted)
    }
    closeContextMenu()
  }, [currentContent, closeContextMenu])

  useEffect(() => {
    const handleClick = () => closeContextMenu()
    if (contextMenu.show) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.show, closeContextMenu])

  const processContent = useCallback((text) => {
    if (!file || !text) return text
    // Normalize path separators to forward slashes for easier directory extraction
    const normalizedPath = file.path.replace(/\\/g, '/')
    const fileDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
    
    // Replace relative image paths with local-resource:// protocol
    return text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
      // Skip absolute paths, URLs, or data URIs
      if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/') || /^[a-zA-Z]:/.test(src)) {
        return match
      }
      
      // Remove leading ./ if present
      const cleanSrc = src.replace(/^\.\//, '')
      const absolutePath = `local-resource://${fileDir}/${cleanSrc}`
      return `![${alt}](${absolutePath})`
    })
  }, [file])

  useEffect(() => {
    if (!file) return
    const loadContent = async () => {
      setLoading(true)
      try {
        const ext = file.path.split('.').pop().toLowerCase()
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)
        
        if (isImage) {
          // Normalize path for images
          const normalizedPath = file.path.replace(/\\/g, '/')
          setCurrentContent(`![${file.name}](local-resource://${normalizedPath})`)
        } else {
          const text = await window.api.readFile(file.path)
          setCurrentContent(processContent(text))
        }
      } catch (error) {
        console.error('Failed to read file:', error)
      } finally {
        setLoading(false)
      }
    }
    loadContent()
  }, [file?.path, file?.name, processContent])

  const saveTimerRef = useRef(null)

   const handleContentChange = useCallback(
    (newContent) => {
      setCurrentContent(newContent)
      // Don't save if it's an image file (read-only preview)
      const ext = file.path.split('.').pop().toLowerCase()
      if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

       setIsSaving(true)
       saveTimerRef.current = setTimeout(async () => {
         try {
           await window.api.writeFile(file.path, newContent)
         } catch (err) {
           console.error('Failed to save file:', err)
         } finally {
           setIsSaving(false)
         }
       }, 1000)
     },
     [file?.path]
   )

  const handleExportPDF = async () => {
    try {
      if (!currentContent) {
        alert('没有内容可导出')
        return
      }
      const path = await window.api.exportPDF(file.name, currentContent)
      if (path) {
        alert(`导出成功: ${path}`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('导出失败')
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-400">正在加载...</div>
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="flex flex-col items-center gap-2 max-w-md">
          <div className="p-4 bg-slate-50 rounded-full">
            <FileText size={32} className="text-slate-300" strokeWidth={1} />
          </div>
          <h2 className="text-sm font-semibold text-slate-700 whitespace-nowrap">选择或创建一个文件开始编辑</h2>
          <p className="text-xs text-slate-500 whitespace-nowrap">从左侧文档列表中选择一个现有文件，或点击"新建"按钮创建一个新的Markdown文档</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`h-full w-full flex flex-col transition-all duration-300 ${
        isFocusMode 
          ? 'fixed inset-0 z-50 bg-white' 
          : 'bg-transparent'
      }`}
      onContextMenu={handleContextMenu}
    >
      {contextMenu.show && (
        <div 
          className="fixed bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleFormatJSON}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <Code2 size={14} />
            格式化 JSON
          </button>
        </div>
      )}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 z-10 ${isFocusMode ? 'bg-white' : 'bg-white/80 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-2 truncate mr-2">
          <h1 className="text-sm font-semibold text-slate-700 truncate whitespace-nowrap">{file.name}</h1>
          {isSaving && (
            <span className="text-xs text-slate-500 flex items-center gap-1 animate-pulse whitespace-nowrap">
              <Save size={12} />
              正在保存...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onFocusModeChange(!isFocusMode)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
            title={isFocusMode ? "退出全屏专注模式" : "全屏专注模式"}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
          >
            <Download size={14} />
            <span>导出 PDF</span>
          </button>
        </div>
      </div>
      
      <div className={`flex-1 overflow-auto ${isFocusMode ? 'px-4' : 'p-3'}`}>
        <div className={`mx-auto transition-all duration-300 ${isFocusMode ? 'max-w-4xl py-12' : 'max-w-4xl'}`}>
          <MilkdownProvider>
            <EditorComponent key={file.path} content={currentContent} onChange={handleContentChange} onCursorChange={onCursorChange} />
          </MilkdownProvider>
        </div>
      </div>
    </div>
  )
}

export default Editor
