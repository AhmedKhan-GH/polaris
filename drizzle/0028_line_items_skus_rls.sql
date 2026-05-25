-- Tighten database-side access for SKU and order line item tables.
-- App actions still perform CASL checks; these RLS policies are the
-- database backstop for direct Supabase/PostgREST access.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    DROP POLICY IF EXISTS skus_select ON skus;
    DROP POLICY IF EXISTS skus_insert ON skus;
    DROP POLICY IF EXISTS skus_update ON skus;
    DROP POLICY IF EXISTS order_line_items_select ON order_line_items;
    DROP POLICY IF EXISTS order_line_items_insert ON order_line_items;
    DROP POLICY IF EXISTS order_line_items_update ON order_line_items;
    DROP POLICY IF EXISTS order_line_items_delete ON order_line_items;

    CREATE POLICY skus_select ON skus
      FOR SELECT TO authenticated
      USING (is_active OR current_user_role() IN ('system', 'owner', 'admin'));

    CREATE POLICY skus_insert ON skus
      FOR INSERT TO authenticated
      WITH CHECK (current_user_role() IN ('system', 'owner', 'admin'));

    CREATE POLICY skus_update ON skus
      FOR UPDATE TO authenticated
      USING (current_user_role() IN ('system', 'owner', 'admin'))
      WITH CHECK (current_user_role() IN ('system', 'owner', 'admin'));

    CREATE POLICY order_line_items_select ON order_line_items
      FOR SELECT TO authenticated
      USING (
        current_user_role() IN ('system', 'owner', 'admin', 'member')
        OR EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_line_items.order_id
            AND orders.created_by = auth.uid()
        )
      );

    CREATE POLICY order_line_items_insert ON order_line_items
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_line_items.order_id
            AND orders.status = 'drafted'
            AND (
              current_user_role() IN ('system', 'owner', 'admin', 'member')
              OR orders.created_by = auth.uid()
            )
        )
      );

    CREATE POLICY order_line_items_update ON order_line_items
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_line_items.order_id
            AND orders.status = 'drafted'
            AND (
              current_user_role() IN ('system', 'owner', 'admin', 'member')
              OR orders.created_by = auth.uid()
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_line_items.order_id
            AND orders.status = 'drafted'
            AND (
              current_user_role() IN ('system', 'owner', 'admin', 'member')
              OR orders.created_by = auth.uid()
            )
        )
      );

    CREATE POLICY order_line_items_delete ON order_line_items
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_line_items.order_id
            AND orders.status = 'drafted'
            AND (
              current_user_role() IN ('system', 'owner', 'admin', 'member')
              OR orders.created_by = auth.uid()
            )
        )
      );
  END IF;
END $$;
