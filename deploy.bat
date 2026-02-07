@echo off
echo ==========================================
echo   Hainan Travel Planner - Git Deploy 🚀
echo ==========================================

REM Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/
    pause
    exit /b
)

echo [1/5] Initializing repository...
if not exist .git (
    git init
) else (
    echo Repository already initialized.
)

echo [2/5] Adding files...
git add .

echo [3/5] Committing changes...
git commit -m "Deploy: Hainan Travel Planner v3.0 (Food Map + Healing Theme)"

echo [4/5] Setting up remote...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/cxg294/plan.git

echo [5/5] Pushing to GitHub...
echo [4.5/5] Pulling remote changes (if any)...
git pull origin main --allow-unrelated-histories

echo [5/5] Pushing to GitHub (Force Push)...
echo.
echo NOTE: Using -f (force) to ensure your local design overwrites 
echo any default README/LICENSE files on GitHub.
echo.
git push -u origin main -f

echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Deployed successfully! 
    echo Visit: https://github.com/cxg294/plan
) else (
    echo [ERROR] Push failed. 
    echo Please check if you have write access to the repository.
)
pause
