# GitHub Pages Deployment Checklist

Follow these steps to deploy your app to GitHub Pages:

## Pre-Deployment ✓

- [x] Repository contains `.github/workflows/deploy.yml` (GitHub Actions workflow)
- [x] `vite.config.ts` configured with `base: '/WhatNflGameShouldIWatch/'`
- [x] `package.json` has build script: `"build": "vite build"`
- [x] All dependencies are in `package.json`

## Deployment Steps

### 1. Ensure Git Repository is Setup
```bash
# Check if repository is on GitHub
git remote -v

# If not, add it:
# git remote add origin https://github.com/YOUR_USERNAME/WhatNflGameShouldIWatch.git
# git push -u origin main
```

### 2. Configure GitHub Pages Settings
- [ ] Go to GitHub repository → Settings
- [ ] Click "Pages" in the left sidebar
- [ ] Under "Build and deployment":
  - [ ] Source: "Deploy from a branch"
  - [ ] Branch: "gh-pages" / "(root)"
  - [ ] Save

### 3. Deploy
```bash
# Make sure your code is committed
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

### 4. Verify Deployment
- [ ] Go to repository → Actions tab
- [ ] Check if "Deploy to GitHub Pages" workflow is running
- [ ] Wait for ✅ green checkmark (usually 2-3 minutes)
- [ ] Go to Settings → Pages to see your live URL

### 5. Access Your Live Site
Your app will be available at:
```
https://YOUR_USERNAME.github.io/WhatNflGameShouldIWatch/
```

## Troubleshooting

### Workflow won't start
- Ensure `.github/workflows/deploy.yml` exists
- Make sure it's in the `main` branch

### Build fails
- Check GitHub Actions logs (Actions tab)
- Run locally: `npm install && npm run build`

### Site shows 404
- Wait 5-10 minutes (first deployment takes longer)
- Check that Pages settings point to `gh-pages` branch
- Verify `base` path in `vite.config.ts`

### Assets don't load (blank/unstyled site)
- Ensure `base: '/WhatNflGameShouldIWatch/'` in `vite.config.ts`
- Clear browser cache
- Check browser console for errors (F12)

## How to Update Site

Just push changes to `main` branch:
```bash
# Make your changes
git add .
git commit -m "Your message"
git push origin main

# GitHub Actions automatically deploys within 2-3 minutes
```

## Useful Links

- Your site: `https://github.com/YOUR_USERNAME/WhatNflGameShouldIWatch`
- Workflow file: `.github/workflows/deploy.yml`
- Build config: `vite.config.ts`
- Deployment guide: `DEPLOYMENT.md`

## Support

For more info:
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vite Deployment Docs](https://vitejs.dev/guide/static-deploy.html#github-pages)
