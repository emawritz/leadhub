CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"nombre" text,
	"rol" text DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"filtros" jsonb,
	"cantidad" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" text NOT NULL,
	"razon_social" text NOT NULL,
	"nombre_fantasia" text NOT NULL,
	"telefono" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"cuit" text DEFAULT '' NOT NULL,
	"sitio_web" text DEFAULT '' NOT NULL,
	"direccion" text DEFAULT '' NOT NULL,
	"localidad" text DEFAULT '' NOT NULL,
	"provincia" text DEFAULT '' NOT NULL,
	"categoria" text DEFAULT '' NOT NULL,
	"calificacion_google" text DEFAULT '' NOT NULL,
	"cantidad_resenas" integer DEFAULT 0 NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"facebook" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"coordenadas" text DEFAULT '' NOT NULL,
	"fuente" text NOT NULL,
	"fecha_extraccion" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_email" boolean GENERATED ALWAYS AS (email <> '') STORED;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_telefono" boolean GENERATED ALWAYS AS (telefono <> '') STORED;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_whatsapp" boolean GENERATED ALWAYS AS (whatsapp <> '') STORED;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_web" boolean GENERATED ALWAYS AS (sitio_web <> '') STORED;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_cuit" boolean GENERATED ALWAYS AS (cuit <> '') STORED;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(nombre_fantasia,'') || ' ' || coalesce(categoria,''))) STORED;
--> statement-breakpoint
CREATE INDEX "leads_provincia_idx" ON "leads" ("provincia");
--> statement-breakpoint
CREATE INDEX "leads_localidad_idx" ON "leads" ("localidad");
--> statement-breakpoint
CREATE INDEX "leads_categoria_idx" ON "leads" ("categoria");
--> statement-breakpoint
CREATE INDEX "leads_fuente_idx" ON "leads" ("fuente");
--> statement-breakpoint
CREATE INDEX "leads_has_email_idx" ON "leads" ("has_email");
--> statement-breakpoint
CREATE INDEX "leads_search_idx" ON "leads" USING GIN ("search_tsv");
