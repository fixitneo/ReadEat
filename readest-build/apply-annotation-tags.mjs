#!/usr/bin/env node
// Readest Personal annotation-tag patch against official Readest v0.12.16.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? 'upstream');
const app = path.join(root, 'apps/readest-app');
const local = path.dirname(new URL(import.meta.url).pathname);
function patch(relative, before, after) {
  const file = path.join(app, relative);
  const src = fs.readFileSync(file, 'utf8');
  if (src.split(before).length !== 2) throw new Error('Expected exactly one source anchor: ' + relative + ' ~ ' + before.slice(0, 65));
  fs.writeFileSync(file, src.replace(before, after));
}
fs.copyFileSync(path.join(local, 'PersonalAnnotationTagPicker.tsx'),
  path.join(app, 'src/app/reader/components/annotator/PersonalAnnotationTagPicker.tsx'));

patch('src/types/book.ts',
  '  note: string;\n  /**\n   * If true, this annotation',
  '  note: string;\n  /** Per-highlight tags for the Personal tag organizer. Stored with BookNote. */\n  tags?: string[];\n  /**\n   * If true, this annotation');

patch('src/app/reader/components/annotator/Annotator.tsx',
  "import AnnotationPopup from './AnnotationPopup';",
  "import AnnotationPopup from './AnnotationPopup';\nimport { PersonalAnnotationTagPicker } from './PersonalAnnotationTagPicker';\nimport { MdOutlineLabel } from 'react-icons/md';");

patch('src/app/reader/components/annotator/Annotator.tsx',
  '  const [selection, setSelection] = useState<TextSelection | null>(null);',
  '  const [selection, setSelection] = useState<TextSelection | null>(null);\n  const [tagEditorTarget, setTagEditorTarget] = useState<{ ids: string[]; placeholderIds: string[] } | null>(null);');

// A freshly selected range needs a highlight before tags can be persisted;
// keep its placeholder IDs so Cancel can roll them back. Existing annotations
// are never restyled just to open the tag picker.
patch('src/app/reader/components/annotator/Annotator.tsx',
  '  const handleCreateTTSHighlight = (event: CustomEvent) => {',
  "  const handleTagSelection = () => {\n" +
  "    if (!selection?.text || (selection.popup && !selection.cfi)) return;\n" +
  "    const cfi = selection.popup ? selection.cfi : view?.getCFI(selection.index, selection.range);\n" +
  "    if (!cfi) return;\n" +
  "    const current = getConfig(bookKey)?.booknotes ?? [];\n" +
  "    const existing = current.filter((n) => n.type === 'annotation' && !n.deletedAt && n.cfi === cfi);\n" +
  "    const created = existing.length ? [] : handleHighlight(true);\n" +
  "    const ids = [...existing, ...created].map((n) => n.id);\n" +
  "    if (!ids.length) return;\n" +
  "    setTagEditorTarget({ ids, placeholderIds: created.map((n) => n.id) });\n" +
  "    setShowAnnotPopup(false);\n" +
  "    dropSelectionForOverlay();\n" +
  "  };\n" +
  "  const finishTagEditor = (saved: boolean) => {\n" +
  "    if (!saved && tagEditorTarget?.placeholderIds.length) {\n" +
  "      const placeholders = new Set(tagEditorTarget.placeholderIds);\n" +
  "      const cfg = getConfig(bookKey);\n" +
  "      if (cfg) {\n" +
  "        const current = cfg.booknotes ?? [];\n" +
  "        const views = getViewsById(bookKey.split('-')[0]!);\n" +
  "        const updated = current.map((note) => {\n" +
  "          if (!placeholders.has(note.id) || note.deletedAt) return note;\n" +
  "          views.forEach((v) => removeBookNoteOverlays(v, note));\n" +
  "          return { ...note, deletedAt: nextBooknoteStamp(note) };\n" +
  "        });\n" +
  "        const next = updateBooknotes(bookKey, updated);\n" +
  "        if (next) void saveConfig(envConfig, bookKey, next, settings);\n" +
  "      }\n" +
  "    }\n" +
  "    setTagEditorTarget(null);\n" +
  "    handleDismissPopupAndSelection();\n" +
  "  };\n" +
  "\n  const handleCreateTTSHighlight = (event: CustomEvent) => {");

