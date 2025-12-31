-- Add roster management tables

-- Staff table for roster management
CREATE TABLE IF NOT EXISTS "staff" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL, -- 'manager', 'barista', 'junior'
    "base_hourly_rate" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rosters table for weekly schedules
CREATE TABLE IF NOT EXISTS "rosters" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "week_start_date" DATE NOT NULL, -- Monday of the roster week
    "status" TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
    "created_by" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("week_start_date")
);

-- Roster shifts for individual staff assignments
CREATE TABLE IF NOT EXISTS "roster_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "roster_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE,
    FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE
);

-- Public holidays table for penalty rate calculations
CREATE TABLE IF NOT EXISTS "public_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NSW',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("date", "state")
);

-- Insert initial staff data
INSERT INTO "staff" ("name", "role", "base_hourly_rate", "is_active") VALUES
('Jackie', 'manager', 35.00, true),
('Alexandra', 'manager', 32.00, true),
('Heath', 'manager', 38.00, true),
('Jasper', 'manager', 30.00, true),
('Tosh', 'barista', 28.00, true),
('Katie', 'barista', 26.00, true),
('Hanna', 'barista', 25.00, true)
ON CONFLICT DO NOTHING;

-- Insert some common NSW public holidays for 2025
INSERT INTO "public_holidays" ("name", "date", "state") VALUES
('New Year''s Day', '2025-01-01', 'NSW'),
('Australia Day', '2025-01-27', 'NSW'),
('Good Friday', '2025-04-18', 'NSW'),
('Easter Saturday', '2025-04-19', 'NSW'),
('Easter Monday', '2025-04-21', 'NSW'),
('Anzac Day', '2025-04-25', 'NSW'),
('King''s Birthday', '2025-06-09', 'NSW'),
('Labour Day', '2025-10-06', 'NSW'),
('Christmas Day', '2025-12-25', 'NSW'),
('Boxing Day', '2025-12-26', 'NSW')
ON CONFLICT DO NOTHING;