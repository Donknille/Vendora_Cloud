alter table users
alter column subscription_status set default 'trialing';

update users
set subscription_status = 'trialing'
where subscription_status is null;

update users
set revenuecat_app_user_id = supabase_id
where revenuecat_app_user_id is null
  and supabase_id is not null;

update users
set created_at = current_timestamp::text
where created_at is null;