patch('src/app/reader/components/annotator/Annotator.tsx',
  "  const toolButtons = toolbarToolTypes\n    .map(buildToolButton)\n    .filter((button): button is NonNullable<typeof button> => button !== null);",
  "  const toolButtons = toolbarToolTypes\n    .map(buildToolButton)\n    .filter((button): button is NonNullable<typeof button> => button !== null);\n" +
  "  // Present Tag on the existing selection toolbar regardless of per-user\n" +
  "  // legacy toolbar preferences. It is not a separate floating toolbar.\n" +
  "  if (appService?.isAndroidApp && !popupSelectionNoCfi && selection?.text) {\n" +
  "    toolButtons.splice(3, 0, { tooltipText: 'Tags', Icon: MdOutlineLabel, onClick: handleTagSelection });\n" +
  "  }");

patch('src/app/reader/components/annotator/Annotator.tsx',
  "      <PageTurnHint bookKey={bookKey} contentInsets={contentInsets} hint={turnHint} />",
  "      <PageTurnHint bookKey={bookKey} contentInsets={contentInsets} hint={turnHint} />\n" +
  "      {tagEditorTarget && (\n" +
  "        <PersonalAnnotationTagPicker bookKey={bookKey} annotationIds={tagEditorTarget.ids}\n" +
  "          onSaved={() => finishTagEditor(true)} onClose={() => finishTagEditor(false)} />\n" +
  "      )}");

// Existing highlights with note bubbles hide the regular selection tools.
// Keep Tags reachable inside that existing popup as well.
const annotationPopup = 'src/app/reader/components/annotator/AnnotationPopup.tsx';
patch(annotationPopup,
  '  onEditNote?: (note: BookNote) => void;',
  '  onEditNote?: (note: BookNote) => void;\n  onEditTags?: () => void;');
patch(annotationPopup,
  '  onEditNote,\n  position,',
  '  onEditNote,\n  onEditTags,\n  position,');
patch(annotationPopup,
  "        <div className={clsx('flex h-full gap-4', isVertical ? 'flex-row' : 'flex-col')}>",
  "        <div className={clsx('flex h-full gap-4', isVertical ? 'flex-row' : 'flex-col')}>\n" +
  "          {notes.length > 0 && !noteEditor && onEditTags && (\n" +
  "            <button type='button' aria-label='Edit highlight tags'\n" +
  "              className='absolute right-2 top-2 z-[70] rounded-lg bg-base-300 px-3 py-1 text-xs shadow-md'\n" +
  "              onClick={onEditTags}># Tags</button>\n" +
  "          )}");
patch('src/app/reader/components/annotator/Annotator.tsx',
  "            onEditNote={handleEditNote}\n",
  "            onEditNote={handleEditNote}\n            onEditTags={handleTagSelection}\n");

const list = 'src/app/reader/components/sidebar/BooknoteView.tsx';
patch(list,
  "import AnnotationsToolbar from './AnnotationsToolbar';",
  "import AnnotationsToolbar from './AnnotationsToolbar';\nimport { normalizeAnnotationTags } from '../annotator/PersonalAnnotationTagPicker';");
patch(list,
  "  const [excludedStyles, setExcludedStyles] = useState<HighlightStyle[]>([]);",
  "  const [excludedStyles, setExcludedStyles] = useState<HighlightStyle[]>([]);\n" +
  "  const [selectedTags, setSelectedTags] = useState<string[]>([]);\n" +
  "  const [sortOrder, setSortOrder] = useState<'location' | 'newest' | 'oldest' | 'tag'>('location');");

patch(list,
  "      excludedStyles.length > 0);",
  "      excludedStyles.length > 0 ||\n      selectedTags.length > 0);");

patch(list,
  "    setExcludedStyles([]);\n  }, []);",
  "    setExcludedStyles([]);\n    setSelectedTags([]);\n  }, []);");

