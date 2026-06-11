/**
 * Regenerates design/figma/chapter-user-journey.fig from code.
 * Uses openfig-core (community .fig encoder — open in Figma desktop to verify).
 *
 * Run: npm run figma:journey
 *
 * Important: TEXT nodes must be children of FRAME, not ROUNDED_RECTANGLE —
 * otherwise Figma opens the file but renders empty cards.
 */

import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { compress } from '@mongodb-js/zstd'
import {
  createEmptyFigDoc,
  encodeFigParts,
  assembleCanvasFig,
  createFigZip,
  makeSolidPaint,
  parseFig,
} from 'openfig-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, 'chapter-user-journey.fig')

const PAGE_GUID = { sessionID: 0, localID: 1 }
const DETACHED_STYLE = { guid: { sessionID: 4294967295, localID: 4294967295 } }

const C = {
  canvas: '#fafaf9',
  surface: '#ffffff',
  border: '#e7e5e4',
  text: '#1c1917',
  textSecondary: '#78716c',
  textMuted: '#a8a29e',
  body: '#44403c',
  brand: '#fbbf24',
  brandSubtle: '#fef3c7',
}

let localId = 100
const guid = () => ({ sessionID: 1, localID: localId++ })
const pos = (i) => String.fromCharCode(33 + i)

function buildTextData(text) {
  const characters = text.endsWith('\n') ? text : text
  const lines = characters.split('\n').map(() => ({
    lineType: 'PLAIN',
    indentationLevel: 0,
    isFirstLineOfList: false,
    styleId: 0,
    sourceDirectionality: 'AUTO',
    listStartOffset: 0,
  }))
  return { characters, lines }
}

/** FRAME card — required parent for TEXT nodes in Figma */
function addCard(nodes, { name, parent, position, x, y, w, h, fill, stroke = false, radius = 0 }) {
  const g = guid()
  nodes.push({
    guid: g,
    type: 'FRAME',
    phase: 'CREATED',
    name,
    parentIndex: { guid: parent, position },
    visible: true,
    opacity: 1,
    size: { x: w, y: h },
    transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
    fillPaints: [makeSolidPaint(fill)],
    cornerRadius: radius,
    rectangleTopLeftCornerRadius: radius,
    rectangleTopRightCornerRadius: radius,
    rectangleBottomLeftCornerRadius: radius,
    rectangleBottomRightCornerRadius: radius,
    strokeWeight: stroke ? 1 : 0,
    strokeAlign: 'INSIDE',
    strokeJoin: 'MITER',
    strokePaints: stroke ? [makeSolidPaint(C.border)] : [],
    frameMaskDisabled: true,
    clipsContent: false,
  })
  return g
}

/** Decorative shape only — never parent TEXT nodes to this */
function addRect(nodes, { name, parent, position, x, y, w, h, fill, radius = 0 }) {
  const g = guid()
  nodes.push({
    guid: g,
    type: 'ROUNDED_RECTANGLE',
    phase: 'CREATED',
    name,
    parentIndex: { guid: parent, position },
    visible: true,
    opacity: 1,
    size: { x: w, y: h },
    transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
    cornerRadius: radius,
    rectangleTopLeftCornerRadius: radius,
    rectangleTopRightCornerRadius: radius,
    rectangleBottomLeftCornerRadius: radius,
    rectangleBottomRightCornerRadius: radius,
    strokeWeight: 0,
    strokeAlign: 'INSIDE',
    strokeJoin: 'MITER',
    fillPaints: [makeSolidPaint(fill)],
  })
  return g
}

function addText(nodes, { name, parent, position, x, y, w, text, size, bold = false, color = C.text }) {
  const g = guid()
  const textData = buildTextData(text)
  nodes.push({
    guid: g,
    type: 'TEXT',
    phase: 'CREATED',
    name,
    parentIndex: { guid: parent, position },
    visible: true,
    opacity: 1,
    size: { x: w, y: Math.max(40, textData.lines.length * size * 1.5) },
    transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
    textData,
    fontName: {
      family: 'Inter',
      style: bold ? 'Bold' : 'Regular',
      postscript: bold ? 'Inter-Bold' : 'Inter-Regular',
    },
    fontSize: size,
    lineHeight: { value: 1.4, units: 'RAW' },
    letterSpacing: { value: 0, units: 'PERCENT' },
    textTracking: 0,
    textAutoResize: 'HEIGHT',
    textAlignHorizontal: 'LEFT',
    textAlignVertical: 'TOP',
    styleIdForText: DETACHED_STYLE,
    fillPaints: [makeSolidPaint(color)],
    strokeWeight: 0,
    strokeAlign: 'OUTSIDE',
    strokeJoin: 'MITER',
  })
  return g
}

