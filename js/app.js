/**
 * LIVING LETTER — Interactive Marginal Notes
 * ============================================
 */

// ============================================
// MARGINAL NOTES DATA
// ============================================

const MARGINAL_NOTES = [
  {
    id: 'beginner',
    anchorId: 'beginner',
    text: 'what are you a beginner at?',
    side: 'right',
    writingHref: 'writing.html#topic-beginner',
    prompt: 'What are you learning right now that makes you feel like a beginner again?',
    context: 'On being a perpetual beginner...'
  },
  {
    id: 'coordinate',
    anchorId: 'coordinate',
    text: 'coordination without coercion?',
    side: 'left',
    writingHref: 'writing.html#topic-coordination',
    prompt: 'What\'s an example of coordination that actually worked — or spectacularly failed?',
    context: 'On interfaces for coordination at scale...'
  },
  {
    id: 'invert',
    anchorId: 'invert',
    text: 'what would this actually look like?',
    side: 'right',
    writingHref: 'writing.html#topic-inversion',
    prompt: 'If the internet were built around individuals instead of platforms, what would change first?',
    context: 'On inverting who the internet is built around...'
  },
  {
    id: 'limits',
    anchorId: 'limits',
    text: 'is this actually true?',
    side: 'left',
    writingHref: 'writing.html#topic-money',
    prompt: 'Do you think money is really approaching its physical limits — or is this overstated?',
    context: 'On monetary coordination collapsing toward its physical limits...'
  },
  {
    id: 'freed',
    anchorId: 'freed',
    text: 'what would you do with it?',
    side: 'right',
    writingHref: 'writing.html#topic-capacity',
    prompt: 'If coordination suddenly became cheap, what would you spend the freed-up time and attention on?',
    context: 'On what is freed up as coordination costs collapse...'
  },
  {
    id: 'responsibility',
    anchorId: 'responsibility',
    text: 'who holds the responsibility?',
    side: 'left',
    writingHref: 'writing.html#topic-responsibility',
    prompt: 'When systems get more efficient, who ends up holding the responsibility — and is that good?',
    context: 'On responsibility becoming more concentrated...'
  },
  {
    id: 'living',
    anchorId: 'living',
    text: 'letters deserve responses',
    side: 'right',
    writingHref: 'writing.html#topic-living-letter',
    prompt: 'What\'s a question you\'ve been carrying that you haven\'t found a good place to put yet?',
    context: 'On this being a living letter...'
  }
];


// ============================================
// APPLICATION STATE
// ============================================

const state = {
  openWindows: new Map(),
  nextZIndex: 1000,
  dragState: null,
};


// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeMarginalNotes();
  setupAnchorHighlighting();
  setupGlobalDragListeners();
  renderAllDoodles();

  // Font loading can subtly shift inline layout; redraw once fonts settle.
  // This improves alignment of circles/underlines with the text.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => renderAllDoodles());
  }
});


// ============================================
// MARGINAL NOTES RENDERING
// ============================================

function initializeMarginalNotes() {
  const marginsContainer = document.getElementById('margins');
  
  MARGINAL_NOTES.forEach(note => {
    const noteElement = createMarginalNoteElement(note);
    marginsContainer.appendChild(noteElement);
    positionMarginalNote(note, noteElement);
  });
  renderAllDoodles();
  
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      MARGINAL_NOTES.forEach(note => {
        const noteElement = document.querySelector(`[data-margin-note-id="${note.id}"]`);
        if (noteElement) {
          positionMarginalNote(note, noteElement);
        }
      });
      renderAllDoodles();
    }, 100);
  });
}

// ============================================
// HAND-DRAWN DOODLES
// ============================================
//
// Goal: make the letter feel like a correspondence surface, not a UI.
// We draw:
// - scribbly underlines and circles around selected anchor phrases
// - playful margin doodles (stars, arrows, spirals, map-like lines)
//
// Implementation choice:
// - SVG overlays are used so the marks track layout precisely.
// - Marks are re-rendered on resize for correctness.
//
// TODO: If this grows, consider caching measurements per anchor to reduce work.

const DOODLE_MARKS = {
  // For each anchor id, pick what marks to draw on the text.
  beginner: { circle: true, underline: false, ink: 'ink' },
  coordinate: { circle: false, underline: true, ink: 'accent' },
  invert: { circle: true, underline: true, ink: 'ink' },
  limits: { circle: false, underline: true, ink: 'accent' },
  freed: { circle: true, underline: false, ink: 'ink' },
  responsibility: { circle: true, underline: false, ink: 'accent' },
  living: { circle: false, underline: true, ink: 'ink' },
};

function renderAllDoodles() {
  renderTextDoodles();
  renderMarginDoodles();
}

