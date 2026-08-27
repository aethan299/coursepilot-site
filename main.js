/**
 * main.js — the only script on the site.
 *
 * The theme toggle, the demo frame's self-heal, the scroll reveal, and the
 * pointer tilt on the browser mock. No dependencies, no network calls, nothing
 * stored except the visitor's own theme choice.
 */
(function () {
  'use strict';

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
})();
