-- Rename the demo club to the real venue name. The admin console header reads
-- clubs.name, so this is the only place the name needs to change.
update clubs
  set name = 'HASSY PICKLEBALL COURT'
  where name = 'Baseline Pickleball Club';
