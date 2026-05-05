insert into project_settings (
    id,
    project_name,
    project_start_date,
    project_end_date,
    exclude_non_working_days,
    version
) values (
    1,
    'チーム進行ガントチャート',
    date '2026-05-01',
    date '2026-05-20',
    false,
    1
);

insert into members (project_id, name, display_order) values
(1, 'Mina', 0),
(1, 'Ren', 1),
(1, 'Kai', 2),
(1, 'Aoi', 3),
(1, 'Sora', 4);

insert into tasks (
    id,
    project_id,
    name,
    owner,
    start_date,
    end_date,
    progress,
    status,
    parent_task_id,
    task_type,
    display_order
) values
(1, 1, '要件整理', 'Mina', date '2026-05-01', date '2026-05-04', 100, 'DONE', null, 'TASK', 1),
(2, 1, '画面設計', 'Ren', date '2026-05-03', date '2026-05-08', 72, 'IN_PROGRESS', null, 'TASK', 2),
(3, 1, 'API 実装', 'Kai', date '2026-05-06', date '2026-05-13', 48, 'IN_PROGRESS', null, 'TASK', 3),
(4, 1, 'フロント実装', 'Aoi', date '2026-05-07', date '2026-05-15', 36, 'IN_PROGRESS', null, 'TASK', 4),
(5, 1, '受け入れテスト', 'Sora', date '2026-05-16', date '2026-05-20', 0, 'TODO', null, 'TASK', 5),
(6, 1, 'マイルストーン 1', '未設定', date '2026-05-06', date '2026-05-06', 0, 'TODO', null, 'MILESTONE', 0);

insert into dependencies (project_id, from_task_id, to_task_id) values
(1, 1, 2),
(1, 2, 3),
(1, 2, 4),
(1, 3, 5),
(1, 4, 5);

insert into holidays (project_id, date, name) values
(0, date '2026-01-01', '元日'),
(0, date '2026-01-12', '成人の日'),
(0, date '2026-02-11', '建国記念の日'),
(0, date '2026-02-23', '天皇誕生日'),
(0, date '2026-03-20', '春分の日'),
(0, date '2026-04-29', '昭和の日'),
(0, date '2026-05-03', '憲法記念日'),
(0, date '2026-05-04', 'みどりの日'),
(0, date '2026-05-05', 'こどもの日'),
(0, date '2026-05-06', '振替休日'),
(0, date '2026-07-20', '海の日'),
(0, date '2026-08-11', '山の日'),
(0, date '2026-09-21', '敬老の日'),
(0, date '2026-09-22', '国民の休日'),
(0, date '2026-09-23', '秋分の日'),
(0, date '2026-10-12', 'スポーツの日'),
(0, date '2026-11-03', '文化の日'),
(0, date '2026-11-23', '勤労感謝の日');
