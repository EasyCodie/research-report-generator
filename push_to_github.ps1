# PowerShell script to push research-report-generator to GitHub
# Run this after creating the repository on GitHub

Write-Host "GitHub Repository Push Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Get current directory
$currentDir = Get-Location
Write-Host "`nCurrent directory: $currentDir" -ForegroundColor Yellow

# Check if we're in the right directory
if (!(Test-Path "package.json") -or !(Test-Path "evaluator.py")) {
    Write-Host "Error: This doesn't appear to be the research-report-generator directory" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Instructions:" -ForegroundColor Green
Write-Host "1. First, create a new repository on GitHub:" -ForegroundColor White
Write-Host "   https://github.com/new" -ForegroundColor Cyan
Write-Host "   - Name: research-report-generator" -ForegroundColor White
Write-Host "   - Do NOT initialize with README, .gitignore, or license" -ForegroundColor Yellow
Write-Host ""

$username = Read-Host "Enter your GitHub username (likely 'EasyCodie')"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "EasyCodie"
}

$repoUrl = "https://github.com/$username/research-report-generator.git"
Write-Host "`nRepository URL will be: $repoUrl" -ForegroundColor Cyan

$continue = Read-Host "`nHave you created the repository on GitHub? (y/n)"
if ($continue -ne 'y') {
    Write-Host "Please create the repository first, then run this script again." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🔧 Setting up remote repository..." -ForegroundColor Green

# Check if remote already exists
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "Removing existing remote 'origin'..." -ForegroundColor Yellow
    git remote remove origin
}

# Add the remote
Write-Host "Adding remote repository..." -ForegroundColor Green
git remote add origin $repoUrl

# Rename branch to main
Write-Host "Renaming branch to 'main'..." -ForegroundColor Green
git branch -M main

# Show current status
Write-Host "`n📊 Current Git Status:" -ForegroundColor Green
git status --short

Write-Host "`n🚀 Pushing to GitHub..." -ForegroundColor Green
Write-Host "Note: You may be prompted for your GitHub credentials." -ForegroundColor Yellow
Write-Host "If you have 2FA enabled, use a Personal Access Token as the password." -ForegroundColor Yellow
Write-Host "Create one at: https://github.com/settings/tokens" -ForegroundColor Cyan

# Push to GitHub
try {
    git push -u origin main
    Write-Host "`n✅ Success! Your code has been pushed to GitHub!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/$username/research-report-generator" -ForegroundColor Cyan
    Write-Host "`nNext steps:" -ForegroundColor Green
    Write-Host "1. Visit your repository: https://github.com/$username/research-report-generator" -ForegroundColor White
    Write-Host "2. Add collaborators: Settings → Manage access → Add people" -ForegroundColor White
    Write-Host "3. Create issues for tracking work" -ForegroundColor White
    Write-Host "4. Set up GitHub Actions for CI/CD (optional)" -ForegroundColor White
}
catch {
    Write-Host "`n❌ Push failed. Common solutions:" -ForegroundColor Red
    Write-Host "1. Make sure you created the repository on GitHub" -ForegroundColor Yellow
    Write-Host "2. Check your internet connection" -ForegroundColor Yellow
    Write-Host "3. If using 2FA, create a Personal Access Token:" -ForegroundColor Yellow
    Write-Host "   https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host "4. Try running: git push -u origin main" -ForegroundColor Yellow
}
