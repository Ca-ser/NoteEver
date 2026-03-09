import React from 'react'
import { Globe, Bell, ChevronUp, Check } from 'lucide-react'

const BottomBar = ({ 
  cursorPos = { line: 1, col: 1 }, 
  encoding = 'UTF-8', 
  lineEnding = 'LF', 
  indent = '空格: 2', 
  language = 'Markdown',
  errorCount = 0
}) => {
  return (
    <div className="h-7 bg-white border-t border-slate-200 flex items-center justify-between px-3 text-xs text-slate-600 select-none z-[1000] shrink-0">
      {/* Left side */}
      <div className="flex items-center h-full gap-2">
        <button className="flex items-center gap-1 px-2 h-full hover:bg-slate-100 transition-colors cursor-pointer group rounded whitespace-nowrap">
          <Check size={12} className="text-green-500" />
          <span className="whitespace-nowrap">NoteEver</span>
        </button>
        
        {errorCount > 0 && (
          <button className="flex items-center gap-1 px-2 h-full hover:bg-slate-100 transition-colors cursor-pointer rounded whitespace-nowrap">
            <Bell size={12} className="text-red-500" />
            <span className="whitespace-nowrap">{errorCount}</span>
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center h-full gap-1">
        {/* Cursor Position - Main Item */}
        <div className="px-2 h-full flex items-center hover:bg-slate-100 transition-colors cursor-default rounded whitespace-nowrap" title="行:列">
          第 {cursorPos.line} 行，第 {cursorPos.col} 列
        </div>

        {/* Indent - Secondary (hidden on small screens) */}
        <div className="hidden sm:flex px-2 h-full items-center hover:bg-slate-100 transition-colors cursor-pointer rounded whitespace-nowrap" title="选择缩进">
          {indent}
        </div>

        {/* Encoding - Secondary (hidden on small screens) */}
        <div className="hidden md:flex px-2 h-full items-center hover:bg-slate-100 transition-colors cursor-pointer rounded whitespace-nowrap" title="选择字符编码 (UTF-8)">
          {encoding}
        </div>

        {/* Line Ending - Secondary (hidden on small screens) */}
        <div className="hidden lg:flex px-2 h-full items-center hover:bg-slate-100 transition-colors cursor-pointer rounded whitespace-nowrap" title="选择行尾序列 (Line Feed)">
          {lineEnding}
        </div>

        {/* Language Mode - Main Item */}
        <div className="px-2 h-full flex items-center hover:bg-slate-100 transition-colors cursor-pointer rounded whitespace-nowrap" title="选择语言模式">
          {language}
        </div>

        {/* Feedback/Notifications */}
        <button className="px-2 h-full hover:bg-slate-100 transition-colors cursor-pointer rounded" title="通知">
          <Bell size={12} />
        </button>
      </div>
    </div>
  )
}

export default BottomBar
