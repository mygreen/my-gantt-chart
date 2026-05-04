alter table project_settings add column if not exists version integer;

update project_settings
set version = 1
where version is null;

alter table project_settings alter column version set not null;
