/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  loginAsync,
  logoutAsync,
  selectAuth,
  selectUser,
  setupAutoRefresh,
} from "@/lib/redux/slices/authSlice";
import { ROLE_ADMIN, ROLE_FACILITATOR, ROLE_PARTICIPANT } from "@/lib/types/roles";

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);

  const roles = user?.role ?? [];
  const isAdmin = roles.includes(ROLE_ADMIN);
  const isFacilitator = roles.includes(ROLE_FACILITATOR);
  const isParticipant = roles.includes(ROLE_PARTICIPANT);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const result = await dispatch(loginAsync(credentials)).unwrap();

      if (result.token) setupAutoRefresh(result.token, dispatch as any);

      const userRoles = result.user?.role ?? [];
      toast.success("Đăng nhập thành công");

      if (userRoles.includes(ROLE_ADMIN)) router.push("/admin/dashboard");
      else if (userRoles.includes(ROLE_FACILITATOR)) router.push("/facilitator/dashboard");
      else router.push("/rooms");

      return result;
    } catch (error: any) {
      toast.error(error || "Đăng nhập thất bại");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await dispatch(logoutAsync()).unwrap();
      toast.success("Đăng xuất thành công");
      router.push("/login");
    } catch {
      toast.error("Có lỗi xảy ra khi đăng xuất");
    }
  };

  return {
    ...auth,
    user,
    isAdmin,
    isFacilitator,
    isParticipant,
    login,
    logout,
  };
}
