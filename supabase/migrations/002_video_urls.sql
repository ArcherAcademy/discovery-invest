-- ============================================================
-- Archer Invest Demo — Set Vimeo video URLs for core videos
-- Vimeo embed URL: https://player.vimeo.com/video/{id}
-- Video 5: no Vimeo ID yet — leave as NULL / existing placeholder.
-- ============================================================

UPDATE demo_invest_videos SET video_url = 'https://player.vimeo.com/video/1216350623' WHERE section = 'core' AND order_no = 1;
UPDATE demo_invest_videos SET video_url = 'https://player.vimeo.com/video/1216350621' WHERE section = 'core' AND order_no = 2;
UPDATE demo_invest_videos SET video_url = 'https://player.vimeo.com/video/1216350622' WHERE section = 'core' AND order_no = 3;
UPDATE demo_invest_videos SET video_url = 'https://player.vimeo.com/video/1216350624' WHERE section = 'core' AND order_no = 4;
UPDATE demo_invest_videos SET video_url = 'https://player.vimeo.com/video/1216351086' WHERE section = 'core' AND order_no = 6;
