import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

const WIKI_RE = /\[\[([^\]]+)\]\]/g

export const wikiLinksPlugin = $prose(() =>
  new Plugin({
    key: new PluginKey('wiki-links'),
    props: {
      decorations(state) {
        const decos = []
        state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return
          const re = new RegExp(WIKI_RE.source, 'g')
          let match
          while ((match = re.exec(node.text)) !== null) {
            decos.push(
              Decoration.inline(
                pos + match.index,
                pos + match.index + match[0].length,
                { class: 'wiki-link', 'data-wiki': match[1] }
              )
            )
          }
        })
        return DecorationSet.create(state.doc, decos)
      }
    }
  })
)
