insert into public.system_settings (key, value)
values ('delivery_accept_timeout', jsonb_build_object('seconds', 60))
on conflict (key) do update
set value = excluded.value;

create index if not exists delivery_queue_delivery_status_offered_idx
  on public.delivery_queue(delivery_id, status, offered_at);
