-- Current PSG work for the week board. Paste after 005. Safe to re-run.
-- Northcliffe / Conserve units are the Sep 29 list plus the Sep 29–Oct 2 refresh,
-- plus open follow-ups from the 30-day audit.
-- Skips the giveaway that is not a work order, and skips the terminated capital-group properties.
-- 001 sample rows (address contains "(SAMPLE)") are archived so they leave the active board.
-- Board day is scheduled_on. created_at is set to noon America/New_York on that day
-- only on the first insert, so an older app that groups by created_at still lands
-- on the same columns. Re-runs refresh title, status, schedule, and invoice label
-- and replace notes that start with "Seed:". Notes you add in the app stay.

update public.jobs
set archived_at = coalesce(archived_at, timestamptz '2026-10-02 12:00:00-04')
where property_address ilike '%(SAMPLE)%'
  and archived_at is null;

insert into public.jobs (
  seed_key,
  title,
  property_address,
  status,
  scheduled_on,
  invoice_ref,
  created_at
)
values
  (
    'nc-101',
    'NC Unit 101 — seal pipe holes',
    'Northcliffe Forest Apartments Unit 101, Winston-Salem, NC',
    'in_progress',
    date '2026-09-28',
    '2026280 / 2026281',
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'nc-106',
    'NC Unit 106 — caulk + cabinets',
    'Northcliffe Forest Apartments Unit 106, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-115',
    'NC Unit 115 — paint + cabinets',
    'Northcliffe Forest Apartments Unit 115, Winston-Salem, NC',
    'in_progress',
    date '2026-09-29',
    '2026280 / 2026281',
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'nc-204',
    'NC Unit 204 — cabinet bottoms + paint',
    'Northcliffe Forest Apartments Unit 204, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026280 / 2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-315',
    'NC Unit 315 — photos only',
    'Northcliffe Forest Apartments Unit 315, Winston-Salem, NC',
    'in_progress',
    date '2026-09-29',
    '2026280 / 2026281',
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'nc-414',
    'NC Unit 414 — sheetrock ceiling + paint',
    'Northcliffe Forest Apartments Unit 414, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026280 / 2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-517',
    'NC Unit 517 — paint + under-cabinet',
    'Northcliffe Forest Apartments Unit 517, Winston-Salem, NC',
    'in_progress',
    date '2026-09-28',
    '2026280 / 2026281',
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'nc-601',
    'NC Unit 601 — ceiling fan + paint',
    'Northcliffe Forest Apartments Unit 601, Winston-Salem, NC',
    'in_progress',
    date '2026-10-01',
    '2026280 / 2026281',
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'nc-708',
    'NC Unit 708 — paint',
    'Northcliffe Forest Apartments Unit 708, Winston-Salem, NC',
    'done',
    date '2026-09-15',
    '2026280 / 2026281',
    timestamptz '2026-09-15 12:00:00-04'
  ),
  (
    'nc-716',
    'NC Unit 716 — photos only',
    'Northcliffe Forest Apartments Unit 716, Winston-Salem, NC',
    'in_progress',
    date '2026-09-29',
    '2026280 / 2026281',
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'nc-811',
    'NC Unit 811 — cabinets + paint',
    'Northcliffe Forest Apartments Unit 811, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026280 / 2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-816',
    'NC Unit 816 — sheetrock + cabinets + paint',
    'Northcliffe Forest Apartments Unit 816, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026280 / 2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-820',
    'NC Unit 820 — cabinets + full paint',
    'Northcliffe Forest Apartments Unit 820, Winston-Salem, NC',
    'in_progress',
    date '2026-09-30',
    '2026280 / 2026281',
    timestamptz '2026-09-30 12:00:00-04'
  ),
  (
    'nc-912',
    'NC Unit 912 — interior paint',
    'Northcliffe Forest Apartments Unit 912, Winston-Salem, NC',
    'done',
    date '2026-09-14',
    null,
    timestamptz '2026-09-14 12:00:00-04'
  ),
  (
    'nc-1008',
    'NC Unit 1008 — cabinet door + paint touchup',
    'Northcliffe Forest Apartments Unit 1008, Winston-Salem, NC',
    'in_progress',
    date '2026-10-01',
    '2026280',
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'nc-1019',
    'NC Unit 1019 — cabinets + vents',
    'Northcliffe Forest Apartments Unit 1019, Winston-Salem, NC',
    'open',
    date '2026-10-02',
    '2026280 / 2026281',
    timestamptz '2026-10-02 12:00:00-04'
  ),
  (
    'nc-1103',
    'NC Unit 1103 — paint + vinyl',
    'Northcliffe Forest Apartments Unit 1103, Winston-Salem, NC',
    'in_progress',
    date '2026-10-01',
    '2026280 / 2026281',
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'nc-1306',
    'NC Unit 1306 — paint + cabinets',
    'Northcliffe Forest Apartments Unit 1306, Winston-Salem, NC',
    'open',
    date '2026-10-02',
    null,
    timestamptz '2026-10-02 12:00:00-04'
  ),
  (
    'nc-1313',
    'NC Unit 1313 — 1BR paint + under-cabinet',
    'Northcliffe Forest Apartments Unit 1313, Winston-Salem, NC',
    'in_progress',
    date '2026-09-28',
    '2026280 / 2026281',
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'nc-1404',
    'NC Unit 1404 — paint + cabinets',
    'Northcliffe Forest Apartments Unit 1404, Winston-Salem, NC',
    'open',
    date '2026-10-02',
    null,
    timestamptz '2026-10-02 12:00:00-04'
  ),
  (
    'nc-1407',
    'NC Unit 1407 — drywall',
    'Northcliffe Forest Apartments Unit 1407, Winston-Salem, NC',
    'in_progress',
    date '2026-10-01',
    '2026280 / 2026281',
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'nc-1410',
    'NC Unit 1410 — photos only',
    'Northcliffe Forest Apartments Unit 1410, Winston-Salem, NC',
    'in_progress',
    date '2026-09-29',
    '2026280 / 2026281',
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'nc-1503',
    'NC Unit 1503 — make-ready',
    'Northcliffe Forest Apartments Unit 1503, Winston-Salem, NC',
    'in_progress',
    date '2026-09-28',
    null,
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'nc-1504',
    'NC Unit 1504 — cabinet bottom + paint',
    'Northcliffe Forest Apartments Unit 1504, Winston-Salem, NC',
    'in_progress',
    date '2026-09-28',
    null,
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'nc-1506',
    'NC Unit 1506 — touchup paint',
    'Northcliffe Forest Apartments Unit 1506, Winston-Salem, NC',
    'in_progress',
    date '2026-09-29',
    null,
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'nc-1511',
    'NC Unit 1511 — paint + sheetrock',
    'Northcliffe Forest Apartments Unit 1511, Winston-Salem, NC',
    'in_progress',
    date '2026-10-01',
    null,
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'nc-1513',
    'NC Unit 1513 — occupied paint',
    'Northcliffe Forest Apartments Unit 1513, Winston-Salem, NC',
    'in_progress',
    date '2026-10-02',
    '2026280 / 2026281',
    timestamptz '2026-10-02 12:00:00-04'
  ),
  (
    'nc-walk-2026-10-02',
    'NC — verify units called complete',
    'Northcliffe Forest Apartments, Winston-Salem, NC',
    'open',
    date '2026-10-02',
    null,
    timestamptz '2026-10-02 12:00:00-04'
  ),
  (
    'audit-wachovia-322',
    'Wachovia 322 — pull-cord lights',
    'Wachovia House, Unit 322',
    'in_progress',
    date '2026-09-28',
    null,
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'audit-cgc-1612',
    'CGC 1612 — double door + lock',
    '1600 N Main Street, Unit 1612, High Point, NC',
    'open',
    date '2026-09-28',
    null,
    timestamptz '2026-09-28 12:00:00-04'
  ),
  (
    'audit-aster-1421',
    'Aster 1421 — plumbing under tub',
    'Aster Park, Unit 1421',
    'in_progress',
    date '2026-09-29',
    null,
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'audit-mitch-sites',
    'CMC — confirm Mitch site work',
    'Thorntons 304 / Holly Court / Arbor Oaks',
    'open',
    date '2026-09-29',
    null,
    timestamptz '2026-09-29 12:00:00-04'
  ),
  (
    'audit-azalea-211-98',
    'Azalea 211 and 98 — patio doors',
    'Azalea Terrace',
    'open',
    date '2026-10-01',
    null,
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'audit-leigh-capistrano',
    'Leigh House — tile shower',
    'Leigh House, 222 Capistrano',
    'in_progress',
    date '2026-10-01',
    null,
    timestamptz '2026-10-01 12:00:00-04'
  ),
  (
    'audit-solano',
    'Solano — roof leak',
    'Solano, Mooresville, NC',
    'in_progress',
    date '2026-10-02',
    null,
    timestamptz '2026-10-02 12:00:00-04'
  )
