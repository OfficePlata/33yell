-- 医院（テナント）ごとにデータを分ける。すべての表に tenant（医院のslug）を持たせる
CREATE TABLE IF NOT EXISTS tenants (slug TEXT PRIMARY KEY, name TEXT NOT NULL, open_days TEXT NOT NULL DEFAULT '1,2,3,5,6', am TEXT DEFAULT '09:00-12:30', pm TEXT DEFAULT '14:30-18:00', slot_min INTEGER NOT NULL DEFAULT 30, capacity INTEGER NOT NULL DEFAULT 2, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, menu TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, visit TEXT NOT NULL, note TEXT DEFAULT '', status TEXT NOT NULL DEFAULT '予約', created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_res_tenant_date ON reservations(tenant, date, time);
CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, theme TEXT NOT NULL, media TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_posts_tenant ON posts(tenant, created_at);
INSERT OR IGNORE INTO tenants (slug, name, open_days) VALUES ('sakura','さくら歯科クリニック（デモ）','1,2,3,5,6'),('aoba','あおば歯科医院（デモ）','1,2,4,5,6'),('midori','みどり歯科（デモ）','1,2,3,4,5');
