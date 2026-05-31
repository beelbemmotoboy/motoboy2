alter table public.deliveries add column if not exists cancellation_reason text;
alter table public.deliveries add column if not exists cancellation_requested_by text;
alter table public.deliveries add column if not exists cancellation_requested_at timestamptz;
alter table public.deliveries add column if not exists cancelled_at timestamptz;
alter table public.deliveries add column if not exists cancellation_acknowledged_at timestamptz;
alter table public.deliveries add column if not exists cancellation_acknowledged_by uuid references public.couriers(id);

create index if not exists deliveries_courier_cancel_ack_idx
  on public.deliveries(courier_id, status, cancellation_acknowledged_at)
  where status = 'cancelled';