function renderTextDoodles() {
  const svg = document.getElementById('letter-doodles');
  const letter = document.getElementById('letter');
  if (!svg || !letter) return;

  const rect = letter.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.innerHTML = '';

  Object.entries(DOODLE_MARKS).forEach(([anchorId, marks]) => {
    const el = document.querySelector(`[data-note-id="${anchorId}"]`);
    if (!el) return;
    const rects = Array.from(el.getClientRects());
    if (rects.length === 0) return;

    // Use the *actual* line boxes instead of a single union rect.
    // This makes underlines line up even when an anchor wraps lines.
    const localRects = rects.map((r) => ({
      x: r.left - rect.left,
      y: r.top - rect.top,
      w: r.width,
      h: r.height,
    }));

    const klass = marks.ink === 'accent'
      ? 'doodle-stroke doodle-accent'
      : 'doodle-stroke doodle-ink';
    const seed = hashString(anchorId);

    if (marks.circle) {
      // Circle the union of all line rects with tighter padding for better alignment.
      const union = unionRect(localRects);
      const padX = 6;
      const padY = 6;
      const cx = union.x + union.w / 2;
      const cy = union.y + union.h / 2;
      const rx = union.w / 2 + padX;
      const ry = union.h / 2 + padY;

      // Two passes to feel more like a pen looping twice.
      const p1 = roughEllipsePath(cx, cy, rx, ry, seed);
      const p2 = roughEllipsePath(cx, cy, rx + 2, ry - 1, seed + 42);
      svg.appendChild(svgPath(p1, klass));
      svg.appendChild(svgPath(p2, klass));
    }

    if (marks.underline) {
      // Underline each line box, not the whole union.
      localRects.forEach((lr, i) => {
        const y = lr.y + lr.h + 6;
        const p = squiggleUnderlinePath(
          lr.x - 2,
          y,
          lr.x + lr.w + 2,
          y,
          seed + 7 + i * 17
        );
        svg.appendChild(svgPath(p, klass));
      });
    }
  });
}

