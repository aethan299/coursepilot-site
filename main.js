/**
 * main.js — the only script on the site.
 *
 * The theme toggle, the demo frame's self-heal, the scroll reveal, the pointer
 * tilt on the browser mock, the looping chat illustration, and the play/pause
 * gate that keeps the chat and the data-flow diagram from animating while
 * nobody is looking at them. No dependencies, no network calls, nothing stored
 * except the visitor's own theme choice.
 */
(function () {
  'use strict';

  /* ======================================================================
     ANIMATION TIMING — every number the scripted animations use.

     Tune here rather than hunting through the code. The CSS animations have
     their own matching block at the top of styles.css.

     On CHAT: ANSWER_DELAY is how long a question sits alone before its answer
     lands, and NEXT_DELAY is how long the finished exchange sits before the
     next question pushes it up. Between them they decide whether a reader can
     finish a line before it moves. If the loop feels rushed, raise NEXT_DELAY
     first — the pause after an answer is what a reader actually uses.
     ====================================================================== */
  var CHAT = {
    ANSWER_DELAY: 1200,   // ms from a question appearing to its answer
    NEXT_DELAY: 1500,     // ms from an answer appearing to the next question
    RESTART_DELAY: 2200,  // ms of stillness before the script starts over
    MAX_BUBBLES: 4,       // bubbles kept on screen; a fifth pushes the top out
    SHIFT_MS: 420         // must match --t-chat-shift in styles.css
  };

  /* ----------------------------------------------------------------------
     The data-flow diagram.

     TRAVEL_MS is the time for a FULL-LENGTH journey. Every route's duration is
     scaled by its own length against REF_LEN, so a card moves at the same
     speed on the short hops as it does on the long run to the boundary. That,
     plus offset-distance rather than animating x and y, is what keeps the
     speed even through the bends.

     EASE_IN / EASE_OUT are the fractions of a journey spent accelerating and
     decelerating; the middle is constant speed. BLOCK_EASE_OUT is deliberately
     much longer, because that card is supposed to look like it is running into
     something.
     ---------------------------------------------------------------------- */
  var DIAGRAM = {
    TRAVEL_MS: 2500,        // a full-length journey
    REF_LEN: 434,           // user units a TRAVEL_MS journey covers
    PAUSE_MS: 1200,         // stillness between journeys
    EASE_IN: 0.15,
    EASE_OUT: 0.15,
    BLOCK_EASE_IN: 0.12,
    BLOCK_EASE_OUT: 0.35,   // the hard stop
    TRAIL_COUNT: 3,         // ghost copies behind the card
    TRAIL_LAG_MS: 70,       // how far behind each ghost runs
    TRAIL_OPACITY: 0.30,    // the first ghost; the rest step down from here
    TILT_DEG: 2.5,          // card tilt at the start, eased to 0 on arrival
    GLOW_PULSE_MS: 1500,
    SQUASH_MS: 130,         // the compression on contact
    SHATTER_MS: 600,        // particles scattering and fading
    PARTICLES: 11,
    FLARE_MS: 200,          // how long the cross mark burns brighter
    RIPPLE_MS: 1000,        // the pulse running along the boundary from impact
    LABEL_MS: 1600,         // "nothing to send to" on screen
    GATE_WAIT_MS: 1600,     // a card sitting at a closed gate before it gives up
    SHIMMER_MS: 9000,       // one lap of the boundary by the shimmer
    PARALLAX_MAX: 8         // px at the extremes; more than this is seasick
  };

  /* ---------------------------------------------------------------- theme */

  var STORE_KEY = 'coursepilot-site:theme';
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var label = document.getElementById('theme-toggle-label');

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /** What the page is actually showing right now, attribute or OS. */
  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function syncToggle() {
    if (!toggle) return;
    var dark = currentTheme() === 'dark';
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    if (label) label.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(STORE_KEY, next); } catch (e) { /* private browsing */ }
      syncToggle();
    });
  }

  // A visitor who never chose gets to follow the OS live, including a change
  // made while the page is open.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!root.getAttribute('data-theme')) syncToggle(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  syncToggle();

  /* ----------------------------------------------------------- demo frame */

  /**
   * Put the demo's launcher back in the corner if it landed somewhere else.
   *
   * The widget measures its viewport the moment it mounts and saves where the
   * launcher goes. If the frame has not finished being laid out at that instant
   * it measures zero and pins the launcher to the middle-left, on top of the
   * demo's own text. Timing that mount from out here turned out to be
   * unreliable, so instead we check the result — the widget's saved position is
   * in this origin's localStorage — and reload the frame once if it is wrong.
   *
   * PREFS_KEY is the widget's own storage key (widget-prefs.js in the extension
   * repo). If that key or its shape changes, this check quietly stops working;
   * the demo still runs, it just may look wrong. See the README.
   */
  var PREFS_KEY = 'vcs-assistant:widget';
  var frame = document.querySelector('.browser-view');

  if (frame) {
    var healed = false;

    /** Where the launcher should be sitting, given the frame's size right now. */
    var launcherLooksWrong = function () {
      var box = frame.getBoundingClientRect();
      // Too small to judge — the frame has not been laid out yet, so wait.
      if (box.width < 200 || box.height < 200) return false;

      var saved;
      try {
        saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
      } catch (e) {
        return false;
      }
      if (!saved || typeof saved.x !== 'number' || typeof saved.y !== 'number') return false;

      // It defaults to the bottom-right corner. Anything in the top or left
      // half of the frame means it measured a viewport that was not there.
      return saved.x < box.width / 2 || saved.y < box.height / 2;
    };

    var check = function () {
      if (healed || !launcherLooksWrong()) return;
      healed = true;
      try { window.localStorage.removeItem(PREFS_KEY); } catch (e) { /* private browsing */ }
      // Re-run the demo now that the frame definitely has its real size.
      try {
        frame.contentWindow.location.reload();
      } catch (e) {
        frame.src = frame.getAttribute('src') + '?retry=1';
      }
    };

    // The frame often only reaches its real width after the demo inside has
    // already mounted and measured — that is the whole problem — so watch for
    // it from every direction: the frame's own load, the frame changing size,
    // the window changing size, and a ladder of timers for the cases where
    // none of those fire.
    frame.addEventListener('load', check);
    window.addEventListener('resize', check);
    if ('ResizeObserver' in window) {
      new ResizeObserver(check).observe(frame);
    }
    [200, 600, 1500, 3000, 6000].forEach(function (ms) { window.setTimeout(check, ms); });
  }

  /* ------------------------------------------------------------- 3D tilt */

  /**
   * Tilt the browser mock toward the pointer, so it reads as an object sitting
   * in the page rather than a screenshot pasted onto it.
   *
   * Three rules keep it from getting in the way:
   *   - it flattens the moment the pointer is over the frame, or anything
   *     inside it takes focus, so nobody ever clicks a skewed control;
   *   - it does nothing on touch or when the pointer is coarse, which covers
   *     the school iPads, where the compositor work would not be repaid;
   *   - it does nothing at all under prefers-reduced-motion.
   * Writes two custom properties and lets CSS do the transform, so the only
   * thing that ever changes is one composited property.
   */
  var mock = document.getElementById('browser-mock');
  var hero = document.querySelector('.hero');
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (mock && hero && fine && !noMotion) {
    var MAX = 5;           // degrees; past about 6 it stops being subtle
    var queued = false;
    var px = 0, py = 0;

    var apply = function () {
      queued = false;
      var box = hero.getBoundingClientRect();
      if (!box.width || !box.height) return;
      // -1 .. 1 from the centre of the hero
      var nx = ((px - box.left) / box.width - 0.5) * 2;
      var ny = ((py - box.top) / box.height - 0.5) * 2;
      nx = nx < -1 ? -1 : nx > 1 ? 1 : nx;
      ny = ny < -1 ? -1 : ny > 1 ? 1 : ny;
      mock.style.setProperty('--tilt-x', (-ny * MAX + 1.4).toFixed(2) + 'deg');
      mock.style.setProperty('--tilt-y', (nx * MAX - 2.5).toFixed(2) + 'deg');
    };

    var onPointer = function (e) {
      px = e.clientX;
      py = e.clientY;
      if (queued) return;
      queued = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(apply);
      else window.setTimeout(apply, 32);
    };

    hero.addEventListener('pointermove', onPointer, { passive: true });

    // Back to rest when the pointer leaves the hero entirely.
    hero.addEventListener('pointerleave', function () {
      mock.style.removeProperty('--tilt-x');
      mock.style.removeProperty('--tilt-y');
    });

    // Flat while it is being used.
    var flatten = function () { mock.classList.add('is-flat'); };
    var unflatten = function () {
      if (mock.contains(document.activeElement)) return;
      mock.classList.remove('is-flat');
    };
    mock.addEventListener('pointerenter', flatten);
    mock.addEventListener('pointerleave', unflatten);
    mock.addEventListener('focusin', flatten);
    mock.addEventListener('focusout', unflatten);
  }

  /* ----------------------------------------------------------------- chat */

  /**
   * The looping chat beside the four steps.
   *
   * SCRIPT is an illustration, not a recording. Every exchange here is
   * something the extension answers today; the dates are all relative, and the
   * course names generic, so this can never be mistaken for a feed of one
   * student's real coursework. The live thing is the demo in the hero.
   *
   * DO NOT add an exchange showing a capability the extension does not have.
   * The rest of this page spends its credibility on being accurate about what
   * the thing does, and a mocked-up answer here would spend it all at once.
   *
   * The stack is bottom-anchored and clipped, so appending a bubble pushes the
   * others up and the oldest out of view. Browsers do not animate that, so the
   * survivors get a FLIP: measure before, measure after, translate them back
   * to where they were, then release. Nothing but transform and opacity moves.
   */
  var SCRIPT = [
    {
      q: "what's due this week",
      a: 'You have 6 assignments coming up:',
      cards: [
        { title: 'Unit 3 Problem Set', course: 'Precalculus', due: 'due Friday' },
        { title: 'Lab writeup — density', course: 'Chemistry', due: 'due in 2 days' }
      ]
    },
    {
      q: 'anything overdue',
      a: "Nothing is overdue. You're fully caught up."
    },
    {
      q: 'what are we doing in chem tomorrow',
      a: "Tomorrow's lesson plan for Chemistry says:",
      cards: [
        { title: '"Unit 2 review — stoichiometry practice, problems 1–14. Bring a calculator."',
          course: 'Chemistry', due: 'lesson plan, tomorrow' }
      ]
    },
    {
      q: 'whats due next class for stats',
      a: 'Statistics has one thing due next class:',
      cards: [
        { title: 'Chapter 4 reading + notes', course: 'Statistics', due: 'due in 2 days' }
      ]
    },
    {
      q: 'homework for calc',
      a: 'Calculus has 2 things coming up:',
      cards: [
        { title: 'Section 3.4 problem set', course: 'Calculus', due: 'due tomorrow' },
        { title: 'Unit 3 test', course: 'Calculus', due: 'due next week' }
      ]
    }
  ];

  var chatStack = document.getElementById('chat-stack');
  var chatFigure = document.getElementById('chat-demo');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildQuestion(step) {
    var b = el('div', 'bubble bubble-q');
    b.appendChild(el('p', null, step.q));
    return b;
  }

  function buildAnswer(step) {
    var b = el('div', 'bubble bubble-a');
    b.appendChild(el('p', null, step.a));
    (step.cards || []).forEach(function (card) {
      var wrap = el('span', 'chat-card');
      wrap.appendChild(el('span', 'chat-card-title', card.title));
      var meta = el('span', 'chat-card-meta');
      meta.appendChild(el('span', 'chat-card-course', card.course));
      meta.appendChild(el('span', 'chat-card-due', card.due));
      wrap.appendChild(meta);
      b.appendChild(wrap);
    });
    return b;
  }

  /**
   * Append a bubble and move everything else out of its way.
   *
   * FLIP: the browser has already done the layout by the time we read the new
   * positions, so we put each survivor back where it was with a transform and
   * then let a transition carry it to zero. The element being pushed out of
   * view fades on the way.
   */
  function pushBubble(node) {
    var existing = Array.prototype.slice.call(chatStack.children);
    var before = existing.map(function (b) { return b.getBoundingClientRect().top; });

    node.classList.add('is-entering');
    chatStack.appendChild(node);

    // Anything now beyond the keep-count is on its way out of the clip.
    var kept = Array.prototype.slice.call(chatStack.children);
    kept.slice(0, Math.max(0, kept.length - CHAT.MAX_BUBBLES)).forEach(function (b) {
      b.classList.add('is-leaving');
    });

    existing.forEach(function (b, i) {
      var delta = before[i] - b.getBoundingClientRect().top;
      if (!delta) return;
      b.style.transform = 'translateY(' + delta + 'px)';
    });

    // One forced reflow so the browser sees the start state before we release.
    void chatStack.offsetHeight;

    existing.forEach(function (b) {
      if (!b.style.transform) return;
      b.classList.add('is-shifting');
      b.style.transform = '';
    });
    node.classList.add('is-settled');
    node.classList.remove('is-entering');

    window.setTimeout(function () {
      existing.forEach(function (b) {
        b.classList.remove('is-shifting');
        b.style.transform = '';
      });
      // Drop anything that has finished leaving. It is already outside the
      // clip, and the stack is bottom-anchored, so nothing visible moves.
      Array.prototype.slice.call(chatStack.children).forEach(function (b) {
        if (b.classList.contains('is-leaving')) chatStack.removeChild(b);
      });
    }, CHAT.SHIFT_MS + 40);
  }

  var chatTimer = null;
  var chatStep = 0;
  var chatPhase = 'question';
  var chatRunning = false;

  function chatTick() {
    if (!chatRunning) return;
    var step = SCRIPT[chatStep];

    if (chatPhase === 'question') {
      pushBubble(buildQuestion(step));
      chatPhase = 'answer';
      chatTimer = window.setTimeout(chatTick, CHAT.ANSWER_DELAY);
      return;
    }

    pushBubble(buildAnswer(step));
    chatPhase = 'question';
    chatStep++;
    var last = chatStep >= SCRIPT.length;
    if (last) chatStep = 0;
    chatTimer = window.setTimeout(chatTick, last ? CHAT.RESTART_DELAY : CHAT.NEXT_DELAY);
  }

  function chatStart() {
    if (chatRunning || !chatStack) return;
    chatRunning = true;
    if (!chatStack.dataset.started) {
      // Clear the static seed the markup ships with — it is what people see
      // with JS off and under reduced motion, and it is in the way now.
      chatStack.dataset.started = '1';
      while (chatStack.firstChild) chatStack.removeChild(chatStack.firstChild);
    }
    chatTick();
  }

  function chatStop() {
    chatRunning = false;
    if (chatTimer !== null) { window.clearTimeout(chatTimer); chatTimer = null; }
  }

  /* --------------------------------------------------------------- reveal */

  /**
   * Scroll reveal, with two fallbacks.
   *
   * The reveal is decoration, but it works by hiding content first, so a
   * failure here means a blank page. IntersectionObserver does the work; a
   * throttled sweep of what is on screen — on scroll, on resize, and on a slow
   * interval — covers anything it misses. Both stop once nothing is left.
   */
  var targets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var pending = targets.length;

  function reveal(el) {
    if (el.classList.contains('is-visible')) return;
    el.classList.add('is-visible');
    pending--;
  }

  function revealAll() {
    for (var i = 0; i < targets.length; i++) reveal(targets[i]);
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!targets.length) {
    /* nothing to do */
  } else if (reduced) {
    revealAll();
  } else {
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      targets.forEach(function (t) { io.observe(t); });
    }

    // Fallback: sweep whatever is on screen, on movement and on a slow timer.
    // The timer covers the case where scroll events and IntersectionObserver
    // both go quiet; it can never reveal something that is off screen, so it
    // costs the animation nothing.
    var ticking = false;
    var ticks = 0;
    var timer = null;

    var stop = function () {
      window.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
      if (timer !== null) { window.clearInterval(timer); timer = null; }
    };

    var sweep = function () {
      ticking = false;
      var limit = window.innerHeight * 0.94;
      for (var i = 0; i < targets.length; i++) {
        var box = targets[i].getBoundingClientRect();
        if (box.top < limit && box.bottom > 0) reveal(targets[i]);
      }
      if (pending <= 0) stop();
    };

    var onMove = function () {
      if (ticking) return;
      ticking = true;
      window.setTimeout(sweep, 100);
    };

    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    timer = window.setInterval(function () {
      sweep();
      // Give up after five minutes rather than leaving a timer running for
      // the life of the tab. Anything still hidden is far off screen.
      if (++ticks > 150) stop();
    }, 2000);
    sweep();
  }

  /* -------------------------------------------------------------- diagram */

  /**
   * The data-flow animation.
   *
   * Three sequences, in order, forever:
   *
   *   1. Inside the tab. A card captioned "your coursework" slides out of
   *      learn.vcs.net into CoursePilot; CoursePilot lights up; a card
   *      captioned "what's due" slides out of CoursePilot into You.
   *
   *   2. The boundary holds. A card captioned "your coursework" runs for the
   *      edge, decelerates hard into it, compresses, and bursts into particles
   *      that scatter and fade. The cross mark flares, a pulse runs both ways
   *      along the boundary from the point of impact, and a label reads
   *      "nothing to send to".
   *
   *   3. The gate. A card captioned "your question" runs to the gate and stops
   *      dead, because the gate is closed. It waits, then gives up. If a
   *      visitor has opened the gate, it carries on through to Gemini instead
   *      and a caption says "you turned this on".
   *
   * On accuracy, which matters more here than anything else on the page:
   *   - nothing captioned coursework ever crosses either edge;
   *   - the only thing that ever crosses the gate is the typed question,
   *     which is exactly what that feature sends;
   *   - the gate is closed on every load, because the feature is off by
   *     default, and only a deliberate click opens it.
   * Sequence 2 is a statement about how far data can go, not a depiction of a
   * request being intercepted — there is no such request to depict, which is
   * what the "nothing to send to" label and the "no CoursePilot server" box
   * are there to say.
   *
   * Every card rides a real <path> with offset-path/offset-distance, so its
   * speed is constant along the route no matter how the route bends. Only
   * transform, opacity and offset-distance are animated.
   */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var dgPlay = null, dgPause = null;   // filled in below if the diagram animates

  var dgFigure = document.querySelector('.diagram-figure');
  var dgWide = document.querySelector('.diagram-wide');
  var dgFlow = dgWide && dgWide.querySelector('.dg-flow');
  var dgPacer = dgWide && dgWide.querySelector('.dg-pacer');

  /* ---- the gate, which is interactive whether or not anything is moving --- */

  var gateOpen = false;
  var gates = Array.prototype.slice.call(document.querySelectorAll('.dg-gate'));
  var diagrams = Array.prototype.slice.call(document.querySelectorAll('.diagram'));

  function setGate(open) {
    gateOpen = open;
    diagrams.forEach(function (d) { d.classList.toggle('is-gate-open', open); });
    gates.forEach(function (g) {
      g.setAttribute('aria-pressed', open ? 'true' : 'false');
      g.setAttribute('aria-label',
        'Optional Gemini connection. ' + (open ? 'On.' : 'Off.') +
        ' Activate to see what happens when a student ' +
        (open ? 'has added' : 'adds') + ' their own API key.');
      var state = g.querySelector('.dg-gate-state');
      if (state) state.textContent = open ? 'open — by you' : 'closed';
    });
  }

  gates.forEach(function (g) {
    g.addEventListener('click', function () { setGate(!gateOpen); });
    g.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      setGate(!gateOpen);
    });
  });
  setGate(false);   // closed on every load, because the feature is off by default

  /* ---- the animated part -------------------------------------------------- */

  if (dgWide && dgFlow && dgPacer && !noMotion && typeof dgPacer.animate === 'function') {

    var routes = {};
    ['read', 'show', 'block', 'gate'].forEach(function (name) {
      var p = dgWide.querySelector('#dg-route-' + name);
      routes[name] = { d: p.getAttribute('d'), len: p.getTotalLength(), node: p };
    });

    var live = [];        // every animation currently in flight
    var generation = 0;   // bumped on stop, so stale steps abandon quietly
    var playing = false;

    function track(anim) {
      live.push(anim);
      anim.finished.then(clean, clean);
      return anim;
    }
    function clean() {
      live = live.filter(function (a) { return a.playState === 'running' || a.playState === 'paused'; });
    }

    /** A pause that can be paused, so stopping mid-gap works like everything else. */
    function hold(ms) {
      return track(dgPacer.animate([{ opacity: 1 }, { opacity: 1 }], ms)).finished;
    }

    /**
     * A trapezoidal speed profile as keyframes: accelerate over the first
     * `a` of the time, hold a constant speed, decelerate over the last `b`.
     * The distances are worked out so the three phases meet at the same speed
     * — which is the bit that was wrong before, and why it looked like it was
     * crawling and then snapping.
     */
    function travelFrames(a, b, outCurve) {
      var v = 1 / (1 - a / 2 - b / 2);
      var d1 = v * a / 2;
      var d2 = 1 - v * b / 2;
      return [
        { offsetDistance: '0%', offset: 0, easing: 'cubic-bezier(.333,0,.667,.333)' },
        { offsetDistance: (d1 * 100).toFixed(3) + '%', offset: a, easing: 'linear' },
        { offsetDistance: (d2 * 100).toFixed(3) + '%', offset: 1 - b, easing: outCurve },
        { offsetDistance: '100%', offset: 1 }
      ];
    }

    function el(tag, cls) {
      var n = document.createElementNS(SVGNS, tag);
      if (cls) n.setAttribute('class', cls);
      return n;
    }
    function attr(n, o) { for (var k in o) n.setAttribute(k, o[k]); return n; }

    /** The card itself: 48x32, a gradient plate, a lit top edge, three bars. */
    function cardBody(optional) {
      var g = el('g', 'dg-card-body');
      g.appendChild(attr(el('rect', 'dg-card-plate'), { x: -24, y: -16, width: 48, height: 32, rx: 6 }));
      g.appendChild(attr(el('path', 'dg-card-lit'), { d: 'M-18 -15 H 18' }));
      [[-16, -9, 32], [-16, -2.25, 26], [-16, 4.5, 19]].forEach(function (b, i) {
        g.appendChild(attr(el('rect', i === 2 ? 'dg-card-bar dg-card-bar-dim' : 'dg-card-bar'),
          { x: b[0], y: b[1], width: b[2], height: 3.5, rx: 1.75 }));
      });
      if (optional) g.setAttribute('class', 'dg-card-body');
      return g;
    }

    function makeCard(caption, optional) {
      var g = el('g', 'dg-card' + (optional ? ' dg-card-opt' : ''));
      g.appendChild(attr(el('ellipse', 'dg-card-glow'), { cx: 0, cy: 0, rx: 48, ry: 36 }));
      g.appendChild(cardBody(optional));
      var t = attr(el('text', 'dg-card-caption'), { x: 0, y: 36, 'text-anchor': 'middle' });
      t.textContent = caption;
      g.appendChild(t);
      return g;
    }

    function makeGhost(optional) {
      var g = el('g', 'dg-ghost dg-card' + (optional ? ' dg-card-opt' : ''));
      g.appendChild(cardBody(optional));
      return g;
    }

    function onRoute(node, route) {
      node.style.offsetPath = 'path("' + route.d + '")';
      node.style.offsetRotate = '0deg';
      node.style.offsetDistance = '0%';
    }

    /**
     * One journey: the card, its trail, the glow pulse and the tilt settling.
     * `stopAt` (0..1) lets a journey end short of the route's end, which is how
     * the card stops at a closed gate.
     */
    function journey(opts) {
      var route = routes[opts.route];
      var frac = opts.stopAt == null ? 1 : opts.stopAt;
      var ms = DIAGRAM.TRAVEL_MS * (route.len * frac) / DIAGRAM.REF_LEN;
      var frames = travelFrames(
        opts.easeIn || DIAGRAM.EASE_IN,
        opts.easeOut || DIAGRAM.EASE_OUT,
        opts.outCurve || 'cubic-bezier(.333,.667,.667,1)');
      // Rescale the distances if this journey stops short of the end.
      if (frac !== 1) {
        frames = frames.map(function (f) {
          return {
            offsetDistance: (parseFloat(f.offsetDistance) * frac).toFixed(3) + '%',
            offset: f.offset, easing: f.easing
          };
        });
      }

      var parts = [];
      for (var i = DIAGRAM.TRAIL_COUNT; i >= 1; i--) {
        var ghost = makeGhost(opts.optional);
        onRoute(ghost, route);
        dgFlow.appendChild(ghost);
        parts.push({ node: ghost, lag: i * DIAGRAM.TRAIL_LAG_MS,
                     opacity: DIAGRAM.TRAIL_OPACITY * (1 - (i - 1) / DIAGRAM.TRAIL_COUNT) });
      }
      var card = makeCard(opts.caption, opts.optional);
      onRoute(card, route);
      dgFlow.appendChild(card);
      parts.push({ node: card, lag: 0, opacity: 1 });

      parts.forEach(function (p) {
        track(p.node.animate(frames, { duration: ms, delay: p.lag, fill: 'forwards' }));
        track(p.node.animate(
          [{ opacity: 0 }, { opacity: p.opacity, offset: 0.10 },
           { opacity: p.opacity, offset: 0.88 }, { opacity: p.opacity }],
          { duration: ms, delay: p.lag, fill: 'forwards' }));
      });

      // The tilt eases out as it arrives, so the card settles rather than
      // stopping dead — except on the blocked route, where stopping dead is
      // the entire point and the squash takes over instead.
      var body = card.querySelector('.dg-card-body');
      track(body.animate(
        [{ transform: 'rotate(' + DIAGRAM.TILT_DEG + 'deg)' }, { transform: 'rotate(0deg)' }],
        { duration: ms, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }));

      var glow = card.querySelector('.dg-card-glow');
      track(glow.animate([{ opacity: .55 }, { opacity: 1 }, { opacity: .55 }],
        { duration: DIAGRAM.GLOW_PULSE_MS, iterations: Infinity }));

      return {
        card: card, body: body, ms: ms + (DIAGRAM.TRAIL_COUNT * DIAGRAM.TRAIL_LAG_MS),
        done: track(card.animate([{ opacity: 1 }, { opacity: 1 }],
          { duration: ms + DIAGRAM.TRAIL_COUNT * DIAGRAM.TRAIL_LAG_MS })).finished,
        clear: function () {
          parts.forEach(function (p) { if (p.node.parentNode) p.node.parentNode.removeChild(p.node); });
        }
      };
    }

    function fadeOut(j) {
      return track(j.card.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 320, fill: 'forwards' })).finished.then(function () { j.clear(); }, function () {});
    }

    function pulseNode(name) {
      var node = dgWide.querySelector('.dg-node[data-node="' + name + '"] .dg-node-plate');
      if (!node) return;
      track(node.animate(
        [{ opacity: 1 }, { opacity: .55, offset: .35 }, { opacity: 1 }],
        { duration: 620, easing: 'ease-out' }));
    }

    /* ---- sequence 2's staging ---- */

    // Deterministic scatter: a fixed spread so the burst looks the same every
    // cycle and nothing depends on Math.random at render time.
    var PARTICLE_VECTORS = (function () {
      var out = [];
      for (var i = 0; i < DIAGRAM.PARTICLES; i++) {
        var a = (i / DIAGRAM.PARTICLES) * Math.PI * 2 + (i % 2 ? 0.4 : 0);
        var r = 26 + (i % 4) * 9;
        out.push({ x: Math.cos(a) * r * 0.55 - 10, y: Math.sin(a) * r, r: 2.2 + (i % 3) * 0.8 });
      }
      return out;
    })();

    function shatter(x, y) {
      PARTICLE_VECTORS.forEach(function (v, i) {
        var p = attr(el('circle', 'dg-particle'), { cx: x, cy: y, r: v.r });
        dgFlow.appendChild(p);
        track(p.animate(
          [{ transform: 'translate(0px,0px) scale(1)', opacity: .95 },
           { transform: 'translate(' + v.x + 'px,' + v.y + 'px) scale(.2)', opacity: 0 }],
          { duration: DIAGRAM.SHATTER_MS, delay: i * 12,
            easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'forwards' }
        )).finished.then(function () {
          if (p.parentNode) p.parentNode.removeChild(p);
        }, function () { if (p.parentNode) p.parentNode.removeChild(p); });
      });
    }

    function flareCross() {
      var flare = dgWide.querySelector('.dg-block-flare');
      var mark = dgWide.querySelector('.dg-block-mark');
      if (flare) {
        track(flare.animate(
          [{ opacity: 0, transform: 'scale(.5)' },
           { opacity: .9, transform: 'scale(1)', offset: .35 },
           { opacity: 0, transform: 'scale(1.5)' }],
          { duration: DIAGRAM.FLARE_MS * 3, easing: 'ease-out' }));
      }
      if (mark) {
        track(mark.animate(
          [{ opacity: 1, transform: 'scale(1)' },
           { opacity: 1, transform: 'scale(1.3)', offset: .3 },
           { opacity: 1, transform: 'scale(1)' }],
          { duration: DIAGRAM.FLARE_MS, easing: 'ease-out' }));
      }
    }

    /**
     * The pulse that runs along the boundary from the point of impact. Both
     * ripples ride the boundary path itself with offset-distance, so they
     * follow the wall round its corners instead of flying off it.
     */
    function rippleBoundary() {
      var boundary = dgWide.querySelector('#dg-boundary-line');
      if (!boundary) return;
      var total = boundary.getTotalLength();
      // Where on that path the cross mark sits, as a fraction.
      var hit = 0;
      for (var s = 0; s <= total; s += 6) {
        var pt = boundary.getPointAtLength(s);
        if (Math.abs(pt.x - 732) < 8 && pt.y > 200 && pt.y < 380) { hit = s / total; break; }
      }
      [['.dg-ripple-cw', 1], ['.dg-ripple-ccw', -1]].forEach(function (pair) {
        var node = dgWide.querySelector(pair[0]);
        if (!node) return;
        var from = hit * 100;
        var to = from + pair[1] * 38;
        track(node.animate(
          [{ offsetDistance: from + '%', opacity: 0 },
           { offsetDistance: (from + pair[1] * 6) + '%', opacity: .9, offset: .12 },
           { offsetDistance: to + '%', opacity: 0 }],
          { duration: DIAGRAM.RIPPLE_MS, easing: 'cubic-bezier(.1,.7,.3,1)' }));
      });
    }

    function showImpactLabel() {
      var label = dgWide.querySelector('.dg-impact-label');
      if (!label) return;
      track(label.animate(
        [{ opacity: 0, transform: 'translateY(4px)' },
         { opacity: 1, transform: 'translateY(0)', offset: .16 },
         { opacity: 1, transform: 'translateY(0)', offset: .78 },
         { opacity: 0, transform: 'translateY(-3px)' }],
        { duration: DIAGRAM.LABEL_MS, easing: 'ease-out' }));
    }

    var gateCaption = null;
    function showGateCaption() {
      if (!gateCaption) {
        gateCaption = el('g', 'dg-gate-caption');
        gateCaption.appendChild(attr(el('rect', 'dg-plate'), { x: 640, y: 296, width: 184, height: 24, rx: 6 }));
        var t = attr(el('text', 'dg-edge-label dg-edge-label-opt'),
          { x: 732, y: 313, 'text-anchor': 'middle' });
        t.textContent = 'you turned this on';
        gateCaption.appendChild(t);
        dgFlow.appendChild(gateCaption);
      }
      gateCaption.style.opacity = '0';
      track(gateCaption.animate(
        [{ opacity: 0 }, { opacity: 1, offset: .18 }, { opacity: 1, offset: .8 }, { opacity: 0 }],
        { duration: DIAGRAM.LABEL_MS, easing: 'ease-out' }));
    }

    /* ---- the loop ---- */

    function guard(gen) {
      return function (v) {
        if (gen !== generation) throw new Error('stale');
        return v;
      };
    }

    function runCycle() {
      var gen = generation;
      var g = guard(gen);
      var j;

      // 1. learn.vcs.net -> CoursePilot
      j = journey({ route: 'read', caption: 'your coursework' });
      j.done.then(g).then(function () {
        pulseNode('pilot');
        j.clear();
        return hold(DIAGRAM.PAUSE_MS);
      }).then(g).then(function () {
        // 2. CoursePilot -> You
        j = journey({ route: 'show', caption: "what's due" });
        return j.done;
      }).then(g).then(function () {
        pulseNode('you');
        j.clear();
        return hold(DIAGRAM.PAUSE_MS);
      }).then(g).then(function () {
        // 3. the boundary holds
        j = journey({
          route: 'block', caption: 'your coursework',
          easeIn: DIAGRAM.BLOCK_EASE_IN, easeOut: DIAGRAM.BLOCK_EASE_OUT,
          outCurve: 'cubic-bezier(.05,.8,.2,1)'
        });
        return j.done;
      }).then(g).then(function () {
        var card = j.card, body = j.body;
        // compress on contact...
        track(body.animate(
          [{ transform: 'scale(1,1)' }, { transform: 'scale(.55,1.14)' }],
          { duration: DIAGRAM.SQUASH_MS, easing: 'cubic-bezier(.3,0,.1,1)', fill: 'forwards' }));
        return hold(DIAGRAM.SQUASH_MS);
      }).then(g).then(function () {
        // ...then break apart, while the wall answers
        j.card.style.opacity = '0';
        shatter(706, 286);
        flareCross();
        rippleBoundary();
        showImpactLabel();
        j.clear();
        return hold(DIAGRAM.LABEL_MS);
      }).then(g).then(function () {
        return hold(DIAGRAM.PAUSE_MS);
      }).then(g).then(function () {
        // 4. the gate
        var gateFrac = 0.845;   // where the gate sits along the route
        j = journey({
          route: 'gate', caption: 'your question', optional: true,
          stopAt: gateOpen ? 1 : gateFrac,
          easeOut: gateOpen ? DIAGRAM.EASE_OUT : 0.30,
          outCurve: gateOpen ? 'cubic-bezier(.333,.667,.667,1)' : 'cubic-bezier(.08,.8,.25,1)'
        });
        return j.done;
      }).then(g).then(function () {
        if (gateOpen) showGateCaption();
        return hold(gateOpen ? DIAGRAM.PAUSE_MS : DIAGRAM.GATE_WAIT_MS);
      }).then(g).then(function () {
        return fadeOut(j);
      }).then(g).then(function () {
        return hold(DIAGRAM.PAUSE_MS);
      }).then(g).then(function () {
        runCycle();
      }).catch(function () { /* stopped, or the tab went away */ });
    }

    var started = false;
    var dgStart = function () {
      if (playing) return;
      playing = true;
      // Resume whatever was mid-flight (the boundary shimmer always is), and
      // only kick off the sequence the first time.
      live.forEach(function (a) { a.play(); });
      if (!started) { started = true; runCycle(); }
    };
    var dgStop = function () {
      if (!playing) return;
      playing = false;
      live.forEach(function (a) { if (a.playState === 'running') a.pause(); });
    };

    /* ---- hover: lift the node, keep its edges, step everything else back --- */

    var EDGES = {
      page: ['page-pilot'], pilot: ['page-pilot', 'pilot-you', 'pilot-noserver', 'pilot-gemini'],
      you: ['pilot-you'], store: [], noserver: ['pilot-noserver'], gemini: ['pilot-gemini']
    };
    var NEIGHBOURS = {
      page: ['pilot'], pilot: ['page', 'you', 'noserver', 'gemini'], you: ['pilot'],
      store: [], noserver: ['pilot'], gemini: ['pilot']
    };

    function focusNode(name) {
      dgWide.classList.toggle('is-focusing', !!name);
      dgWide.querySelectorAll('.is-hot').forEach(function (n) { n.classList.remove('is-hot'); });
      if (!name) return;
      var hot = [name].concat(NEIGHBOURS[name] || []);
      hot.forEach(function (n) {
        var node = dgWide.querySelector('.dg-node[data-node="' + n + '"]');
        if (node) node.classList.add('is-hot');
      });
      (EDGES[name] || []).forEach(function (e) {
        dgWide.querySelectorAll('[data-edge="' + e + '"]').forEach(function (p) { p.classList.add('is-hot'); });
      });
    }

    if (fine) {
      dgWide.querySelectorAll('.dg-node[data-node]').forEach(function (node) {
        node.addEventListener('pointerenter', function () { focusNode(node.getAttribute('data-node')); });
        node.addEventListener('pointerleave', function () { focusNode(null); });
      });
    }

    /* ---- parallax ---------------------------------------------------------
       Capped at PARALLAX_MAX px at the extremes, with each layer scaling that
       by its own depth in CSS. Off on coarse pointers. */
    if (fine) {
      var pQueued = false, pX = 0, pY = 0;
      var applyParallax = function () {
        pQueued = false;
        var box = dgWide.getBoundingClientRect();
        if (!box.width || !box.height) return;
        var nx = ((pX - box.left) / box.width - 0.5) * 2;
        var ny = ((pY - box.top) / box.height - 0.5) * 2;
        nx = nx < -1 ? -1 : nx > 1 ? 1 : nx;
        ny = ny < -1 ? -1 : ny > 1 ? 1 : ny;
        dgWide.style.setProperty('--dg-px', (-nx * DIAGRAM.PARALLAX_MAX).toFixed(2) + 'px');
        dgWide.style.setProperty('--dg-py', (-ny * DIAGRAM.PARALLAX_MAX).toFixed(2) + 'px');
      };
      dgWide.addEventListener('pointermove', function (e) {
        pX = e.clientX; pY = e.clientY;
        if (pQueued) return;
        pQueued = true;
        if (window.requestAnimationFrame) window.requestAnimationFrame(applyParallax);
        else window.setTimeout(applyParallax, 40);
      }, { passive: true });
      dgWide.addEventListener('pointerleave', function () {
        dgWide.style.removeProperty('--dg-px');
        dgWide.style.removeProperty('--dg-py');
      });
    }

    /* ---- the boundary shimmer, which never stops while the figure is seen -- */
    var shimmer = dgWide.querySelector('.dg-shimmer');
    if (shimmer) {
      track(shimmer.animate(
        [{ offsetDistance: '0%', opacity: 0 },
         { offsetDistance: '12%', opacity: .7, offset: .12 },
         { offsetDistance: '88%', opacity: .7, offset: .88 },
         { offsetDistance: '100%', opacity: 0 }],
        { duration: DIAGRAM.SHIMMER_MS, iterations: Infinity, easing: 'linear' }));
      // Parked until the figure is on screen, same as everything else.
      live.forEach(function (a) { a.pause(); });
    }

    dgPlay = dgStart;
    dgPause = dgStop;
  }

  /* ------------------------------------------------- play only when seen */

  /**
   * Nothing loops off screen.
   *
   * The chat and the diagram both run indefinitely, so both are gated on
   * being in the viewport — an IntersectionObserver starts and stops them, and
   * the page being hidden altogether stops them too. Under reduced motion
   * neither ever starts: the chat keeps the static exchange the markup ships
   * with, and the diagram keeps its still drawing.
   */
  var loops = [];

  if (chatFigure && chatStack) {
    loops.push({ el: chatFigure, on: chatStart, off: chatStop });
  }

  if (dgFigure && dgPlay) {
    loops.push({ el: dgFigure, on: dgPlay, off: dgPause });
  }

  if (loops.length && !reduced) {
    var visible = [];

    var setPlaying = function (entry, on) {
      if (on === (visible.indexOf(entry) !== -1)) return;
      if (on) { visible.push(entry); entry.on(); }
      else { visible.splice(visible.indexOf(entry), 1); entry.off(); }
    };

    var onScreen = function (el) {
      var b = el.getBoundingClientRect();
      return b.bottom > -120 && b.top < window.innerHeight + 120;
    };

    // A throttled sweep runs alongside the observer rather than only as a
    // fallback. IntersectionObserver drives the common case and reacts
    // instantly; this catches the case where it delivers its first callback
    // and then goes quiet, which would otherwise leave both loops dead for the
    // life of the page. Two getBoundingClientRect calls at 5Hz is nothing.
    var sweepQueued = false;
    var sweepLoops = function () {
      sweepQueued = false;
      loops.forEach(function (l) { setPlaying(l, onScreen(l.el)); });
    };
    var queueSweep = function () {
      if (sweepQueued) return;
      sweepQueued = true;
      window.setTimeout(sweepLoops, 200);
    };

    if ('IntersectionObserver' in window) {
      var loopIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          for (var i = 0; i < loops.length; i++) {
            if (loops[i].el === e.target) setPlaying(loops[i], e.isIntersecting);
          }
        });
      }, { rootMargin: '120px 0px' });
      loops.forEach(function (l) { loopIO.observe(l.el); });
    }

    window.addEventListener('scroll', queueSweep, { passive: true });
    window.addEventListener('resize', queueSweep);
    queueSweep();

    // A hidden tab is off screen too, and timers there are throttled rather
    // than stopped, so say so explicitly.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        loops.forEach(function (l) { setPlaying(l, false); });
      }
    });
  }

})();
