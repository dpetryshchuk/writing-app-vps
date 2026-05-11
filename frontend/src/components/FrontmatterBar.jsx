import { useState } from 'react'

export default function FrontmatterBar({ frontmatter, onChange }) {
  const [addingTag, setAddingTag] = useState(false)
  const [tagInput, setTagInput] = useState('')

  if (!frontmatter) return null

  const { title = '', tags = [], status = 'in-progress', date = '' } = frontmatter

  function update(patch) {
    onChange({ ...frontmatter, ...patch })
  }

  function removeTag(tag) {
    update({ tags: tags.filter(t => t !== tag) })
  }

  function addTag() {
    const val = tagInput.trim()
    if (val && !tags.includes(val)) update({ tags: [...tags, val] })
    setTagInput('')
    setAddingTag(false)
  }

  return (
    <div className="border-b border-[#1e1e1e] px-6 py-3 flex gap-3 items-center flex-wrap bg-[#0f0f0f]">
      <input
        value={title}
        onChange={e => update({ title: e.target.value })}
        className="bg-transparent border-none text-white text-[15px] font-semibold outline-none flex-1 min-w-[120px]"
        placeholder="Untitled"
      />
      <div className="flex gap-2 items-center flex-wrap">
        {tags.map(tag => (
          <span key={tag} className="text-[10px] text-[#555] bg-[#1a1a1a] px-2 py-0.5 rounded cursor-pointer hover:text-[#888]">
            {tag}
            <span className="ml-1 text-[#333] hover:text-[#666]" onClick={() => removeTag(tag)}>×</span>
          </span>
        ))}
        {addingTag ? (
          <input
            autoFocus
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setAddingTag(false) }}
            onBlur={addTag}
            placeholder="tag name"
            className="text-[10px] bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-white outline-none w-20"
          />
        ) : (
          <button
            onClick={() => setAddingTag(true)}
            className="text-[10px] text-[#333] hover:text-[#666] px-1"
          >+ tag</button>
        )}
      </div>
      <select
        value={status}
        onChange={e => update({ status: e.target.value })}
        className="bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] text-[10px] rounded px-2 py-1 outline-none"
      >
        <option value="in-progress">in-progress</option>
        <option value="published">published</option>
      </select>
      <span className="text-[10px] text-[#444]">{date}</span>
    </div>
  )
}