patch(list,
  "  const facets = useMemo(() => collectAnnotationFacets(liveAnnotations), [liveAnnotations]);",
  "  const allTags = useMemo(() => normalizeAnnotationTags(liveAnnotations.flatMap((n) => n.tags ?? []), 1000)\n" +
  "    .sort((a, b) => a.localeCompare(b)), [liveAnnotations]);\n" +
  "  const facets = useMemo(() => collectAnnotationFacets(liveAnnotations), [liveAnnotations]);");

patch(list,
  "    return filterBooknotes(liveAnnotations, {\n      kind: filterKind,\n      query,\n      excludedColors,\n      excludedStyles,\n    });\n  }, [allNotes, liveAnnotations, type, filterKind, query, excludedColors, excludedStyles]);",
  "    return filterBooknotes(liveAnnotations, {\n      kind: filterKind,\n      query,\n      excludedColors,\n      excludedStyles,\n    }).filter((n) => selectedTags.length === 0 || selectedTags.some((tag) =>\n" +
  "      (n.tags ?? []).some((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase())));\n" +
  "  }, [allNotes, liveAnnotations, type, filterKind, query, excludedColors, excludedStyles, selectedTags]);");

patch(list,
  "  const sortedGroups = useMemo<BooknoteGroup[]>(() => {\n    const groups: { [href: string]: BooknoteGroup } = {};",
  "  const sortedGroups = useMemo<BooknoteGroup[]>(() => {\n" +
  "    if (type === 'annotation' && sortOrder === 'tag') {\n" +
  "      const byTag = new Map<string, BooknoteGroup>();\n" +
  "      for (const note of filteredNotes) {\n" +
  "        const name = normalizeAnnotationTags(note.tags)[0] ?? 'Untagged';\n" +
  "        if (!byTag.has(name)) byTag.set(name, { id: 0, href: 'tag:' + name, label: name, booknotes: [] });\n" +
  "        byTag.get(name)!.booknotes.push(note);\n" +
  "      }\n" +
  "      return [...byTag.values()].sort((a, b) => a.label.localeCompare(b.label)).map((g, index) => ({\n" +
  "        ...g, id: index, booknotes: [...g.booknotes].sort((a, b) => CFI.compare(a.cfi, b.cfi)),\n" +
  "      }));\n" +
  "    }\n" +
  "    const groups: { [href: string]: BooknoteGroup } = {};");

patch(list,
  "      g.booknotes.sort((a, b) => CFI.compare(a.cfi, b.cfi));",
  "      g.booknotes.sort((a, b) => sortOrder === 'newest' ? b.updatedAt - a.updatedAt\n" +
  "        : sortOrder === 'oldest' ? a.updatedAt - b.updatedAt : CFI.compare(a.cfi, b.cfi));");

patch(list,
  "  }, [filteredNotes, toc]);",
  "  }, [filteredNotes, toc, sortOrder, type]);");

patch(list,
  "      <div ref={listHostRef}>",
  "      {type === 'annotation' && (\n" +
  "        <div className='border-base-300/60 space-y-2 border-b px-3 py-3' aria-label='Annotation tag organizer'>\n" +
  "          <div className='flex items-center gap-2'>\n" +
  "            <span className='shrink-0 text-xs'>Sort / group</span>\n" +
  "            <select aria-label='Annotation sort and group order' className='select select-bordered select-sm min-w-0 flex-1'\n" +
  "              value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}>\n" +
  "              <option value='location'>Reading order</option>\n" +
  "              <option value='newest'>Recently edited</option>\n" +
  "              <option value='oldest'>Oldest first</option>\n" +
  "              <option value='tag'>Group by tag</option>\n" +
  "            </select>\n" +
  "          </div>\n" +
  "          {allTags.length > 0 && <div className='flex flex-wrap gap-1.5' aria-label='Filter annotations by tags'>\n" +
  "            {allTags.map((tag) => <button type='button' key={tag} aria-pressed={selectedTags.includes(tag)}\n" +
  "              className={selectedTags.includes(tag) ? 'btn btn-primary btn-xs' : 'btn btn-outline btn-xs'}\n" +
  "              onClick={() => setSelectedTags((previous) => previous.includes(tag)\n" +
  "                ? previous.filter((v) => v !== tag) : [...previous, tag])}>{tag}</button>)}\n" +
  "            {!!selectedTags.length && <button type='button' className='btn btn-ghost btn-xs'\n" +
  "              onClick={() => setSelectedTags([])}>Clear tags</button>}\n" +
  "          </div>}\n" +
  "        </div>\n" +
  "      )}\n" +
  "      <div ref={listHostRef}>");

