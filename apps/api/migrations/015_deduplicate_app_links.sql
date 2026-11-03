WITH ranked_links AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(btrim(name)), btrim(url)
           ORDER BY sort_order, id
         ) AS duplicate_number
  FROM app_links
)
DELETE FROM app_links AS link
USING ranked_links
WHERE link.id = ranked_links.id
  AND ranked_links.duplicate_number > 1;
