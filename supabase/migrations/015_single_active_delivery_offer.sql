with ranked_offers as (
  select
    id,
    row_number() over (
      partition by delivery_id
      order by offered_at asc nulls last, updated_at asc, created_at asc
    ) as offer_rank
  from public.delivery_queue
  where status = 'offered'
)
update public.delivery_queue
set
  status = 'expired',
  answered_at = coalesce(answered_at, now())
where id in (
  select id
  from ranked_offers
  where offer_rank > 1
);

create unique index if not exists delivery_queue_one_offered_per_delivery_idx
  on public.delivery_queue(delivery_id)
  where status = 'offered';
