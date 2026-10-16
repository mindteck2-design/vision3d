<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/228fa1a9-3794-4e5d-916c-fbcc6d9c780a

## Run Locally

**Prerequisites:** Node.js, Python 3 (for CAD service)

1. Install Node deps: `npm install`
2. Set up CAD service once:
   ```bash
   cd python/cad_service && python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cd ../..
   ```
3. Start UI + CAD service (auto-creates `.venv` / installs deps if missing):
   ```bash
   ./vision3d.sh start
   ```
4. Stop both:
   ```bash
   ./vision3d.sh stop
   ```

Uses **bun** for the UI and Python `.venv` + `uvicorn` for CAD.

- UI: http://127.0.0.1:3000  
- CAD health: http://127.0.0.1:8000/health  
- Logs: `.run/ui.log`, `.run/cad.log`
