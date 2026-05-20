-- Broader notification preference controls beyond thread alerts.
ALTER TABLE "NotificationPreference"
  ADD COLUMN "taskAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "announcementAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "scheduleAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "stockAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "incidentAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "suggestionResponses" BOOLEAN NOT NULL DEFAULT true;
