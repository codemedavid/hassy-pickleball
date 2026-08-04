-- Domain enums. Values mirror the labels used in the Claude Design screens.

create type court_environment as enum ('indoor', 'outdoor');

create type booking_status as enum (
  'pending',
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'completed'
);

create type payment_method as enum ('cash', 'card', 'bank_transfer', 'gcash', 'online');

create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');

create type block_kind as enum ('maintenance', 'league', 'private', 'closed');

create type product_type as enum ('addon', 'cafe');

create type customer_tier as enum ('standard', 'regular', 'pro');

create type staff_role as enum ('admin', 'staff');

-- How a pricing rule transforms the court's base price.
create type rate_kind as enum ('fixed', 'amount_delta', 'percent_delta');
