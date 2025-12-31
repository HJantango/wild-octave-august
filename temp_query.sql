SELECT 
  i.id,
  i."invoiceNumber",
  v.name as vendor_name,
  i."subtotalExGst",
  i."gstAmount",
  i."totalIncGst",
  i."createdAt"
FROM invoice i
JOIN vendor v ON i."vendorId" = v.id
WHERE v.name ILIKE '%horizon%'
ORDER BY i."createdAt" DESC
LIMIT 3;