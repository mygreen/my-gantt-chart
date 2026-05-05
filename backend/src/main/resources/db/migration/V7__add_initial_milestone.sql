insert into tasks (
    name,
    owner,
    start_date,
    end_date,
    progress,
    status,
    parent_task_id,
    task_type,
    display_order
)
select
    'マイルストーン 1',
    '未設定',
    date '2026-05-06',
    date '2026-05-06',
    0,
    'TODO',
    null,
    'MILESTONE',
    0
where not exists (
    select 1
    from tasks
    where task_type = 'MILESTONE'
);

update tasks
set display_order = display_order + 1
where task_type <> 'MILESTONE'
  and exists (
      select 1
      from tasks
      where task_type = 'MILESTONE'
        and name = 'マイルストーン 1'
  );
