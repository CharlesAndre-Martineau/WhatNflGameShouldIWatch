# Manual GitHub Pages Setup - One Time Only

## Required: Configure GitHub Pages Source

Follow these steps **one time only** to enable GitHub Pages deployment:

### Step 1: Go to Repository Settings
1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/WhatNflGameShouldIWatch`
2. Click **Settings** (top right of repo page)

### Step 2: Navigate to Pages
1. In the left sidebar, click **Pages**

### Step 3: Configure Source
1. Under "Build and deployment" section:
   - **Source**: Select "GitHub Actions" from the dropdown
2. Click **Save**

### Step 4: Wait and Deploy

The page should show: "Your site is live at https://your-username.github.io/WhatNflGameShouldIWatch/"

### Step 5: Push Your Code

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

### Step 6: Monitor Deployment

1. Go to your repository
2. Click the **Actions** tab
3. Watch the "Deploy static content to Pages" workflow run
4. Once it completes with a ✅ green checkmark, your site is live!

## That's It!

After this one-time setup, every push to `main` will automatically deploy your app.

## Troubleshooting

**Can't find Pages in Settings?**
- Make sure you're in the repository settings (not personal account settings)
- Scroll down in Settings left sidebar to find Pages

**Still getting errors?**
- Verify Source is set to "GitHub Actions"
- Check that your repository is PUBLIC (Pages is easier with public repos)
- Wait 1-2 minutes and try again

## Your Live Site

Once deployed:
```
https://YOUR_USERNAME.github.io/WhatNflGameShouldIWatch/
```

Example:
```
https://CharlesAndre-Martineau.github.io/WhatNflGameShouldIWatch/
```
as