function renderMarginDoodles() {
  const svg = document.getElementById('margin-doodles');
  const margins = document.getElementById('margins');
  const letter = document.getElementById('letter');
  if (!svg || !margins || !letter) return;

  const m = margins.getBoundingClientRect();
  const l = letter.getBoundingClientRect();
  const width = Math.max(1, Math.floor(m.width));
  const height = Math.max(1, Math.floor(m.height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.innerHTML = '';

  // Helper: positions relative to margins overlay
  const letterLeft = l.left - m.left;
  const letterRight = l.right - m.left;

  // Whimsy goal: LOTS of small, light marks across the full height.
  // Important: keep doodles out of the letter column so it stays readable.
  //
  // The user explicitly asked to remove the big “map cluster” scribble and
  // replace it with many more margin doodles — especially in the bottom half.

  // A few intentional “hero” doodles that give the page character:
  drawPaperPlane(
    svg,
    clamp(letterLeft - 160, 24, Math.max(24, letterLeft - 40)),
    Math.max(120, height * 0.12),
    clamp(letterLeft - 40, 80, letterLeft - 8),
    Math.max(160, height * 0.16),
    131
  );
  drawCurlyBracket(svg, clamp(letterRight + 22, letterRight + 12, width - 18), height * 0.40, height * 0.52, 'doodle-stroke doodle-ink', 149);

  // Arrow pointing toward the "invert…" phrase - point at center of text, not above
  const invert = document.querySelector('[data-note-id="invert"]');
  if (invert) {
    const ir = invert.getBoundingClientRect();
    const ix = (ir.left - m.left) + ir.width * 0.5;
    const iy = (ir.top - m.top) + ir.height * 0.5; // Center of text, not above
    const startX = Math.max(20, letterLeft - 120);
    const startY = Math.max(80, iy - 20);
    drawArrow(svg, startX, startY, ix, iy, 'doodle-stroke doodle-ink', 47);
  }

  // Now: generate MANY more small doodles distributed across the full height,
  // with an intentional bias toward the bottom half.
  scatterMarginDoodles(svg, { width, height, letterLeft, letterRight });
}

// ---------- SVG drawing helpers ----------

function svgPath(d, className) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  p.setAttribute('class', className);
  return p;
}

function hashString(str) {
  // small deterministic hash -> number
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roughEllipsePath(cx, cy, rx, ry, seed) {
  const r = rng(seed);
  const steps = 22;
  const jitter = 1.4; // Reduced for cleaner circles
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = cx + Math.cos(t) * rx + (r() - 0.5) * jitter * 2;
    const y = cy + Math.sin(t) * ry + (r() - 0.5) * jitter * 2;
    d += (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return d;
}

function squiggleUnderlinePath(x0, y0, x1, y1, seed) {
  const r = rng(seed);
  const len = Math.max(20, x1 - x0);
  const steps = Math.max(10, Math.floor(len / 18));
  const amp = 2.6;
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const wave = Math.sin(t * Math.PI * 2 * 2) * amp;
    const y = y0 + wave + (r() - 0.5) * 1.5;
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

function unionRect(rects) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rects.forEach((r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function drawStar(svg, cx, cy, radius, className, seed) {
  const r = rng(seed);
  const lines = 8;
  for (let i = 0; i < lines; i++) {
    const a = (i / lines) * Math.PI * 2 + (r() - 0.5) * 0.2;
    const x1 = cx + Math.cos(a) * (radius * 0.4);
    const y1 = cy + Math.sin(a) * (radius * 0.4);
    const x2 = cx + Math.cos(a) * (radius * (1.2 + (r() - 0.5) * 0.2));
    const y2 = cy + Math.sin(a) * (radius * (1.2 + (r() - 0.5) * 0.2));
    svg.appendChild(svgPath(`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`, className));
  }
}

function drawSpiral(svg, cx, cy, radius, className, seed) {
  const r = rng(seed);
  const turns = 2.4;
  const steps = 42;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * Math.PI * 2 * turns;
    const rad = radius * (t * 0.95);
    const x = cx + Math.cos(ang) * rad + (r() - 0.5) * 1.2;
    const y = cy + Math.sin(ang) * rad + (r() - 0.5) * 1.2;
    d += (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  svg.appendChild(svgPath(d, className));
}

function drawHeart(svg, cx, cy, size, className, seed) {
  const r = rng(seed);
  const s = size;
  const wobble = (v) => v + (r() - 0.5) * 1.2;
  const d = [
    `M ${wobble(cx)} ${wobble(cy + s * 0.2)}`,
    `C ${wobble(cx - s)} ${wobble(cy - s * 0.6)} ${wobble(cx - s * 1.2)} ${wobble(cy + s * 0.6)} ${wobble(cx)} ${wobble(cy + s)}`,
    `C ${wobble(cx + s * 1.2)} ${wobble(cy + s * 0.6)} ${wobble(cx + s)} ${wobble(cy - s * 0.6)} ${wobble(cx)} ${wobble(cy + s * 0.2)}`,
  ].join(' ');
  svg.appendChild(svgPath(d, className));
}

function drawFace(svg, x, y, className, seed) {
  const r = rng(seed);
  // head
  svg.appendChild(svgPath(roughEllipsePath(x, y, 22, 18, seed + 1), className));
  // eyes
  const eyeDx = 8;
  svg.appendChild(svgPath(roughEllipsePath(x - eyeDx, y - 2, 2.6, 2.6, seed + 2), className));
  svg.appendChild(svgPath(roughEllipsePath(x + eyeDx, y - 2, 2.6, 2.6, seed + 3), className));
  // smile
  const sx0 = x - 10, sx1 = x + 10, sy = y + 8;
  const smile = `M ${sx0.toFixed(2)} ${sy.toFixed(2)} Q ${x.toFixed(2)} ${(sy + 6 + (r() - 0.5) * 2).toFixed(2)} ${sx1.toFixed(2)} ${sy.toFixed(2)}`;
  svg.appendChild(svgPath(smile, className));
}

function drawSparkleCluster(svg, x, y, count, seed) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const dx = (r() - 0.5) * 40;
    const dy = (r() - 0.5) * 30;
    drawStar(svg, x + dx, y + dy, 6 + r() * 6, 'doodle-stroke doodle-ink', seed + i * 13);
  }
}

function drawPaperPlane(svg, x0, y0, x1, y1, seed) {
  const r = rng(seed);
  const className = 'doodle-stroke doodle-ink';
  const midx = (x0 + x1) / 2 + (r() - 0.5) * 30;
  const midy = (y0 + y1) / 2 + (r() - 0.5) * 20;

  // flight path
  svg.appendChild(svgPath(`M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${midx.toFixed(2)} ${midy.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`, className));

  // plane
  const px = x1, py = y1;
  const size = 16;
  const ang = Math.atan2(y1 - midy, x1 - midx);
  const p1 = { x: px + Math.cos(ang + Math.PI * 0.85) * size, y: py + Math.sin(ang + Math.PI * 0.85) * size };
  const p2 = { x: px + Math.cos(ang - Math.PI * 0.85) * size, y: py + Math.sin(ang - Math.PI * 0.85) * size };
  const p3 = { x: px + Math.cos(ang + Math.PI) * (size * 0.55), y: py + Math.sin(ang + Math.PI) * (size * 0.55) };
  const d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${px.toFixed(2)} ${py.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
  svg.appendChild(svgPath(d, className));
}

function drawCurlyBracket(svg, x, y0, y1, className, seed) {
  const r = rng(seed);
  const wob = () => (r() - 0.5) * 6;
  const mid = (y0 + y1) / 2;
  const d = [
    `M ${(x + wob()).toFixed(2)} ${(y0 + wob()).toFixed(2)}`,
    `C ${(x - 16 + wob()).toFixed(2)} ${(y0 + 18 + wob()).toFixed(2)} ${(x - 16 + wob()).toFixed(2)} ${(mid - 18 + wob()).toFixed(2)} ${(x + wob()).toFixed(2)} ${(mid + wob()).toFixed(2)}`,
    `C ${(x + 16 + wob()).toFixed(2)} ${(mid + 18 + wob()).toFixed(2)} ${(x + 16 + wob()).toFixed(2)} ${(y1 - 18 + wob()).toFixed(2)} ${(x + wob()).toFixed(2)} ${(y1 + wob()).toFixed(2)}`,
  ].join(' ');
  svg.appendChild(svgPath(d, className));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}

function scatterMarginDoodles(svg, { width, height, letterLeft, letterRight }) {
  const r = rng(20260301);
  const gutterPad = 22;
  const leftMax = Math.max(40, letterLeft - gutterPad);
  const rightMin = Math.min(width - 40, letterRight + gutterPad);

  // If the viewport is tight and gutters are small, keep doodles subtle.
  const leftGutterW = Math.max(0, leftMax);
  const rightGutterW = Math.max(0, width - rightMin);
  const hasRealGutters = leftGutterW > 70 || rightGutterW > 70;

  // Gather obstacles (sticky notes) so doodles don't collide with them.
  const obstacles = Array.from(document.querySelectorAll('.marginal-note')).map((el) => {
    const m = document.getElementById('margins')?.getBoundingClientRect();
    const rr = el.getBoundingClientRect();
    if (!m) return null;
    return {
      x: rr.left - m.left,
      y: rr.top - m.top,
      w: rr.width,
      h: rr.height,
    };
  }).filter(Boolean);

  const kinds = ['star', 'spiral', 'heart', 'sparkle', 'bolt', 'squiggle', 'miniArrow', 'flower'];
  const classes = ['doodle-stroke doodle-ink', 'doodle-stroke', 'doodle-stroke doodle-ink'];

  // Create a shuffled, evenly-distributed sequence of types so we don't cluster.
  // Reduced count for a cleaner, less cluttered look.
  const totalDoodles = hasRealGutters ? 28 : 16;
  const shuffledKinds = shuffleArray([...kinds], rng(12345));
  const shuffledClasses = shuffleArray([...classes], rng(67890));
  
  // Repeat the shuffled arrays to fill the count, ensuring variety.
  const kindSequence = [];
  const classSequence = [];
  for (let i = 0; i < totalDoodles; i++) {
    kindSequence.push(shuffledKinds[i % shuffledKinds.length]);
    classSequence.push(shuffledClasses[i % shuffledClasses.length]);
  }
  // Shuffle one more time to break any patterns from the modulo.
  const finalKinds = shuffleArray(kindSequence, rng(11111));
  const finalClasses = shuffleArray(classSequence, rng(22222));

  // Even distribution: split page into equal bands, place same number per band.
  const bandCount = hasRealGutters ? 16 : 10;
  const topSafe = 90;            // avoid nav + very top whitespace
  const bottomSafe = 60;
  const usableH = Math.max(1, height - topSafe - bottomSafe);
  const bandH = usableH / bandCount;
  const perBand = Math.floor(totalDoodles / bandCount);
  const remainder = totalDoodles % bandCount;

  const placed = []; // {x,y,rad} for spacing
  let doodleIndex = 0;

  for (let band = 0; band < bandCount; band++) {
    const bandTop = topSafe + band * bandH;
    const bandBottom = bandTop + bandH;
    const bandMid = (bandTop + bandBottom) / 2;

    // Distribute remainder evenly across bands.
    const countThisBand = perBand + (band < remainder ? 1 : 0);

    for (let j = 0; j < countThisBand; j++) {
      if (doodleIndex >= totalDoodles) break;

      const kind = finalKinds[doodleIndex];
      const klass = finalClasses[doodleIndex];
      const seed = (band + 1) * 1000 + (j + 1) * 97 + doodleIndex * 13;
      const rr = rng(seed);

      // Estimate footprint for collision avoidance.
      const footprint =
        kind === 'squiggle' ? 26 :
        kind === 'bolt' ? 18 :
        kind === 'spiral' ? 18 :
        kind === 'miniArrow' ? 18 :
        kind === 'star' ? 14 :
        kind === 'flower' ? 14 :
        kind === 'heart' ? 14 :
        14;

      // Alternate sides evenly within each band.
      const preferredSide = (j % 2 === 0) ? 'left' : 'right';
      const canLeft = leftGutterW > 40;
      const canRight = rightGutterW > 40;
      const side =
        preferredSide === 'left'
          ? (canLeft ? 'left' : 'right')
          : (canRight ? 'right' : 'left');

      // Try a few placements with jitter and spacing checks.
      let placedOne = false;
      for (let attempt = 0; attempt < 12 && !placedOne; attempt++) {
        const y = clamp(
          bandMid + (rr() - 0.5) * bandH * 0.6,
          topSafe + 10,
          height - bottomSafe - 10
        );

        const x =
          side === 'left'
            ? clamp(18 + rr() * (leftMax - 18), 12, leftMax - 12)
            : clamp(rightMin + rr() * (width - rightMin - 18), rightMin + 12, width - 12);

        if (!isClear({ x, y, rad: footprint }, placed, obstacles)) continue;

        drawOneMarginDoodle(svg, { kind, x, y, klass, seed: seed + doodleIndex * 7 });
        placed.push({ x, y, rad: footprint });
        placedOne = true;
        doodleIndex++;
      }
    }
  }
}

function shuffleArray(arr, rngFn) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function isClear(candidate, placed, obstacles) {
  const pad = 8;
  // Keep a little distance between doodles.
  for (const p of placed) {
    const dx = candidate.x - p.x;
    const dy = candidate.y - p.y;
    const min = candidate.rad + p.rad + pad;
    if (dx * dx + dy * dy < min * min) return false;
  }

  // Don't draw on top of sticky notes.
  for (const o of obstacles) {
    const ox0 = o.x - pad;
    const oy0 = o.y - pad;
    const ox1 = o.x + o.w + pad;
    const oy1 = o.y + o.h + pad;
    if (candidate.x >= ox0 && candidate.x <= ox1 && candidate.y >= oy0 && candidate.y <= oy1) {
      return false;
    }
  }

  return true;
}

function drawOneMarginDoodle(svg, { kind, x, y, klass, seed }) {
  const rr = rng(seed + 555);
  switch (kind) {
    case 'star':
      drawStar(svg, x, y, 6 + rr() * 9, klass, seed);
      break;
    case 'sparkle':
      drawSparkleCluster(svg, x, y, 1 + Math.floor(rr() * 2), seed);
      break;
    case 'spiral':
      drawSpiral(svg, x, y, 10 + rr() * 16, klass, seed);
      break;
    case 'heart':
      drawHeart(svg, x, y, 7 + rr() * 10, klass, seed);
      break;
    case 'bolt':
      drawLightning(svg, x, y, 14 + rr() * 18, klass, seed);
      break;
    case 'squiggle':
      drawWiggle(svg, x, y, 26 + rr() * 40, klass, seed);
      break;
    case 'miniArrow':
      drawMiniArrow(svg, x, y, 16 + rr() * 26, klass, seed);
      break;
    case 'flower':
      drawFlower(svg, x, y, 7 + rr() * 10, klass, seed);
      break;
    default:
      break;
  }
}

function drawLightning(svg, x, y, size, className, seed) {
  const r = rng(seed);
  const wob = () => (r() - 0.5) * 2.2;
  const d = [
    `M ${(x + wob()).toFixed(2)} ${(y + wob()).toFixed(2)}`,
    `L ${(x + size * 0.25 + wob()).toFixed(2)} ${(y + size * 0.15 + wob()).toFixed(2)}`,
    `L ${(x + size * 0.05 + wob()).toFixed(2)} ${(y + size * 0.55 + wob()).toFixed(2)}`,
    `L ${(x + size * 0.5 + wob()).toFixed(2)} ${(y + size * 0.45 + wob()).toFixed(2)}`,
    `L ${(x + size * 0.25 + wob()).toFixed(2)} ${(y + size * 0.95 + wob()).toFixed(2)}`,
  ].join(' ');
  svg.appendChild(svgPath(d, className));
}

function drawWiggle(svg, x, y, length, className, seed) {
  const r = rng(seed);
  const steps = Math.max(8, Math.floor(length / 10));
  const amp = 4 + r() * 3;
  const x0 = x - length / 2;
  const x1 = x + length / 2;
  let d = `M ${x0.toFixed(2)} ${(y + (r() - 0.5) * 2).toFixed(2)}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const xx = x0 + (x1 - x0) * t;
    const yy = y + Math.sin(t * Math.PI * 2 * 2) * amp + (r() - 0.5) * 2;
    d += ` L ${xx.toFixed(2)} ${yy.toFixed(2)}`;
  }
  svg.appendChild(svgPath(d, className));
}

function drawMiniArrow(svg, x, y, length, className, seed) {
  const r = rng(seed);
  const ang = (r() - 0.5) * 0.9;
  const x1 = x + Math.cos(ang) * length;
  const y1 = y + Math.sin(ang) * length;
  svg.appendChild(svgPath(`M ${x.toFixed(2)} ${y.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`, className));
  const head = 7;
  const a1 = ang + Math.PI * 0.85;
  const a2 = ang - Math.PI * 0.85;
  const hx1 = x1 + Math.cos(a1) * head;
  const hy1 = y1 + Math.sin(a1) * head;
  const hx2 = x1 + Math.cos(a2) * head;
  const hy2 = y1 + Math.sin(a2) * head;
  svg.appendChild(svgPath(`M ${hx1.toFixed(2)} ${hy1.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${hx2.toFixed(2)} ${hy2.toFixed(2)}`, className));
}

function drawFlower(svg, x, y, radius, className, seed) {
  const r = rng(seed);
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const px = x + Math.cos(a) * radius * 1.2;
    const py = y + Math.sin(a) * radius * 1.2;
    svg.appendChild(svgPath(roughEllipsePath(px, py, radius * 0.75, radius * 0.5, seed + i * 19), className));
  }
  svg.appendChild(svgPath(roughEllipsePath(x, y, radius * 0.4, radius * 0.4, seed + 99), className));
}

function drawArrow(svg, x0, y0, x1, y1, className, seed) {
  const r = rng(seed);
  const midx = (x0 + x1) / 2 + (r() - 0.5) * 30;
  const midy = (y0 + y1) / 2 + (r() - 0.5) * 30;
  svg.appendChild(svgPath(`M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${midx.toFixed(2)} ${midy.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`, className));

  // arrow head
  const ang = Math.atan2(y1 - midy, x1 - midx);
  const size = 10;
  const a1 = ang + Math.PI * 0.85;
  const a2 = ang - Math.PI * 0.85;
  const hx1 = x1 + Math.cos(a1) * size;
  const hy1 = y1 + Math.sin(a1) * size;
  const hx2 = x1 + Math.cos(a2) * size;
  const hy2 = y1 + Math.sin(a2) * size;
  svg.appendChild(svgPath(`M ${hx1.toFixed(2)} ${hy1.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${hx2.toFixed(2)} ${hy2.toFixed(2)}`, className));
}

function createMarginalNoteElement(note) {
  const el = document.createElement('button');
  el.className = `marginal-note ${note.side}`;
  el.textContent = note.text;
  el.setAttribute('data-margin-note-id', note.id);
  el.setAttribute('data-anchor-id', note.anchorId);
  el.setAttribute('aria-label', `Note: ${note.text}. Click to respond.`);
  
  el.addEventListener('click', () => {
    openWriteBackWindow(note);
  });
  
  el.addEventListener('mouseenter', () => {
    highlightAnchor(note.anchorId, true);
  });
  
  el.addEventListener('mouseleave', () => {
    highlightAnchor(note.anchorId, false);
  });
  
  return el;
}

function positionMarginalNote(note, noteElement) {
  const anchor = document.querySelector(`[data-note-id="${note.anchorId}"]`);
  if (!anchor) return;
  
  const marginsContainer = document.getElementById('margins');
  const letterElement = document.getElementById('letter');
  if (!marginsContainer || !letterElement) return;

  // We compute positions relative to the margins container (which is the
  // absolute-positioned overlay above the letter). This avoids hard-coded
  // `calc(50% + …)` gutters that can clip on narrower viewports.
  const marginsRect = marginsContainer.getBoundingClientRect();
  const letterRect = letterElement.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();

  const noteHeight = noteElement.offsetHeight;
  const noteWidth = noteElement.offsetWidth;

  // Vertical: align note center to anchor center, but clamp so notes never
  // render off-screen / get cut off at the top.
  const rawTop =
    (anchorRect.top - marginsRect.top) +
    (anchorRect.height / 2) -
    (noteHeight / 2);

  const topPadding = 12;
  const maxTop = Math.max(topPadding, marginsRect.height - noteHeight - topPadding);
  const top = Math.max(topPadding, Math.min(rawTop, maxTop));

  // Horizontal: place notes in the left/right gutter next to the letter,
  // and clamp within the margins overlay.
  const gutter = 28;
  const rawLeft =
    note.side === 'right'
      ? (letterRect.right - marginsRect.left) + gutter
      : (letterRect.left - marginsRect.left) - noteWidth - gutter;

  const maxLeft = Math.max(8, marginsRect.width - noteWidth - 8);
  const left = Math.max(8, Math.min(rawLeft, maxLeft));

  noteElement.style.top = `${top}px`;
  noteElement.style.left = `${left}px`;
}


// ============================================
// ANCHOR HIGHLIGHTING
// ============================================

function highlightAnchor(anchorId, isHighlighted) {
  const anchor = document.querySelector(`[data-note-id="${anchorId}"]`);
  if (anchor) {
    anchor.classList.toggle('highlighted', isHighlighted);
  }
}

function setupAnchorHighlighting() {
  document.querySelectorAll('.anchor').forEach(anchor => {
    const noteId = anchor.getAttribute('data-note-id');
    const marginalNote = document.querySelector(`[data-margin-note-id="${noteId}"]`);
    
    anchor.addEventListener('mouseenter', () => {
      if (marginalNote) {
        marginalNote.style.transform = 'scale(1.05) rotate(0deg) translateY(-2px)';
        marginalNote.style.boxShadow = '3px 5px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
      }
    });
    
    anchor.addEventListener('mouseleave', () => {
      if (marginalNote) {
        marginalNote.style.transform = '';
        marginalNote.style.boxShadow = '';
      }
    });
    
    anchor.style.cursor = 'pointer';
    anchor.addEventListener('click', () => {
      const note = MARGINAL_NOTES.find(n => n.anchorId === noteId);
      if (note) {
        openWriteBackWindow(note);
      }
    });
  });
}


// ============================================
// FLOATING WINDOWS
// ============================================

function openWriteBackWindow(note) {
  if (state.openWindows.has(note.id)) {
    bringWindowToFront(note.id);
    return;
  }
  
  const windowElement = createWindowElement(note);
  document.getElementById('windows-layer').appendChild(windowElement);
  
  positionWindow(note, windowElement);
  
  state.openWindows.set(note.id, {
    element: windowElement,
    zIndex: state.nextZIndex
  });
  
  windowElement.style.zIndex = state.nextZIndex;
  state.nextZIndex++;
  
  const textarea = windowElement.querySelector('.window-textarea');
  if (textarea) {
    setTimeout(() => textarea.focus(), 50);
  }
}

function createWindowElement(note) {
  const win = document.createElement('div');
  win.className = 'floating-window';
  win.setAttribute('data-window-id', note.id);
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-labelledby', `window-title-${note.id}`);
  
  win.addEventListener('mousedown', (e) => {
    bringWindowToFront(note.id);
  });
  
  win.innerHTML = `
    <div class="window-titlebar" data-draggable="true">
      <h3 class="window-title" id="window-title-${note.id}">${note.text}</h3>
      <button class="window-btn close" aria-label="Close" data-action="close">
        <svg viewBox="0 0 10 10" fill="none" stroke="#6b0000" stroke-width="1.5">
          <line x1="2" y1="2" x2="8" y2="8"></line>
          <line x1="8" y1="2" x2="2" y2="8"></line>
        </svg>
      </button>
    </div>
    <div class="window-content">
      <div class="window-meta">
        <p class="window-prompt">${note.prompt}</p>
        ${note.writingHref ? `<a class="window-writing-link" href="${note.writingHref}">Read my writing on this →</a>` : ``}
      </div>
      <form class="window-form">
        <textarea
          class="window-textarea"
          placeholder="Write a paragraph back…"
          rows="6"
          aria-label="Your response"
        ></textarea>
        <input
          type="email"
          class="window-email"
          placeholder="Email (optional)"
          aria-label="Your email, optional"
        />
        <div class="window-buttons">
          <button type="submit" class="btn btn-primary">Send note to LDF</button>
          <button type="button" class="btn btn-secondary" data-action="email">Email me instead</button>
        </div>
        <p class="window-disclaimer">
          This goes directly to me. I read everything, but reply selectively.
        </p>
      </form>
    </div>
  `;
  
  const closeBtn = win.querySelector('[data-action="close"]');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWindow(note.id);
  });
  
  const form = win.querySelector('.window-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit(note, win);
  });
  
  const emailBtn = win.querySelector('[data-action="email"]');
  emailBtn.addEventListener('click', () => {
    handleEmailFallback(note, win);
  });
  
  const titlebar = win.querySelector('.window-titlebar');
  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    startDrag(note.id, e);
  });
  
  return win;
}

function positionWindow(note, windowElement) {
  const anchor = document.querySelector(`[data-note-id="${note.anchorId}"]`);
  if (!anchor) {
    windowElement.style.top = '100px';
    windowElement.style.left = '50%';
    windowElement.style.transform = 'translateX(-50%)';
    return;
  }
  
  const anchorRect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const windowWidth = 400;
  const windowHeight = 420;
  
  let top = anchorRect.bottom + 20;
  let left = anchorRect.left + (anchorRect.width / 2) - (windowWidth / 2);
  
  if (left < 20) left = 20;
  if (left + windowWidth > viewportWidth - 20) {
    left = viewportWidth - windowWidth - 20;
  }
  if (top + windowHeight > viewportHeight - 20) {
    top = anchorRect.top - windowHeight - 20;
    if (top < 20) top = 20;
  }
  
  windowElement.style.top = `${top}px`;
  windowElement.style.left = `${left}px`;
}

function bringWindowToFront(noteId) {
  const windowData = state.openWindows.get(noteId);
  if (!windowData) return;
  
  windowData.element.style.zIndex = state.nextZIndex;
  state.nextZIndex++;
}

function closeWindow(noteId) {
  const windowData = state.openWindows.get(noteId);
  if (!windowData) return;
  
  windowData.element.style.opacity = '0';
  windowData.element.style.transform = 'scale(0.95)';
  windowData.element.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  
  setTimeout(() => {
    windowData.element.remove();
    state.openWindows.delete(noteId);
  }, 150);
}


// ============================================
// WINDOW DRAGGING
// ============================================

function startDrag(windowId, e) {
  const windowData = state.openWindows.get(windowId);
  if (!windowData) return;
  
  const win = windowData.element;
  const rect = win.getBoundingClientRect();
  
  state.dragState = {
    windowId,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top
  };
  
  win.classList.add('dragging');
  bringWindowToFront(windowId);
  
  e.preventDefault();
}

function setupGlobalDragListeners() {
  document.addEventListener('mousemove', (e) => {
    if (!state.dragState) return;
    
    const windowData = state.openWindows.get(state.dragState.windowId);
    if (!windowData) return;
    
    const win = windowData.element;
    const newLeft = e.clientX - state.dragState.offsetX;
    const newTop = e.clientY - state.dragState.offsetY;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const windowWidth = win.offsetWidth;
    
    const clampedLeft = Math.max(0, Math.min(newLeft, viewportWidth - windowWidth));
    const clampedTop = Math.max(0, Math.min(newTop, viewportHeight - 40));
    
    win.style.left = `${clampedLeft}px`;
    win.style.top = `${clampedTop}px`;
  });
  
  document.addEventListener('mouseup', () => {
    if (!state.dragState) return;
    
    const windowData = state.openWindows.get(state.dragState.windowId);
    if (windowData) {
      windowData.element.classList.remove('dragging');
    }
    
    state.dragState = null;
  });
}


// ============================================
// FORM HANDLING
// ============================================

function handleFormSubmit(note, windowElement) {
  const textarea = windowElement.querySelector('.window-textarea');
  const emailInput = windowElement.querySelector('.window-email');
  
  const message = textarea.value.trim();
  const email = emailInput.value.trim();
  
  if (!message) {
    textarea.focus();
    textarea.style.borderColor = '#e57373';
    setTimeout(() => {
      textarea.style.borderColor = '';
    }, 2000);
    return;
  }
  
  const payload = {
    noteId: note.id,
    notePrompt: note.prompt,
    context: note.context,
    message: message,
    email: email || null,
    timestamp: new Date().toISOString()
  };
  
  // Submit to backend API (uses centralized config)
  const API_URL = window.CONFIG ? CONFIG.API_SUBMIT : 'https://personal-website-production-6937.up.railway.app/api/submit';
  
  console.log('Submitting to:', API_URL);
  console.log('Payload:', payload);
  
  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  .then(async response => {
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', text);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = { error: `HTTP ${response.status}: ${text || response.statusText}` };
      }
      throw new Error(JSON.stringify(errorData));
    }
    
    return JSON.parse(text);
  })
  .then(data => {
    console.log('📬 Note saved:', data);
    launchConfetti(windowElement);
    showSubmissionConfirmation(windowElement);
    
    setTimeout(() => {
      closeWindow(note.id);
    }, 2000);
  })
  .catch(error => {
    console.error('Error submitting note:', error);
    const errorMessage = error.message || 'Unknown error';
    
    // Fallback: use email instead if backend is unavailable
    const content = windowElement.querySelector('.window-content');
    content.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 2rem; margin-bottom: 12px;">📧</div>
        <p style="font-family: 'Caveat', cursive; font-size: 1.2rem; color: #5b5bd6; margin: 0 0 12px 0;">
          Backend not available
        </p>
        <p style="font-size: 0.85rem; color: #666; margin: 0 0 20px 0;">
          Error: ${errorMessage}<br>
          Using email fallback instead...
        </p>
        <button class="btn btn-primary" onclick="window.location.href='mailto:hello@ldf.dev?subject=${encodeURIComponent('Note: ' + note.context)}&body=${encodeURIComponent(note.prompt + '\\n\\n---\\n\\n' + message + '\\n\\n---\\nSent from: living letter')}'">
          Open Email Client
        </button>
      </div>
    `;
  });
}

function handleEmailFallback(note, windowElement) {
  const textarea = windowElement.querySelector('.window-textarea');
  const message = textarea.value.trim();
  
  const subject = encodeURIComponent(`Re: ${note.context}`);
  const body = encodeURIComponent(
    `${note.prompt}\n\n---\n\n${message || '[Your thoughts here]'}\n\n---\nSent from: living letter`
  );
  
  const mailtoLink = `mailto:hello@ldf.dev?subject=${subject}&body=${body}`;
  
  window.open(mailtoLink, '_blank');
}

function showSubmissionConfirmation(windowElement) {
  const content = windowElement.querySelector('.window-content');
  content.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 2.5rem; margin-bottom: 16px;">✨</div>
      <p style="font-family: 'Caveat', cursive; font-size: 1.4rem; color: #5b5bd6; margin: 0;">
        Sent! Thank you for writing.
      </p>
      <p style="font-size: 0.85rem; color: #888; margin-top: 12px;">
        Your note is on its way.
      </p>
    </div>
  `;
}


// ============================================
// CONFETTI ANIMATION
// ============================================

function launchConfetti(sourceElement) {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  const rect = sourceElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const colors = ['#5b5bd6', '#ff6b6b', '#ffd93d', '#6bcb77', '#c9a0dc', '#a0c4dc'];
  const shapes = ['●', '■', '▲', '✦', '♦'];
  
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = `${centerX + (Math.random() - 0.5) * 100}px`;
    confetti.style.top = `${centerY}px`;
    confetti.style.fontSize = `${8 + Math.random() * 10}px`;
    confetti.style.animationDuration = `${1.5 + Math.random() * 1}s`;
    confetti.style.animationDelay = `${Math.random() * 0.3}s`;
    
    const drift = (Math.random() - 0.5) * 200;
    confetti.style.setProperty('--drift', `${drift}px`);
    
    container.appendChild(confetti);
  }
  
  setTimeout(() => {
    container.remove();
  }, 3000);
}


// ============================================
// KEYBOARD NAVIGATION
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    let topWindow = null;
    let topZIndex = 0;
    
    state.openWindows.forEach((data, id) => {
      const z = parseInt(data.element.style.zIndex) || 0;
      if (z > topZIndex) {
        topZIndex = z;
        topWindow = id;
      }
    });
    
    if (topWindow) {
      closeWindow(topWindow);
    }
  }
});