const PHASES = [
  {
    title: '1 · Discover & Install',
    emotion: 'Curious · 3/5',
    screens: 'App Store / referral\nSplash · Capacitor shell',
    actions: '• Read tagline\n• Install & open\n• First impression load',
    pains: '• Unclear differentiation\n• Slow first paint',
    ops: '• Lead with books + people\n• Store screenshots = taste',
    highlight: false,
  },
  {
    title: '2 · Account',
    emotion: 'Committed · 4/5',
    screens: '/login · /register\nAuthGuard spinner',
    actions: '• Sign up or sign in\n• Session persists\n• Profile fetch starts',
    pains: '• Form fatigue\n• No password recovery',
    ops: '• Single-column forms\n• Amber primary CTA',
    highlight: false,
  },
  {
    title: '3 · Onboarding',
    emotion: 'Investing · 3/5',
    screens: '/onboarding — 4 steps\nInfo → Photos → Genres → Books',
    actions: '• Name, DOB, gender, prefs\n• Photos (≥1)\n• Genres (min 3, skippable)\n• Favourite books (skippable)',
    pains: '• Length / drop-off\n• Book search friction',
    ops: '• Books step = hero\n• Explain why each step',
    highlight: false,
  },
  {
    title: '4 · Identity Verify',
    emotion: 'Anxious → Trust',
    screens: '/verify\nStripe browser · chapter://verify-complete',
    actions: '• Tap verify CTA\n• Complete ID check\n• Poll identity_verified\n• Land on Discover',
    pains: '• Verification friction\n• Processing uncertainty',
    ops: '• Explain why (safety, 18+)\n• Background polling + retry',
    highlight: false,
  },
  {
    title: '5 · Discover',
    emotion: 'Peak · 5/5',
    screens: '/ swipe deck\nFilters · profile modal · BookDetail',
    actions: '• get_candidates (scored)\n• Like / pass + haptics\n• View bio, genres, books',
    pains: '• Empty deck\n• Fetch errors',
    ops: '• Shared books = hook\n• Skeleton loaders\n• Match modal',
    highlight: true,
  },
  {
    title: '6 · Match & Chat',
    emotion: 'Connected · 5/5',
    screens: '/matches · /chat/:id\nReport · Block · Unmatch',
    actions: '• Match list + preview\n• Realtime messages\n• Typing indicator',
    pains: '• Blank first message\n• Safety concerns',
    ops: '• Amber sent bubbles\n• Toast → tap to chat',
    highlight: true,
  },
  {
    title: '7 · Library · Profile',
    emotion: 'Habit / Exit · 4/5',
    screens: '/library · /profile · /profile/edit',
    actions: '• Shelves + ratings\n• Edit photos, bio, books\n• Pause · delete account',
    pains: '• Stale profile\n• Pause confusion',
    ops: '• Library refreshes score\n• Respectful pause flow',
    highlight: false,
  },
]