const item = 'src/app/reader/components/sidebar/BooknoteItem.tsx';
patch(item,
  "import React, { useMemo, useRef } from 'react';",
  "import React, { useMemo, useRef, useState } from 'react';\nimport { PersonalAnnotationTagPicker } from '../annotator/PersonalAnnotationTagPicker';");
patch(item,
  "  const { text, cfi, note } = item;",
  "  const { text, cfi, note } = item;\n  const [editingTags, setEditingTags] = useState(false);");
patch(item,
  "      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}",
  "      {item.type === 'annotation' && (\n" +
  "        <div className='mt-2 flex flex-wrap items-center gap-1.5' onClick={(e) => e.stopPropagation()}>\n" +
  "          {(item.tags ?? []).map((tag) => <span className='badge badge-outline badge-sm' key={tag}>{tag}</span>)}\n" +
  "          <button type='button' className='btn btn-ghost btn-xs' aria-label='Edit annotation tags'\n" +
  "            onClick={(e) => { e.stopPropagation(); setEditingTags(true); }}>+ Tags</button>\n" +
  "          {editingTags && <PersonalAnnotationTagPicker bookKey={bookKey} annotationIds={[item.id]}\n" +
  "            onClose={() => setEditingTags(false)} />}\n" +
  "        </div>\n" +
  "      )}\n" +
  "      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}");


const annotationExchange = 'src/services/annotation/providers/readest.ts';
patch(annotationExchange,
  '  note: string;\n  global?: boolean;',
  '  note: string;\n  tags?: string[];\n  global?: boolean;');
patch(annotationExchange,
  '      if (note.global) entry.global = true;',
  '      if (note.global) entry.global = true;\n      if (note.tags?.length) entry.tags = [...note.tags];');
patch(annotationExchange,
  '  const text = asString(value[\'text\']);',
  "  if (Array.isArray(value['tags'])) entry.tags = value['tags']\n" +
  "    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)\n" +
  "    .map((tag) => tag.trim().slice(0, 40)).slice(0, 24);\n" +
  "  const text = asString(value['text']);");
patch(annotationExchange,
  '    if (entry.global) note.global = true;',
  '    if (entry.global) note.global = true;\n    if (entry.tags) note.tags = [...entry.tags];');

fs.copyFileSync(path.join(local, 'personalAnnotationTags.test.ts'),
  path.join(app, 'src/__tests__/personalAnnotationTags.test.ts'));
// Include annotation tags in both template-based and built-in markdown exports.
patch('src/utils/note.ts',
  '      note?: string;\n      style?: string;',
  '      note?: string;\n      tags?: string[];\n      style?: string;');
const mdExport = 'src/app/reader/components/annotator/ExportMarkdownDialog.tsx';
patch(mdExport,
  "          if (exportConfig.includeNotes && note.note) {\n            lines.push('');\n            lines.push(\`**\${_('Note')}**: \${note.note}\`);\n          }",
  "          if (exportConfig.includeNotes && note.note) {\n            lines.push('');\n            lines.push(\`**\${_('Note')}**: \${note.note}\`);\n          }\n" +
  "          if (note.tags?.length) {\n            lines.push('');\n            lines.push('**Tags**: ' + note.tags.join(', '));\n          }");


