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
motion *is* the argument — a packet crosses to the extension, reaches the
student, and then visibly stops at the boundary. Both exits stop: one at the
wall, one at a gate that is shut until the student opens it.

Constraints that any new effect has to keep:

- **`prefers-reduced-motion: reduce` disables all of it**, including the 3D
  transform and the diagram animation. The block at the bottom of `styles.css`
  is the single place that happens; add to it in the same commit.
- **Transform and opacity only.** Nothing that animates layout, and no filters.
- **Contrast is measured against the animated backdrop at its brightest point**,
  not against the flat page colour. That is why `--accent-ink` is darker than
  `--accent` in light mode and why the light backdrop fields are so faint: at
  their old strength they pushed body copy under 4.5:1 where they overlapped.
  Re-measure the worst-case overlap before raising any of those alphas.
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
