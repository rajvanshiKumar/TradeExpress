"""commerce and integrations

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-03 11:30:00.000000
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. products
    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("listing_job_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("short_title", sa.String(length=150), nullable=True),
        sa.Column("brand", sa.String(length=100), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("highlights", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("seo_title", sa.String(length=150), nullable=True),
        sa.Column("seo_description", sa.String(length=300), nullable=True),
        sa.Column("seo_keywords", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=op.f("fk_products_category_id_categories"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_products_created_by_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["listing_job_id"], ["ai_listing_jobs.id"], name=op.f("fk_products_listing_job_id_ai_listing_jobs"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_products_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
    )
    op.create_index(op.f("ix_products_organization_id"), "products", ["organization_id"], unique=False)
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"], unique=False)
    op.create_index(op.f("ix_products_listing_job_id"), "products", ["listing_job_id"], unique=False)
    op.create_index(op.f("ix_products_status"), "products", ["status"], unique=False)
    op.create_index(op.f("ix_products_brand"), "products", ["brand"], unique=False)
    op.create_index(op.f("ix_products_model"), "products", ["model"], unique=False)

    # 2. product_variants
    op.create_table(
        "product_variants",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("variant_name", sa.String(length=200), nullable=False),
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("barcode", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_product_variants_organization_id_organizations"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_product_variants_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_variants")),
        sa.UniqueConstraint("organization_id", "sku", name=op.f("uq_product_variants_org_sku")),
    )
    op.create_index(op.f("ix_product_variants_organization_id"), "product_variants", ["organization_id"], unique=False)
    op.create_index(op.f("ix_product_variants_product_id"), "product_variants", ["product_id"], unique=False)
    op.create_index(op.f("ix_product_variants_barcode"), "product_variants", ["barcode"], unique=False)

    # 3. product_attribute_values
    op.create_table(
        "product_attribute_values",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("attribute_key", sa.String(length=80), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column("source", sa.String(length=20), server_default="seller", nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("verified", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_product_attribute_values_organization_id_organizations"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_product_attribute_values_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_attribute_values")),
        sa.UniqueConstraint("product_id", "attribute_key", name=op.f("uq_product_attr_key")),
    )
    op.create_index(op.f("ix_product_attribute_values_organization_id"), "product_attribute_values", ["organization_id"], unique=False)
    op.create_index(op.f("ix_product_attribute_values_product_id"), "product_attribute_values", ["product_id"], unique=False)

    # 4. product_image_mappings
    op.create_table(
        "product_image_mappings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("image_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["image_id"], ["product_images.id"], name=op.f("fk_product_image_mappings_image_id_product_images"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_product_image_mappings_organization_id_organizations"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_product_image_mappings_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_image_mappings")),
        sa.UniqueConstraint("product_id", "image_id", name=op.f("uq_product_image_mapping")),
    )
    op.create_index(op.f("ix_product_image_mappings_organization_id"), "product_image_mappings", ["organization_id"], unique=False)
    op.create_index(op.f("ix_product_image_mappings_product_id"), "product_image_mappings", ["product_id"], unique=False)

    # 5. seller_offers
    op.create_table(
        "seller_offers",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("variant_id", sa.UUID(), nullable=True),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("offer_type", sa.String(length=10), server_default="b2c", nullable=False),
        sa.Column("retail_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("wholesale_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("min_order_quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("lead_time_days", sa.Integer(), server_default="3", nullable=False),
        sa.Column("stock_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_available", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_seller_offers_organization_id_organizations"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_seller_offers_product_id_products"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], name=op.f("fk_seller_offers_variant_id_product_variants"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_seller_offers")),
    )
    op.create_index(op.f("ix_seller_offers_organization_id"), "seller_offers", ["organization_id"], unique=False)
    op.create_index(op.f("ix_seller_offers_product_id"), "seller_offers", ["product_id"], unique=False)
    op.create_index(op.f("ix_seller_offers_variant_id"), "seller_offers", ["variant_id"], unique=False)

    # 6. pricing_tiers
    op.create_table(
        "pricing_tiers",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("offer_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("min_quantity", sa.Integer(), nullable=False),
        sa.Column("max_quantity", sa.Integer(), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["offer_id"], ["seller_offers.id"], name=op.f("fk_pricing_tiers_offer_id_seller_offers"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_pricing_tiers_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pricing_tiers")),
    )
    op.create_index(op.f("ix_pricing_tiers_organization_id"), "pricing_tiers", ["organization_id"], unique=False)
    op.create_index(op.f("ix_pricing_tiers_offer_id"), "pricing_tiers", ["offer_id"], unique=False)

    # 7. markets
    op.create_table(
        "markets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("default_currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("languages", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_markets")),
        sa.UniqueConstraint("code", name=op.f("uq_markets_code")),
    )

    # 8. currencies
    op.create_table(
        "currencies",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=3), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("symbol", sa.String(length=5), nullable=False),
        sa.Column("exchange_rate_to_usd", sa.Numeric(precision=12, scale=4), server_default="1.0000", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_currencies")),
        sa.UniqueConstraint("code", name=op.f("uq_currencies_code")),
    )

    # 9. compliance_rules
    op.create_table(
        "compliance_rules",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("market_code", sa.String(length=10), nullable=False),
        sa.Column("category_slug", sa.String(length=160), nullable=True),
        sa.Column("rule_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_hard_restriction", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("required_attributes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("required_documents", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("restricted_keywords", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("effective_date", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_compliance_rules")),
    )
    op.create_index(op.f("ix_compliance_rules_market_code"), "compliance_rules", ["market_code"], unique=False)
    op.create_index(op.f("ix_compliance_rules_category_slug"), "compliance_rules", ["category_slug"], unique=False)

    # 10. compliance_results
    op.create_table(
        "compliance_results",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("job_id", sa.UUID(), nullable=True),
        sa.Column("market_code", sa.String(length=10), nullable=False),
        sa.Column("is_compliant", sa.Boolean(), nullable=False),
        sa.Column("advisories", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("violations", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["ai_listing_jobs.id"], name=op.f("fk_compliance_results_job_id_ai_listing_jobs"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_compliance_results_organization_id_organizations"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_compliance_results_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_compliance_results")),
    )
    op.create_index(op.f("ix_compliance_results_organization_id"), "compliance_results", ["organization_id"], unique=False)
    op.create_index(op.f("ix_compliance_results_product_id"), "compliance_results", ["product_id"], unique=False)
    op.create_index(op.f("ix_compliance_results_job_id"), "compliance_results", ["job_id"], unique=False)

    # 11. api_keys
    op.create_table(
        "api_keys",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("prefix", sa.String(length=16), nullable=False),
        sa.Column("scopes", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_api_keys_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_api_keys")),
        sa.UniqueConstraint("key_hash", name=op.f("uq_api_keys_key_hash")),
        sa.UniqueConstraint("organization_id", "prefix", name=op.f("uq_api_keys_org_prefix")),
    )
    op.create_index(op.f("ix_api_keys_organization_id"), "api_keys", ["organization_id"], unique=False)
    op.create_index(op.f("ix_api_keys_key_hash"), "api_keys", ["key_hash"], unique=True)

    # 12. api_idempotency_keys
    op.create_table(
        "api_idempotency_keys",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="processing", nullable=False),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_api_idempotency_keys_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_api_idempotency_keys")),
        sa.UniqueConstraint("organization_id", "key", name=op.f("uq_idempotency_org_key")),
    )
    op.create_index(op.f("ix_api_idempotency_keys_organization_id"), "api_idempotency_keys", ["organization_id"], unique=False)
    op.create_index(op.f("ix_api_idempotency_keys_key"), "api_idempotency_keys", ["key"], unique=False)

    # 13. webhook_endpoints
    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("secret", sa.String(length=100), nullable=False),
        sa.Column("events", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_webhook_endpoints_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_webhook_endpoints")),
    )
    op.create_index(op.f("ix_webhook_endpoints_organization_id"), "webhook_endpoints", ["organization_id"], unique=False)

    # 14. webhook_deliveries
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("endpoint_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=60), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["endpoint_id"], ["webhook_endpoints.id"], name=op.f("fk_webhook_deliveries_endpoint_id_webhook_endpoints"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_webhook_deliveries_organization_id_organizations"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_webhook_deliveries")),
    )
    op.create_index(op.f("ix_webhook_deliveries_organization_id"), "webhook_deliveries", ["organization_id"], unique=False)
    op.create_index(op.f("ix_webhook_deliveries_endpoint_id"), "webhook_deliveries", ["endpoint_id"], unique=False)
    op.create_index(op.f("ix_webhook_deliveries_event_type"), "webhook_deliveries", ["event_type"], unique=False)

    # RLS Policies on tenant-scoped tables
    tenant_tables = (
        "products", "product_variants", "product_attribute_values", "product_image_mappings",
        "seller_offers", "pricing_tiers", "compliance_results",
        "api_idempotency_keys", "webhook_endpoints", "webhook_deliveries"
    )
    for t in tenant_tables:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {t}_tenant ON {t} FOR ALL "
            "USING (app_is_admin() OR organization_id = app_org_id()) "
            "WITH CHECK (app_is_admin() OR organization_id = app_org_id())"
        )

    # api_keys: allow SELECT by hash, enforce tenant on writes
    op.execute("ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE api_keys FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY api_keys_select ON api_keys FOR SELECT "
        "USING (true)"
    )
    op.execute(
        "CREATE POLICY api_keys_modify ON api_keys FOR ALL "
        "USING (app_is_admin() OR organization_id = app_org_id()) "
        "WITH CHECK (app_is_admin() OR organization_id = app_org_id())"
    )


def downgrade() -> None:
    tenant_tables = (
        "webhook_deliveries", "webhook_endpoints", "api_idempotency_keys", "api_keys",
        "compliance_results", "pricing_tiers", "seller_offers", "product_image_mappings",
        "product_attribute_values", "product_variants", "products"
    )
    for t in tenant_tables:
        op.drop_table(t)
    op.drop_table("compliance_rules")
    op.drop_table("currencies")
    op.drop_table("markets")
