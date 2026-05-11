import { useEffect, useRef } from 'react'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1e1e1e] border border-[#2a2a2a] rounded shadow-xl py-1 min-w-[140px]"
      style={{ top: y, left: x }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose() }}
          className="block w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-[#2a2a2a] hover:text-white"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
