# coursepilot-site

The public page for **CoursePilot** — a Chrome extension that reads Moodle
lesson plans on `learn.vcs.net` and answers what's due, what's coming up, and
what's late.

Static site: plain HTML, CSS, and one small JS file. No framework, no build
step, no dependencies. Deploying is `git push`.

```
index.html    the whole page
styles.css    tokens + layout, light and dark
main.js       theme toggle + scroll reveal, nothing else
demo.html     COPIED FROM THE EXTENSION REPO — see below
```

## ⚠️ demo.html is a copy. Re-copy it when the widget changes.

`demo.html` is **not maintained here**. It is the extension repo's standalone
demo build — the real widget source concatenated into one file with a mock data
provider instead of Moodle — and it is embedded in an iframe in the hero.

That means:

- **This file goes stale silently.** The site will keep serving an old widget
  that looks fine and behaves like last month. Nobody will notice from the
  outside, which is exactly the problem.
- **Do not edit `demo.html` in this repo.** Any change here is destroyed by the
  next copy, and the version that matters lives in the extension repo.

After any change to the widget — UI, parsing, phrasing, colours — re-copy it:

```bash
cp ../coursepilot/demo/index.html ./demo.html
```

(Adjust the path to wherever the extension repo lives on your machine.) Then
open `index.html`, click into the demo frame, and confirm the widget still
loads before pushing.

The site's palette in `styles.css` is lifted from the extension's
`src/styles.js`. If you change a brand colour in the extension, change it in
both places or the page and the widget inside it will drift apart.

### Two places the site reaches into the widget's internals

Both are worked around here rather than in the extension, so both break quietly
if the widget changes. They are the first things to check if the demo frame
starts looking wrong.

1. **`main.js` checks where the launcher landed and reloads the frame if it is
   wrong.** The widget measures its viewport the moment it mounts and saves
   where the launcher goes; a frame that has not finished being laid out at that
   instant measures zero and pins the launcher to the middle-left, over the
   demo's own text. Timing the mount from outside proved unreliable, so the site
   checks the saved position instead and reloads the frame once if it is not in
   the bottom-right. This reads the widget's saved `x`/`y`.
2. **`index.html` clears the `vcs-assistant:widget` localStorage key on load.**
   That is the widget's own preferences key, and the site shares an origin with
   `demo.html`, so a bad saved position would otherwise stick for that visitor
   forever. Clearing it means the demo always opens in its default corner.

If the extension ever measures its viewport lazily — or renames that storage
key — revisit both.

## Where the motion is, and why it stops where it does

The hero, the four how-it-works steps, and the who-built-it section carry the
visual weight: an animated backdrop, a 3D tilt on the demo frame, cards that
lift on hover, display type. **Privacy and limits are deliberately flat.** A
pitch that gets quiet and factual the moment it starts talking about data reads
as confidence; animating the trust section would read as a sales page. If you
add flourish later, add it above the privacy section, not inside it.

The one exception is the data-flow diagram, which is animated because the
motion *is* the argument. See its own section below.

## The data-flow diagram

The still drawing carries the whole claim on its own — the boundary, the
crossed-out edge with its "no CoursePilot server" box, and the gate drawn
closed. Everything the script adds is on top of that, so with no JavaScript,
`prefers-reduced-motion` set, or the section off screen, the diagram still
says everything it needs to.

### Rules that are not negotiable

- **The gate is closed on every load.** The feature is off by default; the
  diagram has to open closed or it is lying. `setGate(false)` runs
  unconditionally at startup and nothing persists the state.
- **Nothing captioned coursework ever crosses either edge.** The card that
  runs at the wall is contained by it and fades back inside. The only thing
  that ever crosses the gate is captioned "your question", because the typed
  question is all that feature sends.
- Sequence 2 is a statement about how far data can go, not a depiction of a
  request being intercepted — there is no such request to depict. That is what
  the "nothing to send to" label and the "no CoursePilot server" box are there
  to say, and why removing either would change the meaning.

### Two things that are easy to get wrong again

1. **Never put a `<title>` element inside the SVG.** In SVG, `<title>` is a
   native browser tooltip, not a heading: one on the root turns the entire
   diagram into a hover target, and the tooltip then sits over the artwork
   whenever a reader's pointer happens to rest there. The accessible name is
   an `aria-label` on the `<svg>`; the long description is the
   visually-hidden paragraph the figure points at with `aria-describedby`.
2. **Cards move with `offset-path` / `offset-distance` on a real `<path>`,
   never by animating x and y.** `offset-distance` is a fraction of arc
   length, so speed stays even through the bends; animating coordinates makes
   the card crawl on long segments and snap through short ones. Each route's
   duration is also scaled by its own length against `DIAGRAM.REF_LEN`, so a
   short hop and a long run move at the same speed.

