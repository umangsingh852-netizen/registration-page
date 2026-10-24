CREATE TABLE IF NOT EXISTS hour_of_code_registrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  student_number VARCHAR(50) NOT NULL UNIQUE,
  university_roll_no VARCHAR(13) NOT NULL UNIQUE,
  branch VARCHAR(50) NOT NULL,
  gender VARCHAR(30) NOT NULL,
  residence VARCHAR(20) NOT NULL,
  current_year SMALLINT NOT NULL CHECK (current_year IN (2, 3, 4)),
  section VARCHAR(30) NOT NULL DEFAULT '',
  college_email VARCHAR(254) NOT NULL UNIQUE,
  whatsapp VARCHAR(20) NOT NULL,
  attendance_confirmed BOOLEAN NOT NULL CHECK (attendance_confirmed = TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);