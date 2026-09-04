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

  var diagram = document.querySelector('.diagram-figure');
  if (diagram) {
    loops.push({
      el: diagram,
      on: function () { diagram.classList.add('is-playing'); },
      off: function () { diagram.classList.remove('is-playing'); }
    });
  }

  if (loops.length && !reduced) {
    var visible = [];

    var setPlaying = function (entry, on) {
      if (on === (visible.indexOf(entry) !== -1)) return;
      if (on) { visible.push(entry); entry.on(); }
      else { visible.splice(visible.indexOf(entry), 1); entry.off(); }
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
    } else {
      // No observer: run them. A page that cannot tell what is on screen is
      // better off with the illustration working than with it dead.
      loops.forEach(function (l) { setPlaying(l, true); });
    }

    // A hidden tab is off screen too, and timers there are throttled rather
    // than stopped, so say so explicitly.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        loops.forEach(function (l) { setPlaying(l, false); });
      }
    });
  }

})();