function buildJourney(nodes) {
  const W = 4800
  const main = addCard(nodes, {
    name: 'Chapter / User Journey / MVP',
    parent: PAGE_GUID,
    position: pos(0),
    x: 0,
    y: 0,
    w: W,
    h: 3200,
    fill: C.canvas,
  })

  addText(nodes, {
    name: 'Title',
    parent: main,
    position: pos(0),
    x: 80,
    y: 48,
    w: 2400,
    text: 'Chapter — Customer Journey Map',
    size: 48,
    bold: true,
  })
  addText(nodes, {
    name: 'Subtitle',
    parent: main,
    position: pos(1),
    x: 80,
    y: 108,
    w: 2400,
    text: 'Compound view · MVP flows · Regenerate with npm run figma:journey',
    size: 20,
    color: C.textSecondary,
  })

  const persona = addCard(nodes, {
    name: 'Persona — Alex',
    parent: main,
    position: pos(2),
    x: 80,
    y: 180,
    w: 360,
    h: 1040,
    fill: C.surface,
    stroke: true,
    radius: 24,
  })
  addText(nodes, {
    name: 'Persona label',
    parent: persona,
    position: pos(0),
    x: 24,
    y: 24,
    w: 300,
    text: 'PRIMARY PERSONA',
    size: 12,
    bold: true,
    color: C.textMuted,
  })
  addText(nodes, {
    name: 'Persona content',
    parent: persona,
    position: pos(1),
    x: 24,
    y: 52,
    w: 312,
    text: [
      'Alex — The Avid Reader (24–35)',
      '',
      'Motivation',
      'Meet someone who shares book taste.',
      '',
      'Anxieties',
      '• Fake / shallow profiles',
      '• Awkward first messages',
      '• Safety & verification',
      '',
      'Success moment',
      'Mutual like → chat about a shared book.',
      '',
      'Key metrics',
      '• Onboarding completion',
      '• Verify pass rate (<10 min)',
      '• Time to first swipe',
      '• Match → message (48h)',
      '',
      'Brand promise',
      '"Find your next great read — and reader."',
    ].join('\n'),
    size: 14,
    color: C.body,
  })

  let colX = 480
  PHASES.forEach((phase, i) => {
    const col = addCard(nodes, {
      name: `Phase ${i + 1}`,
      parent: main,
      position: pos(3 + i),
      x: colX,
      y: 180,
      w: 580,
      h: 1040,
      fill: C.surface,
      stroke: true,
      radius: 16,
    })

    addRect(nodes, {
      name: 'Header band',
      parent: col,
      position: pos(0),
      x: 0,
      y: 0,
      w: 580,
      h: 56,
      fill: phase.highlight ? C.brand : C.brandSubtle,
      radius: 16,
    })

    addText(nodes, {
      name: 'Phase title',
      parent: col,
      position: pos(1),
      x: 16,
      y: 14,
      w: 548,
      text: phase.title,
      size: 20,
      bold: true,
    })
    addText(nodes, {
      name: 'Emotion',
      parent: col,
      position: pos(2),
      x: 16,
      y: 72,
      w: 548,
      text: `Emotion: ${phase.emotion}`,
      size: 14,
      color: C.textSecondary,
    })
    addText(nodes, {
      name: 'Screens',
      parent: col,
      position: pos(3),
      x: 16,
      y: 110,
      w: 548,
      text: `Screens\n${phase.screens}`,
      size: 14,
      bold: true,
    })
    addText(nodes, {
      name: 'Actions',
      parent: col,
      position: pos(4),
      x: 16,
      y: 220,
      w: 548,
      text: `Actions\n${phase.actions}`,
      size: 14,
    })
    addText(nodes, {
      name: 'Pain points',
      parent: col,
      position: pos(5),
      x: 16,
      y: 400,
      w: 548,
      text: `Pain points\n${phase.pains}`,
      size: 14,
      color: C.textSecondary,
    })
    addText(nodes, {
      name: 'Opportunities',
      parent: col,
      position: pos(6),
      x: 16,
      y: 520,
      w: 548,
      text: `Opportunities\n${phase.ops}`,
      size: 14,
      color: C.body,
    })

    colX += 604
  })

  const flow = addCard(nodes, {
    name: 'Happy path flow',
    parent: main,
    position: pos(10),
    x: 80,
    y: 1260,
    w: 4640,
    h: 220,
    fill: C.surface,
    stroke: true,
    radius: 24,
  })
  addText(nodes, {
    name: 'Flow title',
    parent: flow,
    position: pos(0),
    x: 24,
    y: 24,
    w: 4400,
    text: 'Happy path: Install → Register → Onboarding (×4) → Verify → Swipe → Match → Chat → Library → Return',
    size: 20,
    bold: true,
  })
  addText(nodes, {
    name: 'Flow gates',
    parent: flow,
    position: pos(1),
    x: 24,
    y: 64,
    w: 4400,
    text: 'Gates: AuthGuard → onboarding_complete → identity_verified · Nav: Discover · Matches · Books · Profile',
    size: 14,
    color: C.textSecondary,
  })
  addText(nodes, {
    name: 'Flow globals',
    parent: flow,
    position: pos(2),
    x: 24,
    y: 100,
    w: 4400,
    text: 'Cross-cutting: OfflineBanner · ToastBanner · NotificationListener · BookDetailModal · Report/Block',
    size: 14,
    color: C.textSecondary,
  })

  const tokens = addCard(nodes, {
    name: 'Design tokens',
    parent: main,
    position: pos(11),
    x: 80,
    y: 1520,
    w: 4640,
    h: 120,
    fill: C.text,
    radius: 16,
  })
  addText(nodes, {
    name: 'Token text',
    parent: tokens,
    position: pos(0),
    x: 24,
    y: 28,
    w: 4400,
    text: 'Design system: canvas stone-50 · surface white · brand amber-400 · text stone-900/500 · CTA rounded-xl · focus ring-amber-400 · min tap 44px',
    size: 16,
    color: C.canvas,
  })
}

async function main() {
  const doc = createEmptyFigDoc()
  const nodes = doc.message.nodeChanges

  buildJourney(nodes)

  doc.meta = {
    file_name: 'Chapter User Journey',
    version: 0,
  }

  const parts = encodeFigParts(doc)
  const messageCompressed = new Uint8Array(await compress(Buffer.from(parts.messageRaw), 3))
  const canvasFig = assembleCanvasFig({ ...parts, messageCompressed })
  const figZip = createFigZip({
    canvasFig,
    meta: doc.meta,
    thumbnail: doc.thumbnail,
  })

  writeFileSync(OUT_PATH, figZip)

  const check = parseFig(figZip)
  const textParents = check.nodes
    .filter((n) => n.type === 'TEXT')
    .map((n) => {
      const p = check.nodes.find(
        (x) => x.guid?.sessionID === n.parentIndex?.guid?.sessionID && x.guid?.localID === n.parentIndex?.guid?.localID,
      )
      return p?.type
    })
  const bad = textParents.filter((t) => t !== 'FRAME').length

  console.log(`✓ Wrote ${OUT_PATH}`)
  console.log(`  ${figZip.length.toLocaleString()} bytes · ${check.nodes.length} nodes`)
  console.log(`  TEXT parents: ${bad === 0 ? 'all FRAME ✓' : `${bad} not FRAME ✗`}`)
  console.log('  Re-open in Figma desktop (close tab first if already open)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
