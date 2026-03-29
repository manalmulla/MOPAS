# Phishing Threat Database Setup

To store and display searched phishing links on your dashboard, you need to create a table in your Supabase project.

### SQL Setup
Copy and paste the following SQL into your **Supabase SQL Editor**:

```sql
-- Create the detections table
CREATE TABLE detections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL, -- 'URL', 'EMAIL', 'IMAGE', 'QR'
  target TEXT NOT NULL, -- The searched URL or content snippet
  risk_score INTEGER NOT NULL, -- 0-100
  threat_level TEXT NOT NULL, -- 'Low', 'Medium', 'High', 'Critical'
  is_malicious BOOLEAN NOT NULL,
  summary TEXT
);

-- Enable Realtime for this table (essential for the Live Feed to work)
ALTER PUBLICATION supabase_realtime ADD TABLE detections;

-- (Optional) Create a row-level security policy to allow public reads
-- if you want the dashboard to be visible to everyone
-- ALTER TABLE detections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON detections FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert" ON detections FOR INSERT WITH CHECK (true);
```

### Dashboard Logic
The dashboard will now:
1. Fetch the latest 10 searches on load.
2. Listen for new searches in real-time.
3. Show the "Risk Percentage" directly in the feed.
