# Web Interface Guide

## 🎉 Your Research Report Generator Web Interface is Ready!

The server is now running with a beautiful web interface at:
**http://localhost:3000**

## How to Access

1. **Open your web browser**
2. **Navigate to**: http://localhost:3000 or http://127.0.0.1:3000
3. You'll see the Research Report Generator interface!

## Features of the Web Interface

### 1. Generate Reports
- Enter any research query
- Select report profile (Technical, Executive, or Academic)
- Choose output formats (Markdown, HTML, PDF)
- Set maximum number of sources to analyze
- Click "Generate Report" and watch the progress in real-time!

### 2. View Recent Reports
- See all your generated reports
- Check status (Processing, Completed, Failed)
- Download reports in different formats
- Reports are saved permanently in the `reports/` directory

### 3. API Documentation
- The interface shows all available API endpoints
- You can still use the API programmatically if needed

## Quick Start

1. **Try a sample query**:
   - "Best practices for React development in 2024"
   - "Comparison of cloud providers: AWS vs Azure vs GCP"
   - "Machine learning trends and frameworks"

2. **Watch the progress**:
   - The progress bar shows real-time updates
   - You'll see each stage: parsing, searching, fetching, processing, generating

3. **Download your report**:
   - Once complete, click MD or HTML to download
   - Reports are also saved in `reports/` directory

## Troubleshooting

### If the page doesn't load:
1. Make sure the server is running (`npm run serve`)
2. Check the console for any errors
3. Try http://127.0.0.1:3000 instead of localhost

### If reports fail to generate:
1. Check your API keys in the `.env` file
2. Ensure you have internet connection
3. Check the server console for error messages

## Server Management

### Start the server:
```powershell
npm run serve
```

### Stop the server:
Press `Ctrl+C` in the terminal where it's running

### Run in background (Windows):
```powershell
Start-Process powershell -WindowStyle Hidden -ArgumentList "cd '$PWD'; npm run serve"
```

## API Endpoints (for advanced users)

- `GET /` - Web interface
- `GET /api/health` - Server health check
- `POST /api/reports` - Create new report
- `GET /api/reports` - List all reports
- `GET /api/reports/{id}` - Get report status
- `GET /api/reports/{id}/download?format=md|html|pdf` - Download report

## Enjoy your Research Report Generator!

You now have a fully functional web interface for generating comprehensive research reports from any topic!
