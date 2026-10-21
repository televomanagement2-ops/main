/**
 * The light/dark switch as a turned page: the departing sheet peels up from
 * the bottom-right corner and folds back over itself, uncovering the new theme
 * underneath. Built on same-document View Transitions, in three pieces:
 *
 *   · the old page, captured under its own name so it gets a group of its own
 *     above the new page, cut off at the fold;
 *   · the flap — the back of the departing sheet — which is that sheet
 *     reflected across the fold, drawn on the pseudo-elements of a stand-in;
 *   · the soft shadow the fold casts onto the page it uncovers.
 *
 * Every moving part is a transform, and nothing is repainted while it plays.
 * The cuts come from `overflow: clip` on boxes laid along the fold that ride
 * with it, with their contents counter-moved to stay put. (Animating clip-path
 * instead re-rasterises every clipped layer on every frame — hundreds of tiles
 * at full screen size — and, where clip-path isn't composited, leaves the cuts
 * on the main thread while the transforms run on the compositor, so under load
 * the flap tears away from the fold.) The fold keeps one angle and slides along
 * its normal, so each box is a fixed shape translating at a steady rate: two
 * keyframes are exact at every frame, and one shared timing keeps every piece
 * locked to the others. Colours and shading live in base.css.
 *
 * Where View Transitions are missing, the tab is hidden or the visitor
 * prefers reduced motion, the theme simply switches.
 */

/** The corner starts lifting within a few frames, sweeps, then settles. */
const DURATION = 1000;
const EASING = 'cubic-bezier(0.5, 0.1, 0.3, 1)';

/** Travel angle above the horizontal, in degrees: close to the diagonal, but
 *  clamped so a phone still turns across rather than rolling up, and a wide
 *  monitor doesn't fold almost vertically. */
const MIN_ANGLE = 30;
const MAX_ANGLE = 52;

/** The fold starts this far beyond the corner, so the first frame is exactly
 *  the old page — not even the flap's shadow reaches in yet. */
const LEAD = 16;
/** Travel past the far corner, so the fold's shadow (base.css, --turn-shade)
 *  clears the screen too. */
const TAIL = 48;
/** Slack on both ends of the crease strip so its ends can never show. */
const SLACK = 8;

type Point = [number, number];

interface Turn {
  /** Fold boxes: length along the fold and depth into the old page. */
  span: number;
  depth: number;
  sheetWidth: number;
  sheetHeight: number;
  creaseWidth: number;
  fold: string[];
  page: string[];
  sheet: string[];
  crease: string[];
}

let current: ViewTransition | null = null;
let pendingUpdate: (() => void) | null = null;

const num = (n: number) => String(Math.round(n * 100) / 100);
const px = (n: number) => `${num(n)}px`;
const settled = (transition: ViewTransition): Promise<void> =>
  transition.finished.then(
    () => undefined,
    () => undefined
  );

/**
 * Runs `update` (which must switch the theme) behind a page turn. Resolves once
 * the new page has fully settled.
 */
export function turnPage(toDark: boolean, update: () => void): Promise<void> {
  if (
    typeof document.startViewTransition !== 'function' ||
    document.visibilityState !== 'visible' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return Promise.resolve();
  }

  // A second switch before the page has even been captured (a double tap)
  // joins the queued turn instead of starting another from a half-switched page.
  if (current && pendingUpdate) {
    pendingUpdate = update;
    return settled(current);
  }

  const root = document.documentElement;
  const stand = document.createElement('div');
  stand.className = 'page-turn';
  stand.setAttribute('aria-hidden', 'true');
  document.body.append(stand);

  // The snapshot covers every area that could show page content, which on a
  // phone includes the strip behind collapsible toolbars — so the stand-in's
  // 100lvh, not innerHeight, locates the bottom corner.
  const turn = foldTurn(window.innerWidth, Math.max(window.innerHeight, stand.offsetHeight));

  root.dataset.pageTurn = toDark ? 'to-dark' : 'to-light';
  // Mid-turn already (the previous turn is about to be cut short): capture
  // the page under its departing name again.
  delete root.dataset.pageTurned;
  root.style.setProperty('--turn-span', px(turn.span));
  root.style.setProperty('--turn-depth', px(turn.depth));
  root.style.setProperty('--turn-sheet-w', px(turn.sheetWidth));
  root.style.setProperty('--turn-sheet-h', px(turn.sheetHeight));
  root.style.setProperty('--turn-crease-w', px(turn.creaseWidth));

  pendingUpdate = update;
  const transition = document.startViewTransition(() => {
    stand.remove();
    root.dataset.pageTurned = '';
    const run = pendingUpdate;
    pendingUpdate = null;
    run?.();
  });
  current = transition;

  transition.ready.then(() => play(turn)).catch(() => undefined);

  return settled(transition).then(() => {
    stand.remove();
    // A newer turn that cut this one short now owns the attributes.
    if (current !== transition) return;
    current = null;
    delete root.dataset.pageTurn;
    delete root.dataset.pageTurned;
    for (const name of ['span', 'depth', 'sheet-w', 'sheet-h', 'crease-w']) {
      root.style.removeProperty(`--turn-${name}`);
    }
  });
}

