insert into holidays (project_id, date, name)
select
    0,
    h.date,
    h.name
from holidays h
where h.project_id = 1
  and h.date in (
    date '2026-01-01',
    date '2026-01-12',
    date '2026-02-11',
    date '2026-02-23',
    date '2026-03-20',
    date '2026-04-29',
    date '2026-05-03',
    date '2026-05-04',
    date '2026-05-05',
    date '2026-05-06',
    date '2026-07-20',
    date '2026-08-11',
    date '2026-09-21',
    date '2026-09-22',
    date '2026-09-23',
    date '2026-10-12',
    date '2026-11-03',
    date '2026-11-23'
  )
  and not exists (
    select 1
    from holidays system_h
    where system_h.project_id = 0
      and system_h.date = h.date
  );

delete from holidays
where project_id = 1
  and date in (
    date '2026-01-01',
    date '2026-01-12',
    date '2026-02-11',
    date '2026-02-23',
    date '2026-03-20',
    date '2026-04-29',
    date '2026-05-03',
    date '2026-05-04',
    date '2026-05-05',
    date '2026-05-06',
    date '2026-07-20',
    date '2026-08-11',
    date '2026-09-21',
    date '2026-09-22',
    date '2026-09-23',
    date '2026-10-12',
    date '2026-11-03',
    date '2026-11-23'
  );