patch('src/app/reader/utils/annotatorUtil.ts',
  "import { Overlayer } from 'foliate-js/overlayer.js';",
  "import { Overlayer } from 'foliate-js/overlayer.js';\nimport { eventDispatcher } from '@/utils/event';");
const annotationUtil = 'src/app/reader/utils/annotatorUtil.ts';
patch(annotationUtil, "    isMobile: boolean;\n", "    isMobile: boolean;\n    bookKey?: string;\n");
patch(annotationUtil, "  const { settings, viewSettings, isDarkMode, isMobile } = ctx;", "  const { settings, viewSettings, isDarkMode, isMobile, bookKey } = ctx;");
patch(annotationUtil, "  const kind = decideAnnotationDraw(value, style);", "  const kind = decideAnnotationDraw(value, style);\n\n  const drawWithTag = (renderer: unknown, opts: Record<string, unknown>) => {\n    if (kind === 'bubble' || !annotation.tags?.length || !bookKey) {\n      draw(renderer, opts);\n      return;\n    }\n    const fn = renderer as (rects: DOMRectList, options: Record<string, unknown>) => SVGElement;\n    draw((rects: DOMRectList, options: Record<string, unknown> = {}) => {\n      const base = fn(rects, options);\n      const rect = rects[0];\n      if (!rect) return base;\n      const ns = 'http://www.w3.org/2000/svg';\n      const g = doc.createElementNS(ns, 'g');\n      g.append(base);\n      const badge = doc.createElementNS(ns, 'g');\n      badge.style.pointerEvents = 'all';\n      const x = Math.max(0, rect.left), y = Math.max(0, rect.top - 7);\n      const hit = doc.createElementNS(ns, 'rect');\n      hit.setAttribute('x', String(Math.max(0, x - 3)));\n      hit.setAttribute('y', String(Math.max(0, y - 2)));\n      hit.setAttribute('width', '23');\n      hit.setAttribute('height', '23');\n      hit.setAttribute('fill', 'transparent');\n      const chip = doc.createElementNS(ns, 'rect');\n      chip.setAttribute('x', String(x));\n      chip.setAttribute('y', String(y));\n      chip.setAttribute('width', '12');\n      chip.setAttribute('height', '12');\n      chip.setAttribute('rx', '3');\n      chip.setAttribute('fill', '#252a36');\n      const label = doc.createElementNS(ns, 'text');\n      label.setAttribute('x', String(x + 6));\n      label.setAttribute('y', String(y + 9));\n      label.setAttribute('text-anchor', 'middle');\n      label.setAttribute('font-size', '11');\n      label.setAttribute('font-family', 'sans-serif');\n      label.setAttribute('font-weight', 'bold');\n      label.setAttribute('fill', '#ffffff');\n      label.textContent = '#';\n      badge.append(hit, chip, label);\n      badge.addEventListener('pointerdown', (event) => event.stopPropagation());\n      badge.addEventListener('click', (event) => {\n        event.preventDefault();\n        event.stopPropagation();\n        const box = chip.getBoundingClientRect();\n        const frame = doc.defaultView?.frameElement;\n        const frameRect = frame?.getBoundingClientRect();\n        const scaleX = frameRect ? frameRect.width / (doc.documentElement.clientWidth || frameRect.width) : 1;\n        const scaleY = frameRect ? frameRect.height / (doc.documentElement.clientHeight || frameRect.height) : 1;\n        const pointX = frameRect ? frameRect.left + box.left * scaleX : box.left;\n        const pointY = frameRect ? frameRect.top + box.top * scaleY : box.top;\n        void eventDispatcher.dispatch('personal-tag-badge-open', {\n          bookKey, noteId: annotation.id, tags: annotation.tags, x: pointX, y: pointY,\n        });\n      });\n      g.append(badge);\n      return g;\n    }, opts);\n  };\n");
patch(annotationUtil, "    draw(Overlayer.highlight, {", "    drawWithTag(Overlayer.highlight, {");
patch(annotationUtil, "    draw(Overlayer[kind], {", "    drawWithTag(Overlayer[kind], {");
patch('src/app/reader/components/annotator/Annotator.tsx',
"      isMobile: !!appService?.isMobile,",
"      isMobile: !!appService?.isMobile,\n      bookKey,");
patch('src/app/reader/components/annotator/Annotator.tsx',
"import { PersonalAnnotationTagPicker } from './PersonalAnnotationTagPicker';",
"import { PersonalAnnotationTagPicker } from './PersonalAnnotationTagPicker';\nimport { PersonalTagBadgePopover } from './PersonalTagBadgePopover';");
patch('src/app/reader/components/annotator/Annotator.tsx',
"      <PageTurnHint bookKey={bookKey} contentInsets={contentInsets} hint={turnHint} />",
"      <PageTurnHint bookKey={bookKey} contentInsets={contentInsets} hint={turnHint} />\n      <PersonalTagBadgePopover bookKey={bookKey} />");
fs.copyFileSync(path.join(local, 'PersonalTagBadgePopover.tsx'),
  path.join(app, 'src/app/reader/components/annotator/PersonalTagBadgePopover.tsx'));

