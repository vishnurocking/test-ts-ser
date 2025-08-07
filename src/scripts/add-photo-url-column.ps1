# ts-server/src/scripts/add-photo-url-column.ps1
# PowerShell script to add photo_url column for Google profile pictures

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432", 
    [string]$DbUsername = "postgres",
    [string]$DbDatabase = "lms_db",
    [string]$DbPassword = "admin"
)

Write-Host "📸 Adding photo_url column for Google profile pictures..." -ForegroundColor Cyan
Write-Host "   Database: $DbDatabase" -ForegroundColor Gray
Write-Host "   Host: $DbHost:$DbPort" -ForegroundColor Gray
Write-Host ""

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $DbPassword

try {
    # Test database connection
    Write-Host "🔌 Testing database connection..." -ForegroundColor Yellow
    $TestQuery = "SELECT current_database(), version();"
    $TestResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $TestQuery 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Database connection failed:" -ForegroundColor Red
        Write-Host $TestResult -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Database connection successful!" -ForegroundColor Green
    Write-Host ""
    
    # Check if photo_url column already exists
    Write-Host "🔍 Checking if photo_url column already exists..." -ForegroundColor Yellow
    $CheckColumnQuery = @"
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'photo_url'
    AND table_schema = 'public'
);
"@
    
    $ColumnExists = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $CheckColumnQuery 2>&1
    
    if ($ColumnExists.Trim() -eq 't') {
        Write-Host "ℹ️ Column photo_url already exists in users table" -ForegroundColor Blue
        Write-Host "   Skipping column creation..." -ForegroundColor Gray
    } else {
        Write-Host "➕ Adding photo_url column to users table..." -ForegroundColor Cyan
        
        # Add photo_url column
        $AddColumnQuery = @"
-- Add photo_url column for storing profile picture URLs
ALTER TABLE users 
ADD COLUMN photo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.photo_url IS 'URL to user profile picture from Google OAuth or uploaded image';
"@
        
        $AddColumnResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -c $AddColumnQuery 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to add photo_url column:" -ForegroundColor Red
            Write-Host $AddColumnResult -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✅ Successfully added photo_url column!" -ForegroundColor Green
    }
    
    # Check if index already exists
    Write-Host "🔍 Checking for photo_url index..." -ForegroundColor Yellow
    $CheckIndexQuery = @"
SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname = 'idx_users_photo_url'
    AND schemaname = 'public'
);
"@
    
    $IndexExists = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -t -c $CheckIndexQuery 2>&1
    
    if ($IndexExists.Trim() -eq 't') {
        Write-Host "ℹ️ Index idx_users_photo_url already exists" -ForegroundColor Blue
    } else {
        Write-Host "📊 Creating index for photo_url column..." -ForegroundColor Cyan
        
        # Create index for performance
        $CreateIndexQuery = @"
-- Create index for performance on photo_url lookups
CREATE INDEX idx_users_photo_url ON users(photo_url) WHERE photo_url IS NOT NULL;
"@
        
        $CreateIndexResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -c $CreateIndexQuery 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️ Warning: Failed to create index (non-critical):" -ForegroundColor Yellow
            Write-Host $CreateIndexResult -ForegroundColor Yellow
        } else {
            Write-Host "✅ Successfully created photo_url index!" -ForegroundColor Green
        }
    }
    
    # Verify the changes
    Write-Host ""
    Write-Host "🔍 Verifying column addition..." -ForegroundColor Cyan
    $VerifyQuery = @"
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name = 'photo_url'
    AND table_schema = 'public';
"@
    
    $VerifyResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -c $VerifyQuery 2>&1
    
    Write-Host "📋 Column details:" -ForegroundColor Green
    Write-Host $VerifyResult -ForegroundColor White
    
    # Check current user count
    Write-Host "📊 Current users table statistics..." -ForegroundColor Cyan
    $StatsQuery = @"
SELECT 
    COUNT(*) as total_users,
    COUNT(photo_url) as users_with_photos,
    COUNT(google_id) as google_oauth_users
FROM users;
"@
    
    $StatsResult = psql -h $DbHost -p $DbPort -U $DbUsername -d $DbDatabase -c $StatsQuery 2>&1
    
    Write-Host "📈 Statistics:" -ForegroundColor Green
    Write-Host $StatsResult -ForegroundColor White
    
    Write-Host ""
    Write-Host "🎉 Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Update backend controller to store photo URLs" -ForegroundColor Gray
    Write-Host "   2. Update getUserProfile to return photo_url field" -ForegroundColor Gray
    Write-Host "   3. Test Google OAuth login to verify photo storage" -ForegroundColor Gray
    Write-Host "   4. Update frontend to display profile pictures" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🔄 To rollback this migration, run:" -ForegroundColor Blue
    Write-Host "   ALTER TABLE users DROP COLUMN IF EXISTS photo_url;" -ForegroundColor Gray
    Write-Host "   DROP INDEX IF EXISTS idx_users_photo_url;" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    # Clear the password environment variable
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✨ Photo URL column migration script completed!" -ForegroundColor Magenta