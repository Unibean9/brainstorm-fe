export type StoredTeacher = {
  teacherId: string;
  code: string;
  name: string;
};

const TEACHER_KEY = "brainstorm_teacher";

export function readStoredTeacher(): StoredTeacher | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTeacher;
    if (!parsed?.teacherId) return null;
    return parsed;
  } catch {
    return null;
  }
}

const CHANGE_EVENT = "brainstorm-teacher-changed";

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function writeStoredTeacher(teacher: StoredTeacher): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEACHER_KEY, JSON.stringify(teacher));
    notifyChange();
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredTeacher(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TEACHER_KEY);
    notifyChange();
  } catch {
    /* ignore */
  }
}

/** Đăng ký lắng nghe thay đổi (cùng tab qua CHANGE_EVENT, khác tab qua storage). */
export function subscribeStoredTeacher(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