console.log('Readest Personal: annotation tags, popup editor, and sidebar tag catalog applied');


// Annotation controls added to the original Readest reader and sidebar must
// follow the very same UI locale as standalone Personal components.
function localizeAnnotationInjected(file, replacements) {
  const target = path.join(app, file);
  let source = fs.readFileSync(target, 'utf8');
  for (const [from, to] of replacements) {
    if (source.split(from).length !== 2)
      throw new Error('Annotation localization anchor mismatch: ' + file + ' ~ ' + from.slice(0, 70));
    source = source.replace(from, to);
  }
  const dependency = "import { personalText } from '@/utils/personalI18n';\n";
  if (!source.includes(dependency)) {
    source = source.startsWith("'use client';\n")
      ? source.replace("'use client';\n", "'use client';\n" + dependency)
      : dependency + source;
  }
  fs.writeFileSync(target, source);
}
localizeAnnotationInjected('src/app/reader/components/annotator/Annotator.tsx', [
  ["tooltipText: 'Tags', Icon: MdOutlineLabel", "tooltipText: personalText('Tags'), Icon: MdOutlineLabel"],
]);
localizeAnnotationInjected('src/app/reader/components/annotator/AnnotationPopup.tsx', [
  ["aria-label='Edit highlight tags'", "aria-label={personalText('Edit highlight tags')}"],
  ["># Tags</button>", ">{personalText('# Tags')}</button>"],
]);
localizeAnnotationInjected('src/app/reader/components/sidebar/BooknoteView.tsx', [
  ["aria-label='Annotation tag organizer'", "aria-label={personalText('Annotation tag organizer')}"],
  [">Sort / group</span>", ">{personalText('Sort / group')}</span>"],
  ["aria-label='Annotation sort and group order'", "aria-label={personalText('Annotation sort and group order')}"],
  ...['Reading order', 'Recently edited', 'Oldest first', 'Group by tag']
    .map((label) => [">" + label + "</option>", ">{personalText('" + label + "')}</option>"]),
  ["aria-label='Filter annotations by tags'", "aria-label={personalText('Filter annotations by tags')}"],
  [">Clear tags</button>", ">{personalText('Clear tags')}</button>"],
  ["href: 'tag:' + name, label: name, booknotes: []",
   "href: 'tag:' + name, label: name === 'Untagged' ? personalText('Untagged') : name, booknotes: []"],
]);
localizeAnnotationInjected('src/app/reader/components/sidebar/BooknoteItem.tsx', [
  ["aria-label='Edit annotation tags'", "aria-label={personalText('Edit annotation tags')}"],
  [">+ Tags</button>", ">{personalText('+ Tags')}</button>"],
]);
localizeAnnotationInjected('src/app/reader/components/annotator/ExportMarkdownDialog.tsx', [
  ["lines.push('**Tags**: ' + note.tags.join(', '));",
   "lines.push('**' + personalText('Tags') + '**: ' + note.tags.join(', '));"],
]);
console.log('Readest Personal: localized annotation toolbar, tags, filters and markdown export');
