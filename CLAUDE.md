- Development:
  - Running: npm run dev
  - Changes auto-reload in browser
  - No manual builds needed during development

  Deployment:
  - Using GitHub Pages for hosting
  - Deploy command: npm run deploy (builds, then publishes dist/ to the gh-pages branch on origin; public/CNAME is copied into dist/)
  - Only deploy when explicitly requested

  General Practice:
  - Make code changes directly
  - View changes immediately in dev environment
  - Don't run builds after changes unless deploying