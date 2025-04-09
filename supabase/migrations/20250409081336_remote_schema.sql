

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Beispielhafte Logik zum Einfügen eines neuen Benutzers in public.users
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_training_data"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_session record;
    new_plan_id integer;
    new_session_id integer;
    exercise_entry_id integer;
BEGIN
    FOR old_session IN SELECT DISTINCT user_id FROM session_logs LOOP
        INSERT INTO user_plans (user_id, name, description, status)
        VALUES (old_session.user_id, 'Migrated Plan', 'Automatically migrated from previous data', 'active')
        RETURNING id INTO new_plan_id;

        FOR old_session IN SELECT * FROM session_logs WHERE user_id = old_session.user_id LOOP
            INSERT INTO user_sessions (user_id, plan_id, name, status, scheduled_date, completed_date, notes)
            VALUES (old_session.user_id, new_plan_id, COALESCE(old_session.session_name, 'Session ' || old_session.id),
                CASE WHEN old_session.status = 'finished' THEN 'completed' WHEN old_session.status = 'started' THEN 'in_progress' WHEN old_session.status = 'next' THEN 'planned' WHEN old_session.status = 'skipped' THEN 'skipped' ELSE 'planned' END,
                old_session.session_date, CASE WHEN old_session.status = 'finished' THEN old_session.session_date ELSE NULL END, old_session.session_notes)
            RETURNING id INTO new_session_id;

            FOR old_session IN SELECT e.*, el.* FROM exercise_logs el JOIN exercises e ON el.exercise_id = e.id WHERE el.session_log_id = old_session.id LOOP
                INSERT INTO user_exercise_entries (session_id, exercise_id, exercise_order, notes)
                VALUES (new_session_id, old_session.exercise_id, 1, old_session.notes)
                RETURNING id INTO exercise_entry_id;

                INSERT INTO user_exercise_sets (exercise_entry_id, set_number, weight, reps, rpe, completed)
                VALUES (exercise_entry_id, 1, old_session.weight, old_session.reps, old_session.rpe, true);
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."migrate_training_data"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bodyweight_logs" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "weight" numeric NOT NULL,
    "log_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bodyweight_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bodyweight_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."bodyweight_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bodyweight_logs_id_seq" OWNED BY "public"."bodyweight_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "variation" "text",
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exercises_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."exercises_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exercises_id_seq" OWNED BY "public"."exercises"."id";



CREATE TABLE IF NOT EXISTS "public"."food_logs" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "log_date" "date" NOT NULL,
    "log_time" time without time zone,
    "carbs" numeric,
    "proteins" numeric,
    "fats" numeric,
    "kcal" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."food_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."food_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."food_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."food_logs_id_seq" OWNED BY "public"."food_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."user_assistant_memories" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "memory_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."user_assistant_memories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_assistant_memories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_assistant_memories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_assistant_memories_id_seq" OWNED BY "public"."user_assistant_memories"."id";



CREATE TABLE IF NOT EXISTS "public"."user_exercise_entries" (
    "id" integer NOT NULL,
    "session_id" integer,
    "exercise_id" integer,
    "exercise_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "instructions" "text",
    "target_sets" integer,
    "target_reps" "text",
    "target_rpe" numeric,
    "target_weight" "text",
    "notes" "text"
);


ALTER TABLE "public"."user_exercise_entries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_exercise_entries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_exercise_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_exercise_entries_id_seq" OWNED BY "public"."user_exercise_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."user_exercise_sets" (
    "id" integer NOT NULL,
    "exercise_entry_id" integer,
    "set_number" integer NOT NULL,
    "weight" numeric,
    "reps" integer,
    "rpe" numeric,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."user_exercise_sets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_exercise_sets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_exercise_sets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_exercise_sets_id_seq" OWNED BY "public"."user_exercise_sets"."id";



CREATE TABLE IF NOT EXISTS "public"."user_plan_weeks" (
    "id" integer NOT NULL,
    "plan_id" integer,
    "week_number" integer NOT NULL,
    "focus" "text",
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_plan_weeks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_plan_weeks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_plan_weeks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_plan_weeks_id_seq" OWNED BY "public"."user_plan_weeks"."id";



CREATE TABLE IF NOT EXISTS "public"."user_plans" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "goal" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "source" "text" DEFAULT 'assistant'::"text",
    "metadata" "jsonb"
);


ALTER TABLE "public"."user_plans" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_plans_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_plans_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_plans_id_seq" OWNED BY "public"."user_plans"."id";



CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "plan_id" integer,
    "plan_week_id" integer,
    "name" "text" NOT NULL,
    "type" "text",
    "scheduled_date" "date",
    "completed_date" "date",
    "status" "text" DEFAULT 'planned'::"text",
    "readiness_score" integer,
    "instructions" "text",
    "session_order" integer,
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    CONSTRAINT "user_sessions_readiness_score_check" CHECK ((("readiness_score" >= 1) AND ("readiness_score" <= 10)))
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_sessions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."user_sessions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_sessions_id_seq" OWNED BY "public"."user_sessions"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preferred_ai_model" "text" DEFAULT 'gpt-4o-mini'::"text",
    CONSTRAINT "check_preferred_ai_model" CHECK (("preferred_ai_model" = ANY (ARRAY['gpt-4o-mini'::"text", 'gpt-4o'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bodyweight_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bodyweight_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exercises" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exercises_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."food_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."food_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_assistant_memories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_assistant_memories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_exercise_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_exercise_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_exercise_sets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_exercise_sets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_plan_weeks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_plan_weeks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_plans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bodyweight_logs"
    ADD CONSTRAINT "bodyweight_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_assistant_memories"
    ADD CONSTRAINT "user_assistant_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_exercise_entries"
    ADD CONSTRAINT "user_exercise_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_exercise_sets"
    ADD CONSTRAINT "user_exercise_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_plan_weeks"
    ADD CONSTRAINT "user_plan_weeks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_plans"
    ADD CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bodyweight_logs"
    ADD CONSTRAINT "bodyweight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_logs"
    ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_assistant_memories"
    ADD CONSTRAINT "user_assistant_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exercise_entries"
    ADD CONSTRAINT "user_exercise_entries_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_exercise_entries"
    ADD CONSTRAINT "user_exercise_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exercise_sets"
    ADD CONSTRAINT "user_exercise_sets_exercise_entry_id_fkey" FOREIGN KEY ("exercise_entry_id") REFERENCES "public"."user_exercise_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_plan_weeks"
    ADD CONSTRAINT "user_plan_weeks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."user_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_plans"
    ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."user_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_plan_week_id_fkey" FOREIGN KEY ("plan_week_id") REFERENCES "public"."user_plan_weeks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."user_assistant_memories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_assistant_memories_policy" ON "public"."user_assistant_memories" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_exercise_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_exercise_entries_policy" ON "public"."user_exercise_entries" USING (("session_id" IN ( SELECT "user_sessions"."id"
   FROM "public"."user_sessions"
  WHERE ("user_sessions"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_exercise_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_exercise_sets_policy" ON "public"."user_exercise_sets" USING (("exercise_entry_id" IN ( SELECT "user_exercise_entries"."id"
   FROM "public"."user_exercise_entries"
  WHERE ("user_exercise_entries"."session_id" IN ( SELECT "user_sessions"."id"
           FROM "public"."user_sessions"
          WHERE ("user_sessions"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."user_plan_weeks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_plan_weeks_policy" ON "public"."user_plan_weeks" USING (("plan_id" IN ( SELECT "user_plans"."id"
   FROM "public"."user_plans"
  WHERE ("user_plans"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_plans_policy" ON "public"."user_plans" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sessions_policy" ON "public"."user_sessions" USING (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_training_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_training_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_training_data"() TO "service_role";


















GRANT ALL ON TABLE "public"."bodyweight_logs" TO "anon";
GRANT ALL ON TABLE "public"."bodyweight_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."bodyweight_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bodyweight_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bodyweight_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bodyweight_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_logs" TO "anon";
GRANT ALL ON TABLE "public"."food_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."food_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_assistant_memories" TO "anon";
GRANT ALL ON TABLE "public"."user_assistant_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."user_assistant_memories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_assistant_memories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_assistant_memories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_assistant_memories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_exercise_entries" TO "anon";
GRANT ALL ON TABLE "public"."user_exercise_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exercise_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_exercise_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_exercise_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_exercise_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_exercise_sets" TO "anon";
GRANT ALL ON TABLE "public"."user_exercise_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exercise_sets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_exercise_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_exercise_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_exercise_sets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_plan_weeks" TO "anon";
GRANT ALL ON TABLE "public"."user_plan_weeks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_plan_weeks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_plan_weeks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_plan_weeks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_plan_weeks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_plans" TO "anon";
GRANT ALL ON TABLE "public"."user_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."user_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_plans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_sessions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
