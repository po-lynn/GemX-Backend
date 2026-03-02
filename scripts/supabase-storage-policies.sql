-- Fix: "new row violates row-level security policy" when uploading to product-images / product-videos / product-certificates.
-- Run once: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Ensure .env.local has SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role secret), NOT the anon key.
-- Create buckets in Dashboard > Storage: product-images, product-videos, product-certificates (all public if you want direct links).

DROP POLICY IF EXISTS "Service role can upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload product-videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role full product-images" ON storage.objects;
DROP POLICY IF EXISTS "Service role full product-videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role full product-certificates" ON storage.objects;

-- Allow service_role full access to product-images bucket (INSERT + SELECT/UPDATE/DELETE for upload flow)
CREATE POLICY "Service role full product-images"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Allow service_role full access to product-videos bucket
CREATE POLICY "Service role full product-videos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'product-videos')
WITH CHECK (bucket_id = 'product-videos');

-- Allow service_role full access to product-certificates bucket (lab report / certificate PDFs and images)
CREATE POLICY "Service role full product-certificates"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'product-certificates')
WITH CHECK (bucket_id = 'product-certificates');
