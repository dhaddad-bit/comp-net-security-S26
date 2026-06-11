-- Security audit trail for authentication, token, and authorization events.
-- Written by backend/services/audit_log.js via dbInterface.insertSecurityAudit.
-- The detail column is structured JSON and MUST NOT contain tokens, auth codes,
-- or any other secret material. No hard FK to person so the trail survives a
-- user deletion.
BEGIN;

CREATE TABLE IF NOT EXISTS public.security_audit_log
(
    id          bigserial   NOT NULL,
    event_type  varchar(64) NOT NULL,
    outcome     varchar(16) NOT NULL,        -- SUCCESS | FAILURE | DENIED
    user_id     bigint,                      -- nullable; no FK by design
    ip          varchar(64),
    user_agent  text,
    detail      jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT security_audit_log_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user
    ON public.security_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_type_time
    ON public.security_audit_log(event_type, created_at);

COMMIT;
