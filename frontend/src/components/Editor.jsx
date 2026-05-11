import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor as MilkdownEditor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { api } from '../lib/api'
import { wikiLinksPlugin } from '../plugins/wikiLinks'

// Inner component — lives inside MilkdownProvider
function InnerEditor({ folder, slug, initialBody, frontmatterRef, bodyRef, onSaveStatus, essays, onSelectEssay }) {
  const saveTimer = useRef(null)

  const { get } = useEditor((root) =>
    MilkdownEditor.make()
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
      .use(wikiLinksPlugin)
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
    <div className="absolute bottom-4 right-6 text-[11px] text-[#c4bfb9] pointer-events-none">
      {text}
    </div>
  )
}

export default function Editor({ folder, slug, initialBody, frontmatterRef, bodyRef, essays, onSelectEssay }) {
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

  function handleWikiClick(e) {
    const el = e.target.closest('[data-wiki]')
    if (!el) return
    const title = el.dataset.wiki
    const match = essays?.find(es =>
      String(es.title ?? es.slug).toLowerCase() === title.toLowerCase()
    )
    if (match) onSelectEssay?.(match.folder, match.slug)
  }

  return (
    <div className="flex-1 overflow-y-auto relative" onClick={handleWikiClick}>
      <MilkdownProvider key={`${folder}/${slug}`}>
        <InnerEditor
          folder={folder}
          slug={slug}
          initialBody={initialBody}
          frontmatterRef={frontmatterRef}
          bodyRef={bodyRef}
          onSaveStatus={handleSaveStatus}
          essays={essays}
          onSelectEssay={onSelectEssay}
        />
      </MilkdownProvider>
      <SaveStatus status={saveStatus} lastSaved={lastSaved} />
    </div>
  )
}
