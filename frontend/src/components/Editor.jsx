import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor as MilkdownEditor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { nord } from '@milkdown/theme-nord'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { api } from '../lib/api'

// Inner component — lives inside MilkdownProvider
function InnerEditor({ folder, slug, initialBody, frontmatterRef, bodyRef, onSaveStatus }) {
  const saveTimer = useRef(null)

  const { get } = useEditor((root) =>
    MilkdownEditor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialBody)
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          onSaveStatus('unsaved')
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(async () => {
            try {
              onSaveStatus('saving')
              await api.essays.write(folder, slug, frontmatterRef.current, markdown)
              if (bodyRef) bodyRef.current = markdown
              onSaveStatus('saved')
            } catch (e) {
              onSaveStatus('error')
            }
          }, 1000)
        })
      })
      .use(commonmark)
      .use(listener)
  )

  return <Milkdown />
}

// Status text shown bottom-right
function SaveStatus({ status, lastSaved }) {
  const text = {
    idle: '',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    saved: lastSaved ? `Saved ${Math.round((Date.now() - lastSaved) / 1000)}s ago` : 'Saved',
    error: 'Save failed',
  }[status] || ''

  return (
    <div className="absolute bottom-4 right-6 text-[11px] text-[#444] pointer-events-none">
      {text}
    </div>
  )
}

export default function Editor({ folder, slug, initialBody, frontmatterRef, bodyRef }) {
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSaved, setLastSaved] = useState(null)

  function handleSaveStatus(s) {
    setSaveStatus(s)
    if (s === 'saved') setLastSaved(Date.now())
  }

  useEffect(() => {
    setSaveStatus('idle')
    setLastSaved(null)
  }, [folder, slug])

  return (
    <div className="flex-1 overflow-y-auto relative">
      <MilkdownProvider key={`${folder}/${slug}`}>
        <InnerEditor
          folder={folder}
          slug={slug}
          initialBody={initialBody}
          frontmatterRef={frontmatterRef}
          bodyRef={bodyRef}
          onSaveStatus={handleSaveStatus}
        />
      </MilkdownProvider>
      <SaveStatus status={saveStatus} lastSaved={lastSaved} />
    </div>
  )
}