/** Transform-only, so the compositor runs every piece on one clock. */
function play(turn: Turn): void {
  const root = document.documentElement;
  const animate = (pseudo: string, keyframes: PropertyIndexedKeyframes) =>
    root.animate(keyframes, {
      duration: DURATION,
      easing: EASING,
      fill: 'both',
      pseudoElement: `::view-transition-${pseudo}`,
    });
  animate('image-pair(turn-old)', { transform: turn.fold });
  animate('old(turn-old)', { transform: turn.page });
  animate('group(page-turn)', { transform: turn.fold, opacity: [1, 1] });
  animate('image-pair(page-turn)', { transform: turn.sheet });
  animate('old(page-turn)', { transform: turn.crease });
}

/** Start and end keyframes for a turn across a `w` × `h` snapshot. */
function foldTurn(w: number, h: number): Turn {
  const angle = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, (Math.atan2(h, w) * 180) / Math.PI));
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);

  // Positions are (along, across) from the bottom-right corner: `along` runs
  // the way the fold travels (up and to the left), `across` runs down the
  // fold line itself. The fold is the line `along = s`.
  const toScreen = (along: number, across: number): Point => [
    w - along * cos - across * sin,
    h - along * sin + across * cos,
  ];

  const reach = w * cos + h * sin; // corner to opposite corner, along the travel
  const end = reach + TAIL;
  const half = w + h + 2 * TAIL; // comfortably more than anything on screen

  // Fold boxes, for the old page and for the flap: origin on the fold, x down
  // the fold, y into the old page, so their overflow clip is the fold itself.
  const turnTo = `rotate(${num(angle + 90)}deg)`;
  const turnBack = `rotate(${num(-(angle + 90))}deg)`;
  const fold = (s: number) => {
    const [x, y] = toScreen(s, -half);
    return `translate(${px(x)}, ${px(y)}) ${turnTo}`;
  };
  // The old page inside its fold box: the exact inverse, so it holds still.
  const page = (s: number) => {
    const [x, y] = toScreen(s, -half);
    return `${turnBack} translate(${px(-x)}, ${px(-y)})`;
  };

  // The sheet, reflected across the fold: page point (x, y) lands at
  // (tx - x·sin + y·cos, s - reach + x·cos + y·sin) in the fold box. That
  // mirror is rotate(angle - 90) scaleX(-1), and it is its own inverse.
  const mirror = `rotate(${num(angle - 90)}deg) scaleX(-1)`;
  const tx = w * sin - h * cos + half;
  const sheet = (s: number) => `translate(${px(tx)}, ${px(s - reach)}) ${mirror}`;
  // The crease strip undoes the sheet's placement, so it lies along the fold.
  const creaseLeft = half - h * cos - SLACK;
  const crease = (s: number) => `${mirror} translate(${px(creaseLeft - tx)}, ${px(reach - s)})`;

  return {
    span: half * 2,
    depth: half,
    sheetWidth: w,
    sheetHeight: h,
    creaseWidth: w * sin + h * cos + SLACK * 2,
    fold: [fold(-LEAD), fold(end)],
    page: [page(-LEAD), page(end)],
    sheet: [sheet(-LEAD), sheet(end)],
    crease: [crease(-LEAD), crease(end)],
  };
}
