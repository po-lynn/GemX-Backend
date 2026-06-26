CREATE TYPE "public"."precaution_tag_applies_to" AS ENUM('certified', 'non_certified', 'both');--> statement-breakpoint
CREATE TYPE "public"."precaution_tag_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TABLE "precaution_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"severity" "precaution_tag_severity" NOT NULL,
	"applies_to" "precaution_tag_applies_to" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
