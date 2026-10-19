/** Row shapes returned by the admin API (tables, views and RPCs; see supabase/migrations). */
import type { DayId, Period } from '../../../schemas/timetable';

export type AccountStatus = 'active' | 'disabled';

export interface UserOverview {
  id: string;
  display_name: string;
  class_name: string;
  school_name: string;
  bio: string;
  avatar_path: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
  code_id: string | null;
  code_hint: string | null;
  strength_bits: number | null;
  code_created_at: string | null;
  code_last_used_at: string | null;
  session_id: string | null;
  session_status: 'active' | null;
  session_started_at: string | null;
  session_last_seen_at: string | null;
  session_device: string | null;
  source_template_id: string | null;
  timetable_customized: boolean | null;
}

export type SessionEndReason = 'logout' | 'admin_disconnect' | 'code_revoked' | 'account_disabled' | 'account_deleted' | 'login_aborted';

export interface SessionOverview {
  id: string;
  profile_id: string;
  display_name: string;
  class_name: string;
  avatar_path: string | null;
  profile_status: AccountStatus;
  status: 'pending' | 'active' | 'ended';
  device_label: string;
  created_at: string;
  activated_at: string | null;
  last_seen_at: string | null;
  ended_at: string | null;
  end_reason: SessionEndReason | null;
  access_code_id: string;
  code_hint: string;
  code_status: 'active' | 'revoked';
}

/** A subject preset with its usage (admin_preset_overview). */
export interface PresetRow {
  id: string;
  /** The student who owns it; null = the admin-only library used by templates. */
  profile_id: string | null;
  /** The library preset it was copied from (provenance only). */
  library_preset_id: string | null;
  name: string;
  short_name: string;
  teacher: string;
  room: string;
  color: string;
  notes: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Lessons in the owner's timetable that use it. */
  lesson_count: number;
  /** Template cells that use it (library presets only). */
  template_lesson_count: number;
}

export type PresetFields = Pick<PresetRow, 'name' | 'short_name' | 'teacher' | 'room' | 'color' | 'notes'>;

export interface LessonRow {
  day: DayId;
  period_index: number;
  preset_id: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  periods: Period[];
  created_at: string;
  updated_at: string;
  lesson_count: number;
}

export interface UserTimetable {
  periods: Period[];
  customized: boolean;
  source_template_id: string | null;
  lessons: LessonRow[];
}

export interface ProfileFields {
  display_name: string;
  class_name: string;
  school_name: string;
  bio: string;
}

export interface EventRow {
  id: string;
  profile_id: string | null;
  kind: 'exam' | 'event';
  title: string;
  date: string;
  time: string | null;
  group_name: string;
  notes: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  profile_id: string | null;
  category: 'general' | 'change';
  title: string;
  body: string;
  date: string | null;
  created_at: string;
}

/** The access code as shown once, right after it was issued. */
export interface IssuedCode {
  code: string;
  hint: string;
  strength_bits: number;
  created_at: string;
}
