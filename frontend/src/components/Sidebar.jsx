import { useState, useCallback } from 'react'
import ContextMenu from './ContextMenu'

export default function Sidebar({
  folders,
  essays,
  activeFolder,
  activeSlug,
  onSelectEssay,
  onCreateEssay,
  onDeleteEssay,
  onMoveEssay,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onPull,
  commitMessage,
  onCommitMessageChange,
  onPush,
}) {
  const [collapsed, setCollapsed] = useState({})
  const [contextMenu, setContextMenu] = useState(null)
  const [inlineNew, setInlineNew] = useState(null) // { folder }
  const [newTitle, setNewTitle] = useState('')
  const [renaming, setRenaming] = useState(null) // { folder }
  const [renameValue, setRenameValue] = useState('')
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const openCtx = useCallback((e, items) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }, [])

  function essaysInFolder(folder) {
    return essays.filter(e => e.folder === folder)
  }

  function handleFolderCtx(e, folder) {
    openCtx(e, [
      { label: 'New essay', action: () => { setInlineNew({ folder }); setNewTitle('') } },
      { label: 'Rename', action: () => { setRenaming({ folder }); setRenameValue(folder) } },
      {
        label: 'Delete', action: () => {
          if (essaysInFolder(folder).length > 0) return alert('Remove all essays first')
          if (confirm(`Delete folder "${folder}"?`)) onDeleteFolder(folder)
        }
      },
    ])
  }

  function handleEssayCtx(e, essay) {
    openCtx(e, [
      {
        label: 'Move to…', action: () => {
          const target = prompt('Move to folder:', essay.folder)
          if (target && target !== essay.folder) onMoveEssay(essay.folder, essay.slug, target)
        }
      },
      {
        label: 'Delete', action: () => {
          if (confirm(`Delete "${essay.title || essay.slug}"?`)) onDeleteEssay(essay.folder, essay.slug)
        }
      },
    ])
  }

  function submitNewEssay(folder) {
    if (newTitle.trim()) onCreateEssay(folder, newTitle.trim())
    setInlineNew(null)
    setNewTitle('')
  }

  function submitRename(oldName) {
    if (renameValue.trim() && renameValue !== oldName) onRenameFolder(oldName, renameValue.trim())
    setRenaming(null)
  }

  function submitNewFolder() {
    if (newFolderName.trim()) onCreateFolder(newFolderName.trim())
    setNewFolderMode(false)
    setNewFolderName('')
  }

  return (
    <div className="w-[210px] bg-[#141414] border-r border-[#222] flex flex-col flex-shrink-0 select-none">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
        <span className="text-[11px] tracking-widest text-[#555] font-semibold uppercase">Essays</span>
        <div className="flex gap-2 items-center">
          <button onClick={onPull} title="Pull from GitHub" className="text-[#444] hover:text-[#888] text-sm leading-none">↓</button>
          <button
            onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
            title="New folder"
            className="text-[#444] hover:text-[#888] text-base leading-none"
          >+</button>
        </div>
      </div>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {newFolderMode && (
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') setNewFolderMode(false) }}
            onBlur={() => setNewFolderMode(false)}
            placeholder="folder name"
            className="mx-2 mb-1 w-[calc(100%-16px)] bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-white outline-none"
          />
        )}
        {folders.map(folder => {
          const isOpen = !collapsed[folder]
          const folderEssays = essaysInFolder(folder)
          return (
            <div key={folder}>
              <div
                className="px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer group"
                onClick={() => setCollapsed(c => ({ ...c, [folder]: !c[folder] }))}
                onContextMenu={e => handleFolderCtx(e, folder)}
              >
                <span className="text-[10px] text-[#555]">{isOpen ? '▾' : '▸'}</span>
                {renaming?.folder === folder ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(folder); if (e.key === 'Escape') setRenaming(null) }}
                    onBlur={() => submitRename(folder)}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-1 py-0 text-xs text-white outline-none"
                  />
                ) : (
                  <span className="text-xs text-[#888] group-hover:text-[#aaa] flex-1">{folder}</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setInlineNew({ folder }); setNewTitle('') }}
                  className="text-[#333] hover:text-[#666] text-[10px] leading-none"
                >+</button>
              </div>
              {isOpen && (
                <div>
                  {folderEssays.map(essay => (
                    <div
                      key={essay.slug}
                      className={`pl-[26px] pr-3 py-1.5 text-xs cursor-pointer ${
                        activeFolder === essay.folder && activeSlug === essay.slug
                          ? 'text-white bg-[#1e1e1e] border-l-2 border-[#666]'
                          : 'text-[#777] hover:text-[#aaa]'
                      }`}
                      onClick={() => onSelectEssay(essay.folder, essay.slug)}
                      onContextMenu={e => handleEssayCtx(e, essay)}
                    >
                      {essay.title || essay.slug}
                    </div>
                  ))}
                  {inlineNew?.folder === folder && (
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitNewEssay(folder); if (e.key === 'Escape') setInlineNew(null) }}
                      onBlur={() => setInlineNew(null)}
                      placeholder="Essay title…"
                      className="ml-[26px] mr-2 my-0.5 w-[calc(100%-36px)] bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-white outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer: git push */}
      <div className="border-t border-[#1e1e1e] p-3">
        <input
          value={commitMessage}
          onChange={e => onCommitMessageChange(e.target.value)}
          placeholder="commit message…"
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[11px] text-[#777] font-mono outline-none focus:border-[#444] mb-2"
        />
        <button
          onClick={onPush}
          className="w-full bg-[#2a2a2a] hover:bg-[#333] border-none rounded px-2 py-1.5 text-[#aaa] text-[11px] tracking-wide cursor-pointer"
        >
          ↑ Push to GitHub
        </button>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