The travelling object is a stylised card with bars inside instead of text, and
its label rides underneath as a caption. That is deliberate: with no text in
the card there is no way for a label to overflow it, whatever the wording
becomes.

### The hover dim fades surfaces, not labels

Hovering a node dims the others — but it dims their **plates, outlines and
connector lines**, and leaves every text element at full strength. Fading a
whole node group to 50% takes its body copy from about 5:1 down to 2:1, and a
label losing contrast is not a trade worth making for a hover effect. With the
plates gone the structure reads just as clearly.

### Timing lives in two blocks, not scattered through the code

Every duration is a named constant:

- **`styles.css`** opens with a `:root` block of `--t-*` values. The diagram's
  keyframes are percentages of `--t-diagram-cycle`, so changing that one value
  retimes the whole sequence and keeps every part of it in step.
- **`main.js`** opens with a `CHAT` object holding the chat loop's numbers.
  `ANSWER_DELAY` is how long a question sits alone; `NEXT_DELAY` is how long a
  finished exchange sits before the next question pushes it up. Between them
  they decide whether a reader can finish a line before it moves. Raise
  `NEXT_DELAY` first — the pause after an answer is the one a reader uses.

`CHAT.SHIFT_MS` and `--t-chat-shift` describe the same transition and have to
stay equal; the JS uses it to know when the shift has finished.

### The chat script is an illustration, and has to stay one

`SCRIPT` in `main.js` is scripted, not live. Two rules:

1. **Never add an exchange showing something the extension cannot do.** The
   rest of this page spends its credibility on being accurate about the
   product; a mocked-up capability here would spend all of it at once.
2. **Relative dates only** ("due Friday", "due in 2 days"), and generic course
   names. A specific calendar date would read as somebody's live coursework.

The stack is bottom-anchored inside a fixed-height clipped box, so appending a
bubble pushes the rest up and the oldest out of view. Browsers do not animate
that, so `pushBubble` does a FLIP: measure, append, translate the survivors
back, release. Nothing but transform and opacity moves.

### Both loops stop when nobody is watching

The chat and the diagram are gated on an IntersectionObserver, and on the tab
being visible. If the observer never fires, neither starts — and that failure
mode is safe by design: the chat keeps the static exchange in the markup and
the diagram keeps its still drawing, which is why the seed exchange is real
markup rather than something JavaScript builds.

Constraints that any new effect has to keep:

- **`prefers-reduced-motion: reduce` disables all of it**, including the 3D
  transform and the diagram animation. The block at the bottom of `styles.css`
  is the single place that happens; add to it in the same commit.
- **Transform and opacity only.** Nothing that animates layout, and no filters.
- **Contrast is measured against the backdrop at its worst point**, not against
  the flat page colour: every radial field at full strength on the same pixel,
  plus the grain at its darkest. That is why `--accent-ink` is darker than
  `--accent` in light mode, and why the light `--field-*` alphas are so small.
  Re-measure that overlap before raising any of them.
- **On a light ground, brightness is free and tint is not.** `--field-lift` is
  white in light mode and can be strong, because white behind dark text can
  only raise contrast. `--field-1` and `--field-2` are tints and are capped.
  If you want more depth in light mode, reach for the lift first.
- The grain is an inline SVG `feTurbulence`, desaturated and capped at ~5.5%
  alpha by a `feFuncA` slope. It is a data URI, so it costs no request. Raising
  that slope changes the effective background under every paragraph on the
  page — measure again if you touch it.
- **Four requests, all local.** No fonts, no CDNs, no images.

## Running it locally

Open `index.html` in a browser. That's it — but use a local server if the
iframe misbehaves under `file://`:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploying

GitHub Pages, serving from the repository root of the default branch. `index.html`
is at the root, so pushing publishes.

## Notes for whoever picks this up

- There is no analytics, no tracking, and no network call of any kind on **this
  page** — it loads four local files and nothing else. Keep it that way. The
  site argues that the extension is honest about where data goes, and a tracker
  on the marketing page would undercut that on the spot.
- **The privacy copy has to stay true to the extension.** It states that
  coursework is read and parsed locally, that there is no CoursePilot server or
  account, and that one optional feature — off by default, requiring the
  student's own Google API key — sends the typed question to
  `generativelanguage.googleapis.com`. If that feature changes, is removed, or
  gains a second endpoint, update `index.html` in the same commit: the hero
  lede, the fourth card in the IT strip, the "What it sends" and "The one
  exception, in full" rows, the diagram (both the wide and the tall SVG), and
  the footer. School IT will read the manifest; the page must not be a surprise.
- The "Sign in — coming soon" button is a deliberately disabled placeholder.
  There is no authentication anywhere in this project.
- The install section deliberately does **not** link to the extension repo,
  because that repo is private while this site is public. It tells people to ask
  for the folder instead. Add a link only once the repo is actually public.
