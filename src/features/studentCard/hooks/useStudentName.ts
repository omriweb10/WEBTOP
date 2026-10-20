/** The signed-in student's full name, as shown on the Student Card. */
import { useProfileStore } from '../../../store/dataStores';

/**
 * In account mode the profile store holds the student's Supabase profile (display name),
 * loaded with their account bundle and cleared on sign-out; in local mode it is the name
 * set in the edit tools. Empty when no name is known.
 */
export function useStudentName(): string {
  return useProfileStore((state) => state.value.studentName).trim();
}
