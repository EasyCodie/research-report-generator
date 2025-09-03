# GitHub Repository Setup Instructions

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Fill in the following details:
   - **Repository name**: `research-report-generator`
   - **Description**: `Autonomous research report generator with multi-source retrieval, AI-powered evaluation, and multiple output formats`
   - **Visibility**: Choose Public or Private as you prefer
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you a page with setup instructions. 
Since we already have a local repository with commits, use these commands:

```powershell
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/research-report-generator.git

# Rename branch to main (GitHub's default)
git branch -M main

# Push the code to GitHub
git push -u origin main
```

## Alternative: Using Personal Access Token (if prompted for authentication)

If you're prompted for authentication and have 2FA enabled:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "research-report-push"
4. Select scopes: `repo` (all repo permissions)
5. Generate token and copy it
6. When prompted for password during push, use the token instead

## Step 3: Verify Upload

After pushing, refresh your GitHub repository page. You should see:
- All project files
- The README.md displayed on the main page
- Commit history preserved

## Step 4: Configure Repository Settings (Optional)

On your GitHub repository page:

1. **Add Topics** (gear icon → Topics):
   - `research`
   - `report-generator`
   - `typescript`
   - `nodejs`
   - `openai`
   - `web-scraping`
   - `ai-powered`

2. **Set up GitHub Pages** (Settings → Pages):
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /public
   - This will host your generated reports if needed

3. **Add Repository Details**:
   - Website: Your deployment URL if you have one
   - Check "Releases" if you plan to create releases

## Quick Commands Summary

```powershell
# If you haven't added the remote yet:
git remote add origin https://github.com/YOUR_USERNAME/research-report-generator.git
git branch -M main
git push -u origin main

# For future pushes (after initial setup):
git push
```

## Troubleshooting

### Error: remote origin already exists
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/research-report-generator.git
```

### Error: failed to push some refs
```powershell
# This might happen if you created the repo with a README
git pull origin main --rebase
git push origin main
```

### Authentication Issues
- Use a Personal Access Token instead of password
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

## Next Steps

After successfully pushing to GitHub:

1. **Share the repository** with collaborators:
   - Go to Settings → Manage access → Add people

2. **Set up Issues** for tracking:
   - Create issue templates for bugs and features

3. **Configure Actions** (optional):
   - Add CI/CD workflows for testing and deployment

4. **Create a Release**:
   - Go to Releases → Create a new release
   - Tag version: v1.0.0
   - Release title: Initial Release

Your repository URL will be:
```
https://github.com/YOUR_USERNAME/research-report-generator
```

Clone URL for collaborators:
```
git clone https://github.com/YOUR_USERNAME/research-report-generator.git
```
