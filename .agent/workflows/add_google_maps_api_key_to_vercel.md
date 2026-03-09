---
description: Add Google Maps API Key to Vercel Environment Variables
---

### Steps to add your `GOOGLE_MAPS_API_KEY` to Vercel

1. **Install Vercel CLI (if not already installed)**
   ```bash
   npm install -g vercel
   ```

2. **Log in to Vercel**
   ```bash
   vercel login
   ```
   Follow the prompts to authenticate.

3. **Navigate to your project directory**
   ```bash
   cd /path/to/your/project   # replace with your actual project path
   ```

4. **Add the environment variable**
   ```bash
   vercel env add GOOGLE_MAPS_API_KEY
   ```
   - When prompted, paste your Google Maps API key.
   - Choose the environment(s) you want to set it for (development, preview, production).
   - Confirm the addition.

5. **Verify the variable was added**
   ```bash
   vercel env ls
   ```
   You should see `GOOGLE_MAPS_API_KEY` listed for the selected environments.

6. **Deploy (optional)**
   If you want to trigger a new deployment to apply the new env var:
   ```bash
   vercel --prod
   ```

### Notes
- The API key is stored securely on Vercel and will not be exposed in your code or repository.
- For local development, you can also add the key to a `.env.local` file:
  ```
  GOOGLE_MAPS_API_KEY=your_key_here
  ```
  Vercel will automatically load this when you run `vercel dev`.

---
