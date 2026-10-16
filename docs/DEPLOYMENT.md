# Deployment

The repository is deployable as two services:

- **Vercel** hosts `frontend/` (Next.js and the procedural Three.js scene).
- **Render** hosts `backend/` (FastAPI).

## Render

Create the web service from `render.yaml`, or configure the service manually:

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/api/v1/health`
- `DEMO_MODE=true`
- `ENVIRONMENT=production`
- `FRONTEND_ORIGIN=https://<your-vercel-domain>`
- `GROQ_API_KEY=<your-groq-key>`
- `GROQ_MODEL=openai/gpt-oss-20b`

The backend has no required database for demo mode. `DATABASE_URL` and
`AI_PROVIDER_API_KEY` remain optional and are intentionally not committed.
`GROQ_API_KEY` is required only for the AI Copilot; keep it in Render's secret
environment settings and never expose it through `NEXT_PUBLIC_*` variables.

## Vercel

Import the repository and set the project root to `frontend`. The committed
`frontend/vercel.json` uses `npm ci` and `npm run build`. Set:

```text
NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
```

After the first Vercel deployment, copy its canonical URL into Render's
`FRONTEND_ORIGIN` and redeploy the backend. Verify both:

```text
https://<render-service>/api/v1/health
https://<vercel-domain>/twin
```

No cloud URL is claimed until the user connects the repository to the chosen
provider and performs the deployment.
