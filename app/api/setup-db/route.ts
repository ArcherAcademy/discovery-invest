import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// One-shot DB setup endpoint. Only runs if tables don't exist yet.
// Call once via: POST /api/setup-db
export async function POST() {
  const supabase = createAdminClient()

  const sql = `
-- ─── demo_invest_users ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text,
  name            text,
  role            text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  locale          text NOT NULL DEFAULT 'nl' CHECK (locale IN ('nl', 'en')),
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  last_activity_at timestamptz
);

ALTER TABLE demo_invest_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_users' AND policyname='demo_invest_users: users read own row') THEN
    CREATE POLICY "demo_invest_users: users read own row" ON demo_invest_users FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_users' AND policyname='demo_invest_users: users update own row') THEN
    CREATE POLICY "demo_invest_users: users update own row" ON demo_invest_users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_users' AND policyname='demo_invest_users: users insert own row') THEN
    CREATE POLICY "demo_invest_users: users insert own row" ON demo_invest_users FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_users' AND policyname='demo_invest_users: admins read all') THEN
    CREATE POLICY "demo_invest_users: admins read all" ON demo_invest_users FOR SELECT USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── demo_invest_videos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_videos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no         integer NOT NULL,
  section          text NOT NULL CHECK (section IN ('core', 'bonus')),
  title            text NOT NULL,
  description      text,
  duration_seconds integer NOT NULL DEFAULT 0,
  video_url        text,
  thumbnail_url    text
);

ALTER TABLE demo_invest_videos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_videos' AND policyname='demo_invest_videos: all authenticated can read') THEN
    CREATE POLICY "demo_invest_videos: all authenticated can read" ON demo_invest_videos FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ─── demo_invest_video_progress ────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_video_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  video_id     uuid NOT NULL REFERENCES demo_invest_videos(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_pct integer NOT NULL DEFAULT 0,
  started_at   timestamptz,
  completed_at timestamptz,
  UNIQUE(user_id, video_id)
);

ALTER TABLE demo_invest_video_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_video_progress' AND policyname='demo_invest_video_progress: users manage own') THEN
    CREATE POLICY "demo_invest_video_progress: users manage own" ON demo_invest_video_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_video_progress' AND policyname='demo_invest_video_progress: admins read all') THEN
    CREATE POLICY "demo_invest_video_progress: admins read all" ON demo_invest_video_progress FOR SELECT USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── demo_invest_user_funnel ───────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_user_funnel (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  videos_completed_count integer NOT NULL DEFAULT 0,
  all_completed_at      timestamptz,
  event_booked          boolean NOT NULL DEFAULT false,
  event_booked_at       timestamptz
);

ALTER TABLE demo_invest_user_funnel ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_user_funnel' AND policyname='demo_invest_user_funnel: users manage own') THEN
    CREATE POLICY "demo_invest_user_funnel: users manage own" ON demo_invest_user_funnel FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_user_funnel' AND policyname='demo_invest_user_funnel: admins read all') THEN
    CREATE POLICY "demo_invest_user_funnel: admins read all" ON demo_invest_user_funnel FOR SELECT USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── demo_invest_events ────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  starts_at  timestamptz NOT NULL,
  location   text NOT NULL,
  capacity   integer NOT NULL DEFAULT 50,
  spots_left integer NOT NULL DEFAULT 50
);

ALTER TABLE demo_invest_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_events' AND policyname='demo_invest_events: all authenticated can read') THEN
    CREATE POLICY "demo_invest_events: all authenticated can read" ON demo_invest_events FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_events' AND policyname='demo_invest_events: admins can update') THEN
    CREATE POLICY "demo_invest_events: admins can update" ON demo_invest_events FOR UPDATE USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── demo_invest_event_bookings ────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_event_bookings (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  event_id  uuid NOT NULL REFERENCES demo_invest_events(id) ON DELETE CASCADE,
  booked_at timestamptz NOT NULL DEFAULT now(),
  status    text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled'))
);

ALTER TABLE demo_invest_event_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_event_bookings' AND policyname='demo_invest_event_bookings: users manage own') THEN
    CREATE POLICY "demo_invest_event_bookings: users manage own" ON demo_invest_event_bookings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_event_bookings' AND policyname='demo_invest_event_bookings: admins read all') THEN
    CREATE POLICY "demo_invest_event_bookings: admins read all" ON demo_invest_event_bookings FOR SELECT USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── demo_invest_webhook_log ───────────────────────────────
CREATE TABLE IF NOT EXISTS demo_invest_webhook_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  payload_json    jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  response_status text
);

ALTER TABLE demo_invest_webhook_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_webhook_log' AND policyname='demo_invest_webhook_log: users read own') THEN
    CREATE POLICY "demo_invest_webhook_log: users read own" ON demo_invest_webhook_log FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_webhook_log' AND policyname='demo_invest_webhook_log: users insert own') THEN
    CREATE POLICY "demo_invest_webhook_log: users insert own" ON demo_invest_webhook_log FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_webhook_log' AND policyname='demo_invest_webhook_log: users update own') THEN
    CREATE POLICY "demo_invest_webhook_log: users update own" ON demo_invest_webhook_log FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demo_invest_webhook_log' AND policyname='demo_invest_webhook_log: admins read all') THEN
    CREATE POLICY "demo_invest_webhook_log: admins read all" ON demo_invest_webhook_log FOR SELECT USING (
      EXISTS (SELECT 1 FROM demo_invest_users du WHERE du.id = auth.uid() AND du.role = 'admin')
    );
  END IF;
END $$;

-- ─── SEED: videos ──────────────────────────────────────────
INSERT INTO demo_invest_videos (order_no, section, title, description, duration_seconds, video_url)
VALUES
  (1, 'core', 'De Why',        'Waarom zelf vermogen opbouwen noodzaak wordt: schuld, vergrijzing en inflatie als stille bedreigingen voor je financiële toekomst.', 720,  'https://player.vimeo.com/video/1216350623'),
  (2, 'core', 'De Levensloop', 'Hoe je vermogen piekt rond je 60ste en daarna daalt zonder de juiste shift in strategie en asset-allocatie.', 840,                         'https://player.vimeo.com/video/1216350621'),
  (3, 'core', 'GGR',           'Je gewogen gemiddeld rendement berekenen en waarom het in de praktijk vaak bedroevend tegenvalt.', 780,                                    'https://player.vimeo.com/video/1216350622'),
  (4, 'core', 'ETF',           'Hoe TER, dividendstructuur en domicilie je nettorendement bepalen. De kern-, satelliet- en speculatief-aanpak uitgelegd.', 900,            'https://player.vimeo.com/video/1216350624'),
  (5, 'core', 'De Invest-app', 'Al je assets in één dashboard: GGR berekenen en een 20-jaar levensprojectie in real time.', 300,                                          NULL),
  (6, 'core', 'De Oplossing',  'Hoe de 4-daagse masterclass en de Invest-app samen één samenhangend systeem vormen voor structureel vermogensopbouw.', 750,                'https://player.vimeo.com/video/1216351086'),
  (7, 'bonus', 'Fragment dag 1 van de 4-daagse', 'Een exclusief fragment uit de eerste dag van de live masterclass: de fundamenten van je vermogensstrategie.', 1080,     NULL),
  (8, 'bonus', 'Uitgebreide ETF-gids',            'Verdiepende analyse van ETF-selectie, rebalancing, belastingoptimalisatie en domiciliekeuze.', 1320,                   NULL),
  (9, 'bonus', 'Bonus (verrassing)',               'Een verrassende extra les die we vrijspelen voor iedereen die alle 6 kernvideo''s afgerond heeft.', 600,              NULL)
ON CONFLICT DO NOTHING;

-- ─── SEED: events ──────────────────────────────────────────
INSERT INTO demo_invest_events (title, starts_at, location, capacity, spots_left)
VALUES
  ('Live Invest-avond Antwerpen', '2026-09-18 19:00:00+02', 'Antwerpen Centraal, The Hub',  80,  23),
  ('Live Invest-avond Gent',      '2026-10-09 19:00:00+02', 'Gent, The Student Hotel',      60,  14),
  ('Live Invest-avond Brussel',   '2026-10-30 19:00:00+01', 'Brussel, Tour & Taxis',       100,  41)
ON CONFLICT DO NOTHING;
`

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: { message: 'RPC not available — use Supabase SQL editor' } }))

  if (error) {
    // RPC exec_sql is not a standard Supabase function.
    // Return the SQL so it can be copied into the Supabase SQL editor.
    return NextResponse.json({
      ok: false,
      message: 'Run the SQL manually in your Supabase SQL editor (Dashboard → SQL Editor). The SQL is in supabase/seed.sql in this project.',
      error: error.message,
    })
  }

  return NextResponse.json({ ok: true, message: 'Database schema created and seeded.' })
}
