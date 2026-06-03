CREATE POLICY "Authenticated users can update books"
ON books FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);
