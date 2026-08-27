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

- There is no analytics, no tracking, and no network call of any kind on this
  page. Keep it that way — the site's whole argument is that the extension
  doesn't phone home, and a tracker on the marketing page would undercut it.
- The "Sign in — coming soon" button is a deliberately disabled placeholder.
  There is no authentication anywhere in this project.
- The install section links to the extension repo. That link is a `TODO` in
  `index.html` until the repo is public.
