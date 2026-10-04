-- ============================================================
-- Utsanova Blog Management System - Initial Seed Data (Optional)
-- Database: utsanova_blog
-- ============================================================

USE utsanova_blog;

-- ------------------------------------------------------------
-- Seed: admins
-- Note: Replace firebase_uid with the actual Firebase Auth UID for your admin
-- ------------------------------------------------------------
INSERT INTO admins (firebase_uid, email, name)
VALUES 
  ('admin_default_uid_utsanova', 'admin@utsanova.com', 'Utsanova Administrator'),
  ('24O3TYju6jfCA6IEqLhCPv8jZMP2', 'hansikamothukuri2007@gmail.com', 'Hansika Mothukuri')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ------------------------------------------------------------
-- Seed: blogs (Published and Draft sample entries)
-- ------------------------------------------------------------
INSERT INTO blogs (blog_id, title, content, tags, conclusion, status)
VALUES
(
  '0001',
  'The Future of Technology in Modern Education',
  'In recent years, higher education and engineering training have undergone a massive digital transformation. From interactive cloud laboratories to personalized learning pathways, modern educational systems are bridging the gap between academic theory and industry requirements. At Utsanova Technologies, our mission is to empower learners through immersive real-world project experiences and cutting-edge digital infrastructure.',
  'Technology, Education, Web Development',
  'Embracing emerging technologies is no longer optional for academic institutions. By blending real-world software practices with pedagogy, we prepare the next generation of engineers for long-term career success.',
  'Published'
),
(
  '0002',
  'How to Build Better Products with React and Vite',
  'Speed, developer ergonomics, and rock-solid architecture are the cornerstones of successful web software today. Moving to modern build systems like Vite drastically reduces cold start times and provides lightning-fast hot module replacement. When paired with modular component hierarchies, strict type definitions, and reliable state management, development teams can ship responsive products with confidence.',
  'React, Web Development, Technology',
  'Modern tooling empowers teams to spend less time configuring boilerplate and more time delivering tangible value to end users.',
  'Published'
),
(
  '0003',
  'Career Growth in 2026: Navigating the Tech Industry',
  'The tech ecosystem continues to reward individuals who master core fundamental software engineering principles alongside adaptive problem solving. Whether you are learning full-stack development, cloud deployment pipelines, or database optimizations, having strong hands-on project experience distinguishes you from the crowd. Building end-to-end full-stack systems is the highest-leverage skill an intern or junior engineer can develop.',
  'Career, Students, Education',
  'Consistency, deep curiosity, and building verified production-grade projects are the true catalysts for long-term career growth in technology.',
  'Published'
),
(
  '0004',
  'Designing Scalable Relational Database Schemas',
  'Relational databases remain the backbone of mission-critical business applications. Proper normalization, defensive indexing on query filters, and strict validation layers ensure high throughput and data integrity as user traffic scales. Understanding transactional boundaries and query performance profiling prevents expensive system bottlenecks.',
  'Technology, Web Development',
  'A well-architected relational model pays compounding dividends throughout the entire product lifecycle.',
  'Published'
),
(
  '0005',
  'Upcoming Platform Upgrades: Internal Architecture Notes',
  'This is an internal draft outlining the roadmap for Utsanova blog system enhancements, including scheduled publishing pipelines and granular role-based permissions.',
  'Technology, Career',
  'Review scheduled for next engineering sprint.',
  'Draft'
);