on conflict (seed_key) do update set
  title = excluded.title,
  property_address = excluded.property_address,
  status = excluded.status,
  scheduled_on = excluded.scheduled_on,
  invoice_ref = excluded.invoice_ref;

delete from public.job_notes
where body like 'Seed:%'
  and job_id in (select id from public.jobs where seed_key is not null);

insert into public.job_notes (job_id, body)
select j.id, v.body
from (
  values
    (
      'nc-101',
      $seed$Seed: Seal pipe holes under the kitchen and bath sinks. AppWork oven and drywall notices are preliminary, not a PO. Photos Sep 24. On unpaid Sep 30 invoices 2026280 ($5,395 NET30) and/or 2026281 ($4,000 due upon receipt) to tanya@conserveholdings.com. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-106',
      $seed$Seed: Caulk and repair cabinets $175 on invoice 2026281. Paid $0 on the PDF at send. No finish text after Sep 29, so the job stays in progress.$seed$
    ),
    (
      'nc-115',
      $seed$Seed: Make-ready paint and cabinets. Carpet is being replaced (vendor); vinyl stays. Group said the unit was ready Sep 22. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-204',
      $seed$Seed: Cabinet bottoms $150 and paint touchup $250. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-315',
      $seed$Seed: Site photos Sep 24 only. Scope was not in the message text. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. Confirm scope before treating the invoice as the full job.$seed$
    ),
    (
      'nc-414',
      $seed$Seed: Sheetrock ceiling $95 and paint. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29, so the job stays in progress.$seed$
    ),
    (
      'nc-517',
      $seed$Seed: Paint and repair under the kitchen and bath cabinets. Still to do as of Sep 3; photos that day; no later finish note. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-601',
      $seed$Seed: Ceiling fan (Jazmin). Invoice 2026281 caulk/trim $190 and vinyl/door/mold $345. Invoice 2026280 paint $375 and $95. In progress. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-708',
      $seed$Seed: Paint confirmed done Sep 15. Cabinet bottom from the Sep 1 list was not reconfirmed. Also on unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. Kept as done for the paint.$seed$
    ),
    (
      'nc-716',
      $seed$Seed: Site photos Sep 24 only. Scope was not in the message text. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-811',
      $seed$Seed: Cabinets $150. Paint walls, ceilings, and cabinets. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-816',
      $seed$Seed: Sheetrock and cabinets $250. Paint touchup $275. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-820',
      $seed$Seed: Cabinets $150 and a full paint package. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-912',
      $seed$Seed: Interior paint done Sep 14. Unit was ready for flooring (handoff). Not listed on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1008',
      $seed$Seed: Bathroom cabinet door $75. Invoice 2026280 paint touchup $275. In progress. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-1019',
      $seed$Seed: Planned. Kitchen cabinet gap at the ceiling and vent issues. Scheduled around Sep 25. No done confirmation. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-1103',
      $seed$Seed: Priority 2BR turn. Paint and vinyl. One-spot vinyl touchup still open as of Sep 22. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-1306',
      $seed$Seed: Planned walk list Sep 17–18. Paint the unit and check cabinets / the gap at the top. No done confirmation. Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1313',
      $seed$Seed: 1BR paint and repair under the bath cabinet. Sep 3 photo reply was not an explicit finished. AppWork make-ready paint is preliminary. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-1404',
      $seed$Seed: Planned walk list Sep 17–18. Paint the unit and see if cabinets need work. No done confirmation. Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1407',
      $seed$Seed: Latest written scope is drywall Sep 22. Earlier laundry pipe: do not turn the water on until it is fixed. AppWork paint notice is preliminary. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-1410',
      $seed$Seed: New Sep 29. Photos in the Northcliffe group. Scope was not in the message text. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send.$seed$
    ),
    (
      'nc-1503',
      $seed$Seed: Make-ready. Paint, kitchen cabinet bottom at the sink, wall damage, crooked kitchen cabinets, small vinyl repair. Carpet replacement is the vendor. Crooked cabinets were still on the Sep 18 list. Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1504',
      $seed$Seed: Replace the kitchen cabinet bottom and paint touchup. Check the cabinet gap at the top (Sep 18). Carpet staying. Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1506',
      $seed$Seed: Touchup paint. Cover the carpet (it is getting cleaned). Check the kitchen cabinet gap at the top (Sep 18). Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1511',
      $seed$Seed: Paint and sheetrock water-damage repairs quoted at $265. Cabinets were on the Sep 18 schedule. Not named on Sep 30 invoices 2026280 or 2026281.$seed$
    ),
    (
      'nc-1513',
      $seed$Seed: Living-room ceiling collapse was finished Sep 1. Occupied paint after the flood was still open Sep 22. On unpaid Sep 30 invoices 2026280 and/or 2026281. Paid $0 on the PDF at send. No finish text after Sep 29.$seed$
    ),
    (
      'nc-walk-2026-10-02',
      $seed$Seed: Oct 2, 2026 Rob to Adan — walk the units called totally completed at Northcliffe. Verification is still open. This is not a unit work order.$seed$
    ),
    (
      'audit-wachovia-322',
      $seed$Seed: CMC / Wachovia unit 322. Pull-cord lights in the bath and bedroom before an inspection (Sep 25). To invoice or confirm. This is after invoice 2026269, not that sidewalk and closet-door job.$seed$
    ),
    (
      'audit-cgc-1612',
      $seed$Seed: Nick / CGC at 1600 N Main Street, High Point. Double-door adjust, cable lock, and banners (Sep 18 notes). Confirm — not on invoice 2026273. Door codes from chat are not stored here.$seed$
    ),
    (
      'audit-aster-1421',
      $seed$Seed: CMC / Aster Park unit 1421. Plumbing under the tub, delayed Sep 24–25 for the resident. To invoice or confirm. Not on invoice 2026275 (that invoice was unit 1423).$seed$
    ),
    (
      'audit-mitch-sites',
      $seed$Seed: Confirm, then invoice. Named sites only: Thorntons 304 trash-out, Holly Court clean, Thorntons flashing, Arbor Oaks bath floor (Sep 10 email).$seed$
    ),
    (
      'audit-azalea-211-98',
      $seed$Seed: CMC / Azalea Terrace units 211 and 98. Patio doors. Left-hand / right-hand photos were requested Sep 21. Confirm which are done. Not on invoice 2026277 (that invoice was unit 107).$seed$
    ),
    (
      'audit-leigh-capistrano',
      $seed$Seed: Leigh House, 222 Capistrano. Tile shower, plumbing, and grout (Sep 16–18). To invoice or confirm. No Bill.com invoice in the Aug 30–Sep 29 window.$seed$
    ),
    (
      'audit-solano',
      $seed$Seed: Solano, Mooresville. Roof leak, dry the carpet, fans, and ceiling tiles (Sep 23; still on the Sep 29 plan). Invoice when the job is closed.$seed$
    )
) as v(seed_key, body)
join public.jobs j on j.seed_key = v.seed_key;
