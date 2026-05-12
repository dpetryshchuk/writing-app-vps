# CodeMirror Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Milkdown with CodeMirror 6, fix the selectEssay race condition, and add edit/split/preview mode toggle.

**Architecture:** No backend changes. All work is in `frontend/`. CodeMirror mounts imperatively in a React `useEffect` to a ref'd div; the editor key remounts when essay changes; mode toggle controls layout via CSS classes; preview is rendered with `marked`.

**Tech Stack:** CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`), `marked`, React 18, Vite, Tailwind

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/App.jsx` | Modify | Fix selectEssay race condition |
| `frontend/package.json` | Modify | Swap @milkdown/* for codemirror + marked |
| `frontend/src/plugins/wikiLinks.js` | Rewrite | CodeMirror decoration extension for `[[links]]` |
| `frontend/src/components/Editor.jsx` | Rewrite | CodeMirror editor + autosave + mode toggle + preview |
| `frontend/src/index.css` | Modify | Remove Milkdown styles, add CodeMirror + prose styles |

---

## Task 1: Fix selectEssay race condition

**Files:**
- Modify: `frontend/src/App.jsx:25-32`

- [ ] **Step 1: Apply the fix**

In `frontend/src/App.jsx`, replace the `selectEssay` function (lines 25–32):

```js
// BEFORE
async function selectEssay(folder, slug) {
  setActiveFolder(folder)
  setActiveSlug(slug)
  const data = await api.essays.read(folder, slug)
  setEssay({ frontmatter: data.frontmatter, body: data.body })
  frontmatterRef.current = data.frontmatter
  bodyRef.current = data.body
}

// AFTER — fetch first, set all state atomically after
async function selectEssay(folder, slug) {
  const data = await api.essays.read(folder, slug)
  setActiveFolder(folder)
  setActiveSlug(slug)
  setEssay({ frontmatter: data.frontmatter, body: data.body })
  frontmatterRef.current = data.frontmatter
  bodyRef.current = data.body
}
```

- [ ] **Step 2: Verify manually**

Start the app (or it's already running). Create two essays with distinct content. Click between them several times rapidly. The editor must always show the content that matches the selected essay name in the sidebar.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/Dima/Documents/1. Projects/writing-app"
git add frontend/src/App.jsx
git commit -m "fix: selectEssay fetches content before updating state"
```

---

## Task 2: Swap frontend dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update package.json**

Replace the entire `dependencies` block in `frontend/package.json` with:

```json
"dependencies": {
  "@codemirror/lang-markdown": "^6.3.2",
  "codemirror": "^6.0.1",
  "marked": "^15.0.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

- [ ] **Step 2: Install**

```bash
cd "c:/Users/Dima/Documents/1. Projects/writing-app/frontend"
npm install
```

Expected: installs codemirror packages and marked. The `@milkdown/*` packages remain in node_modules but won't be used.

- [ ] **Step 3: Verify install succeeded**

```bash
ls node_modules | grep codemirror
ls node_modules | grep marked
```

Expected output includes `codemirror`, `@codemirror`, `marked`.

---

## Task 3: Rewrite wikiLinks.js as CodeMirror extension

**Files:**
- Rewrite: `frontend/src/plugins/wikiLinks.js`

- [ ] **Step 1: Replace the entire file**

```js
import { ViewPlugin, Decoration } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const WIKI_RE = /\[\[([^\]]+)\]\]/g
const wikiMark = Decoration.mark({ class: 'cm-wiki-link' })

function buildDecorations(view) {
  const builder = new RangeSetBuilder()
  const { doc, selection } = view.state
  const cursor = selection.main.head
  const text = doc.toString()
  const re = new RegExp(WIKI_RE.source, 'g')
  let match
  while ((match = re.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    if (cursor > from && cursor < to) continue  // show raw text when cursor is inside
    builder.add(from, to, wikiMark)
  }
  return builder.finish()
}

export function wikiLinksExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) { this.decorations = buildDecorations(view) }
      update(update) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: v => v.decorations }
  )
}
```

---

## Task 4: Rewrite Editor.jsx + update index.css

**Files:**
- Rewrite: `frontend/src/components/Editor.jsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Rewrite Editor.jsx**

Replace the entire file:

```jsx
import { useEffect, useRef, useState } from 'react'
import { EditorView, minimalSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { marked } from 'marked'
import { api } from '../lib/api'
import { wikiLinksExtension } from '../plugins/wikiLinks'

// Post-processes marked output to make [[wiki links]] clickable in preview
function renderMarkdown(text) {
  let html = marked.parse(text || '')
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span data-wiki="$1" class="prose-wiki-link">[[$1]]</span>')
  return html
}

// On wide screens: three-button toggle (Edit / Split / Preview)
// On narrow screens (< 768px): two-tab toggle (Edit / Preview); Split not shown
function ModeToggle({ mode, onMode, narrow }) {
  const modes = narrow ? ['edit', 'preview'] : ['edit', 'split', 'preview']
  const effective = narrow && mode === 'split' ? 'edit' : mode
  return (
    <div className="flex gap-0.5 rounded-md border border-[#e8e5e0] p-0.5 bg-[#f7f6f3]">
      {modes.map(m => (
        <button
          key={m}
          onClick={() => onMode(m)}
          className={`px-2.5 py-1 text-[10px] rounded font-medium capitalize transition-colors ${
            effective === m
              ? 'bg-white text-[#1a1916] shadow-sm'
              : 'text-[#9c9590] hover:text-[#1a1916]'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

function SaveStatus({ status, lastSaved }) {
  const text = {
    idle: '',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    saved: lastSaved ? `Saved ${Math.round((Date.now() - lastSaved) / 1000)}s ago` : 'Saved',
    error: 'Save failed',
  }[status] || ''
  return <span className="text-[11px] text-[#c4bfb9]">{text}</span>
}

export default function Editor({ folder, slug, initialBody, frontmatterRef, bodyRef, essays, onSelectEssay }) {
  const containerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSaved, setLastSaved] = useState(null)
  const [mode, setMode] = useState('edit')
  const [previewHtml, setPreviewHtml] = useState(() => renderMarkdown(initialBody))
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    setSaveStatus('idle')
    setLastSaved(null)
    setPreviewHtml(renderMarkdown(initialBody))
  }, [folder, slug])

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      doc: initialBody,
      extensions: [
        minimalSetup,
        markdown(),
        EditorView.lineWrapping,
        wikiLinksExtension(),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const value = update.state.doc.toString()
          if (bodyRef) bodyRef.current = value
          setPreviewHtml(renderMarkdown(value))
          setSaveStatus('unsaved')
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(async () => {
            setSaveStatus('saving')
            try {
              await api.essays.write(folder, slug, frontmatterRef.current, value)
              setSaveStatus('saved')
              setLastSaved(Date.now())
            } catch {
              setSaveStatus('error')
            }
          }, 1000)
        }),
      ],
      parent: containerRef.current,
    })

    return () => {
      view.destroy()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [folder, slug])

  function handleWikiClick(e) {
    const el = e.target.closest('.cm-wiki-link, [data-wiki]')
    if (!el) return
    const title = el.dataset.wiki ?? el.textContent.slice(2, -2)
    const match = essays?.find(es =>
      String(es.title ?? es.slug).toLowerCase() === title.toLowerCase()
    )
    if (match) onSelectEssay?.(match.folder, match.slug)
  }

  const effectiveMode = narrow && mode === 'split' ? 'edit' : mode
  const showEditor = effectiveMode !== 'preview'
  const showPreview = effectiveMode !== 'edit'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2 border-b border-[#e8e5e0] flex-shrink-0">
        <SaveStatus status={saveStatus} lastSaved={lastSaved} />
        <ModeToggle mode={mode} onMode={setMode} narrow={narrow} />
      </div>
      <div className="flex-1 overflow-hidden flex">
        <div
          ref={containerRef}
          onClick={handleWikiClick}
          style={{ display: showEditor ? undefined : 'none' }}
          className={showEditor && showPreview ? 'w-1/2 border-r border-[#e8e5e0] overflow-y-auto' : 'w-full overflow-y-auto'}
        />
        {showPreview && (
          <div
            onClick={handleWikiClick}
            className={`overflow-y-auto prose-editor ${showEditor ? 'w-1/2' : 'w-full'}`}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update index.css**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  background: #ffffff;
  color: #1a1916;
  height: 100%;
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* ── CodeMirror editor ── */
.cm-editor {
  height: 100%;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 16px;
  line-height: 1.85;
  color: #292524;
}
.cm-editor.cm-focused { outline: none; }
.cm-scroller { overflow: auto !important; }
.cm-content {
  padding: 48px 56px;
  max-width: 720px;
  caret-color: #1a1916;
}
.cm-line { padding: 0; }
.cm-cursor { border-left-color: #1a1916; }

/* ── Wiki links in editor ── */
.cm-wiki-link {
  color: #7c6f64;
  background: #f0ede8;
  border-radius: 3px;
  padding: 1px 4px;
  cursor: pointer;
  font-style: italic;
}
.cm-wiki-link:hover { background: #e8e5e0; color: #44403c; }

/* ── Preview pane prose ── */
.prose-editor {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 16px;
  line-height: 1.85;
  color: #292524;
  padding: 48px 56px;
  max-width: 720px;
}
.prose-editor h1 {
  font-family: 'Inter', sans-serif;
  font-size: 21px;
  font-weight: 600;
  color: #1a1916;
  margin: 1.8em 0 0.5em;
  letter-spacing: -0.01em;
}
.prose-editor h2 {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #1a1916;
  margin: 1.5em 0 0.4em;
}
.prose-editor h3 {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #44403c;
  margin: 1.3em 0 0.3em;
}
.prose-editor p { margin: 0 0 1em; }
.prose-editor a { color: #2563eb; text-decoration: underline; }
.prose-editor strong { color: #1a1916; font-weight: 600; }
.prose-editor em { color: #44403c; }
.prose-editor code {
  background: #f0ede8;
  color: #6d28d9;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 13px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}
.prose-editor pre {
  background: #f7f6f3;
  border: 1px solid #e8e5e0;
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 1em;
}
.prose-editor pre code { background: transparent; color: #374151; padding: 0; }
.prose-editor blockquote {
  border-left: 2px solid #d6d3d1;
  margin-left: 0;
  padding-left: 20px;
  color: #78716c;
  font-style: italic;
}
.prose-editor ul, .prose-editor ol { padding-left: 1.5em; margin-bottom: 1em; }
.prose-editor li { margin-bottom: 0.25em; }
.prose-editor hr { border: none; border-top: 1px solid #e8e5e0; margin: 2em 0; }
.prose-wiki-link {
  color: #7c6f64;
  background: #f0ede8;
  border-radius: 3px;
  padding: 1px 4px;
  cursor: pointer;
  font-style: italic;
}
.prose-wiki-link:hover { background: #e8e5e0; color: #44403c; }
```

- [ ] **Step 3: Verify the app builds**

```bash
cd "c:/Users/Dima/Documents/1. Projects/writing-app/frontend"
npm run build
```

Expected: build completes with no errors. Warnings about unused CSS are fine.

- [ ] **Step 4: Verify manually — editor**

Start dev server: `npm run dev` in frontend dir (or use the running VPS instance).

Open the app. Select an essay. Verify:
1. The raw markdown text appears in the editor (not rendered HTML)
2. You can type and edit freely — including clicking into a `[link](url)` and editing the URL
3. The "Saved Xs ago" indicator appears after 1 second of no typing
4. The Edit / Split / Preview toggle appears in the top-right of the editor area

- [ ] **Step 5: Verify manually — modes**

1. Click **Split** → editor on left, rendered preview on right. Both show the same content. Editing in the editor updates the preview in real time.
2. Click **Preview** → full-width rendered HTML, editor hidden.
3. Click **Edit** → back to raw markdown editor.

- [ ] **Step 6: Verify manually — wiki links**

1. Type `[[` then the exact title of another essay, then `]]` — e.g. `[[My Essay]]`
2. Move the cursor outside the brackets → the text turns into a styled span (gray background, italic)
3. Put the cursor back inside the brackets → the raw `[[My Essay]]` text is visible and editable
4. Click the styled span → the app navigates to that essay

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/Dima/Documents/1. Projects/writing-app"
git add frontend/package.json frontend/package-lock.json frontend/src/plugins/wikiLinks.js frontend/src/components/Editor.jsx frontend/src/index.css
git commit -m "feat: replace Milkdown with CodeMirror 6, add edit/split/preview modes"
```
