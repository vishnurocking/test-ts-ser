-- ts-server/src/schema/postgresql-schema.sql
-- PostgreSQL schema for hybrid_db database
-- Enhanced schema with updated database name for TypeScript backend

-- Extensions for enhanced features
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced Users table
CREATE TABLE users (
    -- Core identity fields
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    google_id VARCHAR(255) UNIQUE,
    password VARCHAR(255), -- Hashed password for email/password login
    role VARCHAR(50) NOT NULL DEFAULT 'Learner' CHECK (role IN ('Learner', 'Instructor')),
    enrolled_courses TEXT[], -- Array of course IDs from DynamoDB
    
    -- Gamification fields
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    last_login_date TIMESTAMP,
    language_preference VARCHAR(10) DEFAULT 'HIN-ENG',
    
    -- Enhanced language learning fields
    mother_tongue VARCHAR(10) DEFAULT 'hi', -- ISO 639-1 language code
    primary_target_language VARCHAR(10) DEFAULT 'en', -- Learning goal language
    proficiency_level VARCHAR(20) DEFAULT 'beginner' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    daily_time_commitment INTEGER DEFAULT 30, -- Minutes per day
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata', -- User timezone
    is_active BOOLEAN DEFAULT true, -- Activity status
    onboarding_completed BOOLEAN DEFAULT false, -- Onboarding progress
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Purchases table
CREATE TABLE purchases (
    -- Core purchase fields
    purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id VARCHAR(255) NOT NULL, -- References DynamoDB Courses table
    course_title VARCHAR(500),
    course_thumbnail TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Payment gateway fields (Razorpay)
    payment_id VARCHAR(255), -- Razorpay payment ID
    order_id VARCHAR(255),   -- Razorpay order ID
    payment_signature VARCHAR(500), -- Razorpay signature for verification
    
    -- Enhanced tracking fields
    payment_method VARCHAR(20) DEFAULT 'razorpay' CHECK (payment_method IN ('razorpay', 'stripe', 'paypal', 'free')),
    processing_fee DECIMAL(10,2) DEFAULT 0.00, -- Fee tracking
    refund_amount DECIMAL(10,2) DEFAULT 0.00, -- Refund tracking
    content_type VARCHAR(30) DEFAULT 'video_course' CHECK (content_type IN ('video_course', 'language_lesson', 'mixed_content')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP, -- When payment was completed
    
    -- Business constraints
    UNIQUE(user_id, course_id) -- Prevent duplicate purchases
);

-- Performance indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_language_learning ON users(mother_tongue, primary_target_language, proficiency_level) WHERE is_active = true;
CREATE INDEX idx_users_gamification ON users(points, level, streak) WHERE is_active = true;

-- Performance indexes for purchases table
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_course_id ON purchases(course_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_created_at ON purchases(created_at);
CREATE INDEX idx_purchases_user_status ON purchases(user_id, status);
CREATE INDEX idx_purchases_status_created ON purchases(status, created_at);
CREATE INDEX idx_purchases_payment_id ON purchases(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_purchases_method_type ON purchases(payment_method, content_type);
CREATE INDEX idx_purchases_amount ON purchases(amount, currency) WHERE status = 'completed';

-- Trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at 
    BEFORE UPDATE ON purchases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW active_learners AS
SELECT 
    user_id, 
    email, 
    name, 
    points, 
    level, 
    streak,
    mother_tongue,
    primary_target_language,
    proficiency_level,
    created_at
FROM users 
WHERE role = 'Learner' AND is_active = true;

CREATE VIEW successful_purchases AS
SELECT 
    p.purchase_id,
    u.email,
    u.name,
    p.course_id,
    p.course_title,
    p.amount,
    p.currency,
    p.payment_method,
    p.content_type,
    p.completed_at
FROM purchases p
JOIN users u ON p.user_id = u.user_id
WHERE p.status = 'completed'
ORDER BY p.completed_at DESC;

-- Function to get user's learning statistics
CREATE OR REPLACE FUNCTION get_user_learning_stats(user_uuid UUID)
RETURNS TABLE(
    total_purchases INTEGER,
    total_spent DECIMAL(10,2),
    video_courses INTEGER,
    language_lessons INTEGER,
    current_streak INTEGER,
    total_points INTEGER,
    current_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(p.purchase_id)::INTEGER as total_purchases,
        COALESCE(SUM(p.amount), 0) as total_spent,
        COUNT(CASE WHEN p.content_type = 'video_course' THEN 1 END)::INTEGER as video_courses,
        COUNT(CASE WHEN p.content_type = 'language_lesson' THEN 1 END)::INTEGER as language_lessons,
        u.streak as current_streak,
        u.points as total_points,
        u.level as current_level
    FROM users u
    LEFT JOIN purchases p ON u.user_id = p.user_id AND p.status = 'completed'
    WHERE u.user_id = user_uuid
    GROUP BY u.user_id, u.streak, u.points, u.level;
END;
$$ LANGUAGE plpgsql;

-- Function to update user streak
CREATE OR REPLACE FUNCTION update_user_streak(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    current_streak INTEGER;
    last_login DATE;
    today DATE := CURRENT_DATE;
BEGIN
    SELECT streak, last_login_date::date INTO current_streak, last_login
    FROM users WHERE user_id = user_uuid;
    
    IF last_login IS NULL OR last_login < today - INTERVAL '1 day' THEN
        -- Reset streak if more than 1 day gap
        current_streak := 1;
    ELSIF last_login = today - INTERVAL '1 day' THEN
        -- Increment streak if logged in yesterday
        current_streak := current_streak + 1;
    END IF;
    
    UPDATE users 
    SET streak = current_streak, last_login_date = CURRENT_TIMESTAMP
    WHERE user_id = user_uuid;
    
    RETURN current_streak;
END;
$$ LANGUAGE plpgsql;