# Writing App — CodeMirror Editor Redesign

**Goal:** Replace Milkdown with CodeMirror 6 to fix a content-mismatch race condition and make wiki links always editable. The app's purpose is unchanged: write essays in a VPS-hosted web app, push to GitHub, have them appear on dmytro.petryshchuk.com.

---

## Problem Statement

Two bugs stem from the same root cause — Milkdown:

1. **Content mismatch on essay switch.** `selectEssay` sets `activeFolder`/`activeSlug` synchronously before awaiting the API. The editor key changes immediately, Milkdown remounts with the old body, and when the correct body arrives the key is unchanged so it never remounts. Wrong content shows in the editor.

2. **Uneditable links.** Milkdown (ProseMirror-based) compiles markdown links into document nodes. Once rendered, `[text](url)` becomes an opaque link element — you can't put your cursor in it and edit the raw text. Jarring for a writing tool.

---

## Architecture

No backend changes. All changes are in the frontend.

**Dependencies removed:** all `@milkdown/*` packages  
**Dependencies added:** `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/language`, `marked`

---

## Section 1: Core Editor — CodeMirror 6

`frontend/src/components/Editor.jsx` is rewritten around CodeMirror 6.

- CodeMirror's document is a plain string. The component takes `value={essay.body}` and calls `onChange(newValue)` on every change.
- Autosave: 1-second debounce, same as current behavior. On change → mark unsaved → debounce → API write → mark saved.
- The editor is remounted via `key={folder + '/' + slug}` when switching essays. This is safe because the bug fix (Section 4) guarantees the correct value is set before the key changes.
- Markdown syntax highlighting via `@codemirror/lang-markdown`.

---

## Section 2: Edit / Preview Layout

Three modes toggled by a small button group in the top-right corner of the editor area:

| Mode | Layout |
|---|---|
| **Edit** (default) | Full-width CodeMirror, raw markdown |
| **Split** | CodeMirror left half, rendered preview right half |
| **Preview** | Full-width rendered HTML, read-only |

- Preview rendering: `marked` converts the current markdown string to HTML on every change (debounced 200ms).
- Preview styling: simple prose CSS block matching the editor's font and line-height.
- Wiki links in preview: rendered as `<span data-wiki="Title">Title</span>`, click-handled the same as in the editor.
- **Narrow screens (< 768px):** Split collapses to Edit. A two-tab toggle (Edit / Preview) replaces the three-mode button group.

Mode is stored in local component state — no persistence needed.

---

## Section 3: Wiki Links

The Milkdown `wikiLinksPlugin` is replaced by a CodeMirror **decoration extension** in `frontend/src/plugins/wikiLinks.js`.

- Scans the document for `[[Title]]` patterns using a CodeMirror `ViewPlugin`.
- Renders matching ranges as styled `Decoration.mark` spans: underlined, accent-colored.
- When the cursor enters a decorated range, the decoration is removed — raw `[[Title]]` is always visible and editable.
- On click: finds the matching essay by title (case-insensitive) from the `essays` prop and calls `onSelectEssay`.

**Backlinks:** not in scope for this redesign. Can be added later as a backend scan in `listEssays`.

---

## Section 4: Bug Fix — `selectEssay` Race Condition

`App.jsx` `selectEssay` is fixed by fetching content before updating any state:

```js
async function selectEssay(folder, slug) {
  const data = await api.essays.read(folder, slug)
  setActiveFolder(folder)
  setActiveSlug(slug)
  setEssay({ frontmatter: data.frontmatter, body: data.body })
  frontmatterRef.current = data.frontmatter
  bodyRef.current = data.body
}
```

The sidebar highlight lags by one network round-trip (~50–100ms on local VPS). A loading indicator can be added later if it feels slow in practice.

---

## Files Changed

```
frontend/
  package.json                     — swap @milkdown/* for @codemirror/* + marked
  src/
    App.jsx                        — fix selectEssay (move setActive* after await)
    components/
      Editor.jsx                   — full rewrite: CodeMirror + mode toggle + save status
    plugins/
      wikiLinks.js                 — rewrite: CodeMirror decoration extension
```

No backend changes. No new API routes.

---

## Out of Scope

- Backlinks panel
- Mobile layout improvements beyond Split→Edit collapse
- Any changes to the sidebar, frontmatter bar, or git push flow
