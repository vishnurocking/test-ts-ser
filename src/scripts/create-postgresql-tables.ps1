# ts-server\src\scripts\create-postgresql-tables.ps1
# PowerShell script to create PostgreSQL tables in hybrid_db database

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432", 
    [string]$DbUsername = "postgres",
    [string]$DbDatabase = "hybrid_db",
    [string]$DbPassword = "admin"
)

Write-Host "🔄 Creating PostgreSQL tables in hybrid_db database..." -ForegroundColor Cyan
Write-Host "   Host: $DbHost" -ForegroundColor Gray
Write-Host "   Port: $DbPort" -ForegroundColor Gray  
Write-Host "   Database: $DbDatabase" -ForegroundColor Gray
Write-Host "   Username: $DbUsername" -ForegroundColor Gray
Write-Host ""

# Get the script directory and schema file path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$SchemaFile = Join-Path $ProjectRoot "src\schema\postgresql-schema.sql"

# Check if schema file exists
if (-not (Test-Path $SchemaFile)) {
    Write-Host "❌ Schema file not found: $SchemaFile" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the correct directory." -ForegroundColor Red
    exit 1
}

Write-Host "📄 Found schema file: $SchemaFile" -ForegroundColor Green

# Set PGPASSWORD environment variable to avoid password prompt
$env:PGPASSWORD = $DbPassword

try {
    # Test database connection first
    Write-Host "🔌 Testing database connection..." -ForegroundColor Yellow
    $TestQuery = "SELECT version();"
    $TestResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $TestQuery 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to connect to database:" -ForegroundColor Red
        Write-Host $TestResult -ForegroundColor Red
        Write-Host "" 
        Write-Host "💡 Troubleshooting tips:" -ForegroundColor Yellow
        Write-Host "   1. Make sure PostgreSQL is running" -ForegroundColor Gray
        Write-Host "   2. Verify database 'hybrid_db' exists" -ForegroundColor Gray
        Write-Host "   3. Check username/password are correct" -ForegroundColor Gray
        Write-Host "   4. Ensure psql is in your PATH" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host "✅ Database connection successful!" -ForegroundColor Green
    Write-Host "   PostgreSQL Version: $($TestResult.Trim())" -ForegroundColor Gray
    Write-Host ""
    
    # Execute the schema file
    Write-Host "🚀 Executing schema file..." -ForegroundColor Cyan
    $Result = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -f $SchemaFile 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error executing schema:" -ForegroundColor Red
        Write-Host $Result -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Schema executed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Verify tables were created
    Write-Host "🔍 Verifying created tables..." -ForegroundColor Cyan
    $TablesQuery = @"
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type IN ('BASE TABLE', 'VIEW')
ORDER BY table_type, table_name;
"@
    
    $Tables = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $TablesQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "📋 Database objects created:" -ForegroundColor Green
        $Tables | ForEach-Object {
            if ($_.Trim()) {
                $Parts = $_.Trim() -split '\s*\|\s*'
                if ($Parts.Count -ge 2) {
                    $TableName = $Parts[0].Trim()
                    $TableType = $Parts[1].Trim()
                    if ($TableType -eq "BASE TABLE") {
                        Write-Host "   📄 Table: $TableName" -ForegroundColor White
                    } elseif ($TableType -eq "VIEW") {
                        Write-Host "   👀 View: $TableName" -ForegroundColor Cyan
                    }
                }
            }
        }
    }
    
    # Test functions were created
    Write-Host ""
    Write-Host "🔧 Verifying functions..." -ForegroundColor Cyan
    $FunctionsQuery = @"
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;
"@
    
    $Functions = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $FunctionsQuery 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "⚙️ Functions created:" -ForegroundColor Green
        $Functions | ForEach-Object {
            if ($_.Trim()) {
                $Parts = $_.Trim() -split '\s*\|\s*'
                if ($Parts.Count -ge 1) {
                    $FunctionName = $Parts[0].Trim()
                    Write-Host "   ⚙️ Function: $FunctionName" -ForegroundColor Yellow
                }
            }
        }
    }
    
    Write-Host ""
    Write-Host "🎉 PostgreSQL tables created successfully in hybrid_db!" -ForegroundColor Green
    Write-Host "   Database is ready for your application." -ForegroundColor Gray
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Update your .env file to use DATABASE_URL with hybrid_db" -ForegroundColor Gray
    Write-Host "   2. Create DynamoDB tables (Courses, Learning, LearningProgress)" -ForegroundColor Gray
    Write-Host "   3. Add sample data if needed" -ForegroundColor Gray

} catch {
    Write-Host "❌ Unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    # Clear the password environment variable
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✨ Script completed!" -ForegroundColor Magenta