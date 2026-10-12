# Gym Log

A simple, no-account workout logger for your phone. Set up a routine, tap a day, log your sets.

- **Routines**: training days with exercises, sets, target reps/seconds and warm-ups.
- **Logging**: weights pre-fill from last time, last session shown underneath, one tap to tick off a set.
- **Rest timer** starts automatically after each set (vibrates and beeps when done).
- **Any exercise**: add your own, logged as weight × reps, reps only, or time.
- **Exercise photos**: built-in moves come with a photo; tap any exercise → *Edit* to take or pick your own.
- **Share with your trainer**: History → Share sends a readable summary of the last 1–8 weeks.
- **No account**: data stays on your phone. Settings → *Save backup file* if you want a copy.

## Run it

It's a static site with no build step. Serve the folder with any static host, e.g.:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. To use it on your phone, host it on GitHub Pages
(repo Settings → Pages → deploy from your branch, root folder), open the URL in your phone's
browser and choose **Add to Home screen**. It works offline after the first load.

## Credits

Built-in exercise photos are from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense).

## Files

- `index.html`, `styles.css`: the page and look
- `js/store.js`: data model and saving (localStorage)
- `js/app.js`: screens and interactions
- `images/exercises/`: built-in exercise photos
- `sw.js`, `manifest.webmanifest`, `icons/`: install-to-home-screen + offline support
