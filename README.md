# Andrew's Glucose Display

A minimal, public Netlify display for the latest Dexcom Share glucose reading and the current Eastern time.

## Deploy to Netlify

1. In Netlify, choose **Add new project → Import an existing project** and select `baughaw/cgm-remote-monitor`.
2. Set the production branch to `minimal-glucose-display`.
3. Netlify reads `netlify.toml`; no build command is required.
4. In **Project configuration → Environment variables**, add:
   - `DEXCOM_USERNAME`: the login used by the active Dexcom G7 app (not necessarily the Clarity login)
   - `DEXCOM_PASSWORD`: the Dexcom password
   - `DEXCOM_REGION`: `US`
5. Redeploy the site after adding the variables.

The credentials are used only by the server-side Netlify Function. Never commit them to GitHub or place them in a client-side variable.

## Local checks

Run `npm test`. To exercise the function locally, use Netlify Dev with the three environment variables configured in a local `.env` file. `.env` is ignored by Git.

This display is informational. Use the Dexcom app, receiver, or blood glucose meter for treatment decisions.